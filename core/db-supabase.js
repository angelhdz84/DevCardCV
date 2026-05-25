var dbSupabase = {
  _connected: false,

  // Field mapping: Dexie (camelCase) ↔ Supabase (snake_case)
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

  _lastPush: null,
  _lastPull: null,
  _pushTimer: null,
  _pullInterval: null,

  get status() {
    if (!APP_CONFIG.supabase || !APP_CONFIG.supabase.url || !APP_CONFIG.supabase.anonKey) return 'disabled';
    if (!navigator.onLine) return 'offline';
    return this._connected ? 'connected' : 'disconnected';
  },

  get lastPush() { return this._lastPush; },
  get lastPull() { return this._lastPull; },

  get _headers() {
    return {
      'apikey': APP_CONFIG.supabase.anonKey,
      'Authorization': 'Bearer ' + APP_CONFIG.supabase.anonKey,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    };
  },

  get _baseUrl() {
    return APP_CONFIG.supabase.url.replace(/\/+$/, '') + '/rest/v1';
  },

  async _request(method, table, body, params) {
    const url = this._baseUrl + '/' + table + (params ? '?' + params : '');
    const opts = { method, headers: this._headers };
    if (body) opts.body = JSON.stringify(body);
    const resp = await fetch(url, opts);
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error('HTTP ' + resp.status + ': ' + text.slice(0, 200));
    }
    if (method === 'DELETE' || resp.status === 204) return null;
    return await resp.json();
  },

  async init() {
    if (!APP_CONFIG.supabase || !APP_CONFIG.supabase.url || !APP_CONFIG.supabase.anonKey) {
      console.log('ℹ️ Supabase: deshabilitado (no configurado)');
      this._updateStore();
      return;
    }
    console.log('🚀 Supabase: iniciando...');
    this._updateStore();

    window.addEventListener('online', () => {
      if (APP_CONFIG.supabase && APP_CONFIG.supabase.url && APP_CONFIG.supabase.anonKey) this.sync();
    });

    window.addEventListener('db-change', () => {
      if (APP_CONFIG.supabase && APP_CONFIG.supabase.url && APP_CONFIG.supabase.anonKey) this.schedulePush();
    });
  },

  async push() {
    if (!APP_CONFIG.supabase || !APP_CONFIG.supabase.url || !APP_CONFIG.supabase.anonKey) return;
    if (!navigator.onLine) { console.log('ℹ️ Supabase push: offline, skip'); return; }

    try {
      const tables = ['perfiles', 'habilidades', 'perfil_habilidades', 'usuarios'];
      for (const table of tables) {
        const records = await db[table].toArray();
        if (records.length > 0) {
          const mapped = this._mapFields(records, table, 'toRemote');
          await this._request('POST', table, mapped, 'on_conflict=id');
        }
      }

      this._connected = true;
      this._updateStore();
      this._lastPush = new Date().toISOString();
      console.log('✅ Supabase push: OK');
    } catch (err) {
      this._connected = false;
      this._updateStore();
      console.warn('⚠️ Supabase push error:', err.message);
    }
  },

  async pull() {
    if (!APP_CONFIG.supabase || !APP_CONFIG.supabase.url || !APP_CONFIG.supabase.anonKey) return;
    if (!navigator.onLine) { console.log('ℹ️ Supabase pull: offline, skip'); return; }

    try {
      const tables = ['perfiles', 'habilidades', 'perfil_habilidades', 'usuarios'];
      const remoteData = {};

      for (const table of tables) {
        const rows = await this._request('GET', table, null, 'select=*');
        remoteData[table] = this._mapFields(rows || [], table, 'toLocal');
      }

      if (!remoteData.perfiles || remoteData.perfiles.length === 0) {
        this._connected = true;
        this._updateStore();
        return;
      }

      const localCount = await db.perfiles.count();
      if (localCount === 0 && remoteData.perfiles.length > 0) {
        await this._mergePull(remoteData);
      } else if (localCount > 0 && remoteData.perfiles.length > 0) {
        const localUpdatedAt = await this._getLocalUpdatedAt();
        const remoteUpdatedAt = this._getRemoteUpdatedAt(remoteData);
        if (remoteUpdatedAt > localUpdatedAt) {
          await this._mergePull(remoteData);
        }
      }

      this._connected = true;
      this._updateStore();
      this._lastPull = new Date().toISOString();
      console.log('✅ Supabase pull: OK');
    } catch (err) {
      this._connected = false;
      this._updateStore();
      console.warn('⚠️ Supabase pull error:', err.message);
    }
  },

  async _getLocalUpdatedAt() {
    try {
      const records = await db.perfiles.orderBy('updated_at').last();
      return records ? (records.updated_at || '') : '';
    } catch (e) { return ''; }
  },

  _getRemoteUpdatedAt(data) {
    let max = '';
    for (const p of (data.perfiles || [])) {
      if (p.updated_at && p.updated_at > max) max = p.updated_at;
    }
    return max;
  },

  async _mergePull(data) {
    if (!data || !data.perfiles) return;
    let cambios = 0;

    for (const p of (data.perfiles || [])) {
      const local = await db.perfiles.get(p.id);
      if (!local) {
        await db.perfiles.add(p);
        cambios++;
      } else if (p.updated_at && local.updated_at && p.updated_at > local.updated_at) {
        await db.perfiles.update(p.id, p);
        cambios++;
      }
    }

    for (const h of (data.habilidades || [])) {
      const local = await db.habilidades.get(h.id);
      if (!local) {
        await db.habilidades.add(h);
        cambios++;
      } else if (h.created_at && local.created_at && h.created_at > local.created_at) {
        await db.habilidades.update(h.id, h);
        cambios++;
      }
    }

    for (const r of (data['perfil_habilidades'] || [])) {
      const local = await db.perfil_habilidades.get(r.id);
      if (!local) {
        await db.perfil_habilidades.add(r);
        cambios++;
      }
    }

    for (const u of (data.usuarios || [])) {
      const local = await db.usuarios.get(u.id);
      if (!local) {
        await db.usuarios.add(u);
        cambios++;
      } else if (u.updated_at && local.updated_at && u.updated_at > local.updated_at) {
        await db.usuarios.update(u.id, u);
        cambios++;
      }
    }

    if (cambios > 0) {
      UI.toast('Datos sincronizados desde Supabase', 'success');
      window.dispatchEvent(new CustomEvent('db-change'));
    }
  },

  async sync() {
    await this.push();
    await this.pull();
  },

  schedulePush() {
    if (this._pushTimer) clearTimeout(this._pushTimer);
    this._pushTimer = setTimeout(() => {
      this.push();
      this._pushTimer = null;
    }, 2000);
  },

  startAutoPull() {
    this._pullInterval = setInterval(() => this.pull(), 30000);
  },

  stopAutoPull() {
    if (this._pullInterval) { clearInterval(this._pullInterval); this._pullInterval = null; }
  },

  async forceSync() {
    UI.toast('Sincronizando...', 'info');
    await this.push();
    await this.pull();
    UI.toast('Sincronización completada', 'success');
  }
};

window.dbSupabase = dbSupabase;
