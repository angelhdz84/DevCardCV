@echo off
chcp 65001 >nul
title ⚡ Descargando Librerías - DevCardCV
cls
echo ====================================================
echo  ⚡ DEVCARDCV - DESCARGA DE LIBRERÍAS
echo ====================================================
echo  Base: 12 librerias + Adicionales: 2
echo ====================================================
if not exist "assets\css" mkdir "assets\css"
if not exist "assets\js\libs" mkdir "assets\js\libs"
if not exist "assets\fonts" mkdir "assets\fonts"

set "CURL=curl -f -L --retry 3 --retry-delay 2 -# -o"

echo.
echo --- Base: CSS y Fuentes ---
%CURL% "assets/css/tailwind.min.css" "https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css"
%CURL% "assets/css/daisyui.min.css" "https://cdn.jsdelivr.net/npm/daisyui@4.12.10/dist/full.css"
%CURL% "assets/css/bootstrap-icons.css" "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css"
%CURL% "assets/css/animate.min.css" "https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css"
%CURL% "assets/fonts/bootstrap-icons.woff2" "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/fonts/bootstrap-icons.woff2"

echo.
echo --- Base: JavaScript ---
%CURL% "assets/js/libs/alpine.js" "https://cdn.jsdelivr.net/npm/alpinejs@3.14.1/dist/cdn.min.js"
%CURL% "assets/js/libs/dexie.js" "https://unpkg.com/dexie@4.0.8/dist/dexie.min.js"
%CURL% "assets/js/libs/crypto-js.js" "https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.2.0/crypto-js.min.js"
%CURL% "assets/js/libs/pako.js" "https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js"
%CURL% "assets/js/libs/apexcharts.js" "https://cdn.jsdelivr.net/npm/apexcharts@3.49.1/dist/apexcharts.min.js"
%CURL% "assets/js/libs/jspdf.js" "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
%CURL% "assets/js/libs/xlsx.js" "https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js"

echo.
echo --- Adicionales: HTML2Canvas + emailjs.min.js" "https://cdn.jsdelivr.net/npm/@emailjs/browser@4.4.1/dist/email.min.js"
%CURL% "assets/js/libs/html2canvas.min.js" "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"
%CURL% "assets/js/libs/emailjs.min.js" "https://cdn.jsdelivr.net/npm/@emailjs/browser@4.4.1/dist/email.min.js"

echo.
echo --- Verificando archivos descargados ---
set "ERRORES=0"
set "ESPERADOS=14"

if not exist "assets/css/tailwind.min.css" set /a ERRORES+=1 & echo  [FAIL] tailwind.min.css
if not exist "assets/css/daisyui.min.css" set /a ERRORES+=1 & echo  [FAIL] daisyui.min.css
if not exist "assets/css/bootstrap-icons.css" set /a ERRORES+=1 & echo  [FAIL] bootstrap-icons.css
if not exist "assets/css/animate.min.css" set /a ERRORES+=1 & echo  [FAIL] animate.min.css
if not exist "assets/fonts/bootstrap-icons.woff2" set /a ERRORES+=1 & echo  [FAIL] bootstrap-icons.woff2
if not exist "assets/js/libs/alpine.js" set /a ERRORES+=1 & echo  [FAIL] alpine.js
if not exist "assets/js/libs/dexie.js" set /a ERRORES+=1 & echo  [FAIL] dexie.js
if not exist "assets/js/libs/crypto-js.js" set /a ERRORES+=1 & echo  [FAIL] crypto-js.js
if not exist "assets/js/libs/pako.js" set /a ERRORES+=1 & echo  [FAIL] pako.js
if not exist "assets/js/libs/apexcharts.js" set /a ERRORES+=1 & echo  [FAIL] apexcharts.js
if not exist "assets/js/libs/jspdf.js" set /a ERRORES+=1 & echo  [FAIL] jspdf.js
if not exist "assets/js/libs/xlsx.js" set /a ERRORES+=1 & echo  [FAIL] xlsx.js
if not exist "assets/js/libs/html2canvas.min.js" set /a ERRORES+=1 & echo  [FAIL] html2canvas.min.js
if not exist "assets/js/libs/emailjs.min.js" "https://cdn.jsdelivr.net/npm/@emailjs/browser@4.4.1/dist/email.min.js"

echo.
echo ====================================================
if %ERRORES% EQU 0 (
    echo  ✅ %ESPERADOS%/%ESPERADOS% librerías descargadas correctamente
) else (
    echo  ⚠️  %ERRORES% archivos faltantes de %ESPERADOS%
    echo  Sugerencia: Desactiva el antivirus temporalmente o ejecuta como Administrador
)
echo ====================================================
pause
