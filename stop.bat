@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0src\backend"

set "PORT=3000"
if exist ".env" (
    for /f "usebackq tokens=1,2 delims==" %%A in (".env") do (
        if /i "%%A"=="PORT" if not "%%B"=="" set "PORT=%%B"
    )
)

echo Stopping the PULSE-RTIP server ^(port !PORT!^)...
echo.

set "STOPPED="

REM Stop whatever is actually listening on the configured port. This is
REM the reliable part - it works no matter how the server was started.
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":!PORT! .*LISTENING"') do (
    if not defined SEEN_%%P (
        set "SEEN_%%P=1"
        echo Stopping process %%P listening on port !PORT!...
        taskkill /PID %%P /F >nul 2>&1
        set "STOPPED=1"
    )
)

REM Then sweep up the now-empty console/terminal window start.bat opened,
REM if any. Matched by window title via PowerShell rather than tasklist's
REM process-name filter, since the actual process hosting that window can
REM be cmd.exe, conhost.exe, or WindowsTerminal.exe depending on the
REM user's default terminal app. This has to run AFTER the kill above:
REM while "npm start" is still the active foreground command, Windows
REM Terminal shows ITS name as the tab title instead of the one start.bat
REM set - the original title only comes back once that process is gone.
for /f "delims=" %%W in ('powershell -NoProfile -Command "(Get-Process | Where-Object { $_.MainWindowTitle -eq 'PULSE-RTIP Server' } | Select-Object -First 1 -ExpandProperty Id)" 2^>nul') do (
    echo Closing the leftover "PULSE-RTIP Server" window...
    taskkill /PID %%W /T /F >nul 2>&1
)

echo.
if not defined STOPPED (
    echo Nothing found running on port !PORT! - it's already stopped.
) else (
    echo Done. Port !PORT! is free.
)

pause
endlocal
