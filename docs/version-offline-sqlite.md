# DevCardCV Offline — SQLite local (escritorio + Android)

Versión **100% offline** para uso personal (monousuario, sin pantalla de login). El motor de datos es **SQLite** (sql.js WASM ya presente en `assets/js/libs/`) y **Supabase queda desactivado** (código intacto, inactivo por configuración).

## 1. Modo de datos

`project.config.js`:

```js
storage: { modo: 'sqlite-local' }   // ← SQLite 100% offline (por defecto en esta versión)
// storage: { modo: 'supabase-online' }  ← vuelve al comportamiento original multiusuario
```

| Modo | Fuente de verdad | Escrituras |
|------|------------------|------------|
| `sqlite-local` | SQLite (sql.js) | directas y locales, con snapshot automático |
| `supabase-online` | Supabase | vía `dbOnline` con caché Dexie (comportamiento original) |

## 2. Arquitectura (capas nuevas/modificadas)

| Archivo | Rol |
|---------|-----|
| `core/db-sqlite.js` | **Motor SQLite**: 9 tablas con esquema completo, CRUD genérico, índices únicos parciales en `email_hash`, migración automática desde la IndexedDB legacy de Dexie, export/import `.sqlite`. |
| `core/db.js` | Modo: en `sqlite-local` crea una **fachada compatible con Dexie** (`db.perfiles.toArray/add/put/where/…`) respaldada por el motor SQLite; en online, Dexie clásico. También contiene `seedInitialData()` (compatible con ambos motores). |
| `core/db-offline.js` | Reimplementa `dbLocal` (lecturas) y `dbOnline` (escrituras/lecturas) sobre SQLite con la **misma API de Supabase**, de modo que los módulos no cambian. Expone `window.sqliteOffline.init()` para el arranque. |
| `main.js` | En offline: `await sqliteOffline.init()` (carga el motor, migración y seed) antes de abrir el router. |

Orden de carga (`index.html`): `db-sqlite.js → db.js → db-supabase.js → db-offline.js → crypto → ui → app → modules → main.js`.

## 3. Persistencia del snapshot SQLite

Se guarda el volcado binario de la base (`.sqlite`) con prioridad:

1. **Escritorio (Electron)** → archivo real en `%APPDATA%\DevCardCV\devcardcv.sqlite` (escritura atómica tmp→rename a través de `window.devcardcvFs`, puente expuesto por `desktop-electron/preload.cjs`).
2. **Navegador / PWA / Android (Capacitor)** → IndexedDB propia `devcardcv_kv` (clave `sqlite_bytes`), con flush con debounce (300 ms) y flush al ocultar/cerrar la página.
3. **Migración** → si el snapshot está vacío, importa automáticamente los datos de instalaciones anteriores leyendo la IndexedDB legacy de Dexie (`DevCardCVDB`), incluido el snapshot viejo de `_sqlite_cache`.

Backup manual disponible en Dashboard: **Exportar/Importar `.sqlite`** (restauración completa) y **Backup JSON/Excel**.

## 4. Monousuario (sin login)

- Eliminadas la pantalla de login/registro y el botón de cerrar sesión.
- `appRouter.checkSession()` crea una **sesión local automática** con rol `admin` (crea/actualiza el usuario administrador en la tabla `usuarios` con idempotencia desde `APP_CONFIG.auth.admin`).
- Siempre se ven las funciones de administración; no hay rutas de autenticación (`modules/auth` ya no se carga ni está en `modulosActivos`).

## 5. Escritorio (Windows) con Electron

Carpeta `desktop-electron/`:

```bat
scripts\electron-dev.bat      REM instalar deps + abrir la app
scripts\electron-dist.bat     REM generar instalador NSIS + portable (.exe) en desktop-electron\dist\
```

- `main.cjs` carga el frontend (staging en `app/` vía `preparar.cjs`, o el repo en modo dev) y guarda el `.sqlite` en la carpeta de datos del usuario.
- `preload.cjs` expone `window.devcardcvFs = { readDb, writeDb, dbPath }`.
- **CI**: `.github/workflows/electron-windows.yml` compila y publica el instalador como artifact en cada push a `main`.

## 6. Android con Capacitor

Carpeta `capacitor/` (appId `com.devcardcv.app`, webDir `www/`):

- **CI (recomendado, sin herramientas locales)**: `.github/workflows/android-apk.yml` → en cada push a `main` genera el proyecto Android (`cap add` + `cap sync`), compila y publica dos artifacts:
  - `DevCardCV-debug.apk` (instalable directamente)
  - `DevCardCV-release-unsigned.apk` (para firmar y publicar)
- **Local**: `scripts\android-local.bat` (requiere Node + Android Studio/SDK 34+).
- La APK embebe esta misma SPA en WebView (`https://localhost` interno → IndexedDB persistente). Admite **instalación PWA** como alternativa rápida.

Firma de la release (opcional): generar keystore con `keytool`, añadir secrets `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` y añadir un paso de firma en el workflow.

## 7. Informes SQL y backup

El dashboard ejecuta consultas SQL reales contra el motor SQLite (`dbSQLite.queryObjects`) — en modo offline ahora **sí hay datos** porque el motor es la fuente de verdad.

- `Exportar SQLite` → descarga `.sqlite` con toda la base.
- `Importar SQLite` → restaura la base desde un archivo (valida y completa esquema/columnas si el archivo es de una versión anterior).

## 8. Estructura añadida

```
core/db-offline.js              nueva capa offline
desktop-electron/               app Electron (main, preload, preparar, package.json)
capacitor/                      config Capacitor + copia de web (www/)
scripts/electron-dev.bat        run escritorio dev
scripts/electron-dist.bat       build .exe (NSIS + portable)
scripts/android-local.bat       build APK local
scripts/serve-local.cjs         servidor estático de prueba (http://localhost:8741)
.github/workflows/android-apk.yml       CI: APK debug + release-unsigned
.github/workflows/electron-windows.yml  CI: instalador + portable Windows
```

## 9. Notas

- `core/db-supabase.js` y el worker de sync en la nube quedan fuera del camino offline; con el flag vuelven al modo online sin restear nada.
- `project.config.js` sigue definiendo el admin local (`auth.admin`), que se usa para crear la sesión automática.
