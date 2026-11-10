@echo off
REM Runs build-apk-1.3.2.bat without prompts and writes ALL output to build-1.3.2.log
REM (next to this file), then prints signing-certificate fingerprints for comparison.
REM Read-only apart from the normal build output and the APK copy into Downloads.
cd /d "%~dp0"
set "LOG=%~dp0build-1.3.2.log"
echo ===== START %DATE% %TIME% ===== > "%LOG%"
call build-apk-1.3.2.bat < nul >> "%LOG%" 2>&1
echo BUILD_EXIT=%ERRORLEVEL% >> "%LOG%"
if not defined JAVA_HOME if exist "%USERPROFILE%\AndroidTools\jdk17\bin\java.exe" set "JAVA_HOME=%USERPROFILE%\AndroidTools\jdk17"
set "KT=keytool"
if defined JAVA_HOME set "KT=%JAVA_HOME%\bin\keytool.exe"
echo. >> "%LOG%"
echo ===== CERT: NEW 1.3.2 APK ===== >> "%LOG%"
"%KT%" -printcert -jarfile "%USERPROFILE%\Downloads\england-orders-1.3.2-erp-debug.apk" >> "%LOG%" 2>&1
echo ===== CERT: PREVIOUS 1.3.1 APK ===== >> "%LOG%"
"%KT%" -printcert -jarfile "%USERPROFILE%\Downloads\england-orders-1.3.1-erp-debug.apk" >> "%LOG%" 2>&1
echo ===== CERT: PREVIOUS 1.2.0 APK (if present) ===== >> "%LOG%"
for %%F in ("%USERPROFILE%\Downloads\england-orders-1.2.0*.apk") do "%KT%" -printcert -jarfile "%%~fF" >> "%LOG%" 2>&1
echo ===== CERT: THIS PC DEBUG KEYSTORE (public fingerprints only) ===== >> "%LOG%"
"%KT%" -list -v -keystore "%USERPROFILE%\.android\debug.keystore" -storepass android -alias androiddebugkey 2>&1 | findstr /C:"Owner" /C:"SHA1" /C:"SHA256" /C:"Valid" >> "%LOG%"
echo ===== APK FILES IN DOWNLOADS ===== >> "%LOG%"
dir /-C "%USERPROFILE%\Downloads\england-orders-*.apk" >> "%LOG%" 2>&1
echo ===== END %DATE% %TIME% ===== >> "%LOG%"
