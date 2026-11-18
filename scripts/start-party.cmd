@echo off
rem Double-click to start Chiara Pop Quiz and get a public link.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-party.ps1" %*
pause
