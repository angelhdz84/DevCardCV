var dbOnline = {
  _supa: null,
  _realtimeChannel: null,
  _connected: false,

  _fieldMap: {
    perfiles: { toRemote: { fotoBase64: 'foto_base64' }, toLocal: { foto_base64: 'fotoBase64' } },
    habilidades: { toRemote: {}, toLocal: {} },
    perfil_habilidades: { toRemote: {}, toLocal: {} },
    usuarios: { toRemote: { perfilId: 'perfil_id' }, toLocal: { perfil_id: 'perfilId' } }
  },

  _mapFields(records, table, direction) {
    const map = this._fieldMap[table];
    if (!map || !records || !records.length) return records;
    const mapping = direction === 'toRemote' ? map.toRemote : map.toLocal;
    if (!Object.keys(mapping).length) return records;
    return records.map(r => {
      const out = {};
      for (const key of Object.keys(r)) {
        out[mapping[key] || key] = r[key];
      }
      return out;
    });
  },

  _updateStore() {
    if (typeof Alpine !== 'undefined' && Alpine.store('supabase')) {
      Alpine.store('supabase').status = this.status;
    }
  },

  get status() {
    if (!APP_CONFIG.supabase || !APP_CONFIG.supabase.url || !APP_CONFIG.supabase.anonKey) return 'disabled';
    if (!navigator.onLine) return 'offline';
    return this._connected ? 'connected' : 'disconnected';
  },

  _requireOnline() {
    if (!navigator.onLine) {
      if (typeof UI !== 'undefined') UI.toast('Sin conexión — no puedes guardar cambios', 'error');
      throw new Error('OFFLINE');
    }
  },

  async init() {
    if (!APP_CONFIG.supabase || !APP_CONFIG.supabase.url || !APP_CONFIG.supabase.anonKey) {
      console.log('ℹ️ Supabase: deshabilitado (no configurado)');
      this._updateStore();
      return;
    }
    console.log('🚀 dbOnline: iniciando...');
    this._updateStore();

    this._supa = supabase.createClient(APP_CONFIG.supabase.url, APP_CONFIG.supabase.anonKey, {
      realtime: { params: { eventsPerSecond: 10 } }
    });

    try {
      const { data, error } = await this._supa.from('habilidades').select('id').limit(1);
      if (error) throw error;
      this._connected = true;
      console.log('✅ dbOnline: conexión establecida');
    } catch (err) {
      this._connected = false;
      console.warn('⚠️ dbOnline: error de conexión:', err.message);
    }
    this._updateStore();

    if (this._connected) {
      this._realtimeChannel = this._supa.channel('db-changes')
        .on('postgres_changes',
          { event: '*', schema: 'public' },
          payload => {
            console.log('📡 Realtime:', payload.eventType, payload.table);
            this._onRealtimeChange(payload.table);
          }
        )
        .subscribe(status => {
          if (status === 'SUBSCRIBED') console.log('✅ Realtime: suscrito a cambios');
        });
    }

    window.addEventListener('online', () => {
      if (this._supa) this._connected = true;
    });
    window.addEventListener('offline', () => {
      this._connected = false;
    });
  },

  async _onRealtimeChange(table) {
    try {
      if (!db || !db[table]) return;
      const { data, error } = await this._supa.from(table).select('*');
      if (error) throw error;
      const mapped = this._mapFields(data || [], table, 'toLocal');
      await db[table].clear();
      for (const r of mapped) await db[table].add(r);
      console.log('📡 Cache actualizado:', table, mapped.length, 'registros');
      window.dispatchEvent(new CustomEvent('db-change'));
    } catch (err) {
      console.warn('⚠️ Realtime refresh:', err.message);
    }
  },

  // ─── CRUD: Lecturas ───

  async getAll(table) {
    try {
      this._requireOnline();
      const { data, error } = await this._supa.from(table).select('*');
      if (error) throw error;
      const mapped = this._mapFields(data || [], table, 'toLocal');
      this._setCache(table, mapped).catch(() => {});
      return mapped;
    } catch (err) {
      if (err.message === 'OFFLINE') {
        console.log('ℹ️ dbOnline getAll(' + table + '): offline, usando caché');
        return await db[table].toArray();
      }
      console.warn('⚠️ dbOnline getAll(' + table + '):', err.message, '→ caché');
      return await db[table].toArray();
    }
  },

  async get(table, id) {
    try {
      this._requireOnline();
      const { data, error } = await this._supa.from(table).select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      const mapped = this._mapFields([data].filter(Boolean), table, 'toLocal');
      return mapped[0] || null;
    } catch (err) {
      if (err.message === 'OFFLINE') {
        return await db[table].get(id) || null;
      }
      console.warn('⚠️ dbOnline get(' + table + '):', err.message, '→ caché');
      return await db[table].get(id) || null;
    }
  },

  async getWhere(table, field, value) {
    try {
      this._requireOnline();
      const { data, error } = await this._supa.from(table).select('*').eq(field, value);
      if (error) throw error;
      return this._mapFields(data || [], table, 'toLocal');
    } catch (err) {
      if (err.message === 'OFFLINE') {
        return await db[table].where(field).equals(value).toArray();
      }
      console.warn('⚠️ dbOnline getWhere(' + table + '):', err.message, '→ caché');
      return await db[table].where(field).equals(value).toArray();
    }
  },

  async count(table) {
    try {
      this._requireOnline();
      const { data, error } = await this._supa.from(table).select('id');
      if (error) throw error;
      return (data || []).length;
    } catch (err) {
      if (err.message === 'OFFLINE') {
        return await db[table].count();
      }
      console.warn('⚠️ dbOnline count(' + table + '):', err.message, '→ caché');
      return await db[table].count();
    }
  },

  // ─── CRUD: Escrituras ───

  async add(table, data) {
    this._requireOnline();
    const remote = this._mapFields([data], table, 'toRemote')[0];
    const { data: created, error } = await this._supa.from(table).insert(remote).select();
    if (error) throw error;
    const mapped = this._mapFields(created || [], table, 'toLocal');
    if (mapped && mapped.length > 0) {
      await db[table].add(mapped[0]).catch(() => {});
      return mapped[0];
    }
    return data;
  },

  async update(table, id, data) {
    this._requireOnline();
    const remote = this._mapFields([data], table, 'toRemote')[0];
    const { data: updated, error } = await this._supa.from(table).update(remote).eq('id', id).select();
    if (error) throw error;
    const mapped = this._mapFields(updated || [], table, 'toLocal');
    if (mapped && mapped.length > 0) {
      await db[table].put(mapped[0]).catch(() => {});
      return mapped[0];
    }
    return data;
  },

  async delete(table, id) {
    this._requireOnline();
    const { error } = await this._supa.from(table).delete().eq('id', id);
    if (error) throw error;
    await db[table].delete(id).catch(() => {});
    return true;
  },

  async bulkDelete(table, field, value) {
    this._requireOnline();
    const { error } = await this._supa.from(table).delete().eq(field, value);
    if (error) throw error;
    await db[table].where(field).equals(value).delete().catch(() => {});
    return true;
  },

  // ─── Refresh / Cache ───

  async refreshCache() {
    const tables = ['perfiles', 'habilidades', 'perfil_habilidades', 'usuarios'];
    for (const table of tables) {
      try {
        const { data, error } = await this._supa.from(table).select('*');
        if (error) throw error;
        const mapped = this._mapFields(data || [], table, 'toLocal');
        await db[table].clear();
        for (const r of mapped) await db[table].add(r);
      } catch (err) {
        console.warn('⚠️ refreshCache(' + table + '):', err.message);
      }
    }
    window.dispatchEvent(new CustomEvent('db-change'));
    console.log('✅ Cache refrescado desde Supabase');
  },

  async refreshTableCache(table) {
    try {
      const { data, error } = await this._supa.from(table).select('*');
      if (error) throw error;
      const mapped = this._mapFields(data || [], table, 'toLocal');
      await db[table].clear();
      for (const r of mapped) await db[table].add(r);
    } catch (err) {
      console.warn('⚠️ refreshTableCache(' + table + '):', err.message);
    }
  },

  // ─── Cache helpers ───

  async _setCache(table, records) {
    await db[table].clear();
    for (const r of records) await db[table].add(r);
  },

  // ─── Force refresh (desde Dashboard) ───

  async forceRefresh() {
    if (typeof UI !== 'undefined') UI.toast('Recargando desde Supabase...', 'info');
    await this.refreshCache();
    if (typeof UI !== 'undefined') UI.toast('Datos actualizados desde Supabase', 'success');
  }
};

window.dbOnline = dbOnline;
window.dbSupabase = dbOnline;
