// modules/dashboard/module.js
const Dashboard = {
  id: 'dashboard',
  titulo: 'Dashboard',

  async init() {
    console.log('💡 [dashboard] Inicializado');
  },

  async render(params = {}) {
    const perfiles = await db.perfiles.orderBy('nombre').toArray();
    const habilidades = await db.habilidades.toArray();
    const relaciones = await db.perfil_habilidades.toArray();

    // 💡 Contar skills por categoría
    const categorias = {};
    habilidades.forEach(h => {
      categorias[h.categoria] = (categorias[h.categoria] || 0) + 1;
    });

    // 💡 Skills más comunes
    const skillCount = {};
    relaciones.forEach(r => {
      const hab = habilidades.find(h => h.id === r.habilidad_id);
      if (hab) {
        skillCount[hab.nombre] = (skillCount[hab.nombre] || 0) + 1;
      }
    });
    const topSkills = Object.entries(skillCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    // 💡 Preparar datos para Alpine
    const perfilesData = [];
    for (const p of perfiles) {
      const perfilSkills = relaciones
        .filter(r => r.perfil_id === p.id)
        .map(r => habilidades.find(h => h.id === r.habilidad_id))
        .filter(Boolean);
      perfilesData.push({
        ...p,
        skills: perfilSkills.map(s => s.nombre),
        skillCount: perfilSkills.length
      });
    }

    return `
<div x-data="dashboardData(${JSON.stringify(perfilesData).replace(/"/g, '&quot;')}, ${JSON.stringify(topSkills).replace(/"/g, '&quot;')}, ${JSON.stringify(categorias).replace(/"/g, '&quot;')})"
     x-init="initChart()">

  <!-- Header con contador -->
  <div class="flex items-center justify-between mb-6">
    <h2 class="text-xl font-semibold tracking-heading flex items-center gap-2">
      <i class="bi bi-speedometer2 text-accent"></i> Dashboard
    </h2>
    <p class="text-xs" style="color: var(--ink-muted);" x-text="perfiles.length + ' dev' + (perfiles.length !== 1 ? 's' : '') + ' registrados'"></p>
  </div>

  <!-- Stats cards — Firecrawl stat block pattern -->
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
    <div class="card bg-white">
      <div class="card-body p-4">
        <div class="flex items-center gap-3">
          <div class="p-2 rounded-lg" style="background: rgba(38,38,38,0.06);">
            <i class="bi bi-people-fill" style="color: var(--ink);"></i>
          </div>
          <div>
            <p class="stat-label">Desarrolladores</p>
            <p class="stat-value" x-text="perfiles.length"></p>
          </div>
        </div>
      </div>
    </div>

    <div class="card bg-white">
      <div class="card-body p-4">
        <div class="flex items-center gap-3">
          <div class="p-2 rounded-lg" style="background: var(--accent-light);">
            <i class="bi bi-tools text-accent"></i>
          </div>
          <div>
            <p class="stat-label">Habilidades</p>
            <p class="stat-value" x-text="Object.keys(categorias).reduce((a,b) => a + categorias[b], 0)"></p>
          </div>
        </div>
      </div>
    </div>

    <div class="card bg-white">
      <div class="card-body p-4">
        <div class="flex items-center gap-3">
          <div class="p-2 rounded-lg" style="background: var(--accent-secondary-light);">
            <i class="bi bi-tag-fill" style="color: var(--accent-secondary);"></i>
          </div>
          <div>
            <p class="stat-label">Categorías</p>
            <p class="stat-value" x-text="Object.keys(categorias).length"></p>
          </div>
        </div>
      </div>
    </div>

    <div class="card bg-white">
      <div class="card-body p-4">
        <div class="flex items-center gap-3">
          <div class="p-2 rounded-lg" style="background: var(--accent-light);">
            <i class="bi bi-graph-up" style="color: var(--accent);"></i>
          </div>
          <div>
            <p class="stat-label">Promedio Skills</p>
            <p class="stat-value" x-text="perfiles.length ? (perfiles.reduce((a,p) => a + p.skillCount, 0) / perfiles.length).toFixed(1) : '0'"></p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Sincronización Cloud (solo admin) -->
  <div x-show="$store.auth.isAdmin" class="card bg-white mb-6">
    <div class="card-body p-4">
      <h3 class="section-label mb-3 flex items-center gap-2">
        <i class="bi bi-cloud-arrow-up text-accent"></i> Sincronización Cloud
      </h3>

      <!-- Estado de sync -->
      <div class="flex items-center gap-3 mb-4 p-3 rounded-lg" :style="syncStatusBg"
           style="background: var(--surface-muted);">
        <div class="w-3 h-3 rounded-full" :style="'background: ' + syncStatusColor"></div>
        <div class="flex-1">
          <p class="text-sm font-medium" x-text="syncStatusLabel"></p>
          <p class="text-xs" style="color: var(--ink-muted);">
            <span x-show="syncLastPush">Último push: <span x-text="syncLastPush"></span></span>
            <span x-show="syncLastPull" class="ml-2">Último pull: <span x-text="syncLastPull"></span></span>
          </p>
        </div>
        <button class="btn btn-ghost btn-sm" style="border-radius: 8px; border: 1px solid var(--border);"
                @click="forceSync()" :disabled="syncing">
          <i class="bi" :class="syncing ? 'bi-arrow-repeat animate-spin' : 'bi-arrow-repeat'"></i>
          <span x-text="syncing ? 'Sincronizando...' : 'Sincronizar ahora'"></span>
        </button>
      </div>

      <div class="text-xs" style="color: var(--ink-muted);">
        <i class="bi bi-check-circle text-accent"></i> Sincronización vía Cloudflare D1 (desde <code>project.config.js</code>)
      </div>
    </div>
  </div>

  <!-- Backup manual (solo admin) -->
  <div x-show="$store.auth.isAdmin" class="card bg-white mb-6" x-data="{ open: false }">
    <div class="card-body p-4">
      <h3 class="section-label mb-1 flex items-center gap-2 cursor-pointer select-none" @click="open = !open">
        <i class="bi bi-database-fill-gear text-accent"></i> Backup Manual (JSON)
        <span class="text-xs ml-auto" style="color: var(--ink-muted);">
          <span x-text="open ? 'ocultar' : 'mostrar'"></span>
          <i class="bi" :class="open ? 'bi-chevron-up' : 'bi-chevron-down'"></i>
        </span>
      </h3>
      <p class="text-xs mb-4" style="color: var(--ink-muted);">Exportación/importación local sin conexión cloud</p>
      <div x-show="open" x-collapse>
        <div class="flex flex-wrap gap-2">
          <button class="btn btn-primary btn-sm" style="border-radius: 8px;" @click="exportarJSON()">
            <i class="bi bi-download"></i> Exportar JSON
          </button>
          <label class="btn btn-ghost btn-sm cursor-pointer" style="border-radius: 8px; border: 1px solid var(--border);">
            <i class="bi bi-upload"></i> Importar JSON
            <input type="file" accept=".json" class="hidden" @change="importarJSON($event)">
          </label>
          <span class="text-xs self-center" style="color: var(--ink-muted);">Exporta o restaura todos los datos en formato JSON</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Reporte SQL (sql.js) -->
  <div class="card bg-white mb-6" x-data="{ open: false }">
    <div class="card-body p-4">
      <h3 class="section-label mb-1 flex items-center gap-2 cursor-pointer select-none" @click="open = !open">
        <i class="bi bi-code-slash text-accent"></i> Reporte SQL
        <span class="text-xs ml-auto" style="color: var(--ink-muted);">
          <span x-text="open ? 'ocultar' : 'mostrar'"></span>
          <i class="bi" :class="open ? 'bi-chevron-up' : 'bi-chevron-down'"></i>
        </span>
      </h3>
      <p class="text-xs mb-4" style="color: var(--ink-muted);">Perfiles × Skills — consulta JOIN ejecutada con sql.js</p>
      <div x-show="open" x-collapse>
        <div class="overflow-x-auto rounded-lg" style="border: 1px solid var(--border);">
          <table class="table table-xs w-full">
            <thead>
              <tr style="background: var(--surface-muted);">
                <th class="font-semibold text-xs">Perfil</th>
                <th class="font-semibold text-xs">Cargo</th>
                <th class="font-semibold text-xs">Skill</th>
                <th class="font-semibold text-xs">Categoría</th>
              </tr>
            </thead>
            <tbody>
              <template x-for="row in sqlReport" :key="row.pid + '-' + row.hid">
                <tr class="hover:bg-base-200 transition-colors stagger-enter" :style="'animation-delay: ' + ($el.parentElement.children.length * 0.02) + 's'">
                  <td class="font-medium text-xs" x-text="row.nombre"></td>
                  <td class="text-xs" x-text="row.cargo"></td>
                  <td class="text-xs" x-text="row.skill"></td>
                  <td class="text-xs" style="color: var(--ink-muted);" x-text="row.categoria"></td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
        <p class="text-xs mt-2" style="color: var(--ink-muted);">
          <i class="bi bi-database"></i> <span x-text="sqlReport.length + ' relaciones'"></span>
          &mdash; <code class="px-1 py-0.5 rounded" style="background: var(--surface-muted); font-size: 0.625rem;">SELECT p.nombre, p.cargo, h.nombre, h.categoria FROM perfiles p JOIN perfil_habilidades ph ON p.id = ph.perfil_id JOIN habilidades h ON h.id = ph.habilidad_id</code>
        </p>
      </div>
    </div>
  </div>

  <!-- Buscador -->
  <div class="card bg-white mb-6">
    <div class="card-body p-4">
      <div class="form-control">
        <div class="relative">
          <i class="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-base-content/25 text-sm"></i>
          <input type="text" x-model="search" placeholder="Buscar por nombre, cargo o habilidad..."
                 class="input input-bordered w-full pl-10" style="border-radius: 8px;">
        </div>
      </div>
    </div>
  </div>

  <!-- Gráfico + Tabla -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
    <!-- Gráfico de skills -->
    <div class="card bg-white">
      <div class="card-body p-4">
        <h3 class="section-label mb-2 flex items-center gap-2">
          <i class="bi bi-bar-chart-fill text-accent"></i> Skills más frecuentes
        </h3>
        <div id="skills-chart" style="min-height: 250px;"></div>
      </div>
    </div>

    <!-- Distribución por categoría — barras horizontales -->
    <div class="card bg-white">
      <div class="card-body p-4">
        <h3 class="section-label mb-4 flex items-center gap-2">
          <i class="bi bi-bar-chart-fill text-accent"></i> Por categoría
        </h3>
        <div class="space-y-3" id="category-bars">
          <template x-for="(cat, index) in catList" :key="cat.name">
            <div>
              <div class="flex items-center justify-between mb-1.5">
                <div class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full" :style="'background: ' + catColors[index % catColors.length]"></span>
                  <span class="text-sm font-medium" style="color: var(--ink-secondary);" x-text="cat.name"></span>
                </div>
                <span class="text-xs font-semibold" style="color: var(--ink-muted);" x-text="cat.count + ' skills'"></span>
              </div>
              <div class="w-full rounded-md overflow-hidden" style="height: 16px; background: var(--surface-muted);">
                <div class="rounded-md transition-all duration-500 flex items-center justify-end pr-1.5"
                     :style="'width: ' + cat.pct + '%; background: ' + catColors[index % catColors.length]">
                  <span class="text-[10px] font-bold text-white leading-none" x-show="cat.pct >= 10" x-text="cat.pct + '%'"></span>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>

  <!-- Tabla de desarrolladores -->
  <div class="card bg-white">
    <div class="card-body p-4">
      <h3 class="section-label mb-4 flex items-center gap-2">
        <i class="bi bi-people-fill text-accent"></i> Equipo de desarrollo
      </h3>

      <template x-if="filtered.length === 0">
        <div x-html="emptyState"></div>
      </template>

      <div class="overflow-x-auto" x-show="filtered.length > 0">
        <table class="table w-full">
          <thead>
            <tr class="border-b border-base-200">
              <th class="section-label font-semibold">Nombre</th>
              <th class="section-label font-semibold">Cargo</th>
              <th class="section-label font-semibold">Skills</th>
              <th class="text-right section-label font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <template x-for="(dev, index) in filtered" :key="dev.id">
              <tr class="border-b border-base-100 last:border-b-0 stagger-enter" :style="'animation-delay: ' + (index * 0.03) + 's'">
                  <td>
                    <div class="flex items-center gap-3">
                      <div class="avatar">
                        <div class="rounded-full w-9 h-9 overflow-hidden ring-1 ring-base-200" style="background: rgba(38,38,38,0.06);">
                          <template x-if="dev.fotoBase64">
                            <img :src="dev.fotoBase64" :alt="dev.nombre" class="w-full h-full object-cover">
                          </template>
                          <template x-if="!dev.fotoBase64">
                            <div class="w-full h-full flex items-center justify-center" style="color: var(--ink);">
                              <span x-text="dev.nombre.charAt(0).toUpperCase()" class="text-xs font-semibold"></span>
                            </div>
                          </template>
                        </div>
                      </div>
                    <div>
                      <p class="font-medium text-sm" x-text="dev.nombre"></p>
                      <p class="text-xs text-base-content/50" x-text="UI.formatDateRelative(dev.created_at)"></p>
                    </div>
                  </div>
                </td>
                <td><span class="badge badge-ghost badge-sm" style="border-radius: 6px;" x-text="dev.cargo"></span></td>
                <td>
                  <div class="flex flex-wrap gap-1.5">
                    <template x-for="skill in dev.skills.slice(0, 4)" :key="skill">
                      <span class="badge badge-sm" style="border-radius: 4px;" x-text="skill"></span>
                    </template>
                    <span x-show="dev.skills.length > 4" class="badge badge-sm badge-ghost" style="border-radius: 4px;" x-text=" '+' + (dev.skills.length - 4)"></span>
                  </div>
                </td>
                <td class="text-right">
                  <div class="flex justify-end gap-1">
                    <button class="btn btn-ghost btn-xs" @click="verCV(dev.id)" aria-label="Ver CV" title="Ver CV">
                      <i class="bi bi-file-earmark-richtext"></i>
                    </button>
                    <button class="btn btn-ghost btn-xs" @click="editarPerfil(dev.id)" aria-label="Editar perfil" title="Editar perfil">
                      <i class="bi bi-pencil"></i>
                    </button>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>
`;
  },

  destroy() {
    // 💡 Limpiar gráficos ApexCharts
    if (window._dashboardCharts) {
      window._dashboardCharts.forEach(c => { try { c.destroy(); } catch(e) {} });
      window._dashboardCharts = [];
    }
    console.log('💡 [dashboard] Destruído');
  }
};

// 💡 Alpine data factory
function dashboardData(perfiles, topSkills, categorias) {
  const catColors = ['#0f172a', '#15803d', '#3b82f6', '#F59E0B', '#8B5CF6', '#22C55E', '#06b6d4', '#ec4899'];
  const catNames = Object.keys(categorias);
  const catValues = catNames.map(c => categorias[c]);
  const catTotal = catValues.reduce((a, b) => a + b, 0) || 1;
  const catList = catNames.map((name, i) => ({
    name,
    count: categorias[name],
    pct: Math.round((categorias[name] / catTotal) * 100)
  })).sort((a, b) => b.count - a.count);

  return {
    perfiles,
    search: '',
    topSkills,
    categorias,
    catList,
    catColors,

    get filtered() {
      if (!this.search) return this.perfiles;
      const q = this.search.toLowerCase();
      return this.perfiles.filter(d =>
        d.nombre.toLowerCase().includes(q) ||
        d.cargo.toLowerCase().includes(q) ||
        d.skills.some(s => s.toLowerCase().includes(q))
      );
    },

    get emptyState() {
      return UI.emptyState('No se encontraron resultados', 'bi-search');
    },

    get sqlReport() {
      try {
        return dbSQLite.queryObjects(
          'SELECT p.id AS pid, p.nombre, p.cargo, h.id AS hid, h.nombre AS skill, h.categoria FROM perfiles p JOIN perfil_habilidades ph ON p.id = ph.perfil_id JOIN habilidades h ON h.id = ph.habilidad_id ORDER BY p.nombre, h.categoria'
        );
      } catch (e) {
        return [];
      }
    },

    verCV(id) {
      window.location.hash = `#/cv/${id}`;
    },

    editarPerfil(id) {
      window.location.hash = `#/perfiles/edit/${id}`;
    },

    async exportarJSON() {
      try {
        const perfiles = await db.perfiles.toArray();
        const habilidades = await db.habilidades.toArray();
        const relaciones = await db.perfil_habilidades.toArray();
        const usuarios = await db.usuarios.toArray();

        const backup = {
          version: APP_CONFIG.app.version,
          fecha: new Date().toISOString(),
          app: APP_CONFIG.app.nombre,
          perfiles: perfiles.map(p => ({
            ...p,
            email: cryptoHelpers.decrypt(p.email || ''),
            telefono: p.telefono ? cryptoHelpers.decrypt(p.telefono) : ''
          })),
          habilidades,
          relaciones,
          usuarios: usuarios.map(u => ({
            ...u,
            email: cryptoHelpers.decrypt(u.email || '')
          }))
        };

        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `devcardcv_backup_${dayjs().format('YYYYMMDD_HHmmss')}.json`;
        a.click();
        URL.revokeObjectURL(url);
        UI.toast(`Backup exportado: ${perfiles.length} perfiles, ${habilidades.length} habilidades`, 'success');
      } catch (err) {
        UI.toast('Error al exportar: ' + err.message, 'error');
      }
    },

    exportarSQLite() {
      try {
        dbSQLite.download();
        UI.toast('Base de datos SQLite exportada', 'success');
      } catch (err) {
        UI.toast('Error al exportar SQLite: ' + err.message, 'error');
      }
    },

    async importarSQLite(event) {
      const file = event.target.files[0];
      if (!file) return;
      const ok = await UI.confirm('¿Restaurar desde el archivo .sqlite? Se sobrescribirán todos los datos actuales.', 'Importar SQLite');
      if (!ok) { event.target.value = ''; return; }
      try {
        const buf = await file.arrayBuffer();
        await dbSQLite.import(buf);
        UI.toast('SQLite importado correctamente', 'success');
        window.dispatchEvent(new CustomEvent('db-change'));
        window.location.hash = '#/dashboard';
      } catch (err) {
        UI.toast('Error al importar SQLite: ' + err.message, 'error');
      }
      event.target.value = '';
    },

    async importarJSON(event) {
      const file = event.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (!data.app || data.app !== APP_CONFIG.app.nombre) {
          UI.toast('Archivo no compatible con DevCardCV', 'error');
          return;
        }

        const ok = await UI.confirm(
          `¿Importar ${data.perfiles?.length || 0} perfiles, ${data.habilidades?.length || 0} habilidades y ${data.usuarios?.length || 0} usuarios?<br><strong>Esto reemplazará todos los datos actuales.</strong>`,
          'Importar backup'
        );
        if (!ok) return;

        // 💡 Limpiar y restaurar
        await db.perfiles.clear();
        await db.habilidades.clear();
        await db.perfil_habilidades.clear();
        await db.usuarios.clear();

        // 💡 Insertar habilidades primero (necesarias para relaciones)
        for (const hab of (data.habilidades || [])) {
          delete hab.id; // Dexie auto-genera ID
          await db.habilidades.add(hab);
        }

        // 💡 Insertar perfiles con cifrado
        for (const p of (data.perfiles || [])) {
          delete p.id;
          const registro = {
            ...p,
            email: cryptoHelpers.encrypt(p.email || ''),
            telefono: p.telefono ? cryptoHelpers.encrypt(p.telefono) : '',
            created_at: p.created_at ? new Date(p.created_at) : new Date(),
            updated_at: p.updated_at ? new Date(p.updated_at) : new Date()
          };
          await db.perfiles.add(registro);
        }

        // 💡 Reconstruir relaciones
        const perfilesNuevos = await db.perfiles.toArray();
        const habilidadesNuevas = await db.habilidades.toArray();

        for (const rel of (data.relaciones || [])) {
          // 💡 Buscar IDs nuevos por nombre/email
          const perfil = perfilesNuevos.find(p => p.email === cryptoHelpers.encrypt(data.perfiles.find(dp => dp.id === rel.perfil_id)?.email || ''));
          const habilidad = habilidadesNuevas.find(h => h.nombre === (data.habilidades.find(dh => dh.id === rel.habilidad_id)?.nombre));
          if (perfil && habilidad) {
            await db.perfil_habilidades.add({ perfil_id: perfil.id, habilidad_id: habilidad.id });
          }
        }

        // 💡 Restaurar usuarios
        for (const u of (data.usuarios || [])) {
          delete u.id;
          await db.usuarios.add({
            ...u,
            email: cryptoHelpers.encrypt(u.email || ''),
            created_at: u.created_at ? new Date(u.created_at) : new Date(),
            updated_at: u.updated_at ? new Date(u.updated_at) : new Date()
          });
        }

        UI.toast(`Importado: ${data.perfiles?.length || 0} perfiles, ${data.habilidades?.length || 0} habilidades, ${data.usuarios?.length || 0} usuarios`, 'success');
        window.dispatchEvent(new CustomEvent('db-change'));
        window.location.hash = '#/dashboard';
      } catch (err) {
        UI.toast('Error al importar: ' + err.message, 'error');
      }
      event.target.value = '';
    },

    initChart() {
      window._dashboardCharts = [];
      // 💡 Esperar a que el DOM esté pintado antes de renderizar gráficos
      setTimeout(() => {
        // 💡 Gráfico de barras - Skills más frecuentes
        if (this.topSkills.length > 0 && typeof ApexCharts !== 'undefined') {
          const skillsEl = document.querySelector('#skills-chart');
          if (skillsEl) {
            const chart1 = new ApexCharts(skillsEl, {
              chart: { type: 'bar', height: 250, toolbar: { show: false }, animations: { enabled: false } },
              series: [{ name: 'Devs', data: this.topSkills.map(s => s[1]) }],
              xaxis: { categories: this.topSkills.map(s => s[0]), labels: { rotate: -45, style: { fontSize: '11px' } } },
              colors: ['#0f172a'],
              plotOptions: { bar: { borderRadius: 4, columnWidth: '60%' } },
              grid: { borderColor: 'rgba(0,0,0,0.04)' },
              tooltip: { theme: 'light' },
              dataLabels: { enabled: false }
            });
            chart1.render();
            window._dashboardCharts.push(chart1);
          }
        }
      }, 100);
    },

    // 💡 Cloud sync state
    syncing: false,

    get syncStatusColor() {
      switch (dbTurso.status) {
        case 'connected': return '#22C55E';
        case 'offline': return '#F59E0B';
        case 'disconnected': return '#EF4444';
        default: return '#94A3B8';
      }
    },

    get syncStatusBg() {
      switch (dbTurso.status) {
        case 'connected': return 'background: rgba(34,197,94,0.06)';
        case 'offline': return 'background: rgba(245,158,11,0.06)';
        case 'disconnected': return 'background: rgba(239,68,68,0.06)';
        default: return 'background: var(--surface-muted)';
      }
    },

    get syncStatusLabel() {
      switch (dbTurso.status) {
        case 'connected': return 'Conectado a Cloud D1';
        case 'offline': return 'Sin conexión a internet';
        case 'disconnected': return 'Error de conexión con Cloud';
        default: return 'Cloud no configurado';
      }
    },

    get syncLastPush() {
      return dbTurso.lastPush ? dayjs(dbTurso.lastPush).format('HH:mm:ss') : null;
    },

    get syncLastPull() {
      return dbTurso.lastPull ? dayjs(dbTurso.lastPull).format('HH:mm:ss') : null;
    },

    async forceSync() {
      this.syncing = true;
      await dbTurso.forceSync();
      this.syncing = false;
    },


  };
}

window.MODULES = window.MODULES || {};
window.MODULES[Dashboard.id] = Dashboard;
appRouter.register(Dashboard);
