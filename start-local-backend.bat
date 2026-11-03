@echo off
REM Local testing only - starts the England Laravel API on http://localhost:8000
REM Uses your LOCAL MySQL (order_system on 127.0.0.1). Do not commit this file.
title England backend (localhost:8000)
cd /d "%~dp0backend_laravel"

set "PHP="
if exist "D:\xamp\php\php.exe"   set "PHP=D:\xamp\php\php.exe"
if not defined PHP if exist "D:\xampp\php\php.exe" set "PHP=D:\xampp\php\php.exe"
if not defined PHP if exist "C:\xampp\php\php.exe" set "PHP=C:\xampp\php\php.exe"
if not defined PHP if exist "C:\xamp\php\php.exe"  set "PHP=C:\xamp\php\php.exe"
if not defined PHP (
  where php >nul 2>nul && set "PHP=php"
)
if not defined PHP (
  echo.
  echo  [X] PHP not found. Install XAMPP or tell Claude where php.exe is.
  echo.
  pause
  exit /b 1
)
echo Using PHP: %PHP%
"%PHP%" -v | findstr /b "PHP"

REM Check MySQL is listening on 3306 (XAMPP Control Panel - Start MySQL)
netstat -ano | findstr ":3306" | findstr "LISTENING" >nul
if errorlevel 1 (
  echo.
  echo  [!] MySQL is NOT running. Open XAMPP Control Panel and click Start next to MySQL,
  echo      then press any key here to continue.
  pause >nul
)

echo.
echo Starting backend at http://localhost:8000  (keep this window open)
echo.
"%PHP%" artisan serve --host=localhost --port=8000
echo.
echo Backend stopped. If you see an error above, send a screenshot to Claude.
pause
