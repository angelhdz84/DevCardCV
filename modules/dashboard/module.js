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
        edad: calcularEdad(p.dni || '')
      });
    }

    const adminCount = usuarios.filter(u => u.rol === 'admin').length;

    // ─── Nuevas gráficas: datos de proyectos y tareas ───
    const tareas = (await dbLocal.getAll('tareas').catch(() => [])) || [];
    const proyectos = (await dbLocal.getAll('proyectos').catch(() => [])) || [];

    // 1) Estado de las tareas (donut)
    const ESTADOS = [
      { key: 'pendiente', label: 'Pendiente', color: '#3b82f6' },
      { key: 'en-progreso', label: 'En progreso', color: '#f59e0b' },
      { key: 'completada', label: 'Completada', color: '#06b6d4' },
      { key: 'confirmada', label: 'Confirmada', color: '#22c55e' }
    ];
    const estadoCounts = ESTADOS.map(e => ({
      label: e.label,
      color: e.color,
      count: tareas.filter(t => (t.estado || 'pendiente') === e.key).length
    }));

    // 2) Prioridad del trabajo (donut)
    const PRIORIDADES = [
      { key: 'alta', label: 'Alta', color: '#ef4444' },
      { key: 'media', label: 'Media', color: '#f59e0b' },
      { key: 'baja', label: 'Baja', color: '#94a3b8' }
    ];
    const prioridadCounts = PRIORIDADES.map(p => ({
      label: p.label,
      color: p.color,
      count: tareas.filter(t => (t.prioridad || 'media') === p.key).length
    }));

    // 3) Carga por desarrollador (barras horizontales: tareas abiertas)
    const abiertas = tareas.filter(t => !t.estado || t.estado === 'pendiente' || t.estado === 'en-progreso');
    let cargaDev = perfiles.map(p => ({
      nombre: p.nombre,
      abiertas: abiertas.filter(t => t.asignado_a != null && t.asignado_a !== '' && Number(t.asignado_a) === Number(p.id)).length
    }));
    const sinAsignar = abiertas.filter(t => t.asignado_a == null || t.asignado_a === '').length;
    if (sinAsignar) cargaDev.push({ nombre: 'Sin asignar', abiertas: sinAsignar });
    cargaDev = cargaDev.sort((a, b) => b.abiertas - a.abiertas);

    // 4) Avance por proyecto (barras 100% apiladas: % tareas confirmadas)
    const avanceProy = [...proyectos]
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      .slice(0, 8)
      .map(p => {
        const tt = tareas.filter(t => Number(t.proyectoId ?? t.proyecto_id) === Number(p.id));
        const done = tt.filter(t => t.estado === 'confirmada').length;
        return { nombre: p.nombre, pct: tt.length ? Math.round((done / tt.length) * 100) : 0, total: tt.length };
      });

    // 5) Vencimientos próximos (semáforo: vencidas ≤ hoy+7 días)
    const hoy = dayjs().startOf('day');
    let vencimientos = [];
    const _addVenc = (item, fecha, tipo) => {
      if (!fecha) return;
      const f = dayjs(fecha);
      if (!f.isValid()) return;
      const dias = f.diff(hoy, 'day');
      if (dias > 7) return;
      vencimientos.push({
        id: tipo + item.id,
        nombre: item.nombre,
        tipo,
        fecha: f.format('DD/MM'),
        dias,
        estado: dias < 0 ? 'vencido' : (dias === 0 ? 'hoy' : 'proxima'),
        cuando: dias < 0 ? ('hace ' + Math.abs(dias) + (Math.abs(dias) === 1 ? ' día' : ' días')) : (dias === 0 ? 'hoy' : ('en ' + dias + (dias === 1 ? ' día' : ' días')))
      });
    };
    tareas.forEach(t => _addVenc(t, t.fecha_limite, 'Tarea'));
    proyectos.forEach(p => _addVenc(p, p.fecha_limite, 'Proyecto'));
    vencimientos = vencimientos.sort((a, b) => a.dias - b.dias).slice(0, 6);

    // 6) Evolución mensual (últimos 6 meses: proyectos y tareas creados)
    const evolucion = [];
    for (let i = 5; i >= 0; i--) {
      const m = dayjs().subtract(i, 'month');
      const key = m.format('YYYY-MM');
      evolucion.push({
        label: m.format('MMM'),
        proyectos: proyectos.filter(p => p.created_at && dayjs(p.created_at).format('YYYY-MM') === key).length,
        tareas: tareas.filter(t => t.created_at && dayjs(t.created_at).format('YYYY-MM') === key).length
      });
    }

    const J = (v) => JSON.stringify(v).replace(/"/g, '&quot;');
    return `
<div x-data="dashboardData(${J(perfilesData)}, ${J(categorias)}, ${adminCount}, ${J(estadoCounts)}, ${J(prioridadCounts)}, ${J(cargaDev)}, ${J(avanceProy)}, ${J(vencimientos)}, ${J(evolucion)})"
     x-init="initChart()">

  <!-- Header con contador -->
  <div class="flex items-center justify-between mb-6">
    <h2 class="text-xl font-semibold tracking-heading flex items-center gap-2">
      <i class="bi bi-speedometer2 text-accent"></i> Dashboard
    </h2>
    <p class="text-xs text-muted" x-text="perfiles.length + ' dev' + (perfiles.length !== 1 ? 's' : '') + ' registrados'"></p>
  </div>

  <!-- Stats cards — label a todo el ancho arriba (no se recorta en móvil), icono + valor abajo -->
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
    <div class="card bg-white">
      <div class="card-body p-4 sm:p-5">
        <p class="text-[11px] sm:text-xs font-medium uppercase tracking-wide text-muted stat-label-wrap mb-2">Developer</p>
        <div class="flex items-center gap-3">
          <div class="p-2 sm:p-2.5 rounded-lg shrink-0 bg-muted">
            <i class="bi bi-people-fill text-lg" style="color: var(--ink);"></i>
          </div>
          <p class="text-2xl font-bold tracking-tight" style="color: var(--ink);" x-text="perfiles.length"></p>
        </div>
      </div>
    </div>

    <div class="card bg-white">
      <div class="card-body p-4 sm:p-5">
        <p class="text-[11px] sm:text-xs font-medium uppercase tracking-wide text-muted stat-label-wrap mb-2">Habilidades</p>
        <div class="flex items-center gap-3">
          <div class="p-2 sm:p-2.5 rounded-lg shrink-0 bg-muted">
            <i class="bi bi-tools text-lg" style="color: var(--ink);"></i>
          </div>
          <p class="text-2xl font-bold tracking-tight" style="color: var(--ink);" x-text="Object.keys(categorias).reduce((a,b) => a + categorias[b], 0)"></p>
        </div>
      </div>
    </div>

    <div class="card bg-white">
      <div class="card-body p-4 sm:p-5">
        <p class="text-[11px] sm:text-xs font-medium uppercase tracking-wide text-muted stat-label-wrap mb-2">Categorías</p>
        <div class="flex items-center gap-3">
          <div class="p-2 sm:p-2.5 rounded-lg shrink-0 bg-muted">
            <i class="bi bi-tag-fill text-lg" style="color: var(--ink);"></i>
          </div>
          <p class="text-2xl font-bold tracking-tight" style="color: var(--ink);" x-text="Object.keys(categorias).length"></p>
        </div>
      </div>
    </div>

    <div class="card bg-white">
      <div class="card-body p-4 sm:p-5">
        <p class="text-[11px] sm:text-xs font-medium uppercase tracking-wide text-muted stat-label-wrap mb-2">Promedio Skills</p>
        <div class="flex items-center gap-3">
          <div class="p-2 sm:p-2.5 rounded-lg shrink-0 bg-muted">
            <i class="bi bi-graph-up text-lg" style="color: var(--ink);"></i>
          </div>
          <p class="text-2xl font-bold tracking-tight" style="color: var(--ink);" x-text="perfiles.length ? (perfiles.reduce((a,p) => a + p.skillCount, 0) / perfiles.length).toFixed(1) : '0'"></p>
        </div>
      </div>
    </div>
  </div>

  <!-- Proyectos widget -->
  <div class="card bg-white mb-6" x-data="{ proyectos: [], tareas: [], proyectoUsuarios: [] }" x-init="async() => { proyectos = await dbLocal.getAll('proyectos'); tareas = await dbLocal.getAll('tareas'); proyectoUsuarios = await dbLocal.getAll('proyecto_usuarios'); }">
    <div class="card-body p-5">
      <a href="#/proyectos" class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider mb-4 text-muted hover:text-accent transition-colors">
        <i class="bi bi-kanban text-accent"></i> Proyectos
        <i class="bi bi-arrow-right text-[10px] ml-auto"></i>
      </a>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="p-3 rounded-lg bg-muted/50">
          <p class="text-2xl font-bold tracking-tight text-accent" x-text="proyectos.filter(p => p.estado !== 'completado').length"></p>
          <p class="text-xs text-muted mt-0.5">Activos</p>
        </div>
        <div class="p-3 rounded-lg bg-muted/50">
          <p class="text-2xl font-bold tracking-tight text-error" x-text="proyectos.filter(p => p.fechaLimite && dayjs(p.fechaLimite).isBefore(dayjs(), 'day') && p.estado !== 'completado').length"></p>
          <p class="text-xs text-muted mt-0.5">Vencidos</p>
        </div>
        <div class="p-3 rounded-lg bg-muted/50">
          <p class="text-2xl font-bold tracking-tight text-warning" x-text="proyectos.filter(p => p.fechaLimite && dayjs(p.fechaLimite).diff(dayjs(), 'day') <= 3 && dayjs(p.fechaLimite).diff(dayjs(), 'day') >= 0 && p.estado !== 'completado').length"></p>
          <p class="text-xs text-muted mt-0.5">Próximos</p>
        </div>
        <template x-if="$store.auth.isAdmin">
          <div class="p-3 rounded-lg bg-muted/50">
            <p class="text-2xl font-bold tracking-tight" style="color: var(--ink)" x-text="tareas.filter(t => t.estado === 'pendiente' || t.estado === 'en-progreso').length"></p>
            <p class="text-xs text-muted mt-0.5">Tareas abiertas</p>
          </div>
        </template>
        <template x-if="!$store.auth.isAdmin">
          <div class="p-3 rounded-lg bg-muted/50">
            <p class="text-2xl font-bold tracking-tight" style="color: var(--ink)" x-text="tareas.filter(t => (t.estado === 'pendiente' || t.estado === 'en-progreso') && t.asignado_a == $store.auth.user?.perfilId).length"></p>
            <p class="text-xs text-muted mt-0.5">Mis tareas</p>
          </div>
        </template>
      </div>
    </div>
  </div>

  <!-- Backup manual (solo admin) -->
  <div x-show="$store.auth.isAdmin" class="card bg-white mb-6" x-data="{ open: false }">
    <div class="card-body p-5">
      <h3 class="text-xs font-semibold uppercase tracking-wider flex items-center gap-2 cursor-pointer select-none text-muted" @click="open = !open">
        <i class="bi bi-database-fill-gear text-accent"></i> Backup y Restauración
        <span class="ml-auto flex items-center gap-1">
          <span x-text="open ? 'ocultar' : 'mostrar'"></span>
          <i class="bi" :class="open ? 'bi-chevron-up' : 'bi-chevron-down'"></i>
        </span>
      </h3>
      <p class="text-xs mt-1 mb-4 text-faint">JSON, Excel o copia completa .sqlite — se descarga a la carpeta <strong>Descargas</strong> de tu dispositivo</p>
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
        <div class="divider my-4 text-xs text-faint">Backup completo (SQLite)</div>
        <div class="flex flex-wrap items-center gap-3">
          <button class="btn btn-ghost btn-sm gap-1.5 radius-sm" @click="exportarSQLite()">
            <i class="bi bi-database-down text-accent"></i> Descargar .sqlite
          </button>
          <label class="btn btn-ghost btn-sm cursor-pointer gap-1.5 radius-sm">
            <i class="bi bi-database-up"></i> Restaurar .sqlite
            <input type="file" accept=".sqlite,.db,application/octet-stream" class="hidden" @change="importarSQLite($event)">
          </label>
          <span class="text-xs text-faint">Copia exacta de la base de datos completa</span>
        </div>
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

  <!-- Gráficas informativas (proyectos, tareas, fechas) -->
  <div class="mb-6 space-y-6">
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- 1) Estado de las tareas -->
      <div class="card bg-white">
        <div class="card-body p-5">
          <h3 class="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2 text-muted">
            <i class="bi bi-pie-chart-fill text-accent"></i> Estado de las tareas
          </h3>
          <div id="estado-chart" style="min-height: 250px;" role="img" aria-label="Gráfico de donut con el estado de las tareas"></div>
        </div>
      </div>

      <!-- 2) Prioridad del trabajo -->
      <div class="card bg-white">
        <div class="card-body p-5">
          <h3 class="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2 text-muted">
            <i class="bi bi-exclamation-triangle-fill text-accent"></i> Prioridad del trabajo
          </h3>
          <div id="prioridad-chart" style="min-height: 250px;" role="img" aria-label="Gráfico de donut con la prioridad de las tareas"></div>
        </div>
      </div>

      <!-- 3) Carga por desarrollador -->
      <div class="card bg-white">
        <div class="card-body p-5">
          <h3 class="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2 text-muted">
            <i class="bi bi-person-lines-fill text-accent"></i> Carga por desarrollador
            <span class="badge badge-ghost badge-xs radius-sm ml-auto">tareas abiertas</span>
          </h3>
          <div id="carga-chart" style="min-height: 250px;" role="img" aria-label="Barras con las tareas abiertas por desarrollador"></div>
        </div>
      </div>

      <!-- 6) Evolución mensual -->
      <div class="card bg-white">
        <div class="card-body p-5">
          <h3 class="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2 text-muted">
            <i class="bi bi-graph-up-arrow text-accent"></i> Evolución mensual
            <span class="badge badge-ghost badge-xs radius-sm ml-auto">últimos 6 meses</span>
          </h3>
          <div id="evolucion-chart" style="min-height: 250px;" role="img" aria-label="Gráfico de área con proyectos y tareas creados por mes"></div>
        </div>
      </div>
    </div>

    <!-- 4) Avance por proyecto (ancho completo) -->
    <div class="card bg-white">
      <div class="card-body p-5">
        <h3 class="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2 text-muted">
          <i class="bi bi-bar-chart-line-fill text-accent"></i> Avance por proyecto
          <span class="badge badge-ghost badge-xs radius-sm ml-auto">% tareas confirmadas</span>
        </h3>
        <div id="avance-chart" style="min-height: 200px;" role="img" aria-label="Barras apiladas de avance por proyecto"></div>
      </div>
    </div>

    <!-- 5) Vencimientos próximos (semáforo) -->
    <div class="card bg-white">
      <div class="card-body p-5">
        <h3 class="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2 text-muted">
          <i class="bi bi-calendar-event-fill text-accent"></i> Vencimientos próximos
          <span class="badge badge-ghost badge-xs radius-sm ml-auto">≤ 7 días</span>
        </h3>

        <template x-if="!vencimientos.length">
          <div class="text-center py-6 text-sm text-muted">
            <i class="bi bi-calendar-check text-2xl block mb-1" style="color: var(--ink-faint);"></i>
            Sin fechas límite en los próximos 7 días
          </div>
        </template>

        <div class="space-y-2" x-show="vencimientos.length">
          <template x-for="v in vencimientos" :key="v.id">
            <div class="flex items-center gap-3 p-3 rounded-lg border border-default"
                 :style="v.estado === 'vencido' ? 'background:#fef2f2' : (v.estado === 'hoy' ? 'background:#fffbeb' : 'background:#f0fdf4')">
              <span class="status-dot" :class="v.estado === 'vencido' ? 'status-dot-error' : (v.estado === 'hoy' ? 'status-dot-warning' : 'status-dot-success')"></span>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium truncate" x-text="v.nombre"></p>
                <p class="text-xs text-muted" x-text="v.tipo + ' · ' + v.cuando"></p>
              </div>
              <span class="badge badge-sm shrink-0"
                    :class="v.estado === 'vencido' ? 'badge-error' : (v.estado === 'hoy' ? 'badge-warning' : 'badge-success')"
                    x-text="v.fecha"></span>
            </div>
          </template>
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

      <div class="overflow-x-auto hidden md:block" x-show="filtered.length > 0">
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

      <!-- Equipo: tarjetas en móvil (la tabla se oculta en pantallas < md) -->
      <div class="space-y-3 md:hidden" x-show="filtered.length > 0">
        <template x-for="(dev, index) in filtered" :key="'m-' + dev.id">
          <div class="border border-default rounded-lg p-4 stagger-enter" :style="'animation-delay: ' + (index * 40) + 'ms'">
            <div class="flex items-center gap-3">
              <div class="avatar shrink-0">
                <div class="rounded-full w-11 h-11 overflow-hidden bg-muted">
                  <template x-if="dev.fotoBase64">
                    <img :src="dev.fotoBase64" :alt="dev.nombre" class="w-full h-full object-cover">
                  </template>
                  <template x-if="!dev.fotoBase64">
                    <div class="w-full h-full flex items-center justify-center text-muted">
                      <span x-text="dev.nombre.charAt(0).toUpperCase()" class="text-sm font-semibold"></span>
                    </div>
                  </template>
                </div>
              </div>
              <div class="flex-1 min-w-0">
                <p class="font-medium text-sm truncate" x-text="dev.nombre"></p>
                <p class="text-xs text-faint truncate" x-text="dev.cargo"></p>
              </div>
              <span class="badge badge-sm shrink-0"
                    :class="dev.rol === 'admin' ? 'badge-accent' : 'badge-ghost'"
                    x-text="dev.rol === 'admin' ? 'Admin' : 'Dev'"></span>
            </div>
            <div class="flex flex-wrap gap-1 mt-3" x-show="dev.skills.length">
              <template x-for="skill in dev.skills.slice(0, 5)" :key="skill">
                <span class="badge badge-sm radius-sm" x-text="skill"></span>
              </template>
              <span x-show="dev.skills.length > 5" class="badge badge-sm badge-ghost radius-sm" x-text="'+' + (dev.skills.length - 5)"></span>
            </div>
            <div class="flex justify-end gap-2 mt-3 pt-3 border-t border-default">
              <button class="btn btn-ghost btn-sm gap-1.5 radius-sm" @click="verCV(dev.id)">
                <i class="bi bi-file-earmark-richtext"></i> Ver CV
              </button>
              <button x-show="$store.auth.isAdmin || $store.auth.user?.perfilId === dev.id" class="btn btn-ghost btn-sm gap-1.5 radius-sm" @click="editarPerfil(dev.id)">
                <i class="bi bi-pencil"></i> Editar
              </button>
            </div>
          </div>
        </template>
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
function dashboardData(perfiles, categorias, adminCount, estadoCounts, prioridadCounts, cargaDev, avanceProy, vencimientos, evolucion) {
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
    categorias,
    catList,
    catColors,
    adminCount,
    // Nuevas gráficas
    estadoCounts,
    prioridadCounts,
    cargaDev,
    avanceProy,
    vencimientos,
    evolucion,

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
            email: p.email || '',
            telefono: p.telefono || ''
          })),
          habilidades,
          relaciones,
          usuarios: usuarios.map(u => ({
            ...u,
            email: u.email || ''
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
            'DNI': p.dni || '',
            'Email': p.email || '',
            'Teléfono': p.telefono || '',
            'Dirección': p.direccion || '',
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
            email: p.email || '',
            telefono: p.telefono || '',
            created_at: p.created_at ? new Date(p.created_at) : new Date(),
            updated_at: p.updated_at ? new Date(p.updated_at) : new Date()
          };
          await dbOnline.add('perfiles', registro);
        }

        // 💡 Reconstruir relaciones
        const perfilesNuevos = await dbLocal.getAll('perfiles');
        const habilidadesNuevas = await dbLocal.getAll('habilidades');

        for (const rel of (data.relaciones || [])) {
          const perfil = perfilesNuevos.find(p => p.email === (data.perfiles.find(dp => dp.id === rel.perfil_id)?.email || ''));
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
            email: u.email || '',
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
        if (typeof ApexCharts === 'undefined') return;

        const placeholder = (icono, msg) =>
          '<div class="flex flex-col items-center justify-center text-center py-8 gap-2" style="min-height: 220px;">' +
          '<i class="bi ' + icono + ' text-3xl" style="color: var(--ink-faint);"></i>' +
          '<p class="text-sm text-muted">' + msg + '</p></div>';

        const montar = (sel, opts, hayDatos, icono, msg) => {
          const el = document.querySelector(sel);
          if (!el) return;
          if (!hayDatos) { el.innerHTML = placeholder(icono, msg); return; }
          const c = new ApexCharts(el, opts);
          c.render();
          window._dashboardCharts.push(c);
        };

        // 1) Estado de las tareas (donut)
        const estado = this.estadoCounts.filter(e => e.count > 0);
        montar('#estado-chart', {
          chart: { type: 'donut', height: 250, animations: { enabled: false } },
          series: estado.map(e => e.count),
          labels: estado.map(e => e.label),
          colors: estado.map(e => e.color),
          stroke: { width: 0 },
          legend: { position: 'bottom', labels: { colors: '#64748b' } },
          dataLabels: { style: { fontSize: '11px' } },
          tooltip: { theme: 'light', y: { formatter: v => v + (v === 1 ? ' tarea' : ' tareas') } }
        }, estado.length, 'bi-inbox', 'Sin tareas registradas');

        // 2) Prioridad del trabajo (donut)
        const prio = this.prioridadCounts.filter(p => p.count > 0);
        montar('#prioridad-chart', {
          chart: { type: 'donut', height: 250, animations: { enabled: false } },
          series: prio.map(p => p.count),
          labels: prio.map(p => p.label),
          colors: prio.map(p => p.color),
          stroke: { width: 0 },
          legend: { position: 'bottom', labels: { colors: '#64748b' } },
          dataLabels: { style: { fontSize: '11px' } },
          tooltip: { theme: 'light', y: { formatter: v => v + (v === 1 ? ' tarea' : ' tareas') } }
        }, prio.length, 'bi-exclamation-circle', 'Sin tareas con prioridad');

        // 3) Carga por desarrollador (barras verticales — ejes enteros)
        const carga = this.cargaDev.filter(c => c.abiertas > 0);
        const maxCarga = Math.max(...carga.map(c => c.abiertas), 1);
        montar('#carga-chart', {
          chart: { type: 'bar', height: 250, toolbar: { show: false }, animations: { enabled: false } },
          series: [{ name: 'Tareas abiertas', data: carga.map(c => c.abiertas) }],
          xaxis: {
            categories: carga.map(c => c.nombre),
            labels: { rotate: -40, hideOverlappingLabels: true, style: { fontSize: '11px' } }
          },
          yaxis: {
            min: 0,
            max: maxCarga,
            tickAmount: Math.max(2, maxCarga),
            labels: { formatter: v => Number.isInteger(v) ? v : '', style: { fontSize: '11px' } }
          },
          colors: ['#15803d'],
          plotOptions: { bar: { borderRadius: 4, columnWidth: '55%' } },
          dataLabels: { enabled: true, style: { fontSize: '11px', fontWeight: 600 } },
          legend: { show: false },
          grid: { borderColor: 'rgba(0,0,0,0.04)' },
          tooltip: { theme: 'light' }
        }, carga.length, 'bi-people', 'Sin tareas abiertas');

        // 4) Avance por proyecto (barras verticales 100% apiladas)
        const av = this.avanceProy;
        montar('#avance-chart', {
          chart: { type: 'bar', height: Math.max(240, av.length * 34 + 90), stacked: true, stackType: '100%', toolbar: { show: false }, animations: { enabled: false } },
          series: [
            { name: 'Confirmadas', data: av.map(a => a.pct) },
            { name: 'Resto', data: av.map(a => 100 - a.pct) }
          ],
          colors: ['#22c55e', '#e2e5e9'],
          plotOptions: { bar: { borderRadius: 3, columnWidth: '60%' } },
          xaxis: {
            categories: av.map(a => (a.nombre.length > 14 ? a.nombre.slice(0, 13) + '…' : a.nombre)),
            labels: { rotate: -40, hideOverlappingLabels: true, style: { fontSize: '11px' } }
          },
          yaxis: { max: 100, tickAmount: 4, labels: { formatter: v => Math.round(v) + '%', style: { fontSize: '10px' } } },
          dataLabels: {
            enabled: true,
            formatter: (v, ctx) => (ctx.seriesIndex === 0 && v > 0) ? Math.round(v) + '%' : '',
            style: { fontSize: '10px', fontWeight: 600 },
            dropShadow: { enabled: false }
          },
          legend: { position: 'bottom', labels: { colors: '#64748b' } },
          grid: { borderColor: 'rgba(0,0,0,0.04)' },
          tooltip: { theme: 'light', y: { formatter: v => Math.round(v) + '%' } }
        }, av.length, 'bi-folder', 'Sin proyectos creados');

        // 5) Evolución mensual (área: proyectos y tareas creados por mes)
        const ev = this.evolucion;
        const totalEv = ev.reduce((s, m) => s + m.proyectos + m.tareas, 0);
        montar('#evolucion-chart', {
          chart: { type: 'area', height: 250, toolbar: { show: false }, animations: { enabled: false } },
          series: [
            { name: 'Proyectos', data: ev.map(m => m.proyectos) },
            { name: 'Tareas', data: ev.map(m => m.tareas) }
          ],
          colors: ['#15803d', '#3b82f6'],
          xaxis: { categories: ev.map(m => m.label), labels: { style: { fontSize: '11px' } } },
          yaxis: { min: 0, tickAmount: 4, labels: { formatter: v => Number.isInteger(v) ? v : '', style: { fontSize: '11px' } } },
          stroke: { curve: 'smooth', width: 2 },
          fill: { type: 'opacity', opacity: 0.15 },
          dataLabels: { enabled: false },
          legend: { position: 'bottom', labels: { colors: '#64748b' } },
          grid: { borderColor: 'rgba(0,0,0,0.04)' },
          tooltip: { theme: 'light' }
        }, totalEv > 0, 'bi-graph-up', 'Sin actividad en los últimos 6 meses');
      }, 100);
    },

    // 💡 Sync state (simplificado — Realtime es automático)
    syncing: false,

    get syncStatus() {
      const store = Alpine.store('supabase');
      return store ? store.status : 'disconnected';
    },

    get isOfflineMode() { return !!window.DB_OFFLINE_SQLITE; },

    get storageLabel() {
      const src = (window.dbSQLite && dbSQLite._storageSource) || 'nuevo';
      if (src === 'electron') return 'Archivo .sqlite en tu equipo';
      if (src === 'indexeddb') {
        const nativo = window.Capacitor && typeof Capacitor.isNativePlatform === 'function' && Capacitor.isNativePlatform();
        return nativo ? 'Almacenamiento del dispositivo' : 'Persistencia del navegador';
      }
      return 'SQLite local';
    },

    get onlineLabel() {
      if (this.isOfflineMode) return this.storageLabel;
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
