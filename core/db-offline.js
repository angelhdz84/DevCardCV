// core/db-offline.js — Capa offline SQLite (modo 'sqlite-local', 100% sin red)
// Reimplementa `dbLocal` (lecturas) y `dbOnline` (escrituras/lecturas) sobre el
// motor SQLite local. Mantiene la MISMA API que la versión Supabase, de modo que
// los módulos no requieren cambios. Supabase queda desactivado por project.config.js.
(function () {
  'use strict';
  if (window.DB_OFFLINE_SQLITE !== true) return; // modo online: no hacer nada

  const dbOnlineLocal = {
    get status() { return 'local'; },

    _touch() {
      if (typeof Alpine !== 'undefined' && Alpine.store('supabase')) {
        Alpine.store('supabase').status = 'local';
      }
      if (window.actualizarBadgeEstado) window.actualizarBadgeEstado();
    },

    async init() {
      this._touch();
      console.log('🟢 Modo offline: SQLite local como fuente de verdad (0 red)');
    },

    // ─── Lecturas ───

    async getAll(table) { await dbSQLite.init(); return dbSQLite.selectAll(table); },
    async get(table, id) { await dbSQLite.init(); return dbSQLite.getById(table, id) || null; },
    async getWhere(table, field, value) { await dbSQLite.init(); return dbSQLite.selectWhere(table, field, value); },
    async count(table) { await dbSQLite.init(); return dbSQLite.countAll(table); },

    // ─── Escrituras ───

    async add(table, data) {
      await dbSQLite.init();
      return dbSQLite.insert(table, { ...data });
    },

    async update(table, id, data) {
      await dbSQLite.init();
      const row = dbSQLite.update(table, id, data);
      if (!row) throw new Error(`Registro ${table}#${id} no encontrado`);
      return row;
    },

    async delete(table, id) {
      await dbSQLite.init();
      dbSQLite.deleteById(table, id);
      return true;
    },

    async bulkDelete(table, field, value) {
      await dbSQLite.init();
      dbSQLite.deleteWhere(table, field, value);
      return true;
    },

    // ─── Compatibilidad con la API online ───

    async refreshCache() {
      // En modo offline no hay nada que refrescar desde la nube
      window.dispatchEvent(new CustomEvent('db-change'));
      console.log('ℹ️ Offline: refreshCache no-op (SQLite local)');
    },

    async refreshTableCache(table) {
      window.dispatchEvent(new CustomEvent('db-change'));
    },

    async forceRefresh() {
      if (typeof UI !== 'undefined') UI.toast('Datos locales — no hay nube que sincronizar', 'info');
      await this.refreshCache();
    }
  };

  // Parchear `dbLocal` (definido en core/db-supabase.js) para leer del motor SQLite:
  // los módulos usan la misma referencia duradera, así que basta con swap de métodos.
  if (typeof dbLocal !== 'undefined' && dbLocal) {
    dbLocal.getAll = dbOnlineLocal.getAll.bind(dbOnlineLocal);
    dbLocal.get = dbOnlineLocal.get.bind(dbOnlineLocal);
    dbLocal.getWhere = dbOnlineLocal.getWhere.bind(dbOnlineLocal);
    dbLocal.count = dbOnlineLocal.count.bind(dbOnlineLocal);
  } else {
    window.dbLocal = {
      getAll: dbOnlineLocal.getAll.bind(dbOnlineLocal),
      get: dbOnlineLocal.get.bind(dbOnlineLocal),
      getWhere: dbOnlineLocal.getWhere.bind(dbOnlineLocal),
      count: dbOnlineLocal.count.bind(dbOnlineLocal)
    };
  }

  window.dbOnline = dbOnlineLocal;
  window.dbSupabase = dbOnlineLocal;

  // Init del modo offline (lo llama main.js antes de abrir el router)
  window.sqliteOffline = {
    async init() {
      await dbSQLite.init();
      if (typeof Alpine !== 'undefined' && Alpine.store('supabase')) {
        Alpine.store('supabase').status = 'local';
      }
      if (window.actualizarBadgeEstado) window.actualizarBadgeEstado();
      const resumen = [
        'usr: ' + dbSQLite.countAll('usuarios'),
        'perfiles: ' + dbSQLite.countAll('perfiles'),
        'hab: ' + dbSQLite.countAll('habilidades'),
        'proy: ' + dbSQLite.countAll('proyectos')
      ].join(' · ');
      console.log(`🟢 SQLite listo (${dbSQLite._storageSource}) — ${resumen}`);
    }
  };
})();
