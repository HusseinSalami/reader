@echo off
echo Setting up Document Reader Service...
echo.

echo Checking prerequisites...
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Node.js is required but not installed. Aborting.
    exit /b 1
)

where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo npm is required but not installed. Aborting.
    exit /b 1
)

echo Prerequisites check passed
echo.

echo Installing backend dependencies...
cd backend
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo Backend installation failed
    exit /b 1
)
echo Backend dependencies installed
cd ..
echo.

echo Installing frontend dependencies...
cd frontend
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo Frontend installation failed
    exit /b 1
)
echo Frontend dependencies installed
cd ..
echo.

echo Setup complete!
echo.
echo Next steps:
echo 1. Deploy backend: cd backend ^&^& npm run deploy
echo 2. Update frontend config with API URL: frontend/src/config.ts
echo 3. Run frontend: cd frontend ^&^& npm run dev
echo.
echo See DEPLOYMENT.md for detailed instructions.
