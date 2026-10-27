@echo off
REM DevCardCV — Compilar APK Android localmente (requiere Node y Android Studio con SDK 34+)
cd /d "%~dp0..\capacitor"
if not exist node_modules (
  echo [DevCardCV] Instalando Capacitor...
  call npm install --no-audit --no-fund
)
call node copiar-web.cjs
if not exist android (
  call npx cap add android
)
call npx cap sync android
cd android
echo [DevCardCV] Compilando APK debug...
call gradlew.bat assembleDebug
echo.
echo [DevCardCV] APK en capacitor\android\app\build\outputs\apk\debug\app-debug.apk
