@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Instala Node.js 22 o posterior desde https://nodejs.org y vuelve a intentar.
  pause
  exit /b 1
)
node abrir.mjs
pause
