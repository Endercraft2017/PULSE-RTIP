@echo off
setlocal
title PULSE 911 - Send Test Push

echo ============================================================
echo  Send a test push notification to all registered devices
echo ============================================================
echo.

set TITLE=%1
if "%TITLE%"=="" set TITLE=PULSE 911 Test

set MSG=%2
if "%MSG%"=="" set MSG=This is a test push from your laptop. Tap to dismiss.

ssh -i %USERPROFILE%\kali_openclaw -o StrictHostKeyChecking=no root@76.13.215.54 "cd /opt/PULSE-RTIP/src/backend && node -e \"const fcm=require('./services/push/fcm');const db=require('./config/database');(async()=>{const r=await db.query('SELECT token FROM push_tokens');console.log('Tokens:',r.length);if(!r.length){console.log('No devices registered yet. Open the app and let it register first.');process.exit(0);}const o=await fcm.send(r.map(x=>x.token),{title:'%TITLE%',body:'%MSG%',sound:true});console.log('Result:',JSON.stringify(o));process.exit(0);})().catch(e=>{console.error(e);process.exit(1);});\""

echo.
pause
endlocal
