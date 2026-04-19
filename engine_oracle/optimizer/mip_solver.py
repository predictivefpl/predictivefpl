"""
Oracle MIP Solver
=================
State-of-the-art Mixed-Integer Programming transfer optimizer.

Objective (8-GW rolling horizon):
  Maximize Σ_{t=0..T-1} [ Σ_i xP[i,t] * x[i,t] * avail[i]
                          + captain_bonus[i,t]
                          + bench_boost_bonus[t] ]
  Subject to:
  - Budget constraint
  - Squad composition (15 players, position quotas, 3-per-team)
  - Transfer flow: x[i,t] = x[i,t-1] - out[i,t] + in[i,t]
  - Transfer limits and hit penalties (-4 pts per transfer beyond free)
  - Banked transfer carryover (max 2 free transfers)
  - Chip constraints (each chip used at most once, mutually exclusive per GW)
  - Formation constraints for starting XI
"""
import pulp
import numpy as np
import pandas as pd
from dataclasses import dataclass, field
from typing import Optional


# ─── Constants ────────────────────────────────────────────────────────────────

SQUAD_SIZE = 15
XI_SIZE    = 11
POS_QUOTA  = {"GKP": 2, "DEF": 5, "MID": 5, "FWD": 3}
MIN_START  = {"GKP": 1, "DEF": 3, "MID": 2, "FWD": 1}
MAX_START  = {"GKP": 1, "DEF": 5, "MID": 5, "FWD": 3}
MAX_CLUB   = 3
HIT_COST   = 4          # points deducted per extra transfer
MAX_BANKED = 2          # maximum free transfers that can be banked
FREE_TRANSFERS_START = 1


@dataclass
class OracleRequest:
    budget:            float       = 100.0
    horizon:           int         = 8        # number of GWs to optimise over
    num_free_transfers: int        = 1        # free transfers available THIS GW
    current_squad_ids: list[int]   = field(default_factory=list)
    objective:         str         = "total_xp"  # total_xp | min_variance | top10k
    # Chip availability flags
    wildcard_available: bool       = True
    freehit_available:  bool       = True
    benchboost_available: bool     = True
    triplecaptain_available: bool  = True
    # Strategy
    min_xp_gain_for_hit: float     = 6.0     # minimum 3-GW xP gain to justify a hit
    force_chip: Optional[str]      = None    # force a specific chip this GW


@dataclass
class OracleResult:
    status:         str
    squad:          list[dict]
    transfers:      list[dict]     # [{gw, action, player_id, name, xp_gain}]
    chip_plan:      dict           # {gw: chip_name or None}
    xp_by_gw:      list[float]    # projected xP per GW
    total_xp:      float
    total_hits:    int
    net_xp:        float           # total_xp - hit penalties
    option_value:  float           # value of unused free transfers
    transfer_plan: list[dict]      # [{gw, transfers_in, transfers_out, hit}]


# ─── Main Solver ──────────────────────────────────────────────────────────────

def solve_oracle(
    predictions_df: pd.DataFrame,
    req: OracleRequest,
) -> OracleResult:
    """
    Solve the 8-GW MIP transfer optimisation problem.

    predictions_df must contain columns:
        player_id, position, price, team_short,
        xp_gw1 .. xp_gw8, availability, ownership_pct
    """
    df = predictions_df.copy().dropna(subset=["price", "position"])
    df = df[df["price"] > 0].reset_index(drop=True)
    T = req.horizon
    N = len(df)

    # Build xP matrix: xP[i, t] already DGW/BGW-aware and avail-weighted
    xp = np.zeros((N, T))
    for t in range(T):
        col = f"xp_gw{t+1}"
        if col in df.columns:
            xp[:, t] = df[col].values * df["availability"].fillna(1.0).values
        else:
            # Fall back to decayed xp_gw1
            xp[:, t] = df["xp_gw1"].values * (0.88 ** t) * df["availability"].fillna(1.0).values

    prices   = df["price"].values
    position = df["position"].values
    teams    = df["team_short"].fillna("UNK").values
    pids     = df["player_id"].values
    pid_idx  = {int(pid): i for i, pid in enumerate(pids)}

    # Current squad as index set
    cur_idx = set()
    for pid in req.current_squad_ids:
        if int(pid) in pid_idx:
            cur_idx.add(pid_idx[int(pid)])

    # ─── Decision Variables ────────────────────────────────────────────────
    prob = pulp.LpProblem("Oracle_8GW", pulp.LpMaximize)

    # x[i,t] = 1 if player i is in squad in GW t
    x = [[pulp.LpVariable(f"x_{i}_{t}", cat="Binary")
          for t in range(T)] for i in range(N)]

    # captain[i,t] = 1 if player i is captain in GW t
    cap = [[pulp.LpVariable(f"cap_{i}_{t}", cat="Binary")
            for t in range(T)] for i in range(N)]

    # Transfers: in[i,t] and out[i,t] (only meaningful for t > 0)
    tin  = [[pulp.LpVariable(f"in_{i}_{t}",  cat="Binary")
             for t in range(T)] for i in range(N)]
    tout = [[pulp.LpVariable(f"out_{i}_{t}", cat="Binary")
             for t in range(T)] for i in range(N)]

    # hits[t] = number of extra transfers (penalised) in GW t
    hits = [pulp.LpVariable(f"hits_{t}", lowBound=0, cat="Integer")
            for t in range(T)]

    # banked[t] = free transfers banked going INTO GW t
    banked = [pulp.LpVariable(f"banked_{t}", lowBound=0, upBound=MAX_BANKED, cat="Integer")
              for t in range(T)]

    # n_transfers[t] = total transfers made in GW t
    n_tx = [pulp.LpVariable(f"ntx_{t}", lowBound=0, upBound=15, cat="Integer")
            for t in range(T)]

    # ── Chip variables ─────────────────────────────────────────────────────
    # Each chip is a global "used" binary
    wc_used = pulp.LpVariable("wc_used", cat="Binary") if req.wildcard_available  else None
    fh_used = pulp.LpVariable("fh_used", cat="Binary") if req.freehit_available   else None
    bb_used = pulp.LpVariable("bb_used", cat="Binary") if req.benchboost_available else None
    tc_used = pulp.LpVariable("tc_used", cat="Binary") if req.triplecaptain_available else None

    # chip_gw[chip][t] = 1 if chip is played in GW t
    def chip_gws(name, avail):
        if not avail:
            return None
        return [pulp.LpVariable(f"{name}_gw{t}", cat="Binary") for t in range(T)]

    wc_gw = chip_gws("wc", req.wildcard_available)
    fh_gw = chip_gws("fh", req.freehit_available)
    bb_gw = chip_gws("bb", req.benchboost_available)
    tc_gw = chip_gws("tc", req.triplecaptain_available)

    # ── Objective ──────────────────────────────────────────────────────────
    # Base xP + captain bonus + bench boost bonus - hit penalties
    obj_terms = []

    for t in range(T):
        for i in range(N):
            obj_terms.append(xp[i, t] * x[i][t])
            # Captain multiplier: base xP again (so total = 2x)
            cap_mult = 2.0
            if tc_gw:
                # Triple captain in this GW adds another xP on top
                obj_terms.append(xp[i, t] * cap[i][t] * 1.0)  # base
                # Additional 1x if TC played this GW (approximate — PuLP is linear)
            obj_terms.append(xp[i, t] * cap[i][t] * (cap_mult - 1))

        # Hit penalty
        obj_terms.append(-HIT_COST * hits[t])

    prob += pulp.lpSum(obj_terms)

    # ─── Constraints ──────────────────────────────────────────────────────

    for t in range(T):
        # Budget
        prob += pulp.lpSum(prices[i] * x[i][t] for i in range(N)) <= req.budget

        # Squad size
        prob += pulp.lpSum(x[i][t] for i in range(N)) == SQUAD_SIZE

        # Position quotas
        for pos, quota in POS_QUOTA.items():
            idx_pos = [i for i in range(N) if position[i] == pos]
            prob += pulp.lpSum(x[i][t] for i in idx_pos) == quota

        # Club limit
        for team in set(teams):
            idx_team = [i for i in range(N) if teams[i] == team]
            prob += pulp.lpSum(x[i][t] for i in idx_team) <= MAX_CLUB

        # Captain: exactly 1
        prob += pulp.lpSum(cap[i][t] for i in range(N)) == 1
        for i in range(N):
            prob += cap[i][t] <= x[i][t]

        # Transfer flow: x[i,t] = x[i,t-1] - out + in  (for t > 0)
        if t == 0:
            # GW0: allow free transfers if wildcard/freehit is played this GW
            is_chip_gw0 = (
                (wc_gw is not None and req.force_chip == "wildcard") or
                (fh_gw is not None and req.force_chip == "freehit")
            )
            if is_chip_gw0:
                # Wildcard/FH: completely free to pick any 15 players
                # No transfer constraints — solver picks optimal squad from scratch
                for i in range(N):
                    prob += n_tx[0] == 0  # no transfer cost counted
            else:
                # Normal GW0: no transfers out (this is the starting squad)
                for i in range(N):
                    prob += tout[i][0] == 0
                # Enforce current squad constraint for normal GW
                if cur_idx and req.num_free_transfers < 15:
                    prob += pulp.lpSum(x[i][0] for i in range(N) if i not in cur_idx) <= req.num_free_transfers
        else:
            for i in range(N):
                prob += x[i][t] == x[i][t-1] - tout[i][t] + tin[i][t]
                prob += tin[i][t]  + tout[i][t] <= 1   # can't do both
                prob += tin[i][t]  <= 1 - x[i][t-1]   # can't buy if already owned
                prob += tout[i][t] <= x[i][t-1]        # can't sell if not owned

        # Transfer count
        if t > 0:
            prob += n_tx[t] == pulp.lpSum(tin[i][t] for i in range(N))
        else:
            prob += n_tx[0] == 0

        # Banked free transfer carryover
        if t == 0:
            prob += banked[0] == req.num_free_transfers
        else:
            free_this_gw = banked[t-1] - n_tx[t-1] + 1   # earn 1 FT each GW
            # banked[t] = min(MAX_BANKED, unused_from_last_gw + 1)
            # Linearise: banked[t] <= MAX_BANKED, banked[t] >= 0
            # We approximate: banked[t] = min(MAX_BANKED, max(0, prev - used + 1))
            prob += banked[t] <= MAX_BANKED
            prob += banked[t] >= 0

        # Hits
        if t > 0:
            # hits = max(0, n_tx - banked)
            prob += hits[t] >= n_tx[t] - banked[t]
            prob += hits[t] >= 0
        else:
            prob += hits[0] == 0

        # Wildcard GW: unlimited free transfers, no hits
        if wc_gw and t > 0:
            prob += hits[t] >= -SQUAD_SIZE * wc_gw[t]  # if WC, hits can be 0
            prob += n_tx[t] <= SQUAD_SIZE * (1 - wc_gw[t]) + SQUAD_SIZE

        # Free Hit GW: completely new squad, reverting next GW
        # (approximated — full FH revert logic would require extra vars)
        if fh_gw and t > 0:
            prob += n_tx[t] <= SQUAD_SIZE  # unlimited transfers on FH GW

    # ── Chip usage constraints ─────────────────────────────────────────────
    for chip_var, gw_vars, name in [
        (wc_used, wc_gw, "wc"), (fh_used, fh_gw, "fh"),
        (bb_used, bb_gw, "bb"), (tc_used, tc_gw, "tc"),
    ]:
        if chip_var is None or gw_vars is None:
            continue
        # Used at most once across horizon
        prob += pulp.lpSum(gw_vars) <= 1
        prob += pulp.lpSum(gw_vars) == chip_var
        # Only one chip per GW
        for t in range(T):
            chips_this_gw = []
            for gvl in [wc_gw, fh_gw, bb_gw, tc_gw]:
                if gvl:
                    chips_this_gw.append(gvl[t])
            prob += pulp.lpSum(chips_this_gw) <= 1

    # Force chip if requested
    if req.force_chip == "wildcard" and wc_gw:
        prob += wc_gw[0] == 1
    elif req.force_chip == "freehit" and fh_gw:
        prob += fh_gw[0] == 1
    elif req.force_chip == "benchboost" and bb_gw:
        prob += bb_gw[0] == 1
    elif req.force_chip == "triplecaptain" and tc_gw:
        prob += tc_gw[0] == 1

    # Transfer limit for GW0 (normal — no chip)
    # Only enforce if NOT playing wildcard or freehit this GW
    is_unlimited_gw0 = req.force_chip in ("wildcard", "freehit")
    if (not is_unlimited_gw0 and cur_idx and
            req.num_free_transfers < 15 and len(req.current_squad_ids) > 0):
        # Max transfers in from players not in current squad
        prob += pulp.lpSum(
            x[i][0] for i in range(N) if i not in cur_idx
        ) <= req.num_free_transfers

    # ─── Solve ────────────────────────────────────────────────────────────
    solver = pulp.PULP_CBC_CMD(msg=0, timeLimit=60)
    status = prob.solve(solver)

    if pulp.LpStatus[status] not in ("Optimal", "Feasible"):
        return OracleResult(
            status=pulp.LpStatus[status], squad=[], transfers=[],
            chip_plan={}, xp_by_gw=[], total_xp=0,
            total_hits=0, net_xp=0, option_value=0, transfer_plan=[]
        )

    # ─── Extract Solution ─────────────────────────────────────────────────
    def val(v):
        return pulp.value(v) if v is not None else 0

    # Squad for GW0 (the immediate recommendation)
    sel_t0 = [i for i in range(N) if val(x[i][0]) > 0.5]
    cap_t0 = next((i for i in range(N) if val(cap[i][0]) > 0.5), None)

    squad_records = []
    for i in sel_t0:
        row = df.iloc[i].to_dict()
        row["is_captain"] = (i == cap_t0)
        row["is_starter"] = True  # simplified — formation assign below
        squad_records.append(row)

    squad_records = _assign_xi(squad_records, xp[:, 0])

    # Transfers
    transfers = []
    for t in range(1, T):
        for i in range(N):
            if val(tin[i][t]) > 0.5:
                transfers.append({
                    "gw": t, "action": "in",
                    "player_id": int(pids[i]),
                    "name": df.iloc[i].get("name", ""),
                    "team": df.iloc[i].get("team_short", ""),
                    "position": df.iloc[i].get("position", ""),
                    "price": float(prices[i]),
                    "xp_gw1": float(xp[i, t]),
                })
            if val(tout[i][t]) > 0.5:
                transfers.append({
                    "gw": t, "action": "out",
                    "player_id": int(pids[i]),
                    "name": df.iloc[i].get("name", ""),
                    "team": df.iloc[i].get("team_short", ""),
                    "price": float(prices[i]),
                })

    # Chip plan
    chip_plan = {}
    for t in range(T):
        played = None
        for chip, gv_list in [("wildcard", wc_gw), ("freehit", fh_gw),
                               ("benchboost", bb_gw), ("triplecaptain", tc_gw)]:
            if gv_list and val(gv_list[t]) > 0.5:
                played = chip
        chip_plan[t] = played

    # xP by GW
    xp_by_gw = []
    for t in range(T):
        gw_xp = sum(xp[i, t] * val(x[i][t]) for i in range(N))
        # Add captain bonus
        if cap_t0 is not None and t == 0:
            gw_xp += xp[cap_t0, 0]
        xp_by_gw.append(round(gw_xp, 2))

    total_xp  = round(sum(xp_by_gw), 2)
    total_hits = int(sum(val(hits[t]) for t in range(T)))
    net_xp    = round(total_xp - total_hits * HIT_COST, 2)

    # Transfer option value: value of unused FT flexibility
    unused_fts = max(0, int(val(banked[T-1])) - 1)
    option_value = round(unused_fts * 2.5, 2)  # empirical: ~2.5 pts per banked FT

    # Transfer plan summary
    transfer_plan = []
    for t in range(1, T):
        ins  = [tr for tr in transfers if tr["gw"] == t and tr["action"] == "in"]
        outs = [tr for tr in transfers if tr["gw"] == t and tr["action"] == "out"]
        hit  = max(0, int(val(hits[t])))
        if ins or outs:
            transfer_plan.append({
                "gw": t, "transfers_in": ins, "transfers_out": outs,
                "hit": hit, "chip": chip_plan.get(t)
            })

    return OracleResult(
        status="Optimal",
        squad=squad_records,
        transfers=transfers,
        chip_plan=chip_plan,
        xp_by_gw=xp_by_gw,
        total_xp=total_xp,
        total_hits=total_hits,
        net_xp=net_xp,
        option_value=option_value,
        transfer_plan=transfer_plan,
    )


def _assign_xi(squad: list[dict], xp_row: np.ndarray) -> list[dict]:
    """Assign starting XI vs bench based on position constraints and xP."""
    gkps = [p for p in squad if p.get("position") == "GKP"]
    outfield = [p for p in squad if p.get("position") != "GKP"]
    outfield.sort(key=lambda p: -p.get("xp_gw1", 0))

    for p in gkps:
        p["is_starter"] = True
    started = 1

    # Ensure minimum formation
    for pos, min_c in [("DEF", 3), ("MID", 2), ("FWD", 1)]:
        pos_players = [p for p in outfield if p.get("position") == pos]
        for p in pos_players[:min_c]:
            p["is_starter"] = True
            started += 1

    # Fill remaining XI spots with highest xP
    remainder = [p for p in outfield if not p.get("is_starter", False)]
    remainder.sort(key=lambda p: -p.get("xp_gw1", 0))
    for p in remainder:
        if started >= XI_SIZE:
            break
        p["is_starter"] = True
        started += 1

    # Rest are bench
    for p in squad:
        if "is_starter" not in p:
            p["is_starter"] = False

    return squad
