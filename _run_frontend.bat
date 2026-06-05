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
    echo Please install Node.js LTS from https://nodejs.org and try again.
    pause
    exit /b 1
)

:: 2. Auto-heal: install node_modules if missing
if not exist node_modules (
    echo ============================================
    echo  node_modules missing -- installing deps...
    echo  (this can take 2-3 minutes on first run)
    echo ============================================
    call npm install
    if errorlevel 1 (
        echo ERROR: npm install failed.
        echo Try deleting frontend\node_modules and frontend\package-lock.json,
        echo then running this script again.
        pause
        exit /b 1
    )
)

:: 3. Clear Vite's metadata / dep cache.  This catches the common case where
::    new source files (routes, components, imports) confuse Vite's
::    pre-bundling.  Safe to delete; Vite rebuilds it on next start.
if exist node_modules\.vite (
    echo Clearing stale Vite cache...
    rmdir /s /q node_modules\.vite >nul 2>&1
)
if exist node_modules\.vite-temp (
    rmdir /s /q node_modules\.vite-temp >nul 2>&1
)

:: 4. Check port 5173 isn't already held by an orphan Vite process from a
::    previous run.  If it is, kill the offender so we can take the port.
netstat -ano | findstr ":5173" | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo ============================================
    echo  WARNING: Port 5173 already in use.
    echo  Killing the existing process so we can take over...
    echo ============================================
    for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":5173" ^| findstr "LISTENING"') do (
        taskkill /F /PID %%P >nul 2>&1
    )
    timeout /t 1 /nobreak >nul
)

:: 5. Run Vite dev server (port is set to 5173 in vite.config.ts)
echo Starting frontend on http://localhost:5173 ...
echo (Press Ctrl+C in this window to stop)
echo.
npm run dev
if errorlevel 1 (
    echo.
    echo ============================================
    echo ERROR: Vite dev server failed to start.
    echo Common fixes:
    echo   1. Delete frontend\node_modules and run this script again
    echo   2. Check that Node.js version is 18 or newer:  node -v
    echo   3. Look above for the specific error message from Vite
    echo ============================================
)
pause
