@echo off
setlocal
title XT Trade Journal AI
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-windows.ps1"
set "XT_EXIT_CODE=%ERRORLEVEL%"
if not "%XT_EXIT_CODE%"=="0" (
  echo.
  echo XT could not start. Keep this window open to read the error above.
  pause
)
exit /b %XT_EXIT_CODE%
