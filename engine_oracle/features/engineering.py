"""
Oracle Feature Engineering
- Rolling stats (3/5/8 GW windows)
- Elo-adjusted FDR
- Rotation risk proxy
- Availability probability (rule-based; NLP layer added in Phase 4)
"""
import pandas as pd
import numpy as np
from data.pipeline import get_fixture_count

FEATURE_COLS = [
    "pts_roll3", "pts_roll5", "pts_roll8",
    "mins_roll3", "mins_roll5",
    "goals_roll3", "goals_roll5",
    "assists_roll3", "assists_roll5",
    "cs_roll3", "cs_roll5",
    "bonus_roll3", "bonus_roll5",
    "xgi_roll3", "xgi_roll5",
    "xg_roll3", "xg_roll5",
    "xa_roll3", "xa_roll5",
    "ict_roll3", "ict_roll5",
    "influence_roll3", "creativity_roll3", "threat_roll3",
    "fdr_dynamic", "is_home",
    "fixture_count_gw1", "fixture_count_gw2", "fixture_count_gw3",
    "team_goals_scored_roll5", "team_goals_conceded_roll5",
    "opponent_goals_conceded_roll5",
    "rotation_risk", "start_probability", "starts_pct",
    "price", "ppg", "ownership_pct", "net_transfers",
    "xg_90", "xa_90", "xgc_90", "ict_index",
    "pos_GKP", "pos_DEF", "pos_MID", "pos_FWD",
]


def add_rolling(df: pd.DataFrame, col: str, window: int) -> pd.Series:
    return (
        df.groupby("player_id")[col]
        .transform(lambda x: x.shift(1).rolling(window, min_periods=1).mean())
    )


def build_oracle_features(
    history_df: pd.DataFrame,
    players_df: pd.DataFrame,
    fixtures_df: pd.DataFrame,
    elo,
    current_gw: int,
) -> pd.DataFrame:
    """
    Build the full feature matrix for prediction.
    Returns one row per player with features for current_gw.
    """
    if history_df.empty:
        # No history — build a minimal feature df from players_df alone
        return _build_from_players_only(players_df, fixtures_df, elo, current_gw)

    df = history_df.copy()
    df = df.sort_values(["player_id", "gw"])

    # Rolling stats
    for col, alias in [
        ("total_points", "pts"), ("minutes", "mins"),
        ("goals_scored", "goals"), ("assists", "assists"),
        ("clean_sheets", "cs"), ("bonus", "bonus"),
        ("expected_goal_involvements", "xgi"),
    ]:
        if col not in df.columns:
            continue
        for w in [3, 5, 8]:
            df[f"{alias}_roll{w}"] = add_rolling(df, col, w)

    # xG / xA / ICT rolling stats from history
    for col, alias in [
        ("expected_goals", "xg"), ("expected_assists", "xa"),
        ("ict_index", "ict"), ("influence", "influence"),
        ("creativity", "creativity"), ("threat", "threat"),
    ]:
        if col in df.columns:
            for w in [3, 5]:
                df[f"{alias}_roll{w}"] = add_rolling(df, col, w)
    if "minutes" in df.columns:
        df["started"]    = (df["minutes"] >= 45).astype(int)
        df["starts_pct"] = df.groupby("player_id")["started"].transform(
            lambda x: x.shift(1).rolling(5, min_periods=1).mean())

    # Fixture features for current GW
    pid_to_team = players_df.set_index("player_id")["team_id"].to_dict()
    # Use last recorded GW per player (not just current_gw-1 — player may have blanked)
    last_gw_per_player = df.groupby("player_id")["gw"].max()
    df = df.join(last_gw_per_player.rename("_last_gw"), on="player_id")
    current = df[df["gw"] == df["_last_gw"]].drop_duplicates("player_id").copy()
    # Ensure ALL players appear (some may have no history at all)
    all_pids = players_df[["player_id"]].copy()
    current = all_pids.merge(current.drop(columns=["_last_gw"], errors="ignore"),
                             on="player_id", how="left")
    current["team_id"] = current["player_id"].map(pid_to_team)

    for offset, label in [(0, "gw1"), (1, "gw2"), (2, "gw3")]:
        gw_target = current_gw + offset
        current[f"fixture_count_{label}"] = current["team_id"].apply(
            lambda t: get_fixture_count(fixtures_df, t, gw_target) if pd.notna(t) else 1
        )
        # Elo FDR for current GW
        if offset == 0:
            def _get_fdr(team_id):
                if pd.isna(team_id):
                    return 3.0
                gw_fix = fixtures_df[
                    (fixtures_df["gw"] == gw_target) &
                    ((fixtures_df["home_team"] == team_id) |
                     (fixtures_df["away_team"] == team_id))
                ]
                if gw_fix.empty:
                    return 3.0
                row = gw_fix.iloc[0]
                is_home = row["home_team"] == team_id
                opp = row["away_team"] if is_home else row["home_team"]
                if pd.isna(opp): return 3.0
                try:
                    try:
                        return elo.fdr_dynamic(int(team_id), int(opp))
                    except Exception:
                        return 3.0
                except Exception:
                    return 3.0
            current["fdr_dynamic"] = current["team_id"].apply(_get_fdr)
            current["is_home"] = current["team_id"].apply(
                lambda t: int(
                    not fixtures_df[
                        (fixtures_df["gw"] == gw_target) &
                        (fixtures_df["home_team"] == t)
                    ].empty
                ) if pd.notna(t) else 0
            )

    # Team form
    pid_to_tid = players_df.set_index("player_id")["team_id"].to_dict()
    df["_tid"] = df["player_id"].map(pid_to_tid)
    if "goals_scored" in df.columns:
        tg = df.groupby(["_tid","gw"])["goals_scored"].sum().reset_index()
        tg["team_goals_scored_roll5"] = tg.groupby("_tid")["goals_scored"].transform(
            lambda x: x.shift(1).rolling(5, min_periods=1).mean())
        df = df.merge(tg[["_tid","gw","team_goals_scored_roll5"]], on=["_tid","gw"], how="left")
    else:
        df["team_goals_scored_roll5"] = 1.5
    if "clean_sheets" in df.columns:
        tc = df.groupby(["_tid","gw"])["clean_sheets"].max().reset_index()
        tc["_gc"] = 1 - tc["clean_sheets"]
        tc["team_goals_conceded_roll5"] = tc.groupby("_tid")["_gc"].transform(
            lambda x: x.shift(1).rolling(5, min_periods=1).mean())
        df = df.merge(tc[["_tid","gw","team_goals_conceded_roll5"]], on=["_tid","gw"], how="left")
    else:
        df["team_goals_conceded_roll5"] = 1.2
    if "opponent_team" in df.columns:
        gc_map = df.groupby("_tid")["team_goals_conceded_roll5"].last().to_dict()
        df["opponent_goals_conceded_roll5"] = df["opponent_team"].map(gc_map).fillna(1.2)
    else:
        df["opponent_goals_conceded_roll5"] = 1.2
    current = df.groupby("player_id").last().reset_index()
    # Position dummies
    pos_map = players_df.set_index("player_id")["position"].to_dict()
    current["position"] = current["player_id"].map(pos_map)
    for pos in ["GKP", "DEF", "MID", "FWD"]:
        current[f"pos_{pos}"] = (current["position"] == pos).astype(int)

    # Rotation risk proxy: players who played < 60 mins in last 3 GWs
    if "mins_roll3" in current.columns:
        current["start_probability"] = (current["mins_roll3"] / 90).clip(0, 1)
        current["rotation_risk"] = (current["mins_roll3"] < 50).astype(float) * 0.6
    else:
        current["start_probability"] = 0.8
        current["rotation_risk"] = 0.2
    # Override with real pipeline availability (injured=0, doubtful=0.5, fit=1)
    if "availability" in players_df.columns:
        avail_map = players_df.set_index("player_id")["availability"].to_dict()
        current["start_probability"] = current["player_id"].map(avail_map).fillna(0.8).clip(0, 1)
        current["rotation_risk"]     = 1 - current["start_probability"]
    # Override with real pipeline availability (injured=0, doubtful=0.5, fit=1)
    if "availability" in players_df.columns:
        avail_map = players_df.set_index("player_id")["availability"].to_dict()
        current["start_probability"] = current["player_id"].map(avail_map).fillna(0.8).clip(0, 1)
        current["rotation_risk"]     = 1 - current["start_probability"]

    # Merge player metadata
    meta = players_df[["player_id", "price", "ppg", "ownership_pct"]].copy()
    current = current.merge(meta, on="player_id", how="left")

    avail_cols = [c for c in FEATURE_COLS if c in current.columns]
    result = current[["player_id"] + avail_cols].fillna(0)
    return result


def _build_from_players_only(players_df, fixtures_df, elo, current_gw):
    """
    Minimal feature matrix when no history is available.
    Uses current FPL stats (ppg, form, etc.) as rolling proxies.
    """
    df = players_df.copy()
    df["pts_roll3"]  = df["ppg"]
    df["pts_roll5"]  = df["ppg"]
    df["pts_roll8"]  = df["ppg"]
    df["mins_roll3"] = 75.0
    df["mins_roll5"] = 75.0
    df["goals_roll3"] = 0.0
    df["goals_roll5"] = 0.0
    df["assists_roll3"] = 0.0
    df["assists_roll5"] = 0.0
    df["cs_roll3"]   = 0.0
    df["cs_roll5"]   = 0.0
    df["bonus_roll3"] = 1.0
    df["bonus_roll5"] = 1.0
    df["xgi_roll3"]  = df["xgi_90"] * 0.75
    df["xgi_roll5"]  = df["xgi_90"] * 0.75
    df["xg_roll3"]   = df["xg_90"]  * 0.75 if "xg_90"  in df.columns else 0.0
    df["xg_roll5"]   = df["xg_90"]  * 0.75 if "xg_90"  in df.columns else 0.0
    df["xa_roll3"]   = df["xa_90"]  * 0.75 if "xa_90"  in df.columns else 0.0
    df["xa_roll5"]   = df["xa_90"]  * 0.75 if "xa_90"  in df.columns else 0.0
    df["ict_roll3"]  = df["ict_index"] if "ict_index" in df.columns else 0.0
    df["ict_roll5"]  = df["ict_index"] if "ict_index" in df.columns else 0.0
    df["influence_roll3"]  = 0.0
    df["creativity_roll3"] = 0.0
    df["threat_roll3"]     = 0.0
    df["starts_pct"]       = (df["starts"] / df["minutes"].clip(lower=90) * 90).clip(0,1) if "starts" in df.columns else 0.8
    df["net_transfers"]    = df["net_transfers"] if "net_transfers" in df.columns else 0
    df["team_goals_scored_roll5"]       = 1.5
    df["team_goals_conceded_roll5"]     = 1.2
    df["opponent_goals_conceded_roll5"] = 1.2
    df["xg_roll3"]   = df["xg_90"]  * 0.75 if "xg_90"  in df.columns else 0.0
    df["xg_roll5"]   = df["xg_90"]  * 0.75 if "xg_90"  in df.columns else 0.0
    df["xa_roll3"]   = df["xa_90"]  * 0.75 if "xa_90"  in df.columns else 0.0
    df["xa_roll5"]   = df["xa_90"]  * 0.75 if "xa_90"  in df.columns else 0.0
    df["ict_roll3"]  = df["ict_index"] if "ict_index" in df.columns else 0.0
    df["ict_roll5"]  = df["ict_index"] if "ict_index" in df.columns else 0.0
    df["influence_roll3"]  = 0.0
    df["creativity_roll3"] = 0.0
    df["threat_roll3"]     = 0.0
    df["starts_pct"]       = (df["starts"] / df["minutes"].clip(lower=90) * 90).clip(0,1) if "starts" in df.columns else 0.8
    df["net_transfers"]    = df["net_transfers"] if "net_transfers" in df.columns else 0
    df["team_goals_scored_roll5"]       = 1.5
    df["team_goals_conceded_roll5"]     = 1.2
    df["opponent_goals_conceded_roll5"] = 1.2
    # Use real availability from pipeline (0=injured, 0.5=doubtful, 1=fit)
    if "availability" in df.columns:
        df["start_probability"] = df["availability"].clip(0, 1)
        df["rotation_risk"]     = (1 - df["availability"]).clip(0, 1)
    else:
        df["start_probability"] = 0.8
        df["rotation_risk"]     = 0.2
    # Form multiplier: hot/cold players boosted/reduced vs ppg average
    if "form" in df.columns:
        mean_form = df["form"].mean()
        form_mult = (df["form"] / (mean_form + 0.1)).clip(0.5, 2.0)
        df["pts_roll3"] = (df["ppg"] * form_mult).clip(lower=0)
        df["pts_roll5"] = (df["ppg"] * form_mult.clip(0.7, 1.5)).clip(lower=0)
    # Zero all rolling stats for unavailable players
    if "availability" in df.columns:
        mask = df["availability"] <= 0
        for col in ["pts_roll3", "pts_roll5", "pts_roll8", "xgi_roll3", "xgi_roll5"]:
            df.loc[mask, col] = 0.0

    for offset, label in [(0, "gw1"), (1, "gw2"), (2, "gw3")]:
        gw_t = current_gw + offset
        df[f"fixture_count_{label}"] = df["team_id"].apply(
            lambda t: get_fixture_count(fixtures_df, int(t), gw_t)
        )

    def _fdr(team_id):
        if pd.isna(team_id): return 3.0
        try:
            if pd.isna(team_id): return 3.0
            gw_fix = fixtures_df[
                (fixtures_df["gw"] == current_gw) &
                ((fixtures_df["home_team"] == team_id) |
                 (fixtures_df["away_team"] == team_id))
            ]
            if gw_fix.empty: return 3.0
            row = gw_fix.iloc[0]
            is_home = row["home_team"] == team_id
            opp = row["away_team"] if is_home else row["home_team"]
            if pd.isna(opp): return 3.0
            try:
                return elo.fdr_dynamic(int(team_id), int(opp))
            except Exception:
                return 3.0
        except Exception:
            return 3.0

    df["fdr_dynamic"] = df["team_id"].apply(_fdr)
    df["is_home"] = df["team_id"].apply(
        lambda t: int(not fixtures_df[
            (fixtures_df["gw"] == current_gw) &
            (fixtures_df["home_team"] == t)
        ].empty)
    )

    for pos in ["GKP", "DEF", "MID", "FWD"]:
        df[f"pos_{pos}"] = (df["position"] == pos).astype(int)

    avail_cols = [c for c in FEATURE_COLS if c in df.columns]
    return df[["player_id"] + avail_cols].fillna(0)

