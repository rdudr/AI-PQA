@echo off
title AI Power Quality Analyzer - Launcher
cd /d "%~dp0"

echo ====================================================
echo  AI Power Quality Analyzer - Local Launcher
echo ====================================================
echo  Backend  ^>  http://localhost:8000
echo  Frontend ^>  http://localhost:5173
echo ====================================================
echo.

:: Launch backend in its own window
echo Launching backend server...
start "PQ Backend" "%~dp0_run_backend.bat"

:: Wait for backend to start, then launch frontend
echo Waiting for backend to spin up...
timeout /t 3 /nobreak >nul

echo Launching frontend server...
start "PQ Frontend" "%~dp0_run_frontend.bat"

:: Open browser after frontend starts
echo Opening browser...
timeout /t 4 /nobreak >nul
start "" "http://localhost:5173"

echo.
echo ====================================================
echo  Both servers launched successfully!
echo  - To stop, close the "PQ Backend" and "PQ Frontend" console windows.
echo ====================================================
echo.
pause
