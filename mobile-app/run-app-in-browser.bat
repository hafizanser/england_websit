@echo off
REM England Orders - run the app in a browser against the LIVE backend.
REM The app calls /app/* on its own origin; Vite forwards those calls to
REM https://englandwaly.com/api/app/*  (no CORS change on the server needed).
REM Close this window to stop the app.

cd /d "%~dp0"
title England Orders (live API) - http://localhost:5180

set "VITE_API_BASE="
set "VITE_DEV_PROXY=https://englandwaly.com/api"

if not exist node_modules (
  echo Installing packages first...
  call npm install || goto :fail
)

echo.
echo  England Orders is starting on http://localhost:5180
echo  Data shown is LIVE. Keep this window open while using the app.
echo.
start "" http://localhost:5180
call npx vite --port 5180 --strictPort
goto :eof

:fail
echo.
echo npm install failed. See the messages above.
pause
