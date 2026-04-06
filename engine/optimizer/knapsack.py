import pandas as pd
import numpy as np
import pulp

SQUAD_SIZE = 15
POSITION_QUOTAS = {"GKP":2,"DEF":5,"MID":5,"FWD":3}
MAX_PER_CLUB = 3
STARTING_XI_SIZE = 11
MIN_STARTERS = {"GKP":1,"DEF":3,"MID":2,"FWD":1}
MAX_STARTERS = {"GKP":1,"DEF":5,"MID":5,"FWD":3}

def solve_squad_selection(predictions_df, budget=100.0, num_transfers=15,
                           current_squad_ids=None, chip=None,
                           objective="maximize_total_points", horizon_gws=1):
    df = predictions_df.copy().dropna(subset=["price","position"])
    df = df[df["price"] > 0].reset_index(drop=True)
    if horizon_gws == 1:
        df["xp_opt"] = df["xp_gw1"]
    elif horizon_gws == 2:
        df["xp_opt"] = df["xp_gw1"] + df["xp_gw2"]
    else:
        df["xp_opt"] = df["xp_total"]
    if objective == "maximize_team_value":
        df["xp_opt"] = df["xp_opt"]*0.7 + df["price"]*0.5
    elif objective == "target_top_10k":
        df["xp_opt"] = df["xp_opt"] * (1 + (100 - df["ownership_pct"]) / 200)
    n = len(df)
    player_ids = df["player_id"].tolist()
    player_idx = {pid:i for i,pid in enumerate(player_ids)}
    prob = pulp.LpProblem("FPL_Squad", pulp.LpMaximize)
    x = [pulp.LpVariable(f"x_{i}", cat="Binary") for i in range(n)]
    x_cap = [pulp.LpVariable(f"cap_{i}", cat="Binary") for i in range(n)]
    x_vice = [pulp.LpVariable(f"vice_{i}", cat="Binary") for i in range(n)]
    cap_mult = 3.0 if chip == "tc" else 2.0
    prob += pulp.lpSum(
        df.iloc[i]["xp_opt"]*x[i] + df.iloc[i]["xp_opt"]*(cap_mult-1)*x_cap[i]
        for i in range(n)
    )
    prob += pulp.lpSum(df.iloc[i]["price"]*x[i] for i in range(n)) <= budget
    prob += pulp.lpSum(x[i] for i in range(n)) == SQUAD_SIZE
    for pos, quota in POSITION_QUOTAS.items():
        idx = df[df["position"]==pos].index.tolist()
        prob += pulp.lpSum(x[i] for i in idx) == quota
    team_col = "team_short" if "team_short" in df.columns else "team"
    for team in df[team_col].dropna().unique():
        idx = df[df[team_col]==team].index.tolist()
        prob += pulp.lpSum(x[i] for i in idx) <= MAX_PER_CLUB
    prob += pulp.lpSum(x_cap[i] for i in range(n)) == 1
    for i in range(n):
        prob += x_cap[i] <= x[i]
    prob += pulp.lpSum(x_vice[i] for i in range(n)) == 1
    for i in range(n):
        prob += x_vice[i] <= x[i]
        prob += x_cap[i] + x_vice[i] <= 1
    if current_squad_ids and chip not in ("wildcard","freehit") and num_transfers < 15:
        cur_idx = [player_idx[pid] for pid in current_squad_ids if pid in player_idx]
        kept = pulp.lpSum(x[i] for i in cur_idx)
        prob += (len(current_squad_ids) - kept) <= num_transfers
    solver = pulp.PULP_CBC_CMD(msg=0, timeLimit=30)
    status = prob.solve(solver)
    if pulp.LpStatus[status] != "Optimal":
        return {"error": f"Solver: {pulp.LpStatus[status]}"}
    sel_idx = [i for i in range(n) if pulp.value(x[i]) > 0.5]
    cap_idx = next((i for i in range(n) if pulp.value(x_cap[i]) > 0.5), None)
    vice_idx = next((i for i in range(n) if pulp.value(x_vice[i]) > 0.5), None)
    squad_df = df.iloc[sel_idx].copy()
    squad_df["is_captain"] = False
    squad_df["is_vice"] = False
    if cap_idx is not None and cap_idx in squad_df.index:
        squad_df.loc[cap_idx,"is_captain"] = True
    if vice_idx is not None and vice_idx in squad_df.index:
        squad_df.loc[vice_idx,"is_vice"] = True
    squad_df = _assign_starting_xi(squad_df)
    total_cost = squad_df["price"].sum()
    transfers = []
    if current_squad_ids:
        new_ids = set(squad_df["player_id"].tolist())
        old_ids = set(current_squad_ids)
        for pid in old_ids - new_ids:
            p = df[df["player_id"]==pid]
            if not p.empty:
                transfers.append({"action":"out","player_id":int(pid),"name":p.iloc[0].get("name",""),"price":float(p.iloc[0]["price"])})
        for pid in new_ids - old_ids:
            p = df[df["player_id"]==pid]
            if not p.empty:
                transfers.append({"action":"in","player_id":int(pid),"name":p.iloc[0].get("name",""),"price":float(p.iloc[0]["price"]),"xp_gw1":float(p.iloc[0].get("xp_gw1",0))})
    return {
        "squad": squad_df.to_dict(orient="records"),
        "captain": squad_df[squad_df["is_captain"]].iloc[0].to_dict() if squad_df["is_captain"].any() else {},
        "vice": squad_df[squad_df["is_vice"]].iloc[0].to_dict() if squad_df["is_vice"].any() else {},
        "total_cost": round(total_cost,1),
        "remaining_budget": round(budget-total_cost,1),
        "total_xp": round(pulp.value(prob.objective),2),
        "transfers": transfers,
        "num_transfers": len([t for t in transfers if t["action"]=="in"]),
        "solver_status": pulp.LpStatus[status],
    }

def _assign_starting_xi(squad_df):
    squad_df = squad_df.copy().sort_values("xp_opt", ascending=False)
    squad_df["is_starter"] = False
    for pos, min_count in MIN_STARTERS.items():
        starters = squad_df[squad_df["position"]==pos].head(min_count).index
        squad_df.loc[starters,"is_starter"] = True
    remaining = STARTING_XI_SIZE - squad_df["is_starter"].sum()
    if remaining > 0:
        candidates = squad_df[~squad_df["is_starter"] & (squad_df["position"]!="GKP")]
        top = candidates.nlargest(remaining,"xp_opt").index
        squad_df.loc[top,"is_starter"] = True
    return squad_df

def get_transfer_suggestions(current_squad_ids, predictions_df, budget=0.5, num_transfers=1):
    result = solve_squad_selection(
        predictions_df=predictions_df, budget=100.0,
        num_transfers=num_transfers, current_squad_ids=current_squad_ids,
    )
    if "error" in result:
        return []
    transfers_in = [t for t in result.get("transfers",[]) if t["action"]=="in"]
    transfers_out = [t for t in result.get("transfers",[]) if t["action"]=="out"]
    return [{"transfer_in":ti,"transfer_out":to,"xp_gain":round(ti.get("xp_gw1",0),2)}
            for ti,to in zip(transfers_in[:num_transfers],transfers_out[:num_transfers])]
