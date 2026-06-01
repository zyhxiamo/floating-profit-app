@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\scripts\deploy-cloudbase.ps1" -ConfigPath ".\cloudbase.local.json"
pause
