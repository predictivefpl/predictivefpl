import sys
import os
from pathlib import Path

# Ensure engine root is on the path
engine_root = Path(__file__).parent
sys.path.insert(0, str(engine_root))

import uvicorn

print("""
╔══════════════════════════════════════════╗
║     PredictiveFPL Engine v1.0.0          ║
║     http://localhost:8000                ║
║                                          ║
║  Endpoints:                              ║
║    GET  /api/status                      ║
║    GET  /api/predictions                 ║
║    GET  /api/captain                     ║
║    GET  /api/differentials               ║
║    GET  /api/essentials                  ║
║    POST /api/optimise                    ║
║    POST /api/train                       ║
║    GET  /docs  (Swagger UI)              ║
╚══════════════════════════════════════════╝
""")

if __name__ == "__main__":
    os.chdir(engine_root)
    uvicorn.run("api.server:app", host="0.0.0.0", port=8000, reload=False, log_level="info")
