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

:: Check Node.js existence and version
node -v >nul 2>&1
if errorlevel 1 (
    echo.
    echo ERROR: Node.js is not installed or not in PATH.
    echo Please install Node.js ^(version 20+^) and try again.
    pause
    exit /b 1
)
node -e "if (parseInt(process.versions.node.split('.')[0]) < 20) { process.exit(1); }" >nul 2>&1
if errorlevel 1 (
    echo.
    echo ERROR: Node.js version is too old!
    echo This application requires Node.js version 20.0.0 or higher.
    echo Current version:
    node -v
    echo Please update Node.js from https://nodejs.org/ and try again.
    pause
    exit /b 1
)

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
