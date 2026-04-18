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
    # Form
    "pts_roll3", "pts_roll5", "pts_roll8",
    "mins_roll3", "mins_roll5",
    "goals_roll3", "goals_roll5",
    "assists_roll3", "assists_roll5",
    "cs_roll3", "cs_roll5",
    "bonus_roll3", "bonus_roll5",
    "xgi_roll3", "xgi_roll5",
    # Fixture
    "fdr_dynamic", "is_home",
    "fixture_count_gw1", "fixture_count_gw2", "fixture_count_gw3",
    # Risk
    "rotation_risk", "start_probability",
    # Price
    "price", "ppg", "ownership_pct",
    # Position dummies
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

    # Fixture features for current GW
    pid_to_team = players_df.set_index("player_id")["team_id"].to_dict()
    current = df[df["gw"] == current_gw - 1].copy()
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
                return elo.fdr_dynamic(int(team_id), int(opp))
            current["fdr_dynamic"] = current["team_id"].apply(_get_fdr)
            current["is_home"] = current["team_id"].apply(
                lambda t: int(
                    not fixtures_df[
                        (fixtures_df["gw"] == gw_target) &
                        (fixtures_df["home_team"] == t)
                    ].empty
                ) if pd.notna(t) else 0
            )

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
    df["start_probability"] = 0.8
    df["rotation_risk"]     = 0.2

    for offset, label in [(0, "gw1"), (1, "gw2"), (2, "gw3")]:
        gw_t = current_gw + offset
        df[f"fixture_count_{label}"] = df["team_id"].apply(
            lambda t: get_fixture_count(fixtures_df, int(t), gw_t)
        )

    def _fdr(team_id):
        gw_fix = fixtures_df[
            (fixtures_df["gw"] == current_gw) &
            ((fixtures_df["home_team"] == team_id) |
             (fixtures_df["away_team"] == team_id))
        ]
        if gw_fix.empty:
            return 3.0
        row = gw_fix.iloc[0]
        is_home = row["home_team"] == team_id
        opp = int(row["away_team"] if is_home else row["home_team"])
        return elo.fdr_dynamic(int(team_id), opp)

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
