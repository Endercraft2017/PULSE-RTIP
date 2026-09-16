@echo off
setlocal EnableDelayedExpansion
title PULSE 911 - Build and Install on Phone

cd /d "%~dp0"

echo ============================================================
echo  PULSE 911 - Build and Install
echo ============================================================
echo.

echo [1/4] Syncing Capacitor (web assets + plugins -^> android)...
call npx cap sync android
if errorlevel 1 (
    echo.
    echo ERROR: cap sync failed. Make sure you ran "npm install" first.
    pause
    exit /b 1
)
echo.

echo [2/4] Building debug APK with Gradle...
pushd android
call gradlew.bat --stop >nul 2>&1
call gradlew.bat assembleDebug
set GRADLE_RC=%errorlevel%
popd
if not "%GRADLE_RC%"=="0" (
    echo.
    echo ERROR: Gradle build failed. Scroll up for the cause.
    echo.
    echo If you see "Could not read workspace metadata" errors,
    echo run repair-gradle.bat once, then re-run this script.
    pause
    exit /b 1
)
echo.

set APK=android\app\build\outputs\apk\debug\app-debug.apk
if not exist "%APK%" (
    echo ERROR: APK not found at %APK%
    pause
    exit /b 1
)
echo APK ready: %APK%
echo.

echo [3/4] Looking for a connected Android device...

set ADB=
where adb >nul 2>&1
if not errorlevel 1 set ADB=adb
if "%ADB%"=="" (
    for %%P in (
        "%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
        "%ANDROID_HOME%\platform-tools\adb.exe"
        "%ANDROID_SDK_ROOT%\platform-tools\adb.exe"
        "%USERPROFILE%\AppData\Local\Android\Sdk\platform-tools\adb.exe"
        "C:\Android\platform-tools\adb.exe"
    ) do (
        if exist %%P set ADB=%%~P
    )
)

if "%ADB%"=="" (
    echo.
    echo adb not found. Skipping install.
    echo Copy this APK to your phone manually:
    echo   %CD%\%APK%
    echo.
    pause
    exit /b 0
)
echo Using adb: %ADB%
echo.

set DEVICE_COUNT=0
set UNAUTH_COUNT=0
for /f "skip=1 tokens=1,2" %%a in ('"%ADB%" devices') do (
    if "%%b"=="device" set /a DEVICE_COUNT+=1
    if "%%b"=="unauthorized" set /a UNAUTH_COUNT+=1
)

if %UNAUTH_COUNT% GTR 0 (
    echo.
    echo PHONE FOUND BUT NOT AUTHORIZED.
    echo.
    echo Look at your phone screen NOW - there should be a popup asking
    echo "Allow USB debugging?". Tap Allow ^(check "Always allow" too^).
    echo.
    echo If no popup appears:
    echo   1. Unplug and replug the USB cable
    echo   2. Or: Settings -^> Developer options -^> Revoke USB debugging authorizations,
    echo      then unplug/replug
    echo.
    echo After authorizing, re-run this script.
    pause
    exit /b 1
)

if %DEVICE_COUNT%==0 (
    echo.
    echo No device connected via USB. Either:
    echo   - Plug your phone in with USB debugging enabled, then re-run, OR
    echo   - Copy the APK to your phone manually:
    echo       %CD%\%APK%
    echo.
    pause
    exit /b 0
)

echo Installing on device...
"%ADB%" install -r "%APK%"
if errorlevel 1 (
    echo.
    echo ERROR: install failed. Try uninstalling the old version first:
    echo   "%ADB%" uninstall com.mdrrmo.pulse911
    pause
    exit /b 1
)
echo.

echo [4/4] Launching app and watching push logs...
echo (Press Ctrl+C to stop watching logs - app keeps running)
echo.
"%ADB%" shell monkey -p com.mdrrmo.pulse911 -c android.intent.category.LAUNCHER 1 >nul 2>&1
"%ADB%" logcat -c
"%ADB%" logcat -s Capacitor:* CapacitorPlugins:* FirebaseMessaging:* FA:* chromium:* | findstr /I "push fcm token notification registration"
endlocal
