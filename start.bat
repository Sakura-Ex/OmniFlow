@echo off
setlocal
title OmniFlow
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start.ps1" %*
set "OMNIFLOW_EXIT_CODE=%ERRORLEVEL%"
if not "%OMNIFLOW_EXIT_CODE%"=="0" (
  echo.
  echo OmniFlow could not start. See the message above.
  pause
)
exit /b %OMNIFLOW_EXIT_CODE%
