@echo off
echo ========================================
echo Starting Vite Dev Server for Weave
echo ========================================
cd /d "%~dp0"
echo Current directory: %CD%
echo.
echo Checking environment...
if exist ".env" (
    echo ✓ .env file found
) else (
    echo ⚠ Warning: .env file not found
)
echo.
echo Starting development build with watch mode...
npm run dev
pause
