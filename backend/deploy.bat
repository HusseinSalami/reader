@echo off
setlocal enabledelayedexpansion

echo Document Reader - Backend Deployment
echo ========================================
echo.

REM Load environment variables if .env exists
if exist .env (
    echo Loading configuration from .env file...
    for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
        if not "%%a"=="" if not "%%a:~0,1%"=="#" (
            set "%%a=%%b"
        )
    )
) else (
    echo No .env file found. Using AWS CLI configuration or environment variables.
)

REM Check for AWS account ID
if "%AWS_ACCOUNT_ID%"=="" (
    echo Detecting AWS account from CLI configuration...
    for /f "tokens=*" %%i in ('aws sts get-caller-identity --query Account --output text 2^>nul') do set AWS_ACCOUNT_ID=%%i
    
    if "!AWS_ACCOUNT_ID!"=="" (
        echo Error: AWS_ACCOUNT_ID not set and unable to detect from AWS CLI
        echo.
        echo Please either:
        echo   1. Create a .env file with AWS_ACCOUNT_ID (copy from .env.example^)
        echo   2. Set environment variable: set AWS_ACCOUNT_ID=123456789012
        echo   3. Configure AWS CLI: aws configure
        exit /b 1
    )
)

REM Set default region if not specified
if "%AWS_REGION%"=="" set AWS_REGION=us-east-1

echo.
echo Deployment Configuration:
echo    Account: %AWS_ACCOUNT_ID%
echo    Region:  %AWS_REGION%
echo.

REM Check if dependencies are installed
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)

REM Bootstrap CDK if needed
echo Checking CDK bootstrap status...
aws cloudformation describe-stacks --stack-name CDKToolkit --region %AWS_REGION% >nul 2>&1
if errorlevel 1 (
    echo Bootstrapping CDK (first-time setup^)...
    call cdk bootstrap aws://%AWS_ACCOUNT_ID%/%AWS_REGION%
) else (
    echo CDK already bootstrapped
)

REM Deploy the stack
echo.
echo Deploying DocumentReaderStack...
call cdk deploy --require-approval never

echo.
echo Deployment complete!
echo.
echo Next steps:
echo    1. Copy the ApiUrl from the outputs above
echo    2. Update frontend/src/config.ts with the API URL
echo    3. Deploy the frontend
echo.
