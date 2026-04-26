"""
Oracle Engine API — FastAPI
Endpoints:
  GET  /oracle/status
  POST /oracle/train
  GET  /oracle/predictions
  POST /oracle/optimise
  GET  /oracle/fixtures
  GET  /oracle/captain
"""
import asyncio, os, sys, json
from pathlib import Path
from datetime import datetime
from fastapi import FastAPI, Request
from api.stripe_handler import create_checkout_session, stripe_webhook
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List

sys.path.insert(0, str(Path(__file__).parent.parent))

from data.pipeline import fetch_all_oracle_data
from features.engineering import build_oracle_features
from models.predict import predict_oracle_xp, load_models
from models.train import train_oracle_models
from optimizer.greedy_solver import solve_greedy

import pandas as pd
import aiohttp

app = FastAPI(title="Oracle FPL Engine", version="2.0.0")
app.add_middleware(CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
    allow_credentials=True)

CACHE_DIR  = Path(__file__).parent.parent / "cache"
CACHE_DIR.mkdir(exist_ok=True)
CACHE_FILE = CACHE_DIR / "oracle_predictions.json"

CACHE = {
    "predictions": None, "current_gw": None,
    "last_updated": None, "training_status": "idle",
    "dgw_map": {}, "bgw_map": {},
}


def _save_cache(preds, gw, dgw, bgw):
    data = {
        "predictions": preds, "current_gw": gw,
        "last_updated": datetime.now().isoformat(),
        "dgw_map": {str(k): v for k, v in dgw.items()},
        "bgw_map": {str(k): v for k, v in bgw.items()},
    }
    with open(CACHE_FILE, "w") as f:
        json.dump(data, f)
    CACHE.update({
        "predictions": preds, "current_gw": gw,
        "last_updated": data["last_updated"],
        "dgw_map": dgw, "bgw_map": bgw,
    })


def _load_cache():
    if CACHE_FILE.exists():
        try:
            data = json.load(open(CACHE_FILE))
            CACHE.update({
                "predictions":  data.get("predictions"),
                "current_gw":   data.get("current_gw"),
                "last_updated": data.get("last_updated"),
                "dgw_map":      {int(k): v for k, v in data.get("dgw_map", {}).items()},
                "bgw_map":      {int(k): v for k, v in data.get("bgw_map", {}).items()},
            })
            print(f"Oracle cache loaded: {len(CACHE['predictions'] or [])} players")
        except Exception as e:
            print(f"Cache load error: {e}")


@app.on_event("startup")
async def startup():
    _load_cache()
    print("Oracle Engine ready.")
    # Auto-train on startup if no predictions cached
    if not CACHE["predictions"]:
        print("No cache found — auto-training on startup...")
        CACHE["training_status"] = "training"
        import asyncio
        asyncio.create_task(_run_pipeline())


# ── Pydantic models ──────────────────────────────────────────────────────────
class OptimiseReq(BaseModel):
    budget:             float       = 100.0
    horizon:            int         = 8
    num_free_transfers: int         = 1
    current_squad_ids:  List[int]   = []
    objective:          str         = "total_xp"
    wildcard_available: bool        = True
    freehit_available:  bool        = True
    benchboost_available: bool      = True
    triplecaptain_available: bool   = True
    force_chip:         Optional[str] = None


# ── Endpoints ────────────────────────────────────────────────────────────────

@app.post("/stripe/checkout")
async def checkout(request: Request):
    return await create_checkout_session(request)

@app.post("/stripe/webhook")
async def webhook(request: Request):
    return await stripe_webhook(request)

@app.get("/oracle/status")
async def status():
    return {
        "status":            "ok",
        "predictions_cached": CACHE["predictions"] is not None,
        "models_available":  load_models() is not None,
        "current_gw":        CACHE["current_gw"],
        "last_updated":      CACHE["last_updated"],
        "training_status":   CACHE["training_status"],
        "dgw_gws":           [gw for gw, teams in CACHE["dgw_map"].items() if teams],
    }


@app.post("/oracle/train")
async def train(bg: BackgroundTasks):
    if CACHE["training_status"] == "training":
        return {"status": "already_training"}
    CACHE["training_status"] = "training"
    bg.add_task(_run_pipeline)
    return {"status": "started", "message": "Oracle pipeline started."}


@app.get("/oracle/predictions")
async def get_preds(position: Optional[str] = None, top_n: int = 100):
    if not CACHE["predictions"]:
        raise HTTPException(503, "No predictions. POST /oracle/train first.")
    preds = CACHE["predictions"]
    if position:
        preds = [p for p in preds if p.get("position") == position.upper()]
    return {
        "predictions": preds[:top_n],
        "current_gw":  CACHE["current_gw"],
        "last_updated": CACHE["last_updated"],
        "dgw_map":     CACHE["dgw_map"],
        "bgw_map":     CACHE["bgw_map"],
    }


@app.post("/oracle/optimise")
async def optimise(req: OptimiseReq):
    if not CACHE["predictions"]:
        raise HTTPException(503, "No predictions cached. POST /oracle/train first.")
    preds_df = pd.DataFrame(CACHE["predictions"])
    print(f"Optimising: {req.num_free_transfers} transfers, budget={req.budget}, squad={len(req.current_squad_ids)} players, chip={req.force_chip}")

    result = solve_greedy(
        predictions_df=preds_df,
        current_squad_ids=req.current_squad_ids or [],
        budget=req.budget,
        num_transfers=req.num_free_transfers,
        horizon=min(req.horizon, 8),
        force_chip=req.force_chip,
    )

    result["dgw_map"]    = CACHE["dgw_map"]
    result["current_gw"] = CACHE["current_gw"]
    return result


@app.get("/oracle/captain")
async def captain(top_n: int = 5):
    if not CACHE["predictions"]:
        raise HTTPException(503, "No predictions.")
    preds = sorted(CACHE["predictions"], key=lambda p: -p.get("xp_gw1", 0))
    return {"captain_picks": preds[:top_n], "current_gw": CACHE["current_gw"]}



@app.post("/oracle/cron")
async def cron_retrain(bg: BackgroundTasks):
    """Called by Railway cron job — retrain silently, no auth needed from within Railway."""
    if CACHE["training_status"] == "training":
        return {"status": "already_training"}
    CACHE["training_status"] = "training"
    bg.add_task(_run_pipeline)
    return {"status": "started"}

@app.get("/oracle/fixtures")
async def fixtures():
    return {
        "dgw_map":   CACHE["dgw_map"],
        "bgw_map":   CACHE["bgw_map"],
        "current_gw": CACHE["current_gw"],
    }


# ── Pipeline ─────────────────────────────────────────────────────────────────

async def _run_pipeline():
    try:
        print("=== Oracle Pipeline Start ===")
        data = await fetch_all_oracle_data()
        players_df  = data["players_df"]
        fixtures_df = data["fixtures_df"]
        history_df  = data["history_df"]
        teams_df    = data["teams_df"]
        current_gw  = data["current_gw"]
        elo         = data["elo"]
        dgw_map     = data["dgw_map"]
        bgw_map     = data["bgw_map"]

        print(f"GW:{current_gw}  Players:{len(players_df)}")

        # Fetch ALL player histories concurrently in batches of 40
        print(f"Fetching history for ALL {len(players_df)} players concurrently...")
        all_pids = players_df["player_id"].tolist()
        history_rows = []
        BATCH = 40

        async def _fetch_one(sess, pid):
            try:
                url = f"https://fantasy.premierleague.com/api/element-summary/{pid}/"
                async with sess.get(url, timeout=aiohttp.ClientTimeout(total=15)) as r:
                    if r.status == 200:
                        d = await r.json()
                        return [{
                            "player_id": pid, "gw": row.get("round"),
                            "total_points": row.get("total_points", 0),
                            "minutes": row.get("minutes", 0),
                            "goals_scored": row.get("goals_scored", 0),
                            "assists": row.get("assists", 0),
                            "clean_sheets": row.get("clean_sheets", 0),
                            "bonus": row.get("bonus", 0),
                            "bps": row.get("bps", 0),
                            "expected_goal_involvements": float(row.get("expected_goal_involvements", 0) or 0),
                            "expected_goals": float(row.get("expected_goals", 0) or 0),
                            "expected_assists": float(row.get("expected_assists", 0) or 0),
                            "expected_goals_conceded": float(row.get("expected_goals_conceded", 0) or 0),
                            "influence": float(row.get("influence", 0) or 0),
                            "creativity": float(row.get("creativity", 0) or 0),
                            "threat": float(row.get("threat", 0) or 0),
                            "ict_index": float(row.get("ict_index", 0) or 0),
                            "was_home": int(row.get("was_home", 0)),
                            "opponent_team": row.get("opponent_team", 0),
                        } for row in d.get("history", [])]
            except Exception:
                return []

        async with aiohttp.ClientSession() as sess:
            for i in range(0, len(all_pids), BATCH):
                batch = all_pids[i:i+BATCH]
                batch_results = await asyncio.gather(*[_fetch_one(sess, pid) for pid in batch])
                for rows in batch_results:
                    history_rows.extend(rows)
                print(f"  Progress: {min(i+BATCH, len(all_pids))}/{len(all_pids)} players")

        history_df = pd.DataFrame(history_rows) if history_rows else pd.DataFrame()
        print(f"  Total: {len(history_df)} history rows for {len(all_pids)} players")

        # Build features for top players + train
        features_df = build_oracle_features(history_df, players_df, fixtures_df, elo, current_gw)
        if not history_df.empty and "total_points" in history_df.columns:
            hist_sorted = history_df.sort_values(["player_id", "gw"])
            hist_sorted["target_points"] = hist_sorted.groupby("player_id")["total_points"].shift(-1)
            feat_with_target = features_df.merge(
                hist_sorted[["player_id", "gw", "target_points"]].dropna(),
                on="player_id", how="left"
            )
        else:
            feat_with_target = features_df
        from features.engineering import FEATURE_COLS
        avail_cols = [c for c in FEATURE_COLS if c in feat_with_target.columns]
        try:
            models = train_oracle_models(feat_with_target, avail_cols)
        except Exception as train_err:
            print(f"  Training error: {train_err}")
            models = None
        if not models:
            models = load_models()

        # ── Generate predictions for ALL players (not just top 100) ──────────
        # Players with history get ML-based xP; rest get PPG-based fallback
        print(f"Building predictions for ALL {len(players_df)} players...")
        from features.engineering import _build_from_players_only
        all_features = _build_from_players_only(players_df, fixtures_df, elo, current_gw)

        # Merge: use history-based features where available
        if not features_df.empty:
            hist_pids = set(features_df["player_id"].tolist())
            no_hist   = all_features[~all_features["player_id"].isin(hist_pids)].copy()
            combined  = pd.concat([features_df, no_hist], ignore_index=True)
        else:
            combined = all_features
        print(f"  Combined features: {len(combined)} players")

        preds_df = predict_oracle_xp(
            combined, players_df, fixtures_df,
            current_gw, models=models, horizon=8
        )

        # Serialise
        preds_list = preds_df.to_dict(orient="records")
        for row in preds_list:
            for k, v in list(row.items()):
                if hasattr(v, "item"):
                    row[k] = v.item()
                elif v != v:  # NaN
                    row[k] = None

        _save_cache(preds_list, current_gw, dgw_map, bgw_map)
        CACHE["training_status"] = "done"
        print(f"=== Oracle Pipeline Done: {len(preds_list)} players ===")

    except Exception as e:
        CACHE["training_status"] = "error"
        import traceback; traceback.print_exc()


