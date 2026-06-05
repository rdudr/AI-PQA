@echo off
title PQ Frontend - Vite :5173
cd /d "%~dp0frontend"

echo ============================================
echo  Starting PQ Frontend (Vite)
echo ============================================

:: 1. Check if Node.js/npm is installed
npm -v >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js/npm is not installed or not in PATH.
    echo Please install Node.js and try again.
    pause
    exit /b 1
)

:: 2. Auto-heal: Check and install node_modules if missing
if not exist node_modules (
    echo ============================================
    echo  WARNING: node_modules is missing!
    echo  Installing frontend dependencies... This may take a moment.
    echo ============================================
    call npm install
    if errorlevel 1 (
        echo ERROR: npm install failed.
        pause
        exit /b 1
    )
)

:: 3. Run Vite dev server (port is set to 5173 in vite.config.ts)
echo Starting frontend on http://localhost:5173 ...
npm run dev
if errorlevel 1 (
    echo.
    echo ERROR: Failed to start frontend dev server.
    echo Check if another process is already using port 5173.
)
pause
