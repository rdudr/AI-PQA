@echo off
title PQ Backend - FastAPI :8000
cd /d "%~dp0backend"
echo Starting backend on http://localhost:8000 ...
python -m uvicorn main_fixed:app --reload --port 8000
pause
