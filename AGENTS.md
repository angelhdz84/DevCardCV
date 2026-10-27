# DevCardCV — AGENTS.md

Offline-first SPA for developer CV profiles (hash-based router, Alpine.js + SQLite local sql.js engine). **Mono-usuario: sin login/logout.** El modo online Supabase (Dexie + HTTP) permanece inactivo y seleccionable vía `APP_CONFIG.storage.modo`.

## Architecture

- **Stack**: Alpine.js 3 + sql.js (SQLite local, fuente de verdad en modo offline) + Dexie 4 (IndexedDB, legacy online) + CryptoJS (AES/SHA-256). Empaquetado: Electron (desktop) y Capacitor (Android). CI: `.github/workflows/{electron-windows,android-apk}.yml`
- **Design**: Tailwind CSS v2 + DaisyUI 4 + Bootstrap Icons + custom tokens (Slate/ink + Emerald accent + Violet secondary)
- **Deploy**: GitHub Pages (push to `main` → `.github/workflows/pages.yml`), Netlify (`netlify.toml`), o builds nativos via Actions
- **Data mode flag**: `project.config.js → storage.modo = 'sqlite-local'` (offline SQLite) | `'supabase-online'` (legacy Supabase)
- **Lib download**: run `scripts/descargar-libs.bat` to fetch all 15+ vendor libs to `assets/{css,js/libs}/`
- **Docs**: `docs/version-offline-sqlite.md` — guía completa de la versión SQLite offline

## Entry & Load Order

`index.html` → `project.config.js` (defines `APP_CONFIG` global) → core scripts → modules → `main.js`

Core scripts load in exact order:
```
core/db-sqlite.js → core/db.js → core/db-supabase.js → core/db-offline.js → core/crypto.js → core/ui.js → core/app.js
```

Module scripts load after core (any order): `dashboard/`, `perfiles/`, `habilidades/`, `cv/`, `proyectos/` (sin `auth/` — monousuario)

`main.js` entry flow (offline): `db.open()` → `await window.sqliteOffline.init()` (motor SQLite + migración legacy + snap; bloqueante antes del router) → `_initAuthStore()` → `checkSession()` (sesión monousuario automática con rol admin, hace bootstrap del admin local) → `appRouter.init()` → LOADING HIDDEN → background `seedInitialData()` + `refreshCache()` (no-op en offline) via `Promise.all`

## Module Pattern

Every module in `modules/*/module.js` exports:
```js
const Module = {
  id: 'name',
  titulo: 'Display Name',
  async init() {},
  async render(params = {}) { return HTML string; },
  destroy() {}
};
window.MODULES[id] = Module;
appRouter.register(Module);
```

Route aliases `login`/`register` auto-redirect to `#/auth/{alias}`; with the auto admin session the router immediately redirects any `#/auth/*` route to `#/dashboard` (auth module is no longer loaded).

## Data Layer

| Layer | Role | Access |
|-------|------|--------|
| `dbSQLite` (core/db-sqlite.js) | **SQLite engine (sql.js) — source of truth in offline mode**; 9 tables full schema + partial unique indexes on `email_hash`; persists snapshot (Electron file → kv IndexedDB `devcardcv_kv` → legacy Dexie `_sqlite_cache` read) and auto-migrates legacy Dexie data | `insert/update/upsert/deleteById/deleteWhere/selectAll/getById/selectWhere/countAll/bulkInsert/queryObjects/export/import/download` |
| `db` (core/db.js) | Offline: **Dexie-compatible facade over SQLite** (toArray/get/add/put/bulkAdd/update/delete/clear/count/where.equals) used by modules. Online: real Dexie (IndexedDB) | Same methods, both modes |
| `dbLocal` | Read-only wrapper — SQLite reads in offline mode, Dexie reads online | `getAll()`, `get()`, `getWhere()`, `count()` |
| `dbOnline` | Offline (core/db-offline.js): local CRUD over SQLite with same API as Supabase version. Online: Supabase CRUD + cache | `add/update/delete/bulkDelete/get/getWhere/getAll/refreshCache` |

**Read pattern**: Module `render()` functions use `dbLocal` for **instant** data reads (SQLite-backed in offline). Writes use `dbOnline.add/update/...` (local in offline mode — it succeeds, no throw; in online mode throws OFFLINE and modules fall back to Dexie writes). UI auto-refreshes via `db-change` event.

**Snapshot persistence (offline)**: Debounced 300 ms flush + flush on pagehide/visibilitychange. Priority: Electron real file `%APPDATA%/DevCardCV/devcardcv.sqlite` (atomic tmp→rename) → kv IndexedDB `devcardcv_kv` → legacy migration source `DevCardCVDB` (Dexie tables).

Schema (9 SQLite tables): `perfiles`, `habilidades`, `perfil_habilidades`, `usuarios`, `proyectos`, `tareas`, `proyecto_usuarios`, `equipos`, `categorias`; online Dexie also keeps `_sqlite_cache`. `tareas` keeps BOTH `proyecto_id` and `proyectoId` columns for legacy module code.

Sensitive fields (`notas_admin`) encrypted via `cryptoHelpers.encrypt()` (CryptoJS AES). Contact data (`email`, `telefono`, `direccion`, `dni`) stored as plain text.
`perfiles` also has `email_hash` (SHA-256 of email) for deterministic duplicate detection — partial unique index in SQLite, unique index in Dexie/Supabase.

## Auth (mono-usuario, sin login)

- **No login screen, no logout button** — `modules/auth/module.js` is not loaded and `auth` is not in `modulosActivos`.
- `appRouter.checkSession()` auto-creates a local session with rol `admin`: runs `_bootstrapAdmin()` (idempotent upsert in `usuarios` from `APP_CONFIG.auth.admin`), reads that user, stores session in `localStorage` (`APP_CONFIG.auth.sessionKey`)
- Fallback: if bootstrap fails, a synthetic `{ userId: 1, rol: 'admin' }` session is set so the UI always works
- `auth-logout` event listener and `#/auth/*` UI were removed; any manual navigation to `#/auth/*` redirects to `#/dashboard`

## Alpine.js Gotchas

- `x-for :key` must be **unique**. Never use `p.nombre` as key — names can repeat. Always use a unique field like `p.id`. Passing duplicate keys causes silent render failures (`Cannot read properties of undefined (reading 'after')`).
- Stores must be created BEFORE `Alpine.start()`. The inline `<script>` in `index.html` creates `auth`, `ui`, and `loading` stores with a guard `if(!Alpine.store(...))`.
- Module `render()` returns raw HTML; Alpine processes it after injection. JSON data passed via `x-data` must escape quotes: `JSON.stringify(...).replace(/"/g, '&quot;')`.

## Key Conventions

- **No ES6 modules, no imports/exports, no CDN at runtime** — all JS in global scope, all libs in `assets/`
- **Squeletor CSS classes**: `.sk-el`, `.sk-heading`, `.sk-card`, `.sk-chart`, `.sk-row`, `.sk-text`, `.sk-badge`, `.sk-avatar`, `.sk-progress` — use instead of generic spinners
- **Squeletor CSS classes**: `.sk-el`, `.sk-heading`, `.sk-card`, `.sk-chart`, `.sk-row`, `.sk-text`, `.sk-badge`, `.sk-avatar`, `.sk-progress` — use instead of generic spinners
- **CV PDF export**: Alpine `perfil` data already has decrypted `email`, `telefono`, `direccion`, `dni`. Do NOT call `cryptoHelpers.decrypt()` again in `_generarPDF()` — values come pre-decrypted from `render()`. Excel export (`exportarExcelUnico`) uses the same pre-decrypted values.
- **`refreshCache()`**: runs 8 tables in parallel via `Promise.all(tables.map(...))`, uses `bulkAdd()`
- **db-change event**: dispatch `new CustomEvent('db-change')` after data mutations to trigger re-renders
- **Chart cleanup**: dashboard destroys ApexCharts instances in `destroy()` via `window._dashboardCharts`

## Performance (offline-first pattern)

- **IndexedDB-first reads**: Module `render()` functions MUST use `dbLocal` (IndexedDB) for instant data reads — NEVER `dbOnline` in render paths
- **Non-blocking init**: `dbOnline.init()` and `_bootstrapAdmin()` run in background (fire-and-forget), NOT awaited
- **Loading hidden early**: `Alpine.store('loading').visible = false` immediately after `appRouter.init()`, NOT after `refreshCache()`
- **Background sync**: `refreshCache()` runs in background after UI is visible; UI auto-refreshes via `db-change` event
- **Writes always go through `dbOnline`** (Supabase) — throws if offline

## Proyectos Module — Enhanced Features

- **Inline edit proyecto**: Admin can toggle editing from detail view — edit nombre, descripción, prioridad, fecha límite, notas_admin with save/cancel
- **Inline edit tarea**: Admin can edit nombre, descripción, fecha_limite, asignado_a, prioridad, horas_estimadas per task with save/cancel
- **Eliminar tarea**: Admin has delete button per tarea with confirmation dialog
- **Prioridad y horas por tarea**: Each task has `prioridad` (baja/media/alta) and `horas_estimadas` (optional number)
- **Filtro por responsable**: Select filter shows all developers; filters proyectos where that dev is assigned
- **Excel export**: Button in list view exports .xlsx with two sheets: Proyectos + Tareas
- **Dashboard widget**: Shows counts for Activos, Vencidos, Próximos (≤3d), and Tareas abiertas (admin) or Mis tareas (dev)
- **Due-date notifications**: On module init, shows toast warning for overdue items and info for items due ≤3 days
- **Create form tareas**: Now includes prioridad + horas_estimadas inputs

## Keyboard Shortcuts

- `Ctrl/Cmd+N` — new profile
- `Ctrl/Cmd+F` — focus search input
- `Ctrl/Cmd+E` — trigger export button
- `Escape` — close modals, sidebar drawer

## Testing & Validation

- No test runner or test files in repo
- Validation report: `docs/validacion-devcardcv.md` (static compliance + manual browser tests)
- UX audit: `docs/ux-audit-report.md`
- Run locally: open `index.html` directly (no server needed), or serve via any static server
