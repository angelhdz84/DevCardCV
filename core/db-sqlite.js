// core/db-sqlite.js — Motor SQLite local (sql.js WASM) — 100% offline
// Fuente de verdad cuando APP_CONFIG.storage.modo === 'sqlite-local'.
// Persistencia (por orden de prioridad):
//   1. Archivo .sqlite real vía Electron (window.devcardcvFs, preload de desktop-electron/)
//   2. IndexedDB propia 'devcardcv_kv' (navegador, Chrome/PWA, Android WebView/Capacitor)
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

// ─── Motor SQLite ───

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

    // 💡 Primera ejecución: snapshot nuevo (sin migraciones legacy — datos 100% nuevos)
    if (bytes == null) await this.persist(true);

    // 💡 Saneamiento de integridad (relaciones perfil↔skill): repara ids mal tipados y borra huérfanas
    try { this._repararIntegridad(); } catch (e) { console.warn('⚠️ integridad:', e.message); }

    this._attachAutoFlush();
  },

  // Normaliza un id de relación: número, string numérico o JSON serializado (bug antiguo del seed)
  _idRelacion(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (typeof v === 'string') {
      const s = v.trim();
      if (/^\d+$/.test(s)) return Number(s);
      if (s.startsWith('{') || s.startsWith('[')) {
        try {
          const o = JSON.parse(s);
          const id = (o && typeof o === 'object' && !Array.isArray(o)) ? o.id : (Array.isArray(o) ? o[0]?.id : null);
          return (typeof id === 'number' || /^\d+$/.test(String(id))) ? Number(id) : null;
        } catch (e) { return null; }
      }
    }
    return null;
  },

  _repararIntegridad() {
    const ph = this.selectAll('perfil_habilidades');
    if (!ph.length) return;
    const perfilesIds = new Set(this.selectAll('perfiles').map(p => Number(p.id)));
    const habIds = new Set(this.selectAll('habilidades').map(h => Number(h.id)));
    let reparadas = 0, borradas = 0;
    for (const r of ph) {
      const pid = this._idRelacion(r.perfil_id);
      const hid = this._idRelacion(r.habilidad_id);
      if (pid == null || hid == null || !perfilesIds.has(pid) || !habIds.has(hid)) {
        this._db.run('DELETE FROM perfil_habilidades WHERE id = ?', [r.id]);
        borradas++;
      } else if (pid !== r.perfil_id || hid !== r.habilidad_id) {
        this._db.run('UPDATE perfil_habilidades SET perfil_id = ?, habilidad_id = ? WHERE id = ?', [pid, hid, r.id]);
        reparadas++;
      }
    }
    if (reparadas || borradas) {
      console.log(`🔧 Integridad: ${reparadas} relaciones reparadas, ${borradas} huérfanas eliminadas`);
      this.persistSoon();
    }
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
    if (kv && kv.value && kv.value.length > 0) {
      this._storageSource = 'indexeddb';
      return new Uint8Array(kv.value);
    }
    return null; // primera ejecución: datos nuevos
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
    // 💡 Compat camelCase ↔ snake_case: los módulos filtran por proyectoId/perfilId/
    //    asignadoA/comentarioDev pero la tabla guarda AMBAS columnas (snake_case al
    //    escribir). Se completan las dos variantes en cada lectura para que los
    //    filtros `===` de los módulos funcionen con cualquier dato.
    const dual = (a, b) => {
      if (obj[a] === undefined && obj[b] === undefined) return;
      const v = obj[a] ?? obj[b] ?? null;
      obj[a] = v;
      obj[b] = v;
    };
    dual('proyecto_id', 'proyectoId');
    dual('perfil_id', 'perfilId');
    dual('asignado_a', 'asignadoA');
    dual('comentario_dev', 'comentarioDev');
    dual('fecha_limite', 'fechaLimite');
    dual('horas_estimadas', 'horasEstimadas');
    return obj;
  },

  // ─── CRUD ───

  _cols(obj, table) {
    const known = DB_TABLES[table] || Object.keys(obj);
    return Object.keys(obj).filter(k => known.includes(k));
  },

  // 💡 Completa pares de columnas dual (snake ↔ camel) antes de escribir/leer
  _dualize(input) {
    const obj = { ...input };
    const dual = (a, b) => {
      if (obj[a] === undefined && obj[b] === undefined) return;
      const v = obj[a] ?? obj[b] ?? null;
      obj[a] = v;
      obj[b] = v;
    };
    dual('proyecto_id', 'proyectoId');
    dual('perfil_id', 'perfilId');
    dual('asignado_a', 'asignadoA');
    dual('comentario_dev', 'comentarioDev');
    dual('fecha_limite', 'fechaLimite');
    dual('horas_estimadas', 'horasEstimadas');
    return obj;
  },

  insert(table, obj, opts = {}) {
    if (!this._db) throw new Error('Motor SQLite no inicializado');
    obj = this._dualize(obj);
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
    obj = this._dualize(obj);
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
