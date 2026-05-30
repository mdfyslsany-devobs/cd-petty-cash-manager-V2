@echo off
cd /d "c:\Users\User\AppData\Local\cd-petty-cash-manager V2"
echo Building TypeScript...
call npm run lint
if errorlevel 1 (
    echo Compilation failed
    pause
    exit /b 1
) else (
    echo Build successful!
    pause
)
