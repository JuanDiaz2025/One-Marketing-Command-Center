@echo off
REM Double-click this file to install and start AdPilot on Windows.
cd /d "%~dp0"
title AdPilot

where node >/dev/null 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Download the LTS version from https://nodejs.org
  echo then run this file again.
  start "" https://nodejs.org
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing AdPilot. This takes a minute or two the first time...
  call npm install
  if errorlevel 1 (
    echo Install failed. Take a screenshot of this window and send it over.
    pause
    exit /b 1
  )
)

echo Starting AdPilot. Your browser will open at http://localhost:3000
echo Keep this window open while you use the app. Close it to stop.
start "" cmd /c "timeout /t 8 >/dev/null & start http://localhost:3000"
call npm run dev
pause
