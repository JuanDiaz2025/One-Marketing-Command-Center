@echo off
rem Starts the WhatsApp -> Google Chat alerts and restarts them if they stop.
cd /d "%~dp0"
if not exist node_modules call npm install
if not exist config.json copy config.example.json config.json >nul
if not exist .env copy .env.example .env >nul
:loop
node src\index.js
echo Stopped. Restarting in 10 seconds... (close this window to stop)
timeout /t 10 /nobreak >nul
goto loop
