@echo off
setlocal
set "XT_MULTIUSER=1"
call "%~dp0Start-XT.cmd"
exit /b %ERRORLEVEL%
