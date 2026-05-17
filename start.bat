@echo off
:: Run this as Administrator (right-click -> Run as Administrator)
echo Adding firewall rule for Remote Claude Code (port 3456)...
netsh advfirewall firewall add rule name="Remote Claude Code" dir=in action=allow protocol=TCP localport=3456
echo.
echo Firewall rule added successfully.
echo.
echo Starting server...
cd /d "%~dp0"
node server.js
pause
