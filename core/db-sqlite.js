// core/db-sqlite.js — Motor SQLite (sql.js) con persistencia en IndexedDB
const dbSQLite = {
  SQL: null,
  _db: null,

  async init() {
    this.SQL = await initSqlJs({
      wasmBinary: typeof SQL_WASM_BINARY !== 'undefined' ? SQL_WASM_BINARY : undefined,
      locateFile: (file) => 'assets/js/libs/' + file
    });
    await this._loadOrCreate();
    await this.sync();
  },

  async _loadOrCreate() {
    const cached = await db._sqlite_cache.get(APP_CONFIG.db.sqliteCacheKey);
    if (cached) {
      this._db = new this.SQL.Database(new Uint8Array(cached.data));
    } else {
      this._db = new this.SQL.Database();
      this._createTables();
      await this._persist();
    }
  },

  _createTables() {
    this._db.run('CREATE TABLE IF NOT EXISTS perfiles (id INTEGER PRIMARY KEY, nombre TEXT NOT NULL, email TEXT, telefono TEXT, direccion TEXT, cargo TEXT, bio TEXT, fotoBase64 TEXT, created_at TEXT, updated_at TEXT)');
    this._db.run('CREATE TABLE IF NOT EXISTS habilidades (id INTEGER PRIMARY KEY, nombre TEXT NOT NULL, categoria TEXT, created_at TEXT)');
    this._db.run('CREATE TABLE IF NOT EXISTS perfil_habilidades (id INTEGER PRIMARY KEY, perfil_id INTEGER, habilidad_id INTEGER)');
    this._db.run('CREATE TABLE IF NOT EXISTS usuarios (id INTEGER PRIMARY KEY, email TEXT, email_hash TEXT, nombre TEXT, password_hash TEXT, rol TEXT, perfilId TEXT, created_at TEXT, updated_at TEXT)');
  },

  async sync() {
    const perfiles = await db.perfiles.toArray();
    const habilidades = await db.habilidades.toArray();
    const relaciones = await db.perfil_habilidades.toArray();
    const usuarios = await db.usuarios.toArray();

    this._db.run('DELETE FROM perfiles');
    this._db.run('DELETE FROM habilidades');
    this._db.run('DELETE FROM perfil_habilidades');
    this._db.run('DELETE FROM usuarios');

    for (const p of perfiles) {
      this._db.run('INSERT INTO perfiles (id, nombre, email, telefono, direccion, cargo, bio, fotoBase64, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
        [p.id, p.nombre, p.email || '', p.telefono || '', p.direccion || '', p.cargo || '', p.bio || '', p.fotoBase64 || '', this._toSQLiteDate(p.created_at), this._toSQLiteDate(p.updated_at)]);
    }
    for (const h of habilidades) {
      this._db.run('INSERT INTO habilidades (id, nombre, categoria, created_at) VALUES (?,?,?,?)',
        [h.id, h.nombre, h.categoria || '', this._toSQLiteDate(h.created_at)]);
    }
    for (const r of relaciones) {
      this._db.run('INSERT INTO perfil_habilidades (id, perfil_id, habilidad_id) VALUES (?,?,?)',
        [r.id, r.perfil_id, r.habilidad_id]);
    }
    for (const u of usuarios) {
      this._db.run('INSERT INTO usuarios (id, email, email_hash, nombre, password_hash, rol, perfilId, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)',
        [u.id, u.email || '', u.email_hash || '', u.nombre || '', u.password_hash || '', u.rol || 'dev', u.perfilId || null, this._toSQLiteDate(u.created_at), this._toSQLiteDate(u.updated_at)]);
    }

    await this._persist();
  },

  _toSQLiteDate(d) {
    if (!d) return null;
    return (typeof d === 'string' ? new Date(d) : d).toISOString();
  },

  query(sql, params = []) {
    const result = this._db.exec(sql, params);
    if (!result || result.length === 0) return { columns: [], rows: [] };
    return {
      columns: result[0].columns,
      rows: result[0].values
    };
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

  export() {
    return this._db.export();
  },

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
    const tables = ['perfiles', 'habilidades', 'perfil_habilidades', 'usuarios'];
    const imported = {};
    for (const tbl of tables) {
      const res = db2.exec('SELECT * FROM ' + tbl);
      imported[tbl] = res.length ? res[0].values : [];
    }
    db2.close();

    if (!imported.perfiles.length && !imported.habilidades.length) {
      throw new Error('El archivo no contiene datos válidos de DevCardCV');
    }

    await db.perfiles.clear();
    await db.habilidades.clear();
    await db.perfil_habilidades.clear();
    await db.usuarios.clear();

    for (const row of imported.perfiles) {
      await db.perfiles.add({ id: row[0], nombre: row[1], email: row[2] || '', telefono: row[3] || '', direccion: row[4] || '', cargo: row[5] || '', bio: row[6] || '', fotoBase64: row[7] || '', created_at: row[8] || new Date().toISOString(), updated_at: row[9] || null });
    }
    for (const row of imported.habilidades) {
      await db.habilidades.add({ id: row[0], nombre: row[1], categoria: row[2] || '', created_at: row[3] || new Date().toISOString() });
    }
    for (const row of imported.perfil_habilidades) {
      await db.perfil_habilidades.add({ id: row[0], perfil_id: row[1], habilidad_id: row[2] });
    }
    for (const row of imported.usuarios) {
      await db.usuarios.add({ id: row[0], email: row[1] || '', email_hash: row[2] || '', nombre: row[3] || '', password_hash: row[4] || '', rol: row[5] || 'dev', perfilId: row[6] || null, created_at: row[7] || new Date().toISOString(), updated_at: row[8] || null });
    }

    this._db.close();
    this._db = new this.SQL.Database(new Uint8Array(data));
    await this._persist();
  },

  async _persist() {
    const data = Array.from(this.export());
    await db._sqlite_cache.put({ key: APP_CONFIG.db.sqliteCacheKey, data });
  },

  close() {
    if (this._db) this._db.close();
  }
};

window.dbSQLite = dbSQLite;
