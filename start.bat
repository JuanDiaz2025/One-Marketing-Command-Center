@echo off
REM Double-click this file to install and start One Marketing Command Center on Windows.
cd /d "%~dp0"

REM Helper mode: started below in a minimized window. Waits until the app answers, then opens the browser.
if "%~1"=="open-browser" goto open_browser

REM Get the latest version first. This whole block is read before it runs, so it is safe even
REM when the update replaces this file; after an update, start again with the new version.
if not "%~1"=="updated" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\update.ps1"
  if errorlevel 10 (
    start "" "%~f0" updated
    exit
  )
)

title One Marketing Command Center

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Download the LTS version from https://nodejs.org
  echo then run this file again.
  start "" https://nodejs.org
  pause
  exit /b 1
)

REM Install the first time, and again whenever an update changed the app's packages
REM (package-lock.json differs from the copy saved after the last install).
set "NEED_INSTALL="
if not exist node_modules set "NEED_INSTALL=1"
if not exist node_modules\.omcc-installed-lock.json set "NEED_INSTALL=1"
if not defined NEED_INSTALL (
  fc /b package-lock.json node_modules\.omcc-installed-lock.json >nul 2>nul
  if errorlevel 1 set "NEED_INSTALL=1"
)
if defined NEED_INSTALL (
  echo Installing One Marketing Command Center. This takes a minute or two...
  call npm install
  if errorlevel 1 (
    echo Install failed. Take a screenshot of this window and send it over.
    pause
    exit /b 1
  )
  copy /y package-lock.json node_modules\.omcc-installed-lock.json >nul
)

REM Unzipped into a new folder? Bring over the data (leads, connections) from the earlier copy.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\restore-data.ps1"

if not exist .env.local (
  copy /y .env.example .env.local >nul
  echo Created .env.local. Open it in Notepad and fill in your Google settings,
  echo then close this window and run start.bat again. The README explains each one.
  start "" notepad .env.local
  pause
  exit /b 0
)

REM An older copy still running would keep port 4000, and the browser would show the old version:
REM close it first.
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:":4000 .*LISTENING"') do (
  echo Closing the copy of the app that is already running...
  taskkill /pid %%p /t /f >nul 2>nul
)

echo Starting One Marketing Command Center. Your browser will open at http://localhost:4000 when it's ready.
echo Keep this window open while you use the app. Close it to stop.
start "" /min "%~f0" open-browser
call npm run dev
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
curl -s -o nul http://localhost:4000
if errorlevel 1 (
  timeout /t 2 /nobreak >nul
  goto wait
)
:launch
start "" http://localhost:4000
exit
