@echo off
title PQ Frontend - Vite :5173
cd /d "%~dp0frontend"

echo ============================================
echo  Starting PQ Frontend (Vite)
echo ============================================

:: 1. Check if Node.js/npm is installed
node -v >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH.
    echo Please install Node.js (version 20+) and try again.
    pause
    exit /b 1
)

:: 2. Check Node.js version (Vite 8 requires Node 20+)
node -e "if (parseInt(process.versions.node.split('.')[0]) < 20) { process.exit(1); }" >nul 2>&1
if errorlevel 1 (
    echo ====================================================
    echo  ERROR: Node.js version is too old!
    echo  Vite 8 requires Node.js version 20.0.0 or higher.
    echo  Current version:
    node -v
    echo  Please update Node.js from https://nodejs.org/ and try again.
    echo ====================================================
    pause
    exit /b 1
)

:: 3. Auto-heal: Check and install node_modules if missing
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

:: 4. Run Vite dev server (port is set to 5173 in vite.config.ts)
echo Starting frontend on http://localhost:5173 ...
npm run dev
if errorlevel 1 (
    echo.
    echo ERROR: Failed to start frontend dev server.
    echo Check if another process is already using port 5173.
)
pause
