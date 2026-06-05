@echo off
title PQ Backend - FastAPI :8000
cd /d "%~dp0backend"

echo ============================================
echo  Starting PQ Backend (FastAPI)
echo ============================================

:: 1. Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH.
    echo Please install Python and try again.
    pause
    exit /b 1
)

:: 2. Detect and activate virtual environment if exists
if exist .venv\Scripts\activate.bat (
    echo Activating virtual environment (.venv)...
    call .venv\Scripts\activate.bat
) else if exist venv\Scripts\activate.bat (
    echo Activating virtual environment (venv)...
    call venv\Scripts\activate.bat
) else if exist env\Scripts\activate.bat (
    echo Activating virtual environment (env)...
    call env\Scripts\activate.bat
)

:: 3. Auto-heal: Check if uvicorn is installed, if not install requirements
python -c "import uvicorn" >nul 2>&1
if errorlevel 1 (
    echo ============================================
    echo  WARNING: Python packages (like uvicorn) are missing!
    echo  Installing backend dependencies... This may take a moment.
    echo ============================================
    pip install -r requirements.txt
    if errorlevel 1 (
        echo ERROR: pip install failed.
        pause
        exit /b 1
    )
)

:: 4. Run uvicorn on port 8000
echo Starting backend on http://localhost:8000 ...
python -m uvicorn main_fixed:app --reload --port 8000
if errorlevel 1 (
    echo.
    echo ERROR: Failed to start uvicorn. 
    echo Check if another process is already using port 8000.
)
pause
