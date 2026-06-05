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

:: 2. Run Vite dev server, forcing port 5173
echo Starting frontend on http://localhost:5173 ...
npm run dev -- --port 5173
if errorlevel 1 (
    echo.
    echo ERROR: Failed to start frontend dev server.
    echo Check if another process is already using port 5173.
)
pause
