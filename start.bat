@echo off
title AI Power Quality Analyzer - Launcher
cd /d "%~dp0"

echo ====================================================
echo  AI Power Quality Analyzer - Local Launcher
echo ====================================================
echo  Backend  ^>  http://127.0.0.1:8000
echo  Frontend ^>  http://127.0.0.1:5173
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

:: Open browser after frontend starts and is ready
echo Waiting for frontend to be ready at http://127.0.0.1:5173 ...
set /a "attempts=0"
:wait_loop
timeout /t 1 /nobreak >nul
curl.exe -I -s --connect-timeout 1 http://127.0.0.1:5173 >nul 2>&1
if errorlevel 1 (
    set /a "attempts+=1"
    if %attempts% geq 60 (
        echo.
        echo ERROR: Frontend server did not start within 60 seconds.
        echo Please check the "PQ Frontend" console window for errors.
        pause
        exit /b 1
    )
    goto wait_loop
)

echo Opening browser...
start "" "http://127.0.0.1:5173"

echo.
echo ====================================================
echo  Both servers launched successfully!
echo  - To stop, close the "PQ Backend" and "PQ Frontend" console windows.
echo ====================================================
echo.
pause
