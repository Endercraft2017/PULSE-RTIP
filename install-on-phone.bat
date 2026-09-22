@echo off
setlocal EnableDelayedExpansion
title PULSE 911 - Build and Install on Phone

cd /d "%~dp0"

echo ============================================================
echo  PULSE 911 - Build and Install
echo ============================================================
echo.

echo [0/4] Checking prerequisites...

where node >nul 2>&1
if errorlevel 1 (
    echo.
    echo Node.js was not found on this PC.
    call :OfferInstall "OpenJS.NodeJS.LTS" "Node.js" "https://nodejs.org/"
    if errorlevel 1 exit /b 1
    where node >nul 2>&1
    if errorlevel 1 (
        echo.
        echo Node.js was installed, but this window can't see it yet.
        echo Close this window, open a new one, and re-run this script.
        pause
        exit /b 1
    )
)

where java >nul 2>&1
if errorlevel 1 (
    echo.
    echo Java ^(JDK^) was not found. Gradle needs a JDK to build the app.
    call :OfferInstall "EclipseAdoptium.Temurin.17.JDK" "Eclipse Temurin JDK 17" "https://developer.android.com/studio"
    if errorlevel 1 exit /b 1
    where java >nul 2>&1
    if errorlevel 1 (
        echo.
        echo Java was installed, but this window can't see it yet.
        echo Close this window, open a new one, and re-run this script.
        pause
        exit /b 1
    )
)

set SDK_OK=
if exist "android\local.properties" set SDK_OK=1
if not defined SDK_OK if defined ANDROID_HOME if exist "%ANDROID_HOME%\platform-tools" set SDK_OK=1
if not defined SDK_OK if defined ANDROID_SDK_ROOT if exist "%ANDROID_SDK_ROOT%\platform-tools" set SDK_OK=1
if not defined SDK_OK (
    echo.
    echo The Android SDK location isn't configured yet
    echo ^(android\local.properties is missing^).
    call :OfferInstall "Google.AndroidStudio" "Android Studio" "https://developer.android.com/studio"
    if errorlevel 1 exit /b 1
    echo.
    echo Android Studio is installed. Open it once now, let its setup
    echo wizard finish downloading the Android SDK ^(this needs its GUI -
    echo it can't be scripted^), then close this window and re-run
    echo install-on-phone.bat.
    pause
    exit /b 1
)

echo OK: Node.js, Java, and the Android SDK are all in place.
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
    if not exist "android\local.properties" (
        echo It looks like the Android SDK location isn't configured yet
        echo ^(android\local.properties is missing^). Install Android Studio
        echo from https://developer.android.com/studio, open this project's
        echo android folder in it once so it can configure the SDK path,
        echo then re-run this script.
    ) else (
        echo If you see "Could not read workspace metadata" errors,
        echo run repair-gradle.bat once, then re-run this script.
    )
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
exit /b 0

REM ============================================================
REM Subroutines (only reached via "call", never by falling through)
REM ============================================================

REM --- Asks to auto-install %~2 via winget (package id %~1); on decline
REM     or on winget being unavailable, offers to open %~3 instead.
REM     Returns errorlevel 1 if the caller should treat this as a hard
REM     stop (declined and isn't going to fix it another way). ---
:OfferInstall
set "WINGET_RETRY_COUNT=0"
echo.
choice /C YN /M "Install %~2 automatically now (via winget)"
if errorlevel 2 goto :OfferInstall_Manual

where winget >nul 2>&1
if errorlevel 1 (
    echo.
    echo winget isn't available on this PC, so it can't install %~2
    echo automatically.
    goto :OfferInstall_Manual
)

:OfferInstall_Attempt
echo.
echo Installing %~2 via winget - this can take a few minutes...
winget install --id %~1 -e --source winget --accept-package-agreements --accept-source-agreements
set "WINGET_RC=%errorlevel%"
if not "%WINGET_RC%"=="0" (
    set /a WINGET_RETRY_COUNT+=1
    echo.
    echo winget reported an error installing %~2 ^(exit code %WINGET_RC%^).
    echo Common causes: no internet connection, a UAC/elevation prompt
    echo was dismissed, or it's already installed under a different name.
    if !WINGET_RETRY_COUNT! LSS 2 (
        choice /C YN /M "Try the automatic install again"
        if not errorlevel 2 goto :OfferInstall_Attempt
    )
    echo.
    goto :OfferInstall_Manual
)

echo.
echo Refreshing this window's PATH...
for /f "delims=" %%P in ('powershell -NoProfile -Command "[System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')"') do set "PATH=%%P"
exit /b 0

:OfferInstall_Manual
choice /C YN /M "Open the download page for %~2 instead"
if not errorlevel 2 start "" "%~3"
pause
exit /b 1
