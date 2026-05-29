@echo off
title AI Power Quality Analyzer - Install Dependencies

cd /d "%~dp0"

echo ============================================
echo  Installing Python backend dependencies
echo ============================================
cd backend
pip install -r requirements.txt
if errorlevel 1 (
    echo.
    echo ERROR: pip install failed. Make sure Python is installed.
    pause
    exit /b 1
)

echo.
echo ============================================
echo  Installing Node frontend dependencies
echo ============================================
cd ..\frontend
npm install
if errorlevel 1 (
    echo.
    echo ERROR: npm install failed. Make sure Node.js is installed.
    pause
    exit /b 1
)

echo.
echo ============================================
echo  All dependencies installed successfully!
echo  Run start.bat to launch the application.
echo ============================================
pause
