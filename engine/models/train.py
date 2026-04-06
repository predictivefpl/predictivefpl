import os
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.preprocessing import StandardScaler
import xgboost as xgb

MODEL_DIR = os.path.join(os.path.dirname(__file__), "saved_models")
os.makedirs(MODEL_DIR, exist_ok=True)

XGB_WEIGHT = 0.50
RF_WEIGHT = 0.30
RIDGE_WEIGHT = 0.20

def get_xgb_model():
    return xgb.XGBRegressor(
        n_estimators=500, max_depth=5, learning_rate=0.05,
        subsample=0.8, colsample_bytree=0.8, min_child_weight=3,
        reg_alpha=0.1, reg_lambda=1.0, random_state=42, n_jobs=-1, verbosity=0,
    )

def get_rf_model():
    return RandomForestRegressor(
        n_estimators=300, max_depth=8, min_samples_leaf=5,
        max_features=0.7, random_state=42, n_jobs=-1,
    )

def get_ridge_model():
    return Ridge(alpha=10.0)

def validate_with_timeseries_split(X, y, gw_indices, n_splits=5):
    sort_order = np.argsort(gw_indices)
    X = X[sort_order]; y = y[sort_order]; gw_indices = gw_indices[sort_order]
    tscv = TimeSeriesSplit(n_splits=n_splits)
    results = {"xgb":[],"rf":[],"ridge":[],"ensemble":[]}
    print(f"\nTime-series cross-validation ({n_splits} splits)...")
    for fold, (train_idx, val_idx) in enumerate(tscv.split(X)):
        X_train, X_val = X[train_idx], X[val_idx]
        y_train, y_val = y[train_idx], y[val_idx]
        scaler = StandardScaler()
        X_tr_sc = scaler.fit_transform(X_train)
        X_val_sc = scaler.transform(X_val)
        xgb_m = get_xgb_model()
        xgb_m.fit(X_train, y_train, eval_set=[(X_val,y_val)], verbose=False)
        rf_m = get_rf_model(); rf_m.fit(X_train, y_train)
        ridge_m = get_ridge_model(); ridge_m.fit(X_tr_sc, y_train)
        xgb_p = xgb_m.predict(X_val)
        rf_p = rf_m.predict(X_val)
        ridge_p = ridge_m.predict(X_val_sc)
        ens_p = np.clip(XGB_WEIGHT*xgb_p + RF_WEIGHT*rf_p + RIDGE_WEIGHT*ridge_p, 0, None)
        for name, pred in [("xgb",xgb_p),("rf",rf_p),("ridge",ridge_p),("ensemble",ens_p)]:
            mae = mean_absolute_error(y_val, pred)
            rmse = np.sqrt(mean_squared_error(y_val, pred))
            results[name].append({"fold":fold+1,"mae":mae,"rmse":rmse})
            if name == "ensemble":
                gw_range = f"GW{gw_indices[val_idx].min()}-{gw_indices[val_idx].max()}"
                print(f"  Fold {fold+1} ({gw_range}): MAE={mae:.3f}, RMSE={rmse:.3f}")
    return results

def train_models(features_df, feature_cols):
    print("\n=== Training Ensemble Models ===")
    df = features_df.dropna(subset=["target_points"]).copy()
    X = df[feature_cols].values.astype(np.float32)
    y = df["target_points"].values.astype(np.float32)
    gw_indices = df["gw"].values
    print(f"Training on {len(df)} samples, {len(feature_cols)} features")
    print(f"Target: mean={y.mean():.2f}, std={y.std():.2f}, max={y.max():.0f}")
    cv_results = validate_with_timeseries_split(X, y, gw_indices)
    print("\nValidation Summary:")
    for name, folds in cv_results.items():
        maes = [f["mae"] for f in folds]
        rmses = [f["rmse"] for f in folds]
        print(f"  {name.upper():10s}: MAE={np.mean(maes):.3f}+-{np.std(maes):.3f}, RMSE={np.mean(rmses):.3f}")
    print("\nTraining final models on full dataset...")
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    xgb_model = get_xgb_model(); xgb_model.fit(X, y)
    rf_model = get_rf_model(); rf_model.fit(X, y)
    ridge_model = get_ridge_model(); ridge_model.fit(X_scaled, y)
    importances = pd.DataFrame({
        "feature": feature_cols,
        "importance": xgb_model.feature_importances_,
    }).sort_values("importance", ascending=False)
    print("\nTop 15 Feature Importances:")
    print(importances.head(15).to_string(index=False))
    joblib.dump(xgb_model, os.path.join(MODEL_DIR, "xgb_model.pkl"))
    joblib.dump(rf_model, os.path.join(MODEL_DIR, "rf_model.pkl"))
    joblib.dump(ridge_model, os.path.join(MODEL_DIR, "ridge_model.pkl"))
    joblib.dump(scaler, os.path.join(MODEL_DIR, "scaler.pkl"))
    joblib.dump(feature_cols, os.path.join(MODEL_DIR, "feature_cols.pkl"))
    print(f"\nModels saved to {MODEL_DIR}")
    return {
        "xgb":xgb_model,"rf":rf_model,"ridge":ridge_model,
        "scaler":scaler,"feature_cols":feature_cols,
        "cv_results":cv_results,"importances":importances,
    }

def load_models():
    try:
        return {
            "xgb": joblib.load(os.path.join(MODEL_DIR, "xgb_model.pkl")),
            "rf": joblib.load(os.path.join(MODEL_DIR, "rf_model.pkl")),
            "ridge": joblib.load(os.path.join(MODEL_DIR, "ridge_model.pkl")),
            "scaler": joblib.load(os.path.join(MODEL_DIR, "scaler.pkl")),
            "feature_cols": joblib.load(os.path.join(MODEL_DIR, "feature_cols.pkl")),
        }
    except FileNotFoundError:
        return None
