@echo off
REM DevCardCV — Generar instalador (.exe NSIS) y portable de Windows
cd /d "%~dp0..\desktop-electron"
if not exist node_modules (
  echo [DevCardCV] Instalando Electron + electron-builder...
  call npm install --no-audit --no-fund
)
call npm run dist
echo.
echo [DevCardCV] Exes generados en desktop-electron\dist\
