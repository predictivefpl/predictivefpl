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
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List

sys.path.insert(0, str(Path(__file__).parent.parent))

from data.pipeline import fetch_all_oracle_data
from features.engineering import build_oracle_features
from models.predict import predict_oracle_xp, load_models
from optimizer.mip_solver import OracleRequest, solve_oracle

import pandas as pd

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
    oracle_req = OracleRequest(
        budget=req.budget,
        horizon=min(req.horizon, 8),
        num_free_transfers=req.num_free_transfers,
        current_squad_ids=req.current_squad_ids,
        objective=req.objective,
        wildcard_available=req.wildcard_available,
        freehit_available=req.freehit_available,
        benchboost_available=req.benchboost_available,
        triplecaptain_available=req.triplecaptain_available,
        force_chip=req.force_chip,
    )
    result = solve_oracle(preds_df, oracle_req)
    return {
        "status":        result.status,
        "squad":         result.squad,
        "transfers":     result.transfers,
        "chip_plan":     result.chip_plan,
        "xp_by_gw":     result.xp_by_gw,
        "total_xp":     result.total_xp,
        "total_hits":   result.total_hits,
        "net_xp":        result.net_xp,
        "option_value": result.option_value,
        "transfer_plan": result.transfer_plan,
        "dgw_map":       CACHE["dgw_map"],
        "current_gw":    CACHE["current_gw"],
    }


@app.get("/oracle/captain")
async def captain(top_n: int = 5):
    if not CACHE["predictions"]:
        raise HTTPException(503, "No predictions.")
    preds = sorted(CACHE["predictions"], key=lambda p: -p.get("xp_gw1", 0))
    return {"captain_picks": preds[:top_n], "current_gw": CACHE["current_gw"]}


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

        # Feature engineering
        features_df = build_oracle_features(
            history_df, players_df, fixtures_df, elo, current_gw
        )

        # Predictions
        models = load_models()
        preds_df = predict_oracle_xp(
            features_df, players_df, fixtures_df,
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
