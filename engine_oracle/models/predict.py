"""
Oracle Prediction Engine
- XGBoost + LightGBM + Ridge ensemble
- DGW/BGW fixture multipliers on every horizon GW
- Availability probability weighting
"""
import numpy as np
import pandas as pd
import joblib, os

XGB_W   = 0.50
LGB_W   = 0.30
RIDGE_W = 0.20

GW_DECAY = {0: 1.00, 1: 0.88, 2: 0.76, 3: 0.65,
            4: 0.55, 5: 0.47, 6: 0.40, 7: 0.34}

FDR_MULT = {1: 1.12, 2: 1.06, 3: 1.00, 4: 0.94, 5: 0.88}

MODEL_DIR = os.path.join(os.path.dirname(__file__), "saved_models")


def load_models():
    """Import from train.py to keep single source of truth."""
    from models.train import load_models as _load
    return _load()


def predict_oracle_xp(
    features_df: pd.DataFrame,
    players_df: pd.DataFrame,
    fixtures_df: pd.DataFrame,
    current_gw: int,
    models: dict | None = None,
    horizon: int = 8,
) -> pd.DataFrame:
    """
    Returns DataFrame with columns:
        player_id, name, team_short, position, price,
        ownership_pct, availability_prob, rotation_risk,
        xp[0..7]  (one per GW in horizon),
        xp_total, captain_score, is_differential
    """
    if models is None:
        models = load_models()

    # Build player → team lookup
    pid_to_team = players_df.set_index("player_id")["team_id"].to_dict()

    feature_cols = models["feature_cols"] if models else []

    if models:
        X = features_df.reindex(columns=feature_cols, fill_value=0).values.astype(np.float32)
        xgb_p   = models["xgb"].predict(X)
        lgb_p   = models["lgb"].predict(X) if "lgb" in models and models["lgb"] is not None else xgb_p
        ridge_p = models["ridge"].predict(models["scaler"].transform(X))
        xp_base = np.clip(XGB_W * xgb_p + LGB_W * lgb_p + RIDGE_W * ridge_p, 0, 25)
    else:
        # No models trained yet — use ppg as base estimate
        ppg_map = players_df.set_index("player_id")["ppg"].to_dict()
        xp_base = np.array([
            ppg_map.get(pid, 3.0)
            for pid in features_df["player_id"].values
        ], dtype=float)

    # FDR multiplier for current GW
    if "fdr_dynamic" in features_df.columns:
        fdr_mult = features_df["fdr_dynamic"].apply(
            lambda x: FDR_MULT.get(int(round(float(x))), 1.0) if x == x and x is not None else 1.0 if x == x else 1.0
        ).values
    else:
        fdr_mult = np.ones(len(features_df))

    # Availability: use pipeline-derived value (0=injured, 0.5=doubtful, 1=fit)
    if "availability" in players_df.columns:
        pid_to_avail = players_df.set_index("player_id")["availability"].to_dict()
        avail_prob   = np.array([pid_to_avail.get(int(pid), 1.0)
                                 for pid in features_df["player_id"].values], dtype=float)
    else:
        avail_prob = np.ones(len(features_df))
    # Further dampen by rotation risk if available
    if "rotation_risk" in features_df.columns:
        avail_prob = avail_prob * (1 - features_df["rotation_risk"].fillna(0).values * 0.25)
    avail_prob = avail_prob.clip(0.0, 1.0)

    # Build fixture count matrix: shape (n_players, horizon)
    from data.pipeline import get_fixture_count
    pids = features_df["player_id"].values
    fc_matrix = np.ones((len(pids), horizon))
    for t in range(horizon):
        gw_t = current_gw + t
        for j, pid in enumerate(pids):
            team_id = pid_to_team.get(pid)
            fc_matrix[j, t] = get_fixture_count(fixtures_df, int(team_id), gw_t) if team_id else 1

    # Compute xP per GW: base × fdr (GW0 only) × decay × fixture_count × avail_prob
    xp_horizons = []
    for t in range(horizon):
        fdr_factor = fdr_mult if t == 0 else np.ones(len(features_df))
        decay      = GW_DECAY.get(t, GW_DECAY[7])
        xp_t = xp_base * fdr_factor * decay * fc_matrix[:, t] * avail_prob
        xp_horizons.append(np.round(xp_t, 3))

    results = features_df[["player_id"]].copy()
    xp_total = np.zeros(len(features_df))
    for t, xp_t in enumerate(xp_horizons):
        results[f"xp_gw{t+1}"] = xp_t
        xp_total += xp_t

    results["xp_total"]      = np.round(xp_total, 2)
    results["availability"]  = np.round(avail_prob, 3)
    results["fixture_count_gw1"] = fc_matrix[:, 0].astype(int)
    results["fixture_count_gw2"] = fc_matrix[:, 1].astype(int) if horizon > 1 else 1
    results["fixture_count_gw3"] = fc_matrix[:, 2].astype(int) if horizon > 2 else 1

    # Merge metadata
    meta_cols = ["player_id", "name", "position", "price", "ownership_pct",
                 "status", "photo", "team_short"]
    meta = players_df[[c for c in meta_cols if c in players_df.columns]].copy()
    results = results.merge(meta, on="player_id", how="left")

    results["captain_score"]   = results["xp_gw1"] * 2
    results["is_differential"] = (
        (results["ownership_pct"] < 12.0) &
        (results["xp_total"] > results["xp_total"].quantile(0.72))
    )
    return results.sort_values("xp_total", ascending=False).reset_index(drop=True)
