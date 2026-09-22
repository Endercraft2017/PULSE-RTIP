@echo off
setlocal enabledelayedexpansion

call :EnsureNode
if errorlevel 1 exit /b 1

cd /d "%~dp0src\backend"

if not exist ".env" (
    echo [start.bat] No .env found, copying .env.example...
    copy /y ".env.example" ".env" >nul
)

if not exist "node_modules" (
    echo [start.bat] Installing backend dependencies...
    call npm install
    if errorlevel 1 (
        echo [start.bat] npm install failed.
        pause
        exit /b 1
    )
)

REM --- Read PORT from .env (default 3000) ---
set "PORT=3000"
for /f "usebackq tokens=1,2 delims==" %%A in (".env") do (
    if /i "%%A"=="PORT" if not "%%B"=="" set "PORT=%%B"
)

REM --- LAN IP: prefer the adapter actually carrying the default route (the
REM     real active WiFi/Ethernet link), so VPN/Hyper-V/VMware virtual
REM     adapters on a laptop don't get picked by mistake. ---
set "LAN_IP="
for /f "delims=" %%A in ('powershell -NoProfile -Command "(Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' } | Select-Object -First 1 -ExpandProperty IPv4Address).IPAddress"') do set "LAN_IP=%%A"
if not defined LAN_IP (
    for /f "delims=" %%A in ('powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike '169.254.*' -and $_.IPAddress -ne '127.0.0.1' } | Select-Object -First 1 -ExpandProperty IPAddress)"') do set "LAN_IP=%%A"
)

echo.
echo ========================================
echo   PULSE-RTIP Server
echo ========================================
echo   This PC:     http://localhost:!PORT!
if defined LAN_IP (
    echo   Other devices on this WiFi: http://!LAN_IP!:!PORT!
    echo.
    echo   This IP changes on every different WiFi network. In the
    echo   mobile app, tap "Server: ..." on the login screen ^(or on
    echo   the offline screen^) and paste the address above.
) else (
    echo   Could not auto-detect this PC's IP. Run "ipconfig" and look
    echo   for the IPv4 Address under your active WiFi adapter.
)
echo ========================================
echo.

start "PULSE-RTIP Server" cmd /k npm start

echo [start.bat] Waiting for server to boot...
timeout /t 4 /nobreak >nul
start "" "http://localhost:!PORT!"

endlocal
exit /b 0

REM ============================================================
REM Subroutines (only reached via "call", never by falling through)
REM ============================================================

REM --- Checks Node.js is present and is version 18+; offers a winget
REM     install (with explicit consent) or a manual download page on
REM     either problem. Returns errorlevel 1 if Node.js still isn't
REM     usable by the time this returns. ---
:EnsureNode
where node >nul 2>&1
if errorlevel 1 (
    echo.
    echo ============================================================
    echo   Node.js was not found on this PC.
    echo   PULSE-RTIP needs Node.js 18 or newer to run the server.
    echo ============================================================
    call :OfferInstall "OpenJS.NodeJS.LTS" "Node.js" "https://nodejs.org/"
    if errorlevel 1 exit /b 1
    where node >nul 2>&1
    if errorlevel 1 (
        echo.
        echo Node.js was installed, but this window can't see it yet.
        echo Close this window, open a new one, and re-run start.bat.
        pause
        exit /b 1
    )
)

for /f "tokens=1 delims=v" %%v in ('node -v') do set "NODE_VER_STRING=%%v"
for /f "tokens=1 delims=." %%v in ("!NODE_VER_STRING!") do set "NODE_MAJOR=%%v"
if !NODE_MAJOR! LSS 18 (
    echo.
    echo ============================================================
    echo   Node.js !NODE_VER_STRING! is installed, but PULSE-RTIP needs
    echo   version 18 or newer.
    echo ============================================================
    call :OfferInstall "OpenJS.NodeJS.LTS" "Node.js" "https://nodejs.org/"
    if errorlevel 1 exit /b 1
    for /f "tokens=1 delims=v" %%v in ('node -v') do set "NODE_VER_STRING=%%v"
    for /f "tokens=1 delims=." %%v in ("!NODE_VER_STRING!") do set "NODE_MAJOR=%%v"
    if !NODE_MAJOR! LSS 18 (
        echo.
        echo Still on an old version after installing. Close this window,
        echo open a new one, and re-run start.bat.
        pause
        exit /b 1
    )
)
exit /b 0

REM --- Asks to auto-install %~2 via winget (package id %~1); on decline
REM     or on winget being unavailable, offers to open %~3 instead.
REM     Returns errorlevel 1 if the caller should treat this as a hard
REM     stop (declined and isn't going to fix it another way). ---
:OfferInstall
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

echo.
echo Installing %~2 via winget - this can take a few minutes...
winget install --id %~1 -e --source winget --accept-package-agreements --accept-source-agreements
echo.
echo Refreshing this window's PATH...
for /f "delims=" %%P in ('powershell -NoProfile -Command "[System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')"') do set "PATH=%%P"
exit /b 0

:OfferInstall_Manual
choice /C YN /M "Open the download page for %~2 instead"
if not errorlevel 2 start "" "%~3"
pause
exit /b 1
