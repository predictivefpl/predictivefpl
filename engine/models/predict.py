import numpy as np
import pandas as pd

XGB_WEIGHT = 0.50
RF_WEIGHT  = 0.30
RIDGE_WEIGHT = 0.20
GW_DECAY = {1: 1.00, 2: 0.85, 3: 0.72}
FDR_MULTIPLIER = {1: 1.12, 2: 1.06, 3: 1.00, 4: 0.94, 5: 0.88}


def load_models():
    import os, joblib
    MODEL_DIR = os.path.join(os.path.dirname(__file__), "saved_models")
    try:
        return {
            "xgb":         joblib.load(os.path.join(MODEL_DIR, "xgb_model.pkl")),
            "rf":          joblib.load(os.path.join(MODEL_DIR, "rf_model.pkl")),
            "ridge":       joblib.load(os.path.join(MODEL_DIR, "ridge_model.pkl")),
            "scaler":      joblib.load(os.path.join(MODEL_DIR, "scaler.pkl")),
            "feature_cols":joblib.load(os.path.join(MODEL_DIR, "feature_cols.pkl")),
        }
    except FileNotFoundError:
        return None


def _team_fixture_count(fixtures_df, team_id, gw):
    """Return how many fixtures a team plays in a given GW (0=BGW, 1=normal, 2=DGW)."""
    if fixtures_df is None or fixtures_df.empty:
        return 1  # assume normal if no data
    # Handle both raw FPL column names and renamed versions
    gw_col  = "gw"    if "gw"    in fixtures_df.columns else "event"
    h_col   = "team_h" if "team_h" in fixtures_df.columns else "home_team"
    a_col   = "team_a" if "team_a" in fixtures_df.columns else "away_team"
    if gw_col not in fixtures_df.columns:
        return 1
    mask = (
        (fixtures_df[gw_col] == gw) &
        ((fixtures_df[h_col] == team_id) | (fixtures_df[a_col] == team_id))
    )
    return int(mask.sum())


def _build_fixture_multiplier(fixtures_df, players_df, current_gw, offset):
    """
    Build a Series (indexed by player_id) of fixture multipliers for current_gw + offset.
    offset=1 → next GW (xp_gw2 in the 3-GW horizon), offset=2 → GW after that (xp_gw3).
    Returns multiplier: 0 for BGW, 1 for normal, 2 for DGW.
    """
    target_gw = current_gw + offset
    if fixtures_df is None or fixtures_df.empty or "team_id" not in players_df.columns:
        return pd.Series(1.0, index=players_df["player_id"])

    pid_to_team = players_df.set_index("player_id")["team_id"].to_dict()
    multipliers = {
        pid: _team_fixture_count(fixtures_df, team_id, target_gw)
        for pid, team_id in pid_to_team.items()
    }
    return pd.Series(multipliers)


def predict_xp(features_df, players_df, upcoming_fixtures=None, models=None,
               gw_horizons=3, full_fixtures_df=None, current_gw=None):
    """
    Predict xP for each player.

    full_fixtures_df : the complete fixtures DataFrame (all GWs) — used to
                       correctly weight DGW/BGW players for future gameweeks.
    current_gw       : integer, the GW being predicted for.
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

    # Apply FDR multiplier for current GW
    if "fdr" in features_df.columns:
        fdr_mult = features_df["fdr"].apply(
            lambda x: FDR_MULTIPLIER.get(int(round(float(x))), 1.0)
        )
        xp_gw1 = xp_base * fdr_mult.values
    else:
        xp_gw1 = xp_base

    # ── DGW / BGW awareness for future GWs ──────────────────────────────────
    # If we have fixture schedule data, use real fixture counts per team.
    # Otherwise fall back to the old decay-only approach.
    fix_df = full_fixtures_df if full_fixtures_df is not None else upcoming_fixtures

    if fix_df is not None and not fix_df.empty and current_gw is not None and "player_id" in features_df.columns:
        pid_series = features_df["player_id"].values

        # Build team_id lookup for the players in features_df
        pid_to_team = players_df.set_index("player_id")["team_id"].to_dict()             if "team_id" in players_df.columns else {}

        gw_col = "gw"    if "gw"    in fix_df.columns else "event"
        h_col  = "team_h" if "team_h" in fix_df.columns else "home_team"
        a_col  = "team_a" if "team_a" in fix_df.columns else "away_team"

        def fixture_mult(pid, offset):
            team_id = pid_to_team.get(pid)
            if team_id is None or gw_col not in fix_df.columns:
                return GW_DECAY[min(offset + 1, 3)]
            count = int(((fix_df[gw_col] == current_gw + offset) &
                         ((fix_df[h_col] == team_id) | (fix_df[a_col] == team_id))).sum())
            # count=0 → BGW (0 pts expected), count=2 → DGW (doubled)
            return count * GW_DECAY[1]  # decay[1]=1.0; we scale by actual games

        mult_gw2 = np.array([fixture_mult(pid, 1) for pid in pid_series])
        mult_gw3 = np.array([fixture_mult(pid, 2) for pid in pid_series])

        xp_gw2 = xp_base * mult_gw2   # DGW: ~2x base, BGW: 0, normal: ~1x
        xp_gw3 = xp_base * mult_gw3

        print(f"  DGW/BGW multipliers applied: "
              f"GW+1 range [{mult_gw2.min():.1f}-{mult_gw2.max():.1f}], "
              f"GW+2 range [{mult_gw3.min():.1f}-{mult_gw3.max():.1f}]")
    else:
        # Fallback: decay only (no fixture data available)
        xp_gw2 = xp_gw1 * GW_DECAY[2]
        xp_gw3 = xp_gw1 * GW_DECAY[3]
        print("  Warning: no fixture schedule for DGW/BGW weighting — using decay only.")

    xp_total = xp_gw1 + xp_gw2 + xp_gw3

    results = features_df[["player_id"]].copy()
    results["xp_gw1"]  = np.round(xp_gw1,  2)
    results["xp_gw2"]  = np.round(xp_gw2,  2)
    results["xp_gw3"]  = np.round(xp_gw3,  2)
    results["xp_total"] = np.round(xp_total, 2)

    meta_cols = ["player_id", "name", "position", "price", "ownership_pct", "status"]
    if "team_short" in players_df.columns:
        meta_cols.insert(2, "team_short")
    meta = players_df[[c for c in meta_cols if c in players_df.columns]].copy()
    results = results.merge(meta, on="player_id", how="left")

    results["captain_score"]  = results["xp_gw1"] * 2
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
    } for _, r in top.iterrows()]


def get_differentials(predictions_df, top_n=5):
    diffs = predictions_df[predictions_df["is_differential"]].nlargest(top_n, "xp_total")
    return [{
        "player_id": int(r["player_id"]),
        "name":      r.get("name", "Unknown"),
        "team":      r.get("team_short", r.get("team", "")),
        "position":  r.get("position", ""),
        "xp_total":  float(r["xp_total"]),
        "xp_gw1":   float(r["xp_gw1"]),
        "ownership": float(r.get("ownership_pct", 0)),
    } for _, r in diffs.iterrows()]


def get_essential_picks(predictions_df, top_n=5):
    essentials = predictions_df.nlargest(top_n, "xp_total")
    return [{
        "player_id": int(r["player_id"]),
        "name":      r.get("name", "Unknown"),
        "team":      r.get("team_short", r.get("team", "")),
        "position":  r.get("position", ""),
        "xp_gw1":   float(r["xp_gw1"]),
        "xp_gw2":   float(r["xp_gw2"]),
        "xp_gw3":   float(r["xp_gw3"]),
        "xp_total":  float(r["xp_total"]),
        "ownership": float(r.get("ownership_pct", 0)),
    } for _, r in essentials.iterrows()]
