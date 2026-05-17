@echo off
title Remote Claude Code - Hotspot Mode
cd /d "%~dp0"

echo ==============================================
echo   Remote Claude Code - Hotspot Mode
echo ==============================================
echo.
echo This mode works even if the router has
echo AP isolation enabled.
echo.
echo BEFORE starting, please:
echo   1. Open Windows Settings (Win+I)
echo   2. Go to: Network ^& Internet ^> Mobile Hotspot
echo   3. Turn ON "Mobile hotspot"
echo   4. Connect your phone to the PC's hotspot
echo.
echo The server will listen on ALL network interfaces.
echo Your phone should use the hotspot IP shown below.
echo.
echo ==============================================
echo.
echo Starting server...
node server.js
pause
