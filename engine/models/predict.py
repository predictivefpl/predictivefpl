import numpy as np
import pandas as pd

XGB_WEIGHT = 0.50
RF_WEIGHT = 0.30
RIDGE_WEIGHT = 0.20
GW_DECAY = {1:1.00, 2:0.85, 3:0.72}
FDR_MULTIPLIER = {1:1.12, 2:1.06, 3:1.00, 4:0.94, 5:0.88}

def load_models():
    import os, joblib
    MODEL_DIR = os.path.join(os.path.dirname(__file__), "saved_models")
    try:
        return {
            "xgb": joblib.load(os.path.join(MODEL_DIR,"xgb_model.pkl")),
            "rf": joblib.load(os.path.join(MODEL_DIR,"rf_model.pkl")),
            "ridge": joblib.load(os.path.join(MODEL_DIR,"ridge_model.pkl")),
            "scaler": joblib.load(os.path.join(MODEL_DIR,"scaler.pkl")),
            "feature_cols": joblib.load(os.path.join(MODEL_DIR,"feature_cols.pkl")),
        }
    except FileNotFoundError:
        return None

def predict_xp(features_df, players_df, upcoming_fixtures=None, models=None, gw_horizons=3):
    if models is None:
        models = load_models()
        if models is None:
            raise RuntimeError("No trained models found. Run train first.")
    feature_cols = models["feature_cols"]
    X = features_df.reindex(columns=feature_cols, fill_value=0).values.astype(np.float32)
    xgb_p = models["xgb"].predict(X)
    rf_p = models["rf"].predict(X)
    ridge_p = models["ridge"].predict(models["scaler"].transform(X))
    xp_gw1 = np.clip(XGB_WEIGHT*xgb_p + RF_WEIGHT*rf_p + RIDGE_WEIGHT*ridge_p, 0, 25)
    if "fdr" in features_df.columns:
        fdr_mult = features_df["fdr"].apply(lambda x: FDR_MULTIPLIER.get(int(round(float(x))), 1.0))
        xp_gw1 = xp_gw1 * fdr_mult.values
    xp_gw2 = xp_gw1 * GW_DECAY[2]
    xp_gw3 = xp_gw1 * GW_DECAY[3]
    xp_total = xp_gw1 + xp_gw2 + xp_gw3
    results = features_df[["player_id"]].copy()
    results["xp_gw1"] = np.round(xp_gw1, 2)
    results["xp_gw2"] = np.round(xp_gw2, 2)
    results["xp_gw3"] = np.round(xp_gw3, 2)
    results["xp_total"] = np.round(xp_total, 2)
    meta_cols = ["player_id","name","position","price","ownership_pct","status"]
    if "team_short" in players_df.columns:
        meta_cols.insert(2, "team_short")
    meta = players_df[[c for c in meta_cols if c in players_df.columns]].copy()
    results = results.merge(meta, on="player_id", how="left")
    results["captain_score"] = results["xp_gw1"] * 2
    results["is_differential"] = (
        (results["ownership_pct"] < 15.0) &
        (results["xp_total"] > results["xp_total"].quantile(0.7))
    )
    results["is_essential"] = results["xp_total"] > results["xp_total"].quantile(0.80)
    results["xp_confidence"] = 1.2
    return results.sort_values("xp_total", ascending=False).reset_index(drop=True)

def get_captain_recommendations(predictions_df, top_n=3):
    top = predictions_df.nlargest(top_n, "captain_score")
    return [{
        "player_id": int(r["player_id"]),
        "name": r.get("name","Unknown"),
        "team": r.get("team_short", r.get("team","")),
        "position": r.get("position",""),
        "xp_next_gw": float(r["xp_gw1"]),
        "captain_score": float(r["captain_score"]),
        "ownership": float(r.get("ownership_pct",0)),
    } for _, r in top.iterrows()]

def get_differentials(predictions_df, top_n=5):
    diffs = predictions_df[predictions_df["is_differential"]].nlargest(top_n, "xp_total")
    return [{
        "player_id": int(r["player_id"]),
        "name": r.get("name","Unknown"),
        "team": r.get("team_short", r.get("team","")),
        "position": r.get("position",""),
        "xp_total": float(r["xp_total"]),
        "xp_gw1": float(r["xp_gw1"]),
        "ownership": float(r.get("ownership_pct",0)),
    } for _, r in diffs.iterrows()]

def get_essential_picks(predictions_df, top_n=5):
    essentials = predictions_df.nlargest(top_n, "xp_total")
    return [{
        "player_id": int(r["player_id"]),
        "name": r.get("name","Unknown"),
        "team": r.get("team_short", r.get("team","")),
        "position": r.get("position",""),
        "xp_gw1": float(r["xp_gw1"]),
        "xp_gw2": float(r["xp_gw2"]),
        "xp_gw3": float(r["xp_gw3"]),
        "xp_total": float(r["xp_total"]),
        "ownership": float(r.get("ownership_pct",0)),
    } for _, r in essentials.iterrows()]
