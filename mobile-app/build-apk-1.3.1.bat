@echo off
REM Builds England Orders 1.3.1 (versionCode 6): website orders + Accountrix ERP sales.
REM A SEPARATE APK - never overwrites the 1.1.1 / 1.2.0 / 1.3.0 APKs in Downloads.
REM Needs the 1.3.0 England backend (erp-sales endpoints) live at https://englandwaly.com/api.
cd /d "%~dp0"
REM .env.android now names the live API too; set here as well so a stray .env.android.local cannot override it.
set "VITE_API_BASE=https://englandwaly.com/api"
REM Non-interactive: stops Capacitor asking the telemetry question mid-build.
set "CI=1"
REM Java 17 for Gradle (the copy in AndroidTools, used for earlier builds).
if not defined JAVA_HOME if exist "%USERPROFILE%\AndroidTools\jdk17\bin\java.exe" set "JAVA_HOME=%USERPROFILE%\AndroidTools\jdk17"
if defined JAVA_HOME set "PATH=%JAVA_HOME%\bin;%PATH%"
echo [1/5] Running the app tests...
call npm test || goto fail
echo [2/5] Building the app screens (live API)...
call npm run android:sync || goto fail
echo [3/5] Checking the bundle has no local test server or test login...
findstr /M /C:"127.0.0.1" /C:"localhost:8010" /C:"test_staff" /C:"test-staff-pass" "android\app\src\main\assets\public\assets\*.js" && goto badbundle
findstr /M /C:"englandwaly.com/api" "android\app\src\main\assets\public\assets\*.js" >nul || goto badbundle
echo [4/5] Building the APK...
cd android
call gradlew.bat assembleDebug || goto fail
cd ..
echo [5/5] Copying the APK to Downloads...
copy /Y "android\app\build\outputs\apk\debug\app-debug.apk" "%USERPROFILE%\Downloads\england-orders-1.3.1-erp-debug.apk" || goto fail
echo.
echo DONE: %USERPROFILE%\Downloads\england-orders-1.3.1-erp-debug.apk
for %%A in ("%USERPROFILE%\Downloads\england-orders-1.3.1-erp-debug.apk") do echo SIZE: %%~zA bytes
type "android\app\build\outputs\apk\debug\output-metadata.json" | findstr /C:"versionCode" /C:"versionName"
pause
exit /b 0
:badbundle
echo.
echo STOPPED: the built app screens point at a local/test server or contain a test login. Nothing was copied.
pause
exit /b 1
:fail
echo.
echo BUILD FAILED - send a screenshot of this window.
pause
exit /b 1
