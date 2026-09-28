@echo off
REM Double-click this file to install and start One Marketing Command Center on Windows.
cd /d "%~dp0"

REM Helper mode: started below in a minimized window. Waits until the app answers, then opens the browser.
if "%~1"=="open-browser" goto open_browser

title One Marketing Command Center

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Download the LTS version from https://nodejs.org
  echo then run this file again.
  start "" https://nodejs.org
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing One Marketing Command Center. This takes a minute or two the first time...
  call npm install
  if errorlevel 1 (
    echo Install failed. Take a screenshot of this window and send it over.
    pause
    exit /b 1
  )
)

if not exist .env.local (
  copy /y .env.example .env.local >nul
  echo Created .env.local. Open it in Notepad and fill in your Google settings,
  echo then close this window and run start.bat again. The README explains each one.
  start "" notepad .env.local
  pause
  exit /b 0
)

echo Starting One Marketing Command Center. Your browser will open at http://localhost:3000 when it's ready.
echo Keep this window open while you use the app. Close it to stop.
start "" /min "%~f0" open-browser
call npm run dev -- --port 3000
echo.
echo The app stopped. If you see "address already in use" above, another copy is already running:
echo close its window or restart your computer, then run this file again.
pause
exit /b

:open_browser
REM Without curl (older Windows), give the first compile time and open anyway.
where curl >nul 2>nul
if errorlevel 1 (
  timeout /t 20 /nobreak >nul
  goto launch
)
set /a tries=0
:wait
set /a tries+=1
if %tries% gtr 90 goto launch
curl -s -o nul http://localhost:3000
if errorlevel 1 (
  timeout /t 2 /nobreak >nul
  goto wait
)
:launch
start "" http://localhost:3000
exit
