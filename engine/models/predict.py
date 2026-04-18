import numpy as np
import pandas as pd

XGB_WEIGHT   = 0.50
RF_WEIGHT    = 0.30
RIDGE_WEIGHT = 0.20
GW_DECAY     = {1: 1.00, 2: 0.85, 3: 0.72}
FDR_MULTIPLIER = {1: 1.12, 2: 1.06, 3: 1.00, 4: 0.94, 5: 0.88}


def load_models():
    import os, joblib
    MODEL_DIR = os.path.join(os.path.dirname(__file__), "saved_models")
    try:
        return {
            "xgb":          joblib.load(os.path.join(MODEL_DIR, "xgb_model.pkl")),
            "rf":           joblib.load(os.path.join(MODEL_DIR, "rf_model.pkl")),
            "ridge":        joblib.load(os.path.join(MODEL_DIR, "ridge_model.pkl")),
            "scaler":       joblib.load(os.path.join(MODEL_DIR, "scaler.pkl")),
            "feature_cols": joblib.load(os.path.join(MODEL_DIR, "feature_cols.pkl")),
        }
    except FileNotFoundError:
        return None


def _fixture_counts_for_gw(fixtures_df, gw):
    """
    Returns dict {team_id: fixture_count} for the given GW.
    0 = blank, 1 = normal, 2 = double gameweek.
    Handles both raw FPL column names (event/team_h/team_a) and renamed versions (gw/home_team/away_team).
    """
    if fixtures_df is None or fixtures_df.empty:
        return {}

    gw_col = "gw"    if "gw"     in fixtures_df.columns else "event"
    h_col  = "team_h" if "team_h" in fixtures_df.columns else "home_team"
    a_col  = "team_a" if "team_a" in fixtures_df.columns else "away_team"

    if gw_col not in fixtures_df.columns:
        return {}

    gw_fixtures = fixtures_df[fixtures_df[gw_col] == gw]
    counts = {}
    for _, row in gw_fixtures.iterrows():
        for col in [h_col, a_col]:
            tid = row.get(col)
            if tid is not None and not pd.isna(tid):
                tid = int(tid)
                counts[tid] = counts.get(tid, 0) + 1
    return counts


def predict_xp(features_df, players_df, upcoming_fixtures=None, models=None,
               gw_horizons=3, full_fixtures_df=None, current_gw=None):
    """
    Predict xP for each player with full DGW / BGW awareness.

    full_fixtures_df : complete fixtures DataFrame (all GWs)
    current_gw       : the GW being predicted
    """
    if models is None:
        models = load_models()
        if models is None:
            raise RuntimeError("No trained models found. Run train first.")

    feature_cols = models["feature_cols"]
    X = features_df.reindex(columns=feature_cols, fill_value=0).values.astype(np.float32)

    xgb_p   = models["xgb"].predict(X)
    rf_p    = models["rf"].predict(X)
    ridge_p = models["ridge"].predict(models["scaler"].transform(X))
    xp_base = np.clip(XGB_WEIGHT * xgb_p + RF_WEIGHT * rf_p + RIDGE_WEIGHT * ridge_p, 0, 25)

    # Use full_fixtures_df if provided, else fall back to upcoming_fixtures
    fix_df = full_fixtures_df if full_fixtures_df is not None else upcoming_fixtures

    # Build player_id → team_id map
    pid_to_team = {}
    if "team_id" in players_df.columns:
        pid_to_team = players_df.set_index("player_id")["team_id"].to_dict()

    def get_multipliers(gw):
        """Return array of per-player fixture multipliers for a given GW."""
        if fix_df is None or fix_df.empty or gw is None:
            return np.ones(len(features_df))
        counts = _fixture_counts_for_gw(fix_df, gw)
        if not counts:
            return np.ones(len(features_df))
        result = []
        for pid in features_df["player_id"].values:
            team_id = pid_to_team.get(pid)
            fc = counts.get(int(team_id), 1) if team_id is not None else 1
            result.append(fc)
        return np.array(result, dtype=float)

    # ── GW1 (current GW): FDR adjustment + DGW multiplier ────────────────────
    if "fdr" in features_df.columns:
        fdr_mult = features_df["fdr"].apply(
            lambda x: FDR_MULTIPLIER.get(int(round(float(x))), 1.0)
        ).values
    else:
        fdr_mult = np.ones(len(features_df))

    gw1_fixture_mult = get_multipliers(current_gw)
    xp_gw1 = xp_base * fdr_mult * gw1_fixture_mult

    # ── GW2 & GW3: decay × fixture count ─────────────────────────────────────
    if current_gw is not None and fix_df is not None and not fix_df.empty:
        gw2_mult = get_multipliers(current_gw + 1) * GW_DECAY[2]
        gw3_mult = get_multipliers(current_gw + 2) * GW_DECAY[3]
        xp_gw2 = xp_base * gw2_mult
        xp_gw3 = xp_base * gw3_mult

        dgw1 = int((gw1_fixture_mult == 2).sum())
        bgw1 = int((gw1_fixture_mult == 0).sum())
        dgw2 = int((get_multipliers(current_gw + 1) == 2).sum())
        bgw2 = int((get_multipliers(current_gw + 1) == 0).sum())
        print(f"  GW{current_gw}:   {dgw1} DGW players, {bgw1} BGW players")
        print(f"  GW{current_gw+1}: {dgw2} DGW players, {bgw2} BGW players")
    else:
        xp_gw2 = xp_gw1 * GW_DECAY[2]
        xp_gw3 = xp_gw1 * GW_DECAY[3]
        print("  Warning: no fixture schedule — using decay only")

    xp_total = xp_gw1 + xp_gw2 + xp_gw3

    results = features_df[["player_id"]].copy()
    results["xp_gw1"]   = np.round(xp_gw1,  2)
    results["xp_gw2"]   = np.round(xp_gw2,  2)
    results["xp_gw3"]   = np.round(xp_gw3,  2)
    results["xp_total"] = np.round(xp_total, 2)

    # Store fixture counts per player for frontend use
    results["fixture_count_gw1"] = gw1_fixture_mult.astype(int)
    if current_gw is not None and fix_df is not None and not fix_df.empty:
        results["fixture_count_gw2"] = get_multipliers(current_gw + 1).astype(int)
        results["fixture_count_gw3"] = get_multipliers(current_gw + 2).astype(int)
    else:
        results["fixture_count_gw2"] = 1
        results["fixture_count_gw3"] = 1

    meta_cols = ["player_id", "name", "position", "price", "ownership_pct", "status"]
    if "team_short" in players_df.columns:
        meta_cols.insert(2, "team_short")
    meta = players_df[[c for c in meta_cols if c in players_df.columns]].copy()
    results = results.merge(meta, on="player_id", how="left")

    results["captain_score"]   = results["xp_gw1"] * 2
    results["is_differential"] = (
        (results["ownership_pct"] < 15.0) &
        (results["xp_total"] > results["xp_total"].quantile(0.7))
    )
    results["is_essential"]  = results["xp_total"] > results["xp_total"].quantile(0.80)
    results["xp_confidence"] = 1.2

    return results.sort_values("xp_total", ascending=False).reset_index(drop=True)


def get_captain_recommendations(predictions_df, top_n=3):
    top = predictions_df.nlargest(top_n, "captain_score")
    return [{
        "player_id":     int(r["player_id"]),
        "name":          r.get("name", "Unknown"),
        "team":          r.get("team_short", r.get("team", "")),
        "position":      r.get("position", ""),
        "xp_next_gw":   float(r["xp_gw1"]),
        "captain_score": float(r["captain_score"]),
        "ownership":     float(r.get("ownership_pct", 0)),
        "fixture_count": int(r.get("fixture_count_gw1", 1)),
    } for _, r in top.iterrows()]


def get_differentials(predictions_df, top_n=5):
    diffs = predictions_df[predictions_df["is_differential"]].nlargest(top_n, "xp_total")
    return [{
        "player_id":     int(r["player_id"]),
        "name":          r.get("name", "Unknown"),
        "team":          r.get("team_short", r.get("team", "")),
        "position":      r.get("position", ""),
        "xp_total":     float(r["xp_total"]),
        "xp_gw1":       float(r["xp_gw1"]),
        "ownership":    float(r.get("ownership_pct", 0)),
        "fixture_count": int(r.get("fixture_count_gw1", 1)),
    } for _, r in diffs.iterrows()]


def get_essential_picks(predictions_df, top_n=5):
    essentials = predictions_df.nlargest(top_n, "xp_total")
    return [{
        "player_id":     int(r["player_id"]),
        "name":          r.get("name", "Unknown"),
        "team":          r.get("team_short", r.get("team", "")),
        "position":      r.get("position", ""),
        "xp_gw1":       float(r["xp_gw1"]),
        "xp_gw2":       float(r["xp_gw2"]),
        "xp_gw3":       float(r["xp_gw3"]),
        "xp_total":     float(r["xp_total"]),
        "ownership":    float(r.get("ownership_pct", 0)),
        "fixture_count_gw1": int(r.get("fixture_count_gw1", 1)),
        "fixture_count_gw2": int(r.get("fixture_count_gw2", 1)),
        "fixture_count_gw3": int(r.get("fixture_count_gw3", 1)),
    } for _, r in essentials.iterrows()]
