@echo off
title PQ Backend - FastAPI :8000
cd /d "%~dp0backend"

echo ============================================
echo  Starting PQ Backend (FastAPI)
echo ============================================

:: 1. Check Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH.
    echo Install Python 3.11+ from https://python.org and try again.
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

:: 3. Auto-heal: install requirements if uvicorn / xlrd is missing.
::    Including xlrd in the check guarantees .xls support is in place.
python -c "import uvicorn, xlrd" >nul 2>&1
if errorlevel 1 (
    echo ============================================
    echo  Python packages missing -- installing deps...
    echo  ^(this can take 3-5 minutes on first run^)
    echo ============================================
    pip install -r requirements.txt
    if errorlevel 1 (
        echo ERROR: pip install failed.
        echo Try:  python -m pip install --upgrade pip
        echo and then run this script again.
        pause
        exit /b 1
    )
)

:: 4. Check port 8000 isn't already held by an orphan uvicorn process
netstat -ano | findstr ":8000" | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo ============================================
    echo  WARNING: Port 8000 already in use.
    echo  Killing the existing process so we can take over...
    echo ============================================
    for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do (
        taskkill /F /PID %%P >nul 2>&1
    )
    timeout /t 1 /nobreak >nul
)

:: 5. Run uvicorn — uses main_fixed.py (local-dev entry; main.py is the
::    Render-deploy entry; both expose `app`).
echo Starting backend on http://localhost:8000 ...
echo (Press Ctrl+C in this window to stop)
echo.
python -m uvicorn main_fixed:app --reload --port 8000
if errorlevel 1 (
    echo.
    echo ============================================
    echo ERROR: Failed to start uvicorn.
    echo Common fixes:
    echo   1. Run:  python check_install.py
    echo      That tells you exactly which dependency is missing.
    echo   2. Check Python version:  python --version  ^(needs 3.11+^)
    echo   3. Look above for the specific traceback
    echo ============================================
)
pause
