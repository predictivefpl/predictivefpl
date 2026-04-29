
import pandas as pd
import numpy as np

SQUAD_SIZE  = 15
XI_SIZE     = 11
POS_QUOTA   = {"GKP": 2, "DEF": 5, "MID": 5, "FWD": 3}
MAX_CLUB    = 3
HIT_COST    = 4


def _score(player: dict, horizon: int = 3) -> float:
    """Composite score: weighted sum of xP over horizon * availability."""
    avail = float(player.get("availability", 1.0) or 1.0)
    if avail == 0.0:
        return 0.0  # injured/suspended — never score positively
    xp = sum(
        player.get(f"xp_gw{t+1}", 0) or 0
        for t in range(min(horizon, 8))
    )
    return round(xp * avail, 4)


def _club_counts(squad: list[dict]) -> dict:
    counts: dict[str, int] = {}
    for p in squad:
        c = p.get("team_short", "UNK")
        counts[c] = counts.get(c, 0) + 1
    return counts


def _valid_swap(squad: list[dict], player_out: dict, player_in: dict,
                budget_remaining: float) -> bool:
    """Check if swapping player_out for player_in is valid."""
    price_delta = player_out.get("price", 0) - player_in.get("price", 0)
    if price_delta + budget_remaining < -0.05:          # can't afford
        return False
    if player_out.get("position") != player_in.get("position"):  # must be same pos
        return False
    # Club limit check
    club_counts = _club_counts(squad)
    in_club = player_in.get("team_short", "UNK")
    out_club = player_out.get("team_short", "UNK")
    new_count = club_counts.get(in_club, 0) + (0 if in_club == out_club else 1)
    if new_count > MAX_CLUB:
        return False
    # Not already in squad
    squad_ids = {p["player_id"] for p in squad}
    if player_in["player_id"] in squad_ids:
        return False
    return True


def solve_greedy(
    predictions_df: pd.DataFrame,
    current_squad_ids: list,
    budget: float,
    num_transfers: int,
    horizon: int = 5,
    force_chip: str | None = None,
) -> dict:
    """
    Greedy transfer solver.
    For each transfer: find the (out, in) pair that maximises xP gain.
    Repeat num_transfers times.
    """
    df = predictions_df.copy().dropna(subset=["price", "position"])
    df = df[df["price"] > 0]
    df["_score"] = df.apply(lambda r: _score(r.to_dict(), horizon), axis=1)

    # Wildcard / Free Hit: ignore current squad, pick best 15 from scratch
    if force_chip in ("wildcard", "freehit"):
        result = _solve_best_squad(df, budget, horizon)
        result["force_chip"] = force_chip
        result["chip_plan"]  = {0: force_chip}
        # Build transfers list: all current squad = OUT, all new squad = IN
        new_ids = {p["player_id"] for p in result["squad"]}
        cur_pids = set(current_squad_ids or [])
        pid_map2 = {int(r["player_id"]): r.to_dict() for _, r in df.iterrows()}
        outs = [
            {"action":"out","player_id":int(pid),"name":pid_map2.get(pid,{}).get("name","—"),
             "price":float(pid_map2.get(pid,{}).get("price",0)),"gw":1}
            for pid in cur_pids if pid not in new_ids
        ]
        ins  = [
            {"action":"in","player_id":int(p["player_id"]),"name":p.get("name",""),
             "price":float(p.get("price",0)),"xp_gw1":float(p.get("xp_gw1",0)),
             "position":p.get("position",""),"team_short":p.get("team_short",""),"gw":1}
            for p in result["squad"] if p["player_id"] not in cur_pids
        ]
        result["transfers"] = outs + ins
        return result

    pid_map = {int(r["player_id"]): r.to_dict() for _, r in df.iterrows()}

    # Build starting squad
    squad = [pid_map[pid] for pid in current_squad_ids if pid in pid_map]

    # Greedy: each iteration find the single best (out, in) swap
    transfers_out = []
    transfers_in  = []
    found_price   = sum(p.get("price", 0) for p in squad)
    missing_count = max(0, len(current_squad_ids) - len(squad))
    avg_price     = (found_price / len(squad)) if squad else 6.0
    bank          = max(0.0, budget - found_price - (missing_count * avg_price))

    for _ in range(num_transfers):
        best_gain = -999
        best_out  = None
        best_in   = None

        squad_ids = {p["player_id"] for p in squad}

        for p_out in squad:
            pos    = p_out.get("position")
            score_out = _score(p_out, horizon)
            # Find best replacement for this position
            candidates = df[
                (df["position"] == pos) &
                (~df["player_id"].isin(squad_ids)) &
                (df["availability"].fillna(1.0) > 0.0)  # exclude injured/suspended
            ].sort_values("_score", ascending=False).head(30)

            for _, row in candidates.iterrows():
                p_in = row.to_dict()
                if not _valid_swap(squad, p_out, p_in, bank):
                    continue
                gain = _score(p_in, horizon) - score_out
                if gain > best_gain:
                    best_gain = gain
                    best_out  = p_out
                    best_in   = p_in

        if best_out is None or best_gain <= 0:
            break  # no beneficial transfer found

        # Apply the swap
        bank += best_out.get("price", 0) - best_in.get("price", 0)
        squad = [p for p in squad if p["player_id"] != best_out["player_id"]]
        squad.append(best_in)
        transfers_out.append(best_out)
        transfers_in.append(best_in)

    # Build result
    transfers = []
    for p in transfers_out:
        transfers.append({"action": "out", "player_id": int(p["player_id"]),
                          "name": p.get("name",""), "team": p.get("team_short",""),
                          "price": float(p.get("price",0)), "gw": 1})
    for p in transfers_in:
        transfers.append({"action": "in", "player_id": int(p["player_id"]),
                          "name": p.get("name",""), "team": p.get("team_short",""),
                          "position": p.get("position",""),
                          "price": float(p.get("price",0)),
                          "xp_gw1": float(p.get("xp_gw1",0)), "gw": 1})

    squad = _assign_xi(squad, horizon)
    total_xp = sum(_score(p, horizon) for p in squad if p.get("is_starter"))
    captain  = max((p for p in squad if p.get("is_starter")),
                   key=lambda p: p.get("xp_gw1", 0), default=None)
    if captain:
        captain["is_captain"] = True
        total_xp += captain.get("xp_gw1", 0)  # captain double

    return {
        "status":        "Optimal",
        "squad":         squad,
        "transfers":     transfers,
        "chip_plan":     {0: force_chip},
        "xp_by_gw":     [round(sum(_score(p, 1) for p in squad if p.get("is_starter")), 2)],
        "total_xp":     round(total_xp, 2),
        "total_hits":   max(0, len(transfers_in) - num_transfers),
        "net_xp":       round(total_xp - max(0, len(transfers_in) - num_transfers) * HIT_COST, 2),
        "option_value": 0,
        "transfer_plan": [{
            "gw": 1,
            "transfers_in":  [t for t in transfers if t["action"]=="in"],
            "transfers_out": [t for t in transfers if t["action"]=="out"],
            "hit": max(0, len(transfers_in) - num_transfers),
            "chip": force_chip,
        }] if transfers else [],
        "transfers_applied": len(transfers_in),
    }


def _solve_best_squad(df: pd.DataFrame, budget: float, horizon: int = 5) -> dict:
    """Pick the best 15 players within budget respecting position/club rules."""
    df = df[df["availability"].fillna(1.0) > 0.0].sort_values("_score", ascending=False).copy()
    squad = []
    pos_counts = {p: 0 for p in POS_QUOTA}
    club_counts: dict[str, int] = {}
    spent = 0.0

    for _, row in df.iterrows():
        p = row.to_dict()
        pos   = p.get("position")
        club  = p.get("team_short", "UNK")
        price = float(p.get("price", 0))

        if pos not in POS_QUOTA:
            continue
        if pos_counts[pos] >= POS_QUOTA[pos]:
            continue
        if club_counts.get(club, 0) >= MAX_CLUB:
            continue
        if spent + price > budget + 0.2:
            continue

        squad.append(p)
        pos_counts[pos] += 1
        club_counts[club] = club_counts.get(club, 0) + 1
        spent += price
        if len(squad) == SQUAD_SIZE:
            break

    # Pass 2: if squad incomplete, fill with cheapest valid players
    if len(squad) < SQUAD_SIZE:
        used_pids = {int(p.get("player_id", 0)) for p in squad}
        df_cheap = df.sort_values("price", ascending=True).copy()
        for _, row in df_cheap.iterrows():
            if len(squad) == SQUAD_SIZE: break
            p = row.to_dict()
            pos  = p.get("position")
            club = p.get("team_short", "UNK")
            pid  = int(p.get("player_id", 0))
            if pid in used_pids: continue
            if pos not in POS_QUOTA: continue
            if pos_counts[pos] >= POS_QUOTA[pos]: continue
            if club_counts.get(club, 0) >= MAX_CLUB: continue
            squad.append(p); used_pids.add(pid)
            pos_counts[pos] += 1
            club_counts[club] = club_counts.get(club, 0) + 1

    # Pass 3: still short? Relax club rule
    if len(squad) < SQUAD_SIZE:
        used_pids = {int(p.get("player_id", 0)) for p in squad}
        df_cheap = df.sort_values("price", ascending=True).copy()
        for _, row in df_cheap.iterrows():
            if len(squad) == SQUAD_SIZE: break
            p = row.to_dict()
            pos = p.get("position")
            pid = int(p.get("player_id", 0))
            if pid in used_pids: continue
            if pos not in POS_QUOTA: continue
            if pos_counts[pos] >= POS_QUOTA[pos]: continue
            squad.append(p); used_pids.add(pid)
            pos_counts[pos] += 1

    squad = _assign_xi(squad, horizon)
    total_xp = sum(_score(p, horizon) for p in squad if p.get("is_starter"))
    captain = max((p for p in squad if p.get("is_starter")),
                  key=lambda p: p.get("xp_gw1", 0), default=None)
    if captain:
        captain["is_captain"] = True
        total_xp += captain.get("xp_gw1", 0)

    starters_b = [p for p in squad if p.get("is_starter")]
    cap_b      = next((p for p in starters_b if p.get("is_captain")), None)
    xp_by_gw_b = []
    for t in range(horizon):
        col  = f"xp_gw{t+1}"
        gw_t = sum(float(p.get(col, 0) or 0) for p in starters_b)
        if cap_b:
            gw_t += float(cap_b.get(col, 0) or 0)
        xp_by_gw_b.append(round(gw_t, 2))
    total_b = round(sum(xp_by_gw_b), 2)
    return {
        "status": "Optimal", "squad": squad, "transfers": [],
        "chip_plan": {0: None}, "xp_by_gw": xp_by_gw_b,
        "total_xp": total_b, "total_hits": 0,
        "net_xp": total_b, "option_value": 0,
        "transfer_plan": [], "transfers_applied": 0,
    }


def _start_score(player: dict, horizon: int) -> float:
    """
    Score for starting XI selection.
    Heavily weights GW1 xP so players with immediate fixtures start.
    DGW players get a significant bonus.
    """
    xp_gw1 = float(player.get("xp_gw1", 0) or 0)
    fc_gw1 = int(player.get("fixture_count_gw1", 1) or 1)
    dgw    = fc_gw1
    if fc_gw1 == 0:
        xp_gw1 = 0.0  # BGW — no fixture this GW, never starts over playing players
    # GW1 counts 50%, remaining horizon counts 50%
    future_xp = sum(float(player.get(f"xp_gw{t+1}", 0) or 0) for t in range(1, min(horizon, 5)))
    dgw_bonus  = xp_gw1 * 0.5 if dgw >= 2 else 0  # extra bonus for DGW
    avail = float(player.get("availability", 1.0) or 1.0)
    return (xp_gw1 * 1.5 + future_xp + dgw_bonus) * avail


def _assign_xi(squad: list[dict], horizon: int) -> list[dict]:
    """
    Pick optimal starting XI considering:
    - GW1 xP weighted heavily (immediate fixtures matter most)
    - DGW players prioritised
    - Valid formation (min 1 GKP, 3 DEF, 2 MID, 1 FWD, max 1 GKP)
    - Captain = highest xp_gw1 starter (doubled score)
    """
    MIN_START = {"GKP": 1, "DEF": 3, "MID": 2, "FWD": 1}
    MAX_START = {"GKP": 1, "DEF": 5, "MID": 5, "FWD": 3}

    for p in squad:
        p["is_starter"] = False
        p["is_captain"] = False
        p["is_vice"]    = False

    # Step 1: fill minimums using start_score
    started = 0
    for pos, min_c in MIN_START.items():
        pos_players = sorted(
            [p for p in squad if p.get("position") == pos],
            key=lambda p: -_start_score(p, horizon)
        )
        for p in pos_players[:min_c]:
            p["is_starter"] = True
            started += 1

    # Step 2: fill remaining 4 spots with best available non-GKP players
    # Respect position maximums
    remaining = sorted(
        [p for p in squad if not p["is_starter"] and p.get("position") != "GKP"],
        key=lambda p: -_start_score(p, horizon)
    )
    pos_counts = {pos: sum(1 for p in squad if p.get("is_starter") and p.get("position") == pos)
                  for pos in MAX_START}

    for p in remaining:
        if started >= XI_SIZE:
            break
        pos = p.get("position")
        if pos_counts.get(pos, 0) >= MAX_START.get(pos, 3):
            continue  # already at max for this position
        p["is_starter"] = True
        pos_counts[pos] = pos_counts.get(pos, 0) + 1
        started += 1

    # Step 3: captain = starter with highest GW1 xP
    starters = [p for p in squad if p.get("is_starter")]
    if starters:
        cap = max(starters, key=lambda p: float(p.get("xp_gw1", 0) or 0))
        cap["is_captain"] = True
        # Vice = second highest GW1 xP
        others = [p for p in starters if p is not cap]
        if others:
            vice = max(others, key=lambda p: float(p.get("xp_gw1", 0) or 0))
            vice["is_vice"] = True

    return squad
