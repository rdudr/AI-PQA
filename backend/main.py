from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import sys
import pathlib

# Ensure backend package modules can be imported as top-level during dev
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

from backend.routes import analytics, config, health, upload
from backend.services.config_store import _ensure_dirs as _init_config_dirs
from backend.utils.excel_open import available_engines, warn_if_engines_missing

_init_config_dirs()

# Self-check Excel engines so offline / freshly-cloned installs see the
# problem immediately if a dependency is missing.  Also logged so an
# operator can inspect which paths are healthy from the API logs.
warn_if_engines_missing()
_engines = available_engines()
print(
    "[PQ] Excel engines:",
    ", ".join(f"{k}={'OK' if v else 'MISSING'}" for k, v in _engines.items()),
)

app = FastAPI(title="AI Power Quality Analyzer API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(upload.router, prefix="/api/upload")
app.include_router(analytics.router, prefix="/api")
app.include_router(config.router, prefix="/api/config")
