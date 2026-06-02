@echo off
setlocal
cd /d "%~dp0.."
powershell -NoProfile -ExecutionPolicy Bypass -File "video\generate-narration.ps1"
if errorlevel 1 exit /b 1
call node_modules\.bin\electron.cmd video\render-demo.js
if errorlevel 1 exit /b 1
call node_modules\.bin\electron.cmd video\render-demo.js --vertical
if errorlevel 1 exit /b 1
echo Finished.
