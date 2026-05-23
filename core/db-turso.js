var dbTurso = {
  _connected: false,

  _updateStore() {
    if (typeof Alpine !== 'undefined' && Alpine.store('turso')) {
      Alpine.store('turso').status = this.status;
    }
  },
  _lastPush: null,
  _lastPull: null,
  _pushInterval: null,
  _pullInterval: null,

  get status() {
    if (!APP_CONFIG.cloud || !APP_CONFIG.cloud.syncUrl) return 'disabled';
    if (!navigator.onLine) return 'offline';
    return this._connected ? 'connected' : 'disconnected';
  },

  get lastPush() { return this._lastPush; },
  get lastPull() { return this._lastPull; },

  async init() {
    if (!APP_CONFIG.cloud || !APP_CONFIG.cloud.syncUrl) {
      console.log('ℹ️ Cloud sync: deshabilitado (no configurado)');
      this._updateStore();
      return;
    }
    console.log('🚀 Cloud sync: iniciando...');
    this._updateStore();

    window.addEventListener('online', () => {
      if (APP_CONFIG.cloud && APP_CONFIG.cloud.syncUrl) this.sync();
    });

    window.addEventListener('db-change', () => {
      if (APP_CONFIG.cloud && APP_CONFIG.cloud.syncUrl) this.schedulePush();
    });
  },

  async _request(action, data) {
    const syncUrl = APP_CONFIG.cloud && APP_CONFIG.cloud.syncUrl;
    if (!syncUrl) throw new Error('Cloud sync no configurado');

    try {
      const resp = await fetch(syncUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Key': APP_CONFIG.auth.masterKey || '',
        },
        body: JSON.stringify({ action, data }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error('HTTP ' + resp.status + ': ' + text.slice(0, 200));
      }

      return await resp.json();
    } catch (err) {
      this._connected = false;
      this._updateStore();
      throw err;
    }
  },

  async push() {
    if (!APP_CONFIG.cloud || !APP_CONFIG.cloud.syncUrl) return;
    if (!navigator.onLine) { console.log('ℹ️ Cloud push: offline, skip'); return; }

    try {
      const perfiles = await db.perfiles.toArray();
      const habilidades = await db.habilidades.toArray();
      const relaciones = await db.perfil_habilidades.toArray();
      const usuarios = await db.usuarios.toArray();

      const data = {
        version: APP_CONFIG.app.version,
        app: APP_CONFIG.app.nombre,
        perfiles: perfiles.map(p => ({
          id: p.id, nombre: p.nombre, email: p.email, telefono: p.telefono,
          direccion: p.direccion, cargo: p.cargo, bio: p.bio,
          fotoBase64: p.fotoBase64, created_at: p.created_at, updated_at: p.updated_at
        })),
        habilidades: habilidades.map(h => ({
          id: h.id, nombre: h.nombre, categoria: h.categoria, created_at: h.created_at
        })),
        relaciones: relaciones.map(r => ({
          id: r.id, perfil_id: r.perfil_id, habilidad_id: r.habilidad_id
        })),
        usuarios: usuarios.map(u => ({
          id: u.id, email: u.email, email_hash: u.email_hash, nombre: u.nombre,
          password_hash: u.password_hash, rol: u.rol, perfilId: u.perfilId,
          created_at: u.created_at, updated_at: u.updated_at
        }))
      };

      const result = await this._request('push', data);

      this._connected = true;
      this._updateStore();
      this._lastPush = result.updated_at || new Date().toISOString();
      console.log('✅ Cloud push: OK');
    } catch (err) {
      this._connected = false;
      this._updateStore();
      console.warn('⚠️ Cloud push error:', err.message);
    }
  },

  async pull() {
    if (!APP_CONFIG.cloud || !APP_CONFIG.cloud.syncUrl) return;
    if (!navigator.onLine) { console.log('ℹ️ Cloud pull: offline, skip'); return; }

    try {
      const result = await this._request('pull');

      if (!result.ok || !result.data) {
        this._connected = true;
        this._updateStore();
        return;
      }

      const remoteData = result.data;
      const remoteUpdatedAt = result.updated_at || '';

      const localCount = await db.perfiles.count();
      if (localCount === 0 && remoteData.perfiles && remoteData.perfiles.length > 0) {
        await this._mergePull(remoteData);
      } else if (localCount > 0 && remoteData.perfiles && remoteData.perfiles.length > 0) {
        const localUpdatedAt = await this._getLocalUpdatedAt();
        if (remoteUpdatedAt > localUpdatedAt) {
          await this._mergePull(remoteData);
        }
      }

      this._connected = true;
      this._updateStore();
      this._lastPull = remoteUpdatedAt;
      console.log('✅ Cloud pull: OK');
    } catch (err) {
      this._connected = false;
      this._updateStore();
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        this._corsFailCount = (this._corsFailCount || 0) + 1;
      } else {
        this._corsFailCount = 0;
      }
      if (this._corsFailCount >= 3) {
        this.stopAutoPull();
        console.warn('⚠️ Cloud pull: desactivado por error de red');
        return;
      }
      console.warn('⚠️ Cloud pull error:', err.message);
    }
  },

  async _getLocalUpdatedAt() {
    try {
      const records = await db.perfiles.orderBy('updated_at').last();
      return records ? (records.updated_at || '') : '';
    } catch (e) {
      return '';
    }
  },

  async _mergePull(data) {
    if (!data || !data.perfiles) return;

    const ok = await UI.confirm(
      'Se encontraron datos en la nube. ¿Desea importarlos?<br><strong>Esto reemplazará los datos locales.</strong>',
      'Sincronizar desde la nube'
    );
    if (!ok) return;

    await db.perfiles.clear();
    await db.habilidades.clear();
    await db.perfil_habilidades.clear();
    await db.usuarios.clear();

    for (const p of (data.perfiles || [])) {
      await db.perfiles.add({
        id: p.id, nombre: p.nombre, email: p.email, telefono: p.telefono,
        direccion: p.direccion, cargo: p.cargo, bio: p.bio,
        fotoBase64: p.fotoBase64, created_at: p.created_at || new Date().toISOString(),
        updated_at: p.updated_at || null
      });
    }

    for (const h of (data.habilidades || [])) {
      await db.habilidades.add({
        id: h.id, nombre: h.nombre, categoria: h.categoria || '',
        created_at: h.created_at || new Date().toISOString()
      });
    }

    for (const r of (data.relaciones || [])) {
      await db.perfil_habilidades.add({
        id: r.id, perfil_id: r.perfil_id, habilidad_id: r.habilidad_id
      });
    }

    for (const u of (data.usuarios || [])) {
      await db.usuarios.add({
        id: u.id, email: u.email, email_hash: u.email_hash, nombre: u.nombre,
        password_hash: u.password_hash, rol: u.rol || 'dev', perfilId: u.perfilId || null,
        created_at: u.created_at || new Date().toISOString(),
        updated_at: u.updated_at || null
      });
    }

    UI.toast('Datos sincronizados desde la nube', 'success');
    window.dispatchEvent(new CustomEvent('db-change'));
  },

  async sync() {
    await this.push();
    await this.pull();
  },

  _pushTimer: null,
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

window.dbTurso = dbTurso;
