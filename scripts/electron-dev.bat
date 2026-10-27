@echo off
REM DevCardCV — Escritorio en modo desarrollo (Electron)
cd /d "%~dp0..\desktop-electron"
if not exist node_modules (
  echo [DevCardCV] Instalando Electron + electron-builder...
  call npm install --no-audit --no-fund
)
call node preparar.cjs
call npm run start
