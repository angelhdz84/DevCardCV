// modules/dashboard/module.js
const Dashboard = {
  id: 'dashboard',
  titulo: 'Dashboard',

  async init() {
    console.log('💡 [dashboard] Inicializado');
  },

  async render(params = {}) {
    const perfiles = (await dbLocal.getAll('perfiles')).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
    const habilidades = await dbLocal.getAll('habilidades');
    const relaciones = await dbLocal.getAll('perfil_habilidades');
    const usuarios = await dbLocal.getAll('usuarios');

    // 💡 Contar skills por categoría
    const categorias = {};
    habilidades.forEach(h => {
      categorias[h.categoria] = (categorias[h.categoria] || 0) + 1;
    });

    // 💡 Skills más comunes
    const skillCount = {};
    relaciones.forEach(r => {
      const hab = habilidades.find(h => h.id == r.habilidad_id);
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
        .filter(r => r.perfil_id == p.id)
        .map(r => habilidades.find(h => h.id == r.habilidad_id))
        .filter(Boolean);
      const usuario = usuarios.find(u => u.perfilId != null && u.perfilId == p.id);
      perfilesData.push({
        ...p,
        skills: perfilSkills.map(s => s.nombre),
        skillCount: perfilSkills.length,
        rol: usuario ? usuario.rol : 'dev',
        userId: usuario ? usuario.id : null,
        edad: calcularEdad(cryptoHelpers.decrypt(p.dni || ''))
      });
    }

    const adminCount = usuarios.filter(u => u.rol === 'admin').length;

    // 💡 Heatmap: skills por categoría por dev
    const heatCats = Object.keys(categorias).sort();
    const heatRows = perfiles.map(p => {
      const perfilRs = relaciones.filter(r => r.perfil_id == p.id);
      return heatCats.map(cat =>
        perfilRs.filter(r => {
          const hab = habilidades.find(h => h.id == r.habilidad_id);
          return hab && hab.categoria === cat;
        }).length
      );
    });
    const heatDevs = perfilesData.map(p => p.nombre);

    return `
<div x-data="dashboardData(${JSON.stringify(perfilesData).replace(/"/g, '&quot;')}, ${JSON.stringify(topSkills).replace(/"/g, '&quot;')}, ${JSON.stringify(categorias).replace(/"/g, '&quot;')}, ${adminCount}, ${JSON.stringify(heatDevs).replace(/"/g, '&quot;')}, ${JSON.stringify(heatCats).replace(/"/g, '&quot;')}, ${JSON.stringify(heatRows).replace(/"/g, '&quot;')})"
     x-init="initChart()">

  <!-- Header con contador -->
  <div class="flex items-center justify-between mb-6">
    <h2 class="text-xl font-semibold tracking-heading flex items-center gap-2">
      <i class="bi bi-speedometer2 text-accent"></i> Dashboard
    </h2>
    <p class="text-xs text-muted" x-text="perfiles.length + ' dev' + (perfiles.length !== 1 ? 's' : '') + ' registrados'"></p>
  </div>

  <!-- Stats cards — Linear-inspired stat blocks -->
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
    <div class="card bg-white">
      <div class="card-body p-5">
        <div class="flex items-center gap-3">
          <div class="p-2.5 rounded-lg shrink-0 bg-muted">
            <i class="bi bi-people-fill text-lg" style="color: var(--ink);"></i>
          </div>
          <div class="min-w-0">
            <p class="text-xs font-medium uppercase tracking-wider text-muted">Desarrolladores</p>
            <p class="text-2xl font-bold tracking-tight mt-0.5" style="color: var(--ink);" x-text="perfiles.length"></p>
          </div>
        </div>
      </div>
    </div>

    <div class="card bg-white">
      <div class="card-body p-5">
        <div class="flex items-center gap-3">
          <div class="p-2.5 rounded-lg shrink-0 bg-muted">
            <i class="bi bi-tools text-lg" style="color: var(--ink);"></i>
          </div>
          <div class="min-w-0">
            <p class="text-xs font-medium uppercase tracking-wider text-muted">Habilidades</p>
            <p class="text-2xl font-bold tracking-tight mt-0.5" style="color: var(--ink);" x-text="Object.keys(categorias).reduce((a,b) => a + categorias[b], 0)"></p>
          </div>
        </div>
      </div>
    </div>

    <div class="card bg-white">
      <div class="card-body p-5">
        <div class="flex items-center gap-3">
          <div class="p-2.5 rounded-lg shrink-0 bg-muted">
            <i class="bi bi-tag-fill text-lg" style="color: var(--ink);"></i>
          </div>
          <div class="min-w-0">
            <p class="text-xs font-medium uppercase tracking-wider text-muted">Categorías</p>
            <p class="text-2xl font-bold tracking-tight mt-0.5" style="color: var(--ink);" x-text="Object.keys(categorias).length"></p>
          </div>
        </div>
      </div>
    </div>

    <div class="card bg-white">
      <div class="card-body p-5">
        <div class="flex items-center gap-3">
          <div class="p-2.5 rounded-lg shrink-0 bg-muted">
            <i class="bi bi-graph-up text-lg" style="color: var(--ink);"></i>
          </div>
          <div class="min-w-0">
            <p class="text-xs font-medium uppercase tracking-wider text-muted">Promedio Skills</p>
            <p class="text-2xl font-bold tracking-tight mt-0.5" style="color: var(--ink);" x-text="perfiles.length ? (perfiles.reduce((a,p) => a + p.skillCount, 0) / perfiles.length).toFixed(1) : '0'"></p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Sincronización Cloud (solo admin) -->
  <div x-show="$store.auth.isAdmin" class="card bg-white mb-6">
    <div class="card-body p-5">
      <h3 class="text-xs font-semibold uppercase tracking-wider mb-4 flex items-center gap-2 text-muted">
        <i class="bi bi-cloud-arrow-up text-accent"></i> Sincronización Cloud
      </h3>
      <div class="flex items-center gap-3 p-3 rounded-lg bg-muted">
        <div class="w-2.5 h-2.5 rounded-full shrink-0" :class="syncStatus === 'connected' ? 'status-dot-success' : 'status-dot-error'"></div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium" x-text="'Supabase: ' + onlineLabel"></p>
          <p class="text-xs mt-0.5 text-muted">WebSocket en tiempo real</p>
        </div>
        <button class="btn btn-ghost btn-xs gap-1.5 shrink-0 radius-sm" @click="forceRefresh()" :disabled="syncing">
          <i class="bi" :class="syncing ? 'bi-arrow-repeat animate-spin' : 'bi-arrow-repeat'" role="status"></i>
          <span x-text="syncing ? 'Refrescando...' : 'Refrescar'"></span>
        </button>
      </div>
    </div>
  </div>

  <!-- Backup manual (solo admin) -->
  <div x-show="$store.auth.isAdmin" class="card bg-white mb-6" x-data="{ open: false }">
    <div class="card-body p-5">
      <h3 class="text-xs font-semibold uppercase tracking-wider flex items-center gap-2 cursor-pointer select-none text-muted" @click="open = !open">
        <i class="bi bi-database-fill-gear text-accent"></i> Backup Manual (JSON)
        <span class="ml-auto flex items-center gap-1">
          <span x-text="open ? 'ocultar' : 'mostrar'"></span>
          <i class="bi" :class="open ? 'bi-chevron-up' : 'bi-chevron-down'"></i>
        </span>
      </h3>
      <p class="text-xs mt-1 mb-4 text-faint">Exportación/importación local sin conexión cloud</p>
      <div x-show="open" x-collapse>
        <div class="flex flex-wrap items-center gap-3">
          <button class="btn btn-primary btn-magnetic btn-sm radius-sm" @click="exportarJSON()">
            <i class="bi bi-download"></i> Exportar JSON
          </button>
          <button class="btn btn-primary btn-magnetic btn-sm radius-sm" @click="exportarExcel()">
            <i class="bi bi-file-earmark-spreadsheet-fill"></i> Exportar Excel
          </button>
          <label class="btn btn-ghost btn-sm cursor-pointer radius-sm">
            <i class="bi bi-upload"></i> Importar JSON
            <input type="file" accept=".json" class="hidden" @change="importarJSON($event)">
          </label>
          <span class="text-xs text-faint">Todos los datos en JSON</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Reporte SQL (sql.js) -->
  <div x-show="$store.auth.isAdmin" class="card bg-white mb-6" x-data="{ open: false }">
    <div class="card-body p-5">
      <h3 class="text-xs font-semibold uppercase tracking-wider flex items-center gap-2 cursor-pointer select-none text-muted" @click="open = !open">
        <i class="bi bi-code-slash text-accent"></i> Reporte SQL
        <span class="ml-auto flex items-center gap-1">
          <span x-text="open ? 'ocultar' : 'mostrar'"></span>
          <i class="bi" :class="open ? 'bi-chevron-up' : 'bi-chevron-down'"></i>
        </span>
      </h3>
      <p class="text-xs mt-1 mb-4 text-faint">Perfiles × Skills — consulta JOIN ejecutada con sql.js</p>
      <div x-show="open" x-collapse>
        <div class="overflow-x-auto rounded-lg border-default">
          <table class="table table-xs w-full">
            <thead>
              <tr class="bg-muted">
                <th>Perfil</th>
                <th>Cargo</th>
                <th>Skill</th>
                <th>Categoría</th>
              </tr>
            </thead>
            <tbody>
              <template x-for="row in sqlReport" :key="row.pid + '-' + row.hid">
                <tr class="stagger-enter" :style="'animation-delay: ' + ($el.parentElement.children.length * 0.02) + 's'">
                  <td class="font-medium text-sm" x-text="row.nombre"></td>
                  <td class="text-sm" x-text="row.cargo"></td>
                  <td class="text-sm" x-text="row.skill"></td>
                  <td class="text-sm text-muted" x-text="row.categoria"></td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
        <p class="text-xs mt-3 text-faint">
          <i class="bi bi-database"></i> <span x-text="sqlReport.length + ' relaciones'"></span>
        </p>
      </div>
    </div>
  </div>

  <!-- Buscador -->
  <div class="card bg-white mb-6">
    <div class="card-body p-4">
      <div class="relative">
        <i class="bi bi-search absolute left-4 top-1/2 -translate-y-1/2 text-sm text-faint"></i>
        <input type="text" x-model="search" placeholder="Buscar por nombre, cargo o habilidad..." aria-label="Buscar perfiles"
               class="input input-bordered w-full pl-9 radius-sm">
      </div>
    </div>
  </div>

  <!-- Gráficos -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
    <div class="flex flex-col gap-6">
      <!-- Gráfico de skills -->
      <div class="card bg-white">
        <div class="card-body p-5">
          <h3 class="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2 text-muted">
            <i class="bi bi-bar-chart-fill text-accent"></i> Skills más frecuentes
          </h3>
          <div id="skills-chart" style="min-height: 250px;" role="img" aria-label="Gráfico de skills más frecuentes"></div>
        </div>
      </div>

      <!-- Treemap: Skills por desarrollador -->
      <div class="card bg-white">
        <div class="card-body p-5">
          <h3 class="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2 text-muted">
            <i class="bi bi-grid-3x3-gap-fill text-accent"></i> Skills por desarrollador
          </h3>
          <div id="skills-per-dev-chart" style="min-height: 280px;" role="img" aria-label="Treemap de skills por desarrollador"></div>
        </div>
      </div>
    </div>

    <!-- Heatmap: skills por categoría por dev -->
    <div class="card bg-white">
      <div class="card-body p-5">
        <h3 class="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2 text-muted">
          <i class="bi bi-grid-3x3-gap-fill text-accent"></i> Skills por categoría
          <span class="badge badge-ghost badge-xs radius-sm ml-auto">dev → cat</span>
        </h3>
        <div class="overflow-x-auto -mx-5 px-5">
          <table class="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th class="text-left text-muted font-medium px-1.5 py-1 sticky left-0 bg-white z-10 min-w-[90px]"></th>
                <template x-for="cat in heatCats" :key="cat">
                  <th class="text-center text-muted font-medium px-1.5 py-1 w-8" x-text="cat.substring(0, 4)" :title="cat"></th>
                </template>
              </tr>
            </thead>
            <tbody>
              <template x-for="(dev, di) in heatDevs" :key="dev">
                <tr>
                  <td class="text-left px-1.5 py-1 sticky left-0 bg-white z-10 truncate max-w-[100px] font-medium" x-text="dev" :title="dev"></td>
                  <template x-for="(val, ci) in heatRows[di]" :key="ci">
                    <td class="text-center rounded-sm text-[11px] font-semibold leading-none"
                        :style="'background: ' + heatColor(val)"
                        :title="heatCats[ci] + ': ' + val + (val === 1 ? ' skill' : ' skills')"
                        x-text="val || ''"></td>
                  </template>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
        <div class="flex items-center gap-3 mt-3 text-[10px] text-muted">
          <span>0</span>
          <span class="w-4 h-3 rounded-xs" style="background: #f1f5f9"></span>
          <span class="w-4 h-3 rounded-xs" style="background: #dcfce7"></span>
          <span class="w-4 h-3 rounded-xs" style="background: #bbf7d0"></span>
          <span class="w-4 h-3 rounded-xs" style="background: #86efac"></span>
          <span class="w-4 h-3 rounded-xs" style="background: #4ade80"></span>
          <span class="w-4 h-3 rounded-xs" style="background: #22c55e"></span>
          <span class="w-4 h-3 rounded-xs" style="background: #15803d"></span>
          <span>5+</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Tabla de desarrolladores -->
  <div class="card bg-white">
    <div class="card-body p-5">
      <h3 class="text-xs font-semibold uppercase tracking-wider mb-4 flex items-center gap-2 text-muted">
        <i class="bi bi-people-fill text-accent"></i> Equipo de desarrollo
      </h3>

      <template x-if="filtered.length === 0">
        <div x-html="emptyState"></div>
      </template>

      <div class="overflow-x-auto" x-show="filtered.length > 0">
        <table class="table w-full">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Cargo</th>
              <th>Skills</th>
              <th>Rol</th>
              <th class="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <template x-for="(dev, index) in filtered" :key="dev.id">
              <tr class="stagger-enter" :style="'animation-delay: ' + (index * 40) + 'ms'">
                  <td>
                    <div class="flex items-center gap-3">
                      <div class="avatar">
                        <div class="rounded-full w-9 h-9 overflow-hidden bg-muted">
                          <template x-if="dev.fotoBase64">
                            <img :src="dev.fotoBase64" :alt="dev.nombre" class="w-full h-full object-cover">
                          </template>
                          <template x-if="!dev.fotoBase64">
                            <div class="w-full h-full flex items-center justify-center text-muted">
                              <span x-text="dev.nombre.charAt(0).toUpperCase()" class="text-xs font-semibold"></span>
                            </div>
                          </template>
                        </div>
                      </div>
                      <div class="w-7 h-7 rounded-full bg-accent flex-shrink-0 flex items-center justify-center text-white font-bold text-xs"
                           x-show="dev.edad" x-text="dev.edad">
                      </div>
                    <div>
                      <p class="font-medium text-sm" x-text="dev.nombre"></p>
                      <p class="text-xs text-faint font-mono-data" x-text="UI.formatDateRelative(dev.created_at)"></p>
                    </div>
                  </div>
                </td>
                <td><span class="badge badge-ghost badge-sm radius-sm" x-text="dev.cargo"></span></td>
                <td>
                  <div class="flex flex-wrap gap-1">
                    <template x-for="skill in dev.skills.slice(0, 4)" :key="skill">
                      <span class="badge badge-sm radius-sm" x-text="skill"></span>
                    </template>
                    <span x-show="dev.skills.length > 4" class="badge badge-sm badge-ghost radius-sm" x-text=" '+' + (dev.skills.length - 4)"></span>
                  </div>
                </td>
                <td>
                  <span x-show="$store.auth.isAdmin && dev.userId !== $store.auth.user?.userId && !(dev.rol === 'admin' && esUltimoAdmin)"
                        class="badge badge-sm cursor-pointer gap-1"
                        :class="dev.rol === 'admin' ? 'badge-accent' : 'badge-ghost'"
                        @click="cambiarRol(dev)"
                        :title="dev.rol === 'admin' ? 'Cambiar a Dev' : 'Cambiar a Admin'">
                    <i class="bi bi-arrow-repeat text-[10px]"></i>
                    <span x-text="dev.rol === 'admin' ? 'Admin' : 'Dev'"></span>
                  </span>
                  <span x-show="dev.rol === 'admin' && esUltimoAdmin && (!$store.auth.isAdmin || dev.userId === $store.auth.user?.userId)"
                        class="badge badge-sm badge-accent cursor-not-allowed"
                        title="Debe haber al menos un administrador"
                        x-text="'Admin'"></span>
                  <span x-show="(!$store.auth.isAdmin || dev.userId === $store.auth.user?.userId) && !(dev.rol === 'admin' && esUltimoAdmin)"
                        class="badge badge-sm"
                        :class="dev.rol === 'admin' ? 'badge-accent' : 'badge-ghost'"
                        x-text="dev.rol === 'admin' ? 'Admin' : 'Dev'"></span>
                </td>
                <td class="text-right">
                  <div class="flex justify-end gap-0.5">
                    <button class="btn btn-ghost btn-xs btn-square" @click="verCV(dev.id)" aria-label="Ver CV" title="Ver CV">
                      <i class="bi bi-file-earmark-richtext"></i>
                    </button>
                    <button x-show="$store.auth.isAdmin && dev.userId" class="btn btn-ghost btn-xs btn-square" @click="cambiarPassword(dev)" aria-label="Cambiar contraseña" title="Cambiar contraseña">
                      <i class="bi bi-key"></i>
                    </button>
                    <button x-show="$store.auth.isAdmin || $store.auth.user?.perfilId === dev.id" class="btn btn-ghost btn-xs btn-square" @click="editarPerfil(dev.id)" aria-label="Editar perfil" title="Editar perfil">
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
function dashboardData(perfiles, topSkills, categorias, adminCount, heatDevs, heatCats, heatRows) {
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
    adminCount,
    heatDevs,
    heatCats,
    heatRows,

    heatColor(count) {
      if (count === 0) return '#f1f5f9';
      if (count === 1) return '#dcfce7';
      if (count === 2) return '#bbf7d0';
      if (count === 3) return '#86efac';
      if (count === 4) return '#4ade80';
      if (count === 5) return '#22c55e';
      if (count >= 6) return '#15803d';
      return '#f1f5f9';
    },

    get esUltimoAdmin() { return this.adminCount <= 1; },

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
        const perfiles = await dbLocal.getAll('perfiles');
        const habilidades = await dbLocal.getAll('habilidades');
        const relaciones = await dbLocal.getAll('perfil_habilidades');
        const usuarios = await dbLocal.getAll('usuarios');

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

    async exportarExcel() {
      try {
        const perfiles = await dbLocal.getAll('perfiles');
        const relaciones = await dbLocal.getAll('perfil_habilidades');
        const habilidades = await dbLocal.getAll('habilidades');

        const rows = perfiles.map(p => {
          const perfilSkills = relaciones
            .filter(r => r.perfil_id == p.id)
            .map(r => habilidades.find(h => h.id == r.habilidad_id))
            .filter(Boolean);
          return {
            'Nombre': p.nombre,
            'Cargo': p.cargo,
            'DNI': cryptoHelpers.decrypt(p.dni || ''),
            'Email': cryptoHelpers.decrypt(p.email || ''),
            'Teléfono': cryptoHelpers.decrypt(p.telefono || ''),
            'Dirección': cryptoHelpers.decrypt(p.direccion || ''),
            'Biografía': p.bio || '',
            'Skills': perfilSkills.map(s => s.nombre).join(', '),
            'Categorías': [...new Set(perfilSkills.map(s => s.categoria))].join(', '),
            'Creado': p.created_at ? dayjs(p.created_at).format('DD/MM/YYYY') : '',
            'Actualizado': p.updated_at ? dayjs(p.updated_at).format('DD/MM/YYYY HH:mm') : ''
          };
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [
          { wch: 25 }, { wch: 20 }, { wch: 15 },
          { wch: 30 }, { wch: 15 }, { wch: 30 },
          { wch: 40 }, { wch: 40 }, { wch: 30 },
          { wch: 14 }, { wch: 18 }
        ];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Desarrolladores');
        const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([buf], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `devcardcv_devs_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        UI.toast(`Excel exportado: ${rows.length} desarrolladores`, 'success');
      } catch (err) {
        UI.toast('Error al exportar Excel: ' + err.message, 'error');
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
          delete hab.id;
          await dbOnline.add('habilidades', hab);
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
          await dbOnline.add('perfiles', registro);
        }

        // 💡 Reconstruir relaciones
        const perfilesNuevos = await dbLocal.getAll('perfiles');
        const habilidadesNuevas = await dbLocal.getAll('habilidades');

        for (const rel of (data.relaciones || [])) {
          const perfil = perfilesNuevos.find(p => p.email === cryptoHelpers.encrypt(data.perfiles.find(dp => dp.id === rel.perfil_id)?.email || ''));
          const habilidad = habilidadesNuevas.find(h => h.nombre === (data.habilidades.find(dh => dh.id === rel.habilidad_id)?.nombre));
          if (perfil && habilidad) {
            await dbOnline.add('perfil_habilidades', { perfil_id: perfil.id, habilidad_id: habilidad.id });
          }
        }

        // 💡 Restaurar usuarios
        for (const u of (data.usuarios || [])) {
          delete u.id;
          await dbOnline.add('usuarios', {
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

        // 💡 Treemap — Skills por desarrollador
        if (this.perfiles.length > 0 && typeof ApexCharts !== 'undefined') {
          const el = document.querySelector('#skills-per-dev-chart');
          if (el) {
            const data = [...this.perfiles]
              .sort((a, b) => b.skillCount - a.skillCount)
              .map(p => ({ x: p.nombre, y: p.skillCount || 0 }));
            const palette = ['#15803d','#3b82f6','#F59E0B','#8B5CF6','#22C55E','#06b6d4','#ec4899','#0f172a','#f97316','#6366f1'];
            const chart2 = new ApexCharts(el, {
              chart: { type: 'treemap', height: 280, toolbar: { show: false }, animations: { enabled: false } },
              series: [{ data }],
              colors: palette,
              plotOptions: {
                treemap: {
                  distributed: true,
                  enableShades: false
                }
              },
              dataLabels: {
                enabled: true,
                style: { fontSize: '12px', fontWeight: 600, colors: ['#fff'] },
                offsetY: -4
              },
              tooltip: {
                y: { formatter: v => v + (v === 1 ? ' skill' : ' skills') }
              },
              grid: { show: false }
            });
            chart2.render();
            window._dashboardCharts.push(chart2);
          }
        }
      }, 100);
    },

    // 💡 Sync state (simplificado — Realtime es automático)
    syncing: false,

    get syncStatus() {
      const store = Alpine.store('supabase');
      return store ? store.status : 'disconnected';
    },

    get onlineLabel() {
      return this.syncStatus === 'connected' ? 'Conectado' : 'Sin conexión';
    },

    async forceRefresh() {
      this.syncing = true;
      try {
        await dbOnline.refreshCache();
        UI.toast('Datos refrescados desde Supabase', 'success');
      } catch (e) {
        UI.toast('Error al refrescar: ' + e.message, 'error');
      }
      this.syncing = false;
    },

    async cambiarRol(dev) {
      if (!dev.userId) { UI.toast('Este perfil no tiene usuario asociado', 'error'); return; }
      const nuevoRol = dev.rol === 'admin' ? 'dev' : 'admin';
      if (nuevoRol === 'dev' && this.esUltimoAdmin) {
        UI.toast('Debe haber al menos un administrador en el sistema', 'error');
        return;
      }
      const ok = await UI.confirm(
        `¿Cambiar a "${dev.nombre}" de <strong>${dev.rol}</strong> a <strong>${nuevoRol}</strong>?`,
        'Cambiar rol'
      );
      if (!ok) return;
      try {
        await dbOnline.update('usuarios', dev.userId, { rol: nuevoRol, updated_at: new Date() });
        dev.rol = nuevoRol;
        if (nuevoRol === 'admin') this.adminCount++;
        else this.adminCount--;
        const authUser = Alpine.store('auth').user;
        if (authUser && dev.userId === authUser.userId) {
          const session = { ...authUser, rol: nuevoRol };
          Alpine.store('auth').setSession(session);
          Alpine.store('auth').user.rol = nuevoRol;
        }
        UI.toast(`Rol de "${dev.nombre}" actualizado a ${nuevoRol}`, 'success');
        window.dispatchEvent(new CustomEvent('db-change'));
      } catch (err) {
        UI.toast('Error al cambiar rol: ' + err.message, 'error');
      }
    },

    async cambiarPassword(dev) {
      if (!dev.userId) { UI.toast('Este perfil no tiene usuario asociado', 'error'); return; }
      const nuevaPass = prompt(`Nueva contraseña para "${dev.nombre}":`, '');
      if (!nuevaPass || nuevaPass.length < 6) {
        if (nuevaPass) UI.toast('La contraseña debe tener al menos 6 caracteres', 'warning');
        return;
      }
      const confirmacion = prompt('Confirma la nueva contraseña:', '');
      if (nuevaPass !== confirmacion) {
        UI.toast('Las contraseñas no coinciden', 'error');
        return;
      }
      try {
        const hash = CryptoJS.SHA256(nuevaPass).toString(CryptoJS.enc.Hex);
        await dbOnline.update('usuarios', dev.userId, { password_hash: hash, updated_at: new Date() });
        UI.toast(`Contraseña de "${dev.nombre}" actualizada`, 'success');
        window.dispatchEvent(new CustomEvent('db-change'));
      } catch (err) {
        UI.toast('Error al cambiar contraseña: ' + err.message, 'error');
      }
    }

  };
}

window.MODULES = window.MODULES || {};
window.MODULES[Dashboard.id] = Dashboard;
appRouter.register(Dashboard);
