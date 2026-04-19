import os
import numpy as np
import pandas as pd
import joblib
from pathlib import Path
from sklearn.ensemble import ExtraTreesRegressor
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
import xgboost as xgb

MODEL_DIR = Path(__file__).parent / "saved_models"
MODEL_DIR.mkdir(exist_ok=True)


def train_oracle_models(features_df: pd.DataFrame, feature_cols: list) -> dict:
    """
    Train XGBoost + ExtraTrees + Ridge ensemble.
    LightGBM removed — requires libgomp not available in slim Docker image.
    """
    if "target_points" not in features_df.columns:
        print("  No target_points column — skipping ML training, using PPG fallback")
        return {}

    df = features_df.dropna(subset=["target_points"])
    if len(df) < 50:
        print(f"  Only {len(df)} training rows — skipping ML training")
        return {}

    avail = [c for c in feature_cols if c in df.columns]
    X = df[avail].fillna(0).values.astype(np.float32)
    y = df["target_points"].clip(0, 25).values.astype(np.float32)

    X_tr, X_val, y_tr, y_val = train_test_split(X, y, test_size=0.15, random_state=42)
    print(f"  Training on {len(X_tr)} rows, validating on {len(X_val)}...")

    # XGBoost
    print("  Training XGBoost...")
    xgb_m = xgb.XGBRegressor(
        n_estimators=300, max_depth=4, learning_rate=0.06,
        subsample=0.8, colsample_bytree=0.8,
        objective="reg:squarederror", random_state=42, n_jobs=-1,
        early_stopping_rounds=20, eval_metric="rmse",
    )
    xgb_m.fit(X_tr, y_tr, eval_set=[(X_val, y_val)], verbose=False)

    # ExtraTrees (replaces LightGBM — no system dependencies)
    print("  Training ExtraTrees...")
    et_m = ExtraTreesRegressor(
        n_estimators=200, max_depth=8,
        min_samples_leaf=3, random_state=42, n_jobs=-1
    )
    et_m.fit(X_tr, y_tr)

    # Ridge
    print("  Training Ridge...")
    scaler = StandardScaler()
    ridge_m = Ridge(alpha=10.0)
    ridge_m.fit(scaler.fit_transform(X_tr), y_tr)

    # Ensemble validation
    ensemble = (0.55 * xgb_m.predict(X_val)
                + 0.25 * et_m.predict(X_val)
                + 0.20 * ridge_m.predict(scaler.transform(X_val)))
    mae = float(np.mean(np.abs(ensemble - y_val)))
    print(f"  Ensemble MAE: {mae:.3f} pts")

    models = {
        "xgb": xgb_m, "lgb": et_m,  # key stays "lgb" so predict.py works unchanged
        "ridge": ridge_m, "scaler": scaler, "feature_cols": avail
    }
    for name, obj in models.items():
        joblib.dump(obj, MODEL_DIR / f"{name}.pkl")
    print(f"  Models saved to {MODEL_DIR}")
    return models


def load_models():
    try:
        return {k: joblib.load(MODEL_DIR / f"{k}.pkl")
                for k in ["xgb", "lgb", "ridge", "scaler", "feature_cols"]}
    except FileNotFoundError:
        return None
