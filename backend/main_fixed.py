from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import analytics, config, health, upload
from services.config_store import _ensure_dirs as _init_config_dirs
from utils.excel_open import available_engines, warn_if_engines_missing

_init_config_dirs()   # create backend/config/mappings/ on first run

# Startup self-check: log which Excel engines are usable, warn on missing.
# Brings the local-dev startup to parity with the production main.py so the
# operator immediately sees whether .xls support is healthy.
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
