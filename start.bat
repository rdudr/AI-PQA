@echo off
title AI Power Quality Analyzer - Launcher
cd /d "%~dp0"

echo ============================================
echo  AI Power Quality Analyzer
echo ============================================
echo  Backend  ^>  http://localhost:8000
echo  Frontend ^>  http://localhost:5173
echo ============================================
echo.

:: Launch backend in its own window
start "PQ Backend" "%~dp0_run_backend.bat"

:: Wait for backend to start, then launch frontend
timeout /t 3 /nobreak >nul
start "PQ Frontend" "%~dp0_run_frontend.bat"

:: Open browser after frontend starts
timeout /t 5 /nobreak >nul
start "" "http://localhost:5173"

echo Both servers launched. Close their windows to stop.
echo.
pause
