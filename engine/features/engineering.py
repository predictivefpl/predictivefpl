import pandas as pd
import numpy as np

def add_rolling_features(df):
    df = df.sort_values(["player_id","gw"]).copy()
    stat_cols = ["points","minutes","goals","assists","clean_sheets","saves","bonus","bps","xg","xa","xgi","xgc"]
    for window in [3,5,8]:
        for col in stat_cols:
            if col not in df.columns:
                continue
            df[f"{col}_roll{window}"] = (
                df.groupby("player_id")[col]
                .transform(lambda x: x.shift(1).rolling(window, min_periods=1).mean())
            )
    df["minutes_roll3_ratio"] = df.get("minutes_roll3", pd.Series(0, index=df.index)) / 90.0
    df["minutes_roll5_ratio"] = df.get("minutes_roll5", pd.Series(0, index=df.index)) / 90.0
    if "ownership" in df.columns:
        df["ownership_delta"] = df.groupby("player_id")["ownership"].diff().fillna(0)
    else:
        df["ownership_delta"] = 0
    df["cumulative_pts"] = df.groupby("player_id")["points"].cumsum().shift(1).fillna(0)
    return df

def add_fixture_features(history_df, fixtures_df, teams_df, players_df):
    pid_to_team = players_df.set_index("player_id")["team_id"].to_dict()
    history_df = history_df.copy()
    history_df["team_id"] = history_df["player_id"].map(pid_to_team)

    # Check what columns fixtures_df actually has and adapt
    fix = fixtures_df.copy()

    # Rename columns if they come in raw FPL format
    col_renames = {
        "event": "gw",
        "team_h": "home_team",
        "team_a": "away_team",
        "team_h_difficulty": "home_fdr",
        "team_a_difficulty": "away_fdr",
    }
    for old, new in col_renames.items():
        if old in fix.columns and new not in fix.columns:
            fix = fix.rename(columns={old: new})

    # Drop rows with no GW (future unscheduled fixtures)
    fix = fix.dropna(subset=["gw"])
    fix["gw"] = fix["gw"].astype(int)

    # Build home and away views
    needed = ["gw","home_team","away_team","home_fdr","away_fdr"]
    missing = [c for c in needed if c not in fix.columns]
    if missing:
        # Fallback: add fixture features as defaults
        history_df["is_home"] = 0
        history_df["fdr"] = 3.0
        history_df["fdr_weighted"] = 0.5
        history_df["opp_att_strength_norm"] = 0.5
        history_df["opp_def_strength_norm"] = 0.5
        return history_df

    home_fix = fix[["gw","home_team","away_team","home_fdr","away_fdr"]].copy()
    home_fix = home_fix.rename(columns={"home_team":"team_id","away_team":"opponent_id","home_fdr":"fdr","away_fdr":"opp_fdr"})
    home_fix["is_home"] = 1

    away_fix = fix[["gw","away_team","home_team","away_fdr","home_fdr"]].copy()
    away_fix = away_fix.rename(columns={"away_team":"team_id","home_team":"opponent_id","away_fdr":"fdr","home_fdr":"opp_fdr"})
    away_fix["is_home"] = 0

    all_fix = pd.concat([home_fix, away_fix], ignore_index=True)

    # Merge team strengths if available
    t_cols = ["team_id","str_attack_h","str_attack_a","str_defence_h","str_defence_a"]
    t_cols = [c for c in t_cols if c in teams_df.columns]
    if len(t_cols) > 1:
        all_fix = all_fix.merge(
            teams_df[t_cols].rename(columns={
                "team_id":"opponent_id",
                "str_attack_h":"opp_att_h","str_attack_a":"opp_att_a",
                "str_defence_h":"opp_def_h","str_defence_a":"opp_def_a"
            }),
            on="opponent_id", how="left"
        )
        all_fix["opp_att_strength"] = np.where(
            all_fix["is_home"]==1,
            all_fix.get("opp_att_a", pd.Series(1200, index=all_fix.index)),
            all_fix.get("opp_att_h", pd.Series(1200, index=all_fix.index))
        )
        all_fix["opp_def_strength"] = np.where(
            all_fix["is_home"]==1,
            all_fix.get("opp_def_a", pd.Series(1200, index=all_fix.index)),
            all_fix.get("opp_def_h", pd.Series(1200, index=all_fix.index))
        )
        for col in ["opp_att_strength","opp_def_strength"]:
            cmin = all_fix[col].min()
            cmax = all_fix[col].max()
            all_fix[f"{col}_norm"] = (all_fix[col]-cmin) / (cmax-cmin+1e-9)
    else:
        all_fix["opp_att_strength_norm"] = 0.5
        all_fix["opp_def_strength_norm"] = 0.5

    all_fix["fdr_weighted"] = 0.6*(all_fix["fdr"]/5.0) + 0.4*all_fix.get("opp_att_strength_norm", 0.5)

    merge_cols = ["gw","team_id","is_home","fdr","fdr_weighted","opp_att_strength_norm","opp_def_strength_norm"]
    merge_cols = [c for c in merge_cols if c in all_fix.columns]

    history_df = history_df.merge(all_fix[merge_cols], on=["gw","team_id"], how="left")

    # Fill missing fixture data with sensible defaults
    defaults = {"is_home":0, "fdr":3.0, "fdr_weighted":0.5, "opp_att_strength_norm":0.5, "opp_def_strength_norm":0.5}
    for col, default in defaults.items():
        if col not in history_df.columns:
            history_df[col] = default
        else:
            history_df[col] = history_df[col].fillna(default)

    return history_df

def add_position_features(history_df, players_df):
    pos_map = players_df.set_index("player_id")["position"].to_dict()
    history_df = history_df.copy()
    history_df["position"] = history_df["player_id"].map(pos_map)
    pos_dummies = pd.get_dummies(history_df["position"], prefix="pos")
    history_df = pd.concat([history_df, pos_dummies], axis=1)
    history_df["cs_value"] = history_df["position"].map({"GKP":6,"DEF":6,"MID":1,"FWD":0}).fillna(0)
    return history_df

def add_price_features(history_df, players_df):
    price_map = players_df.set_index("player_id")["price"].to_dict()
    history_df = history_df.copy()
    history_df["price"] = history_df["player_id"].map(price_map)
    history_df["price"] = pd.to_numeric(history_df["price"], errors="coerce").fillna(5.0)
    history_df["pts_per_million"] = history_df["points"] / history_df["price"].replace(0,1)
    history_df["pts_per_million_roll5"] = (
        history_df.groupby("player_id")["pts_per_million"]
        .transform(lambda x: x.shift(1).rolling(5, min_periods=1).mean())
    )
    return history_df

def build_feature_matrix(history_df, fixtures_df, teams_df, players_df, target_gw=None):
    print("Engineering features...")
    df = add_rolling_features(history_df)
    df = add_fixture_features(df, fixtures_df, teams_df, players_df)
    df = add_position_features(df, players_df)
    df = add_price_features(df, players_df)
    df = df.sort_values(["player_id","gw"])
    df["target_points"] = df.groupby("player_id")["points"].shift(-1)
    if target_gw is not None:
        df = df[df["gw"] == target_gw - 1].copy()
    else:
        df = df.dropna(subset=["target_points"])
    feature_cols = [
        "points_roll3","points_roll5","points_roll8",
        "minutes_roll3","minutes_roll5","minutes_roll3_ratio","minutes_roll5_ratio",
        "goals_roll3","goals_roll5","assists_roll3","assists_roll5",
        "clean_sheets_roll3","clean_sheets_roll5","bonus_roll3","bonus_roll5",
        "xg_roll3","xg_roll5","xa_roll3","xa_roll5","xgi_roll3","xgi_roll5",
        "xgc_roll3","xgc_roll5","saves_roll3","saves_roll5",
        "is_home","fdr","fdr_weighted","opp_att_strength_norm","opp_def_strength_norm",
        "pos_GKP","pos_DEF","pos_MID","pos_FWD","cs_value",
        "price","pts_per_million_roll5","cumulative_pts","ownership_delta",
    ]
    available = [c for c in feature_cols if c in df.columns]
    df_features = df[["player_id","gw"] + available].copy()
    if "target_points" in df.columns:
        df_features["target_points"] = df["target_points"].values
    df_features[available] = df_features[available].fillna(0)
    print(f"Feature matrix shape: {df_features.shape}")
    return df_features, available
