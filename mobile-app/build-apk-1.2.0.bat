@echo off
REM Builds England Orders 1.2.0 (Builty redesign) as a SEPARATE APK - never overwrites the 1.1.1 APK in Downloads.
REM Needs the 1.2.0 backend: install only after that backend is live (APK talks to https://englandwaly.com/api).
cd /d "%~dp0"
REM Overrides .env.android, which still names the old, non-existent api-store.codelps.com.
set "VITE_API_BASE=https://englandwaly.com/api"
REM Non-interactive: stops Capacitor asking the telemetry question mid-build.
set "CI=1"
REM Java 17 for Gradle (the copy in AndroidTools, used for earlier builds).
if not defined JAVA_HOME if exist "%USERPROFILE%\AndroidTools\jdk17\bin\java.exe" set "JAVA_HOME=%USERPROFILE%\AndroidTools\jdk17"
if defined JAVA_HOME set "PATH=%JAVA_HOME%\bin;%PATH%"
echo [1/3] Building the app screens...
call npm run android:sync || goto fail
echo [2/3] Building the APK...
cd android
call gradlew.bat assembleDebug || goto fail
cd ..
echo [3/3] Copying the APK to Downloads...
copy /Y "android\app\build\outputs\apk\debug\app-debug.apk" "%USERPROFILE%\Downloads\england-orders-1.2.0-builty-debug.apk" || goto fail
echo.
echo DONE: %USERPROFILE%\Downloads\england-orders-1.2.0-builty-debug.apk
pause
exit /b 0
:fail
echo.
echo BUILD FAILED - send a screenshot of this window.
pause
exit /b 1
