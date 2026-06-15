# DevCardCV — AGENTS.md

Offline-first SPA for developer CV profiles (hash-based router, Alpine.js + Dexie + Supabase).

## Architecture

- **Stack**: Alpine.js 3 + Dexie 4 (IndexedDB) + Supabase (cloud sync) + sql.js (SQLite queries) + CryptoJS (AES)
- **Design**: Tailwind CSS v2 + DaisyUI 4 + Bootstrap Icons + custom tokens (Slate/ink + Emerald accent + Violet secondary)
- **Deploy**: GitHub Pages (push to `main` → `.github/workflows/pages.yml`) or Netlify (`netlify.toml`, publish `.`)
- **Lib download**: run `scripts/descargar-libs.bat` to fetch all 15+ vendor libs to `assets/{css,js/libs}/`

## Entry & Load Order

`index.html` → `project.config.js` (defines `APP_CONFIG` global) → core scripts → modules → `main.js`

Core scripts load in exact order:
```
core/db.js → core/db-sqlite.js → core/db-supabase.js → core/crypto.js → core/ui.js → core/app.js
```

Module scripts load after core (any order): `auth/`, `dashboard/`, `perfiles/`, `habilidades/`, `cv/`, `proyectos/`

`main.js` entry flow: open IndexedDB → init dbOnline (Supabase) → init auth store → checkSession from local → `appRouter.init()` → background bootstrap (admin + seed data + `refreshCache()` via `Promise.all`)

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

Route aliases: `login`, `setup`, `register` auto-redirect to `#/auth/{alias}`.
Auth guard auto-redirects unauthenticated users to `#/auth/login`.

## Data Layer

| Layer | Role | Access |
|-------|------|--------|
| `db` (Dexie) | Primary IndexedDB store | All reads/writes |
| `dbLocal` | Read-only wrapper over Dexie | `getAll()`, `get()`, `getWhere()`, `count()` — **instant, no HTTP** |
| `dbOnline` | Supabase CRUD + cache | Falls back to Dexie when offline. Writes throw if offline. |
| `dbSQLite` | sql.js in-memory + IndexedDB persistence | For SQL reports, backup/restore |

Dexie schema (v8, 10 tables): `perfiles`, `habilidades`, `perfil_habilidades`, `_sqlite_cache`, `usuarios`, `proyectos`, `tareas`, `proyecto_usuarios`, `equipos`, `categorias`

Sensitive fields (`email`, `telefono`, `direccion`, `dni`) encrypted via `cryptoHelpers.encrypt()` (CryptoJS AES). Key auto-generated, stored in localStorage.

Supabase tables must have `REPLICA IDENTITY FULL` and `RLS FOR ALL TO anon USING (true)` (app uses Supabase anon key, not Supabase Auth).

## Auth

- Custom auth (not Supabase Auth): SHA-256 password hash, session token stored in `localStorage` keyed by `APP_CONFIG.auth.sessionKey`
- Roles: `admin` / `dev`
- Default admin: `admin@devcardcv.com` / `admin123` (via `APP_CONFIG.auth.admin`, auto-bootstrapped in `_bootstrapAdmin()`)
- Master key for setup: `APP_CONFIG.auth.masterKey` = `DevCardCV2024`
- Logout: sidebar button dispatches `new CustomEvent('auth-logout')` → handled in `app.js:init()` → calls `Alpine.store('auth').clearSession()` + redirects to `#/auth/login`

## Alpine.js Gotchas

- `x-for :key` must be **unique**. Never use `p.nombre` as key — names can repeat. Always use a unique field like `p.id`. Passing duplicate keys causes silent render failures (`Cannot read properties of undefined (reading 'after')`).
- Stores must be created BEFORE `Alpine.start()`. The inline `<script>` in `index.html` creates `auth`, `ui`, and `loading` stores with a guard `if(!Alpine.store(...))`.
- Module `render()` returns raw HTML; Alpine processes it after injection. JSON data passed via `x-data` must escape quotes: `JSON.stringify(...).replace(/"/g, '&quot;')`.

## Key Conventions

- **No ES6 modules, no imports/exports, no CDN at runtime** — all JS in global scope, all libs in `assets/`
- **Squeletor CSS classes**: `.sk-el`, `.sk-heading`, `.sk-card`, `.sk-chart`, `.sk-row`, `.sk-text`, `.sk-badge`, `.sk-avatar`, `.sk-progress` — use instead of generic spinners
- **Squeletor CSS classes**: `.sk-el`, `.sk-heading`, `.sk-card`, `.sk-chart`, `.sk-row`, `.sk-text`, `.sk-badge`, `.sk-avatar`, `.sk-progress` — use instead of generic spinners
- **CV PDF export**: Alpine `perfil` data already has decrypted `email`, `telefono`, `direccion`, `dni`. Do NOT call `cryptoHelpers.decrypt()` again in `_generarPDF()` — values come pre-decrypted from `render()`. Excel export (`exportarExcelUnico`) uses the same pre-decrypted values.\
- **`refreshCache()`**: runs 8 tables in parallel via `Promise.all(tables.map(...))`, uses `bulkAdd()`
- **db-change event**: dispatch `new CustomEvent('db-change')` after data mutations to trigger re-renders
- **Chart cleanup**: dashboard destroys ApexCharts instances in `destroy()` via `window._dashboardCharts`

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
