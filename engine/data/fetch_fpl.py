import asyncio
import aiohttp
import pandas as pd
import numpy as np

FPL_BASE = "https://fantasy.premierleague.com/api"

async def get_json(session, url):
    async with session.get(url) as r:
        r.raise_for_status()
        return await r.json()

async def fetch_bootstrap(session):
    return await get_json(session, f"{FPL_BASE}/bootstrap-static/")

async def fetch_player_history(session, player_id):
    data = await get_json(session, f"{FPL_BASE}/element-summary/{player_id}/")
    return data.get("history", [])

async def fetch_all_player_histories(player_ids):
    async with aiohttp.ClientSession() as session:
        tasks = [fetch_player_history(session, pid) for pid in player_ids]
        results = await asyncio.gather(*tasks, return_exceptions=True)
    rows = []
    for pid, history in zip(player_ids, results):
        if isinstance(history, Exception):
            continue
        for gw in history:
            gw["player_id"] = pid
            rows.append(gw)
    if not rows:
        return pd.DataFrame()
    df = pd.DataFrame(rows)
    rename = {
        "round": "gw", "total_points": "points", "minutes": "minutes",
        "goals_scored": "goals", "assists": "assists",
        "clean_sheets": "clean_sheets", "saves": "saves",
        "bonus": "bonus", "bps": "bps", "value": "price",
        "selected": "ownership", "transfers_in": "transfers_in",
        "transfers_out": "transfers_out", "expected_goals": "xg",
        "expected_assists": "xa", "expected_goal_involvements": "xgi",
        "expected_goals_conceded": "xgc", "opponent_team": "opponent_id",
        "was_home": "is_home",
    }
    df = df.rename(columns={k: v for k, v in rename.items() if k in df.columns})
    num_cols = ["points","minutes","goals","assists","clean_sheets","saves",
                "bonus","bps","price","ownership","xg","xa","xgi","xgc"]
    for c in num_cols:
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce").fillna(0)
    return df.sort_values(["player_id","gw"]).reset_index(drop=True)

async def fetch_fixtures(session):
    data = await get_json(session, f"{FPL_BASE}/fixtures/")
    df = pd.DataFrame(data)
    cols = ["id","event","team_h","team_a","team_h_difficulty","team_a_difficulty",
            "team_h_score","team_a_score","finished"]
    df = df[[c for c in cols if c in df.columns]].copy()
    df.columns = ["fixture_id","gw","home_team","away_team","home_fdr","away_fdr",
                  "home_score","away_score","finished"][:len(df.columns)]
    return df

async def fetch_all_data():
    async with aiohttp.ClientSession() as session:
        bootstrap = await fetch_bootstrap(session)
        fixtures_df = await fetch_fixtures(session)
    players_raw = bootstrap["elements"]
    teams_raw = bootstrap["teams"]
    gameweeks_raw = bootstrap["events"]
    players_df = pd.DataFrame(players_raw)
    keep = ["id","web_name","element_type","team","now_cost","total_points",
            "form","points_per_game","selected_by_percent",
            "expected_goals","expected_assists","expected_goal_involvements",
            "expected_goals_conceded","minutes","goals_scored","assists",
            "clean_sheets","saves","bonus","status"]
    players_df = players_df[[c for c in keep if c in players_df.columns]].copy()
    players_df = players_df.rename(columns={
        "id":"player_id","web_name":"name","element_type":"position_id",
        "team":"team_id","now_cost":"price","selected_by_percent":"ownership_pct",
        "expected_goals":"season_xg","expected_assists":"season_xa",
        "expected_goal_involvements":"season_xgi","expected_goals_conceded":"season_xgc",
        "goals_scored":"goals","clean_sheets":"clean_sheets",
        "points_per_game":"ppg","form":"form",
    })
    players_df["price"] = pd.to_numeric(players_df["price"], errors="coerce") / 10
    players_df["ownership_pct"] = pd.to_numeric(players_df["ownership_pct"], errors="coerce").fillna(0)
    players_df["position"] = players_df["position_id"].map({1:"GKP",2:"DEF",3:"MID",4:"FWD"})
    teams_df = pd.DataFrame(teams_raw)
    t_keep = ["id","name","short_name","strength_overall_home","strength_overall_away",
              "strength_attack_home","strength_attack_away",
              "strength_defence_home","strength_defence_away"]
    teams_df = teams_df[[c for c in t_keep if c in teams_df.columns]].copy()
    teams_df = teams_df.rename(columns={
        "id":"team_id","name":"team_name","short_name":"team_short",
        "strength_overall_home":"str_overall_h","strength_overall_away":"str_overall_a",
        "strength_attack_home":"str_attack_h","strength_attack_away":"str_attack_a",
        "strength_defence_home":"str_defence_h","strength_defence_away":"str_defence_a",
    })
    players_df = players_df.merge(teams_df[["team_id","team_short"]], on="team_id", how="left")
    gw_df = pd.DataFrame(gameweeks_raw)
    current_gw = 1
    if "is_current" in gw_df.columns:
        cur = gw_df[gw_df["is_current"] == True]
        if not cur.empty:
            current_gw = int(cur.iloc[0]["id"])
    active_ids = players_df[players_df["status"].isin(["a","d"])]["player_id"].tolist()
    print(f"Fetching histories for {len(active_ids)} players (this takes ~2 mins)...")
    history_df = await fetch_all_player_histories(active_ids)
    return {
        "players": players_df, "teams": teams_df, "fixtures": fixtures_df,
        "history": history_df, "current_gw": current_gw, "gameweeks": gw_df,
    }
