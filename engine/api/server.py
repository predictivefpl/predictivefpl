import asyncio, os, sys, json
from datetime import datetime
from pathlib import Path
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List

sys.path.insert(0, str(Path(__file__).parent.parent))

from data.fetch_fpl import fetch_all_data
from data.fetch_understat import fetch_understat_season, merge_understat_to_fpl
from features.engineering import build_feature_matrix
from models.train import train_models, load_models
from models.predict import predict_xp, get_captain_recommendations, get_differentials, get_essential_picks
from optimizer.knapsack import solve_squad_selection, get_transfer_suggestions

app = FastAPI(title="PredictiveFPL Engine", version="1.0.0")
app.add_middleware(CORSMiddleware,
    allow_origins=["http://localhost:5173","http://localhost:3000","https://predictivefpl.com"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

CACHE = {"predictions":None,"last_updated":None,"current_gw":None,"training_status":"idle"}
CACHE_PATH = Path(__file__).parent.parent / "cache" / "predictions.json"
CACHE_PATH.parent.mkdir(exist_ok=True)

def load_cache():
    if CACHE_PATH.exists():
        try:
            with open(CACHE_PATH) as f:
                data = json.load(f)
            CACHE.update({"predictions":data.get("predictions"),"last_updated":data.get("last_updated"),"current_gw":data.get("current_gw")})
            print(f"Loaded {len(CACHE['predictions'])} cached predictions")
        except Exception as e:
            print(f"Cache load failed: {e}")

def save_cache(predictions, current_gw):
    data = {"predictions":predictions,"current_gw":current_gw,"last_updated":datetime.now().isoformat()}
    with open(CACHE_PATH,"w") as f: json.dump(data,f)
    CACHE.update({"predictions":predictions,"last_updated":data["last_updated"],"current_gw":current_gw})

@app.on_event("startup")
async def startup():
    load_cache()
    print("PredictiveFPL Engine ready.")

class OptimiseRequest(BaseModel):
    budget: float = 100.0
    num_transfers: int = 1
    current_squad_ids: Optional[List[int]] = None
    chip: Optional[str] = None
    objective: str = "maximize_total_points"
    horizon_gws: int = 1

@app.get("/api/status")
async def status():
    return {"status":"ok","models_loaded":load_models() is not None,"predictions_cached":CACHE["predictions"] is not None,"last_updated":CACHE["last_updated"],"current_gw":CACHE["current_gw"],"training_status":CACHE["training_status"]}

@app.get("/api/predictions")
async def get_predictions(position: Optional[str] = None):
    if not CACHE["predictions"]: raise HTTPException(503,"No predictions yet. POST /api/train first.")
    preds = CACHE["predictions"]
    if position: preds = [p for p in preds if p.get("position")==position.upper()]
    return {"predictions":preds,"current_gw":CACHE["current_gw"],"last_updated":CACHE["last_updated"],"count":len(preds)}

@app.get("/api/captain")
async def get_captain(top_n: int = 3):
    if not CACHE["predictions"]: raise HTTPException(503,"No predictions.")
    import pandas as pd
    return {"captain_picks":get_captain_recommendations(pd.DataFrame(CACHE["predictions"]),top_n)}

@app.get("/api/differentials")
async def get_diffs(top_n: int = 5):
    if not CACHE["predictions"]: raise HTTPException(503,"No predictions.")
    import pandas as pd
    df = pd.DataFrame(CACHE["predictions"])
    df["is_differential"] = df["ownership_pct"] < 15.0
    return {"differentials":get_differentials(df,top_n)}

@app.get("/api/essentials")
async def get_essentials(top_n: int = 5):
    if not CACHE["predictions"]: raise HTTPException(503,"No predictions.")
    import pandas as pd
    return {"essential_picks":get_essential_picks(pd.DataFrame(CACHE["predictions"]),top_n)}

@app.post("/api/optimise")
async def optimise(req: OptimiseRequest):
    if not CACHE["predictions"]: raise HTTPException(503,"No predictions.")
    import pandas as pd
    result = solve_squad_selection(pd.DataFrame(CACHE["predictions"]),req.budget,req.num_transfers,req.current_squad_ids,req.chip,req.objective,req.horizon_gws)
    if "error" in result: raise HTTPException(500,result["error"])
    return result

@app.post("/api/train")
async def train(background_tasks: BackgroundTasks):
    if CACHE["training_status"]=="training": return {"message":"Already training.","status":"training"}
    background_tasks.add_task(run_full_pipeline)
    CACHE["training_status"]="training"
    return {"message":"Training started.","status":"training"}

async def run_full_pipeline():
    try:
        CACHE["training_status"]="training"
        print("=== Starting Pipeline ===")
        data = await fetch_all_data()
        players_df,teams_df,fixtures_df,history_df,current_gw = data["players"],data["teams"],data["fixtures"],data["history"],data["current_gw"]
        print(f"GW:{current_gw} Players:{len(players_df)} History:{len(history_df)}")
        try:
            us_df = await fetch_understat_season("2024")
            players_df = merge_understat_to_fpl(players_df,us_df)
        except Exception as e:
            print(f"Understat failed: {e}")
        features_df,feature_cols = build_feature_matrix(history_df,fixtures_df,teams_df,players_df)
        trained = train_models(features_df,feature_cols)
        pred_features,_ = build_feature_matrix(history_df,fixtures_df,teams_df,players_df,target_gw=current_gw)
        preds_df = predict_xp(pred_features,players_df,fixtures_df[fixtures_df["gw"]==current_gw],trained)
        preds_list = preds_df.to_dict(orient="records")
        for row in preds_list:
            for k,v in row.items():
                if hasattr(v,"item"): row[k]=v.item()
                elif v!=v: row[k]=None
        save_cache(preds_list,current_gw)
        CACHE["training_status"]="done"
        print(f"=== Done: {len(preds_list)} players ===")
    except Exception as e:
        CACHE["training_status"]="error"
        import traceback; traceback.print_exc()




