// core/db-sqlite.js — Motor SQLite local (sql.js WASM) — 100% offline
// Fuente de verdad cuando APP_CONFIG.storage.modo === 'sqlite-local'.
// Persistencia (por orden de prioridad):
//   1. Archivo .sqlite real vía Electron (window.devcardcvFs, preload de desktop-electron/)
//   2. IndexedDB propia 'devcardcv_kv' (navegador, Chrome/PWA, Android WebView/Capacitor)
//   3. Snapshot legacy en Dexie _sqlite_cache (solo lectura, versión anterior de la app)
const DB_SQLITE_LEGACY_SNAPSHOT_KEY = APP_CONFIG.db.sqliteCacheKey;

const DB_TABLES = {
  perfiles: ['id', 'nombre', 'email', 'telefono', 'direccion', 'dni', 'cargo', 'bio', 'fotoBase64', 'email_hash', 'notas_admin', 'created_at', 'updated_at'],
  habilidades: ['id', 'nombre', 'categoria', 'created_at', 'updated_at'],
  perfil_habilidades: ['id', 'perfil_id', 'habilidad_id'],
  usuarios: ['id', 'email', 'email_hash', 'nombre', 'password_hash', 'rol', 'perfilId', 'created_at', 'updated_at'],
  proyectos: ['id', 'nombre', 'descripcion', 'prioridad', 'estado', 'fecha_limite', 'notas_admin', 'creado_por', 'created_at', 'updated_at'],
  tareas: ['id', 'proyecto_id', 'proyectoId', 'nombre', 'descripcion', 'estado', 'prioridad', 'horas_estimadas', 'fecha_limite', 'asignado_a', 'asignadoA', 'comentario_dev', 'created_at', 'updated_at'],
  proyecto_usuarios: ['id', 'proyecto_id', 'perfil_id'],
  equipos: ['id', 'nombre'],
  categorias: ['id', 'nombre', 'created_at']
};

// ─── Snapshot storage (IndexedDB propio, sin Dexie) ───

function kvOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('devcardcv_kv', 1);
    req.onupgradeneeded = () => { req.result.createObjectStore('kv', { keyPath: 'key' }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function kvGet(key) {
  try {
    const idb = await kvOpen();
    return await new Promise((resolve, reject) => {
      const tx = idb.transaction('kv', 'readonly');
      const req = tx.objectStore('kv').get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) { console.warn('⚠️ kv read:', e.message); return null; }
}

async function kvPut(key, value) {
  const idb = await kvOpen();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction('kv', 'readwrite');
    const req = tx.objectStore('kv').put({ key, value });
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

// ─── Lectura del snapshot legacy en la IndexedDB de Dexie (migración desde versiones previas) ───

function legacyIdbTable(table) {
  return new Promise((resolve) => {
    let req;
    try { req = indexedDB.open(APP_CONFIG.db.nombre); } catch (e) { resolve(null); return; }
    req.onsuccess = () => {
      const idb = req.result;
      try {
        if (!idb.objectStoreNames.contains(table)) { idb.close(); resolve([]); return; }
        const tx = idb.transaction(table, 'readonly');
        const store = tx.objectStore(table);
        const got = store.getAll();
        got.onsuccess = () => { idb.close(); resolve(got.result || []); };
        got.onerror = () => { idb.close(); resolve([]); };
      } catch (e) { try { idb.close(); } catch (_) {} resolve([]); }
    };
    req.onerror = () => resolve([]);
  });
}

// Motor SQLite ───────────────────────────────────────────────────────────────

const dbSQLite = {
  SQL: null,
  _db: null,
  _ready: null,
  _persistTimer: null,
  _storageSource: 'nuevo', // 'electron' | 'indexeddb' | 'legacy-dexie-snapshot' | 'nuevo'
  TABLES: DB_TABLES,

  init() {
    if (!this._ready) this._ready = this._doInit();
    return this._ready;
  },

  async _doInit() {
    if (typeof initSqlJs !== 'function') throw new Error('sql.js no está cargado (falta assets/js/libs/sql-wasm.js)');
    this.SQL = await initSqlJs({
      wasmBinary: typeof SQL_WASM_BINARY !== 'undefined' ? SQL_WASM_BINARY : undefined,
      locateFile: (file) => 'assets/js/libs/' + file
    });
    const bytes = await this._loadSnapshotBytes();
    if (bytes && bytes.length > 0) {
      this._db = new this.SQL.Database(bytes);
      if (this._storageSource === 'unknown') this._storageSource = 'indexeddb';
    } else {
      this._db = new this.SQL.Database();
    }
    this._ensureSchema(this._db);

    // Migración: si el motor está vacío, intenta importar datos de la versión anterior (IndexedDB de Dexie)
    if (this.countAll('perfiles') === 0) {
      const migrated = await this._migrateLegacyDexie();
      if (migrated > 0) {
        console.log(`✅ Migración SQLite: ${migrated} filas importadas desde IndexedDB (Dexie)`);
        await this.persist(true);
      } else {
        await this.persist(true);
      }
    }
    this._attachAutoFlush();
  },

  async _loadSnapshotBytes() {
    // 1. Electron: archivo real en %APPDATA%/DevCardCV/devcardcv.sqlite
    if (typeof window !== 'undefined' && window.devcardcvFs?.readDb) {
      try {
        const buf = await window.devcardcvFs.readDb();
        if (buf && buf.length > 0) {
          this._storageSource = 'electron';
          console.log('🗂️ SQLite: snapshot cargado desde archivo del sistema (Electron)');
          return buf instanceof Uint8Array ? new Uint8Array(buf) : new Uint8Array(Array.from(buf));
        }
      } catch (e) { console.warn('⚠️ Electron readDb:', e.message); }
    }
    // 2. IndexedDB propia (navegador, PWA, Android/Capacitor)
    const kv = await kvGet('sqlite_bytes');
    if (kv && kv.value && kv.value.length > 0) return new Uint8Array(kv.value);
    // 3. Snapshot legacy dentro de la IndexedDB de Dexie (_sqlite_cache)
    try {
      const legacy = await legacyIdbTable('_sqlite_cache');
      const row = (legacy || []).find(r => r && r.key === DB_SQLITE_LEGACY_SNAPSHOT_KEY);
      if (row && row.data && row.data.length > 0) {
        this._storageSource = 'legacy-dexie-snapshot';
        console.log('🗄️ SQLite: snapshot legacy recuperado (Dexie _sqlite_cache)');
        return new Uint8Array(row.data);
      }
    } catch (e) { console.warn('⚠️ legacy snapshot:', e.message); }
    return null;
  },

  async _migrateLegacyDexie() {
    // Datos de verdad de la versión anterior: tablas dentro de la IndexedDB de Dexie
    const KEY_MAP = { perfiles: 'email_hash' };
    let total = 0;
    for (const table of Object.keys(DB_TABLES)) {
      const rows = await legacyIdbTable(table);
      if (rows && rows.length) {
        const cols = DB_TABLES[table];
        for (const r of rows) {
          const clean = {};
          for (const c of cols) clean[c] = r[c] !== undefined ? r[c] : null;
          try { this.insert(table, clean, { noPersist: true }); total++; } catch (e) { console.warn(`⚠️ migración ${table}:`, e.message); }
        }
      }
    }
    return total;
  },

  _ensureSchema(idb) {
    idb.run(`CREATE TABLE IF NOT EXISTS perfiles (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL, email TEXT, telefono TEXT, direccion TEXT, dni TEXT, cargo TEXT, bio TEXT, fotoBase64 TEXT, email_hash TEXT, notas_admin TEXT, created_at TEXT, updated_at TEXT)`);
    idb.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_perfiles_email_hash ON perfiles(email_hash) WHERE email_hash IS NOT NULL AND email_hash != ''`);
    idb.run(`CREATE TABLE IF NOT EXISTS habilidades (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL, categoria TEXT, created_at TEXT, updated_at TEXT)`);
    idb.run(`CREATE TABLE IF NOT EXISTS perfil_habilidades (id INTEGER PRIMARY KEY AUTOINCREMENT, perfil_id INTEGER, habilidad_id INTEGER)`);
    idb.run(`CREATE TABLE IF NOT EXISTS usuarios (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, email_hash TEXT, nombre TEXT, password_hash TEXT, rol TEXT, perfilId INTEGER, created_at TEXT, updated_at TEXT)`);
    idb.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_email_hash ON usuarios(email_hash) WHERE email_hash IS NOT NULL AND email_hash != ''`);
    idb.run(`CREATE TABLE IF NOT EXISTS proyectos (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL, descripcion TEXT, prioridad TEXT, estado TEXT, fecha_limite TEXT, notas_admin TEXT, creado_por INTEGER, created_at TEXT, updated_at TEXT)`);
    idb.run(`CREATE TABLE IF NOT EXISTS tareas (id INTEGER PRIMARY KEY AUTOINCREMENT, proyecto_id INTEGER, proyectoId INTEGER, nombre TEXT NOT NULL, descripcion TEXT, estado TEXT, prioridad TEXT, horas_estimadas REAL, fecha_limite TEXT, asignado_a TEXT, asignadoA INTEGER, comentario_dev TEXT, created_at TEXT, updated_at TEXT)`);
    idb.run(`CREATE TABLE IF NOT EXISTS proyecto_usuarios (id INTEGER PRIMARY KEY AUTOINCREMENT, proyecto_id INTEGER, perfil_id INTEGER)`);
    idb.run(`CREATE TABLE IF NOT EXISTS equipos (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT)`);
    idb.run(`CREATE TABLE IF NOT EXISTS categorias (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT, created_at TEXT)`);
    // Versiones previas del export .sqlite pueden carecer de columnas nuevas
    for (const [table, cols] of Object.entries(DB_TABLES)) {
      const existing = new Set();
      try {
        const r = idb.exec(`PRAGMA table_info(${table})`);
        if (r.length) r[0].values.forEach(v => existing.add(String(v[1])));
      } catch (e) { continue; }
      for (const col of cols) {
        if (!existing.has(col)) {
          try { idb.run(`ALTER TABLE ${table} ADD COLUMN ${col} TEXT`); } catch (e) { /* ya existe con otro tipo */ }
        }
      }
    }
  },

  // ─── Serialización / hidratación ───

  _ser(v) {
    if (v === undefined) return null;
    if (v instanceof Date) return v.toISOString();
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (typeof v === 'object' && v !== null) return JSON.stringify(v);
    return v;
  },

  _hydrate(row) {
    const obj = {};
    for (const key of Object.keys(row)) {
      let v = row[key];
      if ((key === 'created_at' || key === 'updated_at') && typeof v === 'string' && v.includes('T')) {
        const d = new Date(v);
        if (!isNaN(d)) v = d;
      }
      obj[key] = v;
    }
    return obj;
  },

  // ─── CRUD ───

  _cols(obj, table) {
    const known = DB_TABLES[table] || Object.keys(obj);
    return Object.keys(obj).filter(k => known.includes(k));
  },

  insert(table, obj, opts = {}) {
    if (!this._db) throw new Error('Motor SQLite no inicializado');
    const cols = this._cols(obj, table);
    if (!cols.length) throw new Error(`insert(${table}): sin columnas válidas`);
    const sql = `INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`;
    this._db.run(sql, cols.map(c => this._ser(obj[c])));
    const out = { ...obj };
    if (!obj.id) {
      const r = this._db.exec('SELECT last_insert_rowid() AS id');
      out.id = r.length ? Number(r[0].values[0][0]) : null;
    }
    if (!opts.noPersist) this.persistSoon();
    return this._hydrate(out);
  },

  upsert(table, obj) {
    if (!obj.id) throw new Error(`upsert(${table}): falta id`);
    const cols = this._cols(obj, table);
    const sql = `INSERT OR REPLACE INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`;
    this._db.run(sql, cols.map(c => this._ser(obj[c])));
    this.persistSoon();
    return this._hydrate(obj);
  },

  update(table, id, changes) {
    const current = this.getById(table, id);
    if (!current) return null;
    const merged = { ...current, ...changes, id };
    return this.upsert(table, merged);
  },

  deleteById(table, id) {
    this._db.run(`DELETE FROM ${table} WHERE id = ?`, [id]);
    this.persistSoon();
    return true;
  },

  deleteWhere(table, field, value) {
    this._db.run(`DELETE FROM ${table} WHERE ${field} = ?`, [value]);
    this.persistSoon();
    return true;
  },

  clearTable(table) {
    this._db.run(`DELETE FROM ${table}`);
    this.persistSoon();
    return true;
  },

  selectAll(table) {
    if (!this._db) return [];
    const r = this._db.exec(`SELECT * FROM ${table}`);
    if (!r.length) return [];
    return r[0].values.map(row => {
      const obj = {};
      r[0].columns.forEach((c, i) => { obj[c] = row[i]; });
      return this._hydrate(obj);
    });
  },

  getById(table, id) {
    const r = this._db.exec(`SELECT * FROM ${table} WHERE id = ?`, [id]);
    if (!r.length) return null;
    const obj = {};
    r[0].columns.forEach((c, i) => { obj[c] = r[0].values[0][i]; });
    return this._hydrate(obj);
  },

  selectWhere(table, field, value) {
    const r = this._db.exec(`SELECT * FROM ${table} WHERE ${field} = ?`, [value]);
    if (!r.length) return [];
    return r[0].values.map(row => {
      const obj = {};
      r[0].columns.forEach((c, i) => { obj[c] = row[i]; });
      return this._hydrate(obj);
    });
  },

  countAll(table) {
    const r = this._db.exec(`SELECT COUNT(*) FROM ${table}`);
    return r.length ? Number(r[0].values[0][0]) : 0;
  },

  bulkInsert(table, rows) {
    for (const r of rows) this.insert(table, r, { noPersist: true });
    this.persistSoon();
    return rows.length;
  },

  // ─── Consultas SQL libres (dashboard: informe SQL) ───

  query(sql, params = []) {
    if (!this._db) return { columns: [], rows: [] };
    const result = this._db.exec(sql, params);
    if (!result || result.length === 0) return { columns: [], rows: [] };
    return { columns: result[0].columns, rows: result[0].values };
  },

  queryObjects(sql, params = []) {
    const { columns, rows } = this.query(sql, params);
    return rows.map(row => {
      const obj = {};
      columns.forEach((col, i) => { obj[col] = row[i]; });
      return obj;
    });
  },

  count(sql, params = []) {
    const r = this._db.exec(sql, params);
    return r.length ? Number(r[0].values[0][0]) : 0;
  },

  // ─── Snapshot: persistencia ───

  export() {
    if (!this._db) return new Uint8Array(0);
    return this._db.export();
  },

  async _writeSnapshot() {
    const data = this.export();
    if (!data || !data.length) return;
    try {
      if (typeof window !== 'undefined' && window.devcardcvFs?.writeDb) {
        await window.devcardcvFs.writeDb(data);
      } else {
        await kvPut('sqlite_bytes', data);
      }
    } catch (e) { console.warn('⚠️ persist SQLite:', e.message); }
  },

  persistSoon() {
    if (this._persistTimer) return;
    this._persistTimer = setTimeout(async () => {
      this._persistTimer = null;
      await this._writeSnapshot();
    }, 300);
  },

  async persist(force = false) {
    if (this._persistTimer) { clearTimeout(this._persistTimer); this._persistTimer = null; }
    if (!force && !this._db) return;
    await this._writeSnapshot();
  },

  _attachAutoFlush() {
    if (this._autoFlushAttached) return;
    this._autoFlushAttached = true;
    const flush = () => { if (this._persistTimer) { clearTimeout(this._persistTimer); this._persistTimer = null; this._writeSnapshot(); } };
    window.addEventListener('beforeunload', flush);
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  },

  // ─── Backup / restore ───

  download() {
    const data = this.export();
    const blob = new Blob([data], { type: 'application/vnd.sqlite3' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${APP_CONFIG.app.nombre}_${dayjs().format('YYYYMMDD_HHmmss')}.sqlite`;
    a.click();
    URL.revokeObjectURL(url);
  },

  async import(data) {
    const db2 = new this.SQL.Database(new Uint8Array(data));
    const res = db2.exec('SELECT COUNT(*) FROM perfiles');
    const perfiles = res.length ? Number(res[0].values[0][0]) : 0;
    const r2 = db2.exec('SELECT COUNT(*) FROM habilidades');
    const habilidades = r2.length ? Number(r2.values[0][0]) : 0;
    if (!perfiles && !habilidades) {
      db2.close();
      throw new Error('El archivo no contiene datos válidos de DevCardCV');
    }
    this._ensureSchema(db2);   // rellena tablas/columnas que falten en el archivo
    if (this._db) this._db.close();
    this._db = db2;
    await this.persist(true);
    return { perfiles, habilidades };
  },

  // ─── Modo online (Supabase): espejo Dexie → SQLite para informes/export ───

  async sync() {
    if (!this._db || window.DB_OFFLINE_SQLITE) return;
    for (const table of ['perfiles', 'habilidades', 'perfil_habilidades', 'usuarios', 'proyectos', 'tareas', 'proyecto_usuarios', 'equipos', 'categorias']) {
      const rows = await db[table].toArray();
      this._db.run(`DELETE FROM ${table}`);
      for (const r of rows) {
        const cols = this._cols(r, table);
        try {
          this._db.run(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
            cols.map(c => this._ser(r[c])));
        } catch (e) { /* fila con hash duplicado u otro caso */ }
      }
    }
    await this.persist(true);
  },

  close() {
    if (this._db) this._db.close();
  }
};

window.dbSQLite = dbSQLite;
