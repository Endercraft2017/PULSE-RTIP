@echo off
setlocal
title PULSE 911 - Repair Gradle Cache

echo ============================================================
echo  Repair corrupted Gradle cache
echo ============================================================
echo.
echo This stops any running Gradle daemons and deletes the
echo transforms cache that's throwing "Could not read workspace
echo metadata" errors. Gradle will rebuild it on the next build.
echo.
echo Safe to run any time. Takes ^~20 seconds.
echo.
pause

echo.
echo [1/3] Stopping all Gradle daemons...
pushd "%~dp0android" 2>nul
if exist gradlew.bat (
    call gradlew.bat --stop
) else (
    echo (No gradlew.bat found, skipping)
)
popd
echo.

echo [2/3] Deleting corrupted transforms cache...
set TRANSFORMS=%USERPROFILE%\.gradle\caches\8.14.3\transforms
if exist "%TRANSFORMS%" (
    rmdir /s /q "%TRANSFORMS%"
    if exist "%TRANSFORMS%" (
        echo WARNING: could not fully delete %TRANSFORMS%
        echo Some files may be locked. Close Android Studio / VS Code Gradle extension and retry.
    ) else (
        echo Deleted %TRANSFORMS%
    )
) else (
    echo (Folder doesn't exist, nothing to delete)
)
echo.

echo [3/3] Clearing project-level build cache...
if exist "%~dp0android\.gradle" (
    rmdir /s /q "%~dp0android\.gradle"
    echo Deleted android\.gradle
)
if exist "%~dp0android\app\build" (
    rmdir /s /q "%~dp0android\app\build"
    echo Deleted android\app\build
)
echo.

echo ============================================================
echo  Done. Now run install-on-phone.bat again.
echo ============================================================
pause
endlocal
