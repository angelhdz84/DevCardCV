// modules/proyectos/module.js — Gestión de proyectos y tareas
const PROYECTOS = {
  id: 'proyectos',
  titulo: 'Proyectos',
  icono: 'bi bi-kanban',

  async init() {
    console.log('💡 [proyectos] Inicializado');
  },

  async render(params = {}) {
    const ruta = params.params || [];
    const vista = ruta.length === 0 ? 'list' : ruta[0] === 'nuevo' ? 'create' : 'detail';
    const proyectoId = vista === 'detail' ? parseInt(ruta[0]) : null;

    const [proyectos, tareas, proyectoUsuarios, equipos] = await Promise.all([
      db.proyectos.toArray().catch(() => []),
      db.tareas.toArray().catch(() => []),
      db.proyecto_usuarios.toArray().catch(() => []),
      db.equipos.toArray().catch(() => [])
    ]);

    const perfiles = await db.perfiles.toArray().catch(() => []);

    return `
<div x-data="proyectosData(${JSON.stringify({ vista, proyectoId, proyectos, tareas, proyectoUsuarios, equipos, perfiles }).replace(/"/g, '&quot;')})"
     x-init="init()" class="animate__animated animate__fadeIn">

  <!-- Lista de proyectos -->
  <div x-show="view === 'list'" x-cloak>
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
      <div>
        <h2 class="text-xl font-semibold tracking-heading flex items-center gap-2">
          <i class="bi bi-kanban text-accent"></i> Proyectos
        </h2>
        <p class="text-xs text-muted mt-1" x-text="proyectos.length + ' proyectos'"></p>
      </div>
      <button x-show="$store.auth.isAdmin" class="btn btn-primary btn-magnetic btn-sm radius-md" @click="view = 'create'; form = { nombre: '', descripcion: '', prioridad: 'media', fecha_limite: '', notas_admin: '' }; formTareas = []; formAsignados = []">
        <i class="bi bi-plus-lg"></i> Nuevo proyecto
      </button>
    </div>

    <!-- Filtros -->
    <div class="flex flex-wrap gap-2 mb-4" x-show="filteredProyectos.length || filterPrioridad || filterEstado">
      <select x-model="filterPrioridad" class="select select-bordered select-xs radius-sm">
        <option value="">Todas prioridades</option>
        <option value="baja">Baja</option>
        <option value="media">Media</option>
        <option value="alta">Alta</option>
      </select>
      <select x-model="filterEstado" class="select select-bordered select-xs radius-sm">
        <option value="">Todos estados</option>
        <option value="abierto">Abierto</option>
        <option value="en-progreso">En progreso</option>
        <option value="completado">Completado</option>
      </select>
    </div>

    <!-- Tabla -->
    <div class="overflow-x-auto rounded-lg border-default" x-show="filteredProyectos.length">
      <table class="table table-sm w-full">
        <thead>
          <tr class="bg-muted">
            <th>Proyecto</th>
            <th class="hidden sm:table-cell">Prioridad</th>
            <th>Estado</th>
            <th class="hidden md:table-cell">Fecha límite</th>
            <th>Avance</th>
            <th class="hidden lg:table-cell">Responsables</th>
            <th x-show="$store.auth.isAdmin"></th>
          </tr>
        </thead>
        <tbody>
          <template x-for="p in filteredProyectos" :key="p.id">
            <tr class="stagger-enter cursor-pointer hover:bg-muted/50" :style="'animation-delay: ' + (filteredProyectos.indexOf(p) * 0.03) + 's'" @click="cargarProyecto(p.id)">
              <td class="font-medium">
                <span x-text="p.nombre" class="text-sm"></span>
                <span x-show="p.descripcion" class="text-xs text-muted block truncate max-w-[200px]" x-text="p.descripcion"></span>
              </td>
              <td class="hidden sm:table-cell">
                <span class="badge badge-sm" :class="p.prioridad === 'alta' ? 'badge-error' : p.prioridad === 'media' ? 'badge-warning' : 'badge-ghost'" x-text="p.prioridad"></span>
              </td>
              <td>
                <span class="badge badge-sm" :class="p.estado === 'completado' ? 'badge-success' : p.estado === 'en-progreso' ? 'badge-info' : 'badge-ghost'" x-text="p.estado"></span>
              </td>
              <td class="hidden md:table-cell text-xs" :class="p.fechaLimite && dayjs(p.fechaLimite).isBefore(dayjs(), 'day') ? 'text-error font-medium' : dayjs(p.fechaLimite).diff(dayjs(), 'day') <= 3 && dayjs(p.fechaLimite).diff(dayjs(), 'day') >= 0 ? 'text-warning font-medium' : 'text-muted'">
                <span x-show="p.fechaLimite" x-text="dayjs(p.fechaLimite).format('DD/MM/YYYY')"></span>
                <span x-show="!p.fechaLimite" class="text-faint">—</span>
              </td>
              <td>
                <div class="flex items-center gap-2">
                  <progress class="progress progress-accent w-16 h-2" :value="avanceProyecto(p.id)" max="100"></progress>
                  <span class="text-xs font-medium" x-text="avanceProyecto(p.id) + '%'"></span>
                </div>
              </td>
              <td class="hidden lg:table-cell">
                <div class="flex -space-x-2">
                  <template x-for="pu in proyectoUsuarios.filter(u => u.proyectoId === p.id).slice(0, 3)" :key="pu.id">
                    <div class="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-[10px] font-medium text-accent border-2 border-white" x-text="(perfiles.find(r => r.id === pu.perfilId)?.nombre || '?').charAt(0).toUpperCase()"></div>
                  </template>
                  <span x-show="proyectoUsuarios.filter(u => u.proyectoId === p.id).length > 3" class="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] text-muted border-2 border-white" x-text="'+' + (proyectoUsuarios.filter(u => u.proyectoId === p.id).length - 3)"></span>
                </div>
              </td>
              <td x-show="$store.auth.isAdmin">
                <button class="btn btn-ghost btn-xs btn-square" @click.stop="eliminarProyecto(p.id)" title="Eliminar proyecto" aria-label="Eliminar proyecto">
                  <i class="bi bi-trash text-muted hover:text-error"></i>
                </button>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <!-- Empty state -->
    <div x-show="!filteredProyectos.length" class="text-center py-12">
      <i class="bi bi-kanban text-5xl text-muted/30"></i>
      <p class="text-sm text-muted mt-3" x-text="filterPrioridad || filterEstado ? 'No hay proyectos con esos filtros' : ($store.auth.isAdmin ? 'Crea tu primer proyecto' : 'No tienes proyectos asignados')"></p>
    </div>
  </div>

  <!-- Crear proyecto -->
  <div x-show="view === 'create'" x-cloak>
    <button class="btn btn-ghost btn-sm gap-1 mb-4 radius-md" @click="view = 'list'">
      <i class="bi bi-arrow-left"></i> Volver
    </button>
    <div class="card bg-white">
      <div class="card-body p-6">
        <h3 class="section-label mb-4 flex items-center gap-2">
          <i class="bi bi-plus-circle text-accent"></i> Nuevo proyecto
        </h3>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <label class="form-control">
            <span class="label-text text-xs font-medium text-muted mb-1">Nombre del proyecto *</span>
            <input type="text" x-model="form.nombre" class="input input-bordered input-sm radius-sm" placeholder="Ej: Rediseño dashboard">
          </label>
          <label class="form-control">
            <span class="label-text text-xs font-medium text-muted mb-1">Prioridad</span>
            <select x-model="form.prioridad" class="select select-bordered select-sm radius-sm">
              <option value="baja">Baja</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
            </select>
          </label>
          <label class="form-control">
            <span class="label-text text-xs font-medium text-muted mb-1">Fecha límite (opcional)</span>
            <input type="date" x-model="form.fecha_limite" class="input input-bordered input-sm radius-sm">
          </label>
          <label class="form-control" x-show="$store.auth.isAdmin">
            <span class="label-text text-xs font-medium text-muted mb-1">Notas del admin</span>
            <input type="text" x-model="form.notas_admin" class="input input-bordered input-sm radius-sm" placeholder="Notas internas">
          </label>
        </div>

        <label class="form-control mb-4">
          <span class="label-text text-xs font-medium text-muted mb-1">Descripción</span>
          <textarea x-model="form.descripcion" class="textarea textarea-bordered textarea-sm radius-sm" rows="2" placeholder="Breve descripción del proyecto"></textarea>
        </label>

        <!-- Tareas -->
        <div class="mb-4">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-medium text-muted">Tareas</span>
            <button class="btn btn-ghost btn-xs gap-1" @click="formTareas.push({ nombre: '', descripcion: '' })">
              <i class="bi bi-plus-lg text-xs"></i> Agregar tarea
            </button>
          </div>
          <template x-for="(t, i) in formTareas" :key="i">
            <div class="flex items-start gap-2 mb-2">
              <div class="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input type="text" x-model="t.nombre" class="input input-bordered input-xs radius-sm" placeholder="Nombre de la tarea">
                <input type="text" x-model="t.descripcion" class="input input-bordered input-xs radius-sm" placeholder="Descripción (opcional)">
              </div>
              <button class="btn btn-ghost btn-xs btn-square mt-0.5" @click="formTareas.splice(i, 1)" title="Quitar tarea">
                <i class="bi bi-x text-muted hover:text-error"></i>
              </button>
            </div>
          </template>
        </div>

        <!-- Asignar desarrolladores -->
        <div class="mb-6">
          <span class="text-xs font-medium text-muted mb-2 block">Asignar a desarrolladores</span>
          <div class="flex flex-wrap gap-2">
            <template x-for="perfil in perfiles" :key="perfil.id">
              <label class="flex items-center gap-1.5 cursor-pointer px-2.5 py-1.5 rounded-md border-default text-xs hover:bg-muted/50 transition-spring"
                     :class="formAsignados.includes(perfil.id) ? 'border-accent bg-accent/5' : ''">
                <input type="checkbox" :value="perfil.id" x-model="formAsignados" class="checkbox checkbox-xs checkbox-accent">
                <span x-text="perfil.nombre"></span>
              </label>
            </template>
          </div>
          <p x-show="!perfiles.length" class="text-xs text-muted mt-1">No hay desarrolladores registrados</p>
        </div>

        <div class="flex gap-2">
          <button class="btn btn-primary btn-sm radius-md" @click="guardarProyecto()" :disabled="!form.nombre || !formAsignados.length || guardando">
            <i class="bi bi-check-lg"></i>
            <span x-show="!guardando">Crear proyecto</span>
            <span x-show="guardando" class="loading loading-spinner loading-xs"></span>
          </button>
          <button class="btn btn-ghost btn-sm radius-md" @click="view = 'list'">Cancelar</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Detalle del proyecto -->
  <div x-show="view === 'detail'" x-cloak>
    <button class="btn btn-ghost btn-sm gap-1 mb-4 radius-md" @click="view = 'list'; currentProyecto = null">
      <i class="bi bi-arrow-left"></i> Volver
    </button>

    <template x-if="currentProyecto"><div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Info proyecto -->
      <div class="lg:col-span-2">
        <div class="card bg-white">
          <div class="card-body p-6">
            <div class="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <h3 class="text-lg font-semibold tracking-heading flex items-center gap-2" x-text="currentProyecto.nombre"></h3>
                <p class="text-sm text-muted mt-1" x-show="currentProyecto.descripcion" x-text="currentProyecto.descripcion"></p>
              </div>
              <div class="flex items-center gap-2">
                <span class="badge" :class="currentProyecto.prioridad === 'alta' ? 'badge-error' : currentProyecto.prioridad === 'media' ? 'badge-warning' : 'badge-ghost'" x-text="'Prioridad: ' + currentProyecto.prioridad"></span>
                <span class="badge" :class="currentProyecto.estado === 'completado' ? 'badge-success' : currentProyecto.estado === 'en-progreso' ? 'badge-info' : 'badge-ghost'" x-text="currentProyecto.estado"></span>
              </div>
            </div>

            <div class="flex flex-wrap gap-4 text-xs text-muted mb-4">
              <span x-show="currentProyecto.fechaLimite" :class="dayjs(currentProyecto.fechaLimite).isBefore(dayjs(), 'day') ? 'text-error font-medium' : ''">
                <i class="bi bi-calendar3"></i> Límite: <span x-text="dayjs(currentProyecto.fechaLimite).format('DD/MM/YYYY')"></span>
              </span>
              <span><i class="bi bi-people"></i> <span x-text="currentMiembros.length + ' responsable(s)'"></span></span>
            </div>

            <!-- Barra de progreso -->
            <div class="mb-6">
              <div class="flex items-center justify-between text-xs text-muted mb-1">
                <span>Progreso</span>
                <span x-text="avanceProyecto(currentProyecto.id) + '%'"></span>
              </div>
              <progress class="progress progress-accent w-full h-3" :value="avanceProyecto(currentProyecto.id)" max="100"></progress>
            </div>

            <!-- Tareas -->
            <div>
              <div class="flex items-center justify-between mb-3">
                <h4 class="text-sm font-semibold flex items-center gap-1.5">
                  <i class="bi bi-check2-square text-accent"></i> Tareas
                  <span class="badge badge-sm badge-ghost" x-text="currentTareas.length"></span>
                </h4>
                <button x-show="$store.auth.isAdmin" class="btn btn-ghost btn-xs gap-1" @click="agregarTarea(currentProyecto.id)">
                  <i class="bi bi-plus-lg"></i> Agregar
                </button>
              </div>

              <div x-show="!currentTareas.length" class="text-center py-6 text-sm text-muted">
                <i class="bi bi-inbox text-2xl block mb-1 text-muted/30"></i>
                No hay tareas definidas
              </div>

              <template x-for="t in currentTareas" :key="t.id">
                <div class="flex items-start gap-3 py-2.5 border-b-default last:border-b-0">
                  <div class="pt-0.5">
                    <!-- Checkbox cambia estado según rol -->
                    <template x-if="$store.auth.isAdmin">
                      <input type="checkbox" class="checkbox checkbox-sm checkbox-accent"
                             :checked="t.estado === 'completada' || t.estado === 'confirmada'"
                             :disabled="t.estado === 'confirmada'"
                             @click="cambiarEstadoTarea(t)">
                    </template>
                    <template x-if="!$store.auth.isAdmin">
                      <input type="checkbox" class="checkbox checkbox-sm checkbox-accent"
                             :checked="t.estado === 'completada' || t.estado === 'confirmada' || t.estado === 'en-progreso'"
                             :disabled="t.estado === 'confirmada'"
                             @click="cambiarEstadoTarea(t)">
                    </template>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-medium" :class="t.estado === 'confirmada' ? 'line-through text-muted' : ''" x-text="t.nombre"></span>
                      <span class="badge badge-xs" :class="t.estado === 'confirmada' ? 'badge-success' : t.estado === 'completada' ? 'badge-info' : t.estado === 'en-progreso' ? 'badge-warning' : 'badge-ghost'" x-text="t.estado"></span>
                    </div>
                    <p x-show="t.descripcion" class="text-xs text-muted mt-0.5" x-text="t.descripcion"></p>
                    <!-- Comentario del Dev -->
                    <div x-show="t.estado !== 'pendiente' && t.estado !== 'confirmada'" class="mt-1.5 flex items-center gap-1.5">
                      <input type="text" x-model="t.comentario_dev" class="input input-xs input-bordered radius-sm flex-1" placeholder="Agregar comentario..." @keydown.enter="guardarComentario(t)">
                      <button class="btn btn-ghost btn-xs btn-square" @click="guardarComentario(t)" title="Guardar comentario">
                        <i class="bi bi-check text-xs"></i>
                      </button>
                    </div>
                    <!-- Admin: confirmar -->
                    <div x-show="$store.auth.isAdmin && t.estado === 'completada'" class="mt-1.5">
                      <button class="btn btn-primary btn-xs gap-1 radius-sm" @click="confirmarTarea(t)">
                        <i class="bi bi-check2-all"></i> Confirmar
                      </button>
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>

      <!-- Panel lateral -->
      <div class="space-y-3">
        <!-- Miembros -->
        <div class="card bg-white">
          <div class="card-body p-4">
            <h4 class="section-label mb-3 flex items-center gap-2">
              <i class="bi bi-people text-accent"></i> Miembros
            </h4>
            <div class="space-y-2">
              <template x-for="miembro in currentMiembros" :key="miembro.id">
                <div class="flex items-center gap-2 text-sm">
                  <div class="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-[10px] font-medium text-accent" x-text="miembro.nombre.charAt(0).toUpperCase()"></div>
                  <span x-text="miembro.nombre"></span>
                </div>
              </template>
            </div>
            <button x-show="$store.auth.isAdmin" class="btn btn-ghost btn-xs w-full mt-3 gap-1" @click="agregarMiembro(currentProyecto.id)">
              <i class="bi bi-plus"></i> Agregar miembro
            </button>
          </div>
        </div>

        <!-- Cerrar proyecto -->
        <div x-show="$store.auth.isAdmin && currentProyecto.estado !== 'completado'" class="card bg-white">
          <div class="card-body p-4">
            <button class="btn btn-ghost btn-sm w-full radius-md border-default gap-1.5" @click="cerrarProyecto(currentProyecto.id)">
              <i class="bi bi-check2-circle text-accent"></i> Cerrar proyecto
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
`;
  },

  destroy() {
    console.log('💡 [proyectos] Destruído');
  }
};

// ── Alpine Component ──
function proyectosData(initial) {
  return {
    view: initial.vista || 'list',
    proyectoId: initial.proyectoId || null,
    proyectos: initial.proyectos || [],
    tareas: initial.tareas || [],
    proyectoUsuarios: initial.proyectoUsuarios || [],
    equipos: initial.equipos || [],
    perfiles: initial.perfiles || [],
    currentProyecto: null,
    currentTareas: [],
    currentMiembros: [],
    filterPrioridad: '',
    filterEstado: '',
    form: { nombre: '', descripcion: '', prioridad: 'media', fecha_limite: '', notas_admin: '' },
    formTareas: [],
    formAsignados: [],
    guardando: false,

    async init() {
      if (this.proyectoId) await this.cargarProyecto(this.proyectoId);
    },

    async cargarDatos() {
      this.proyectos = await db.proyectos.toArray().catch(() => []);
      this.tareas = await db.tareas.toArray().catch(() => []);
      this.proyectoUsuarios = await db.proyecto_usuarios.toArray().catch(() => []);
      this.equipos = await db.equipos.toArray().catch(() => []);
      this.perfiles = await db.perfiles.toArray().catch(() => []);
    },

    get filteredProyectos() {
      let lista = this.proyectos;
      if (!this.$store.auth.isAdmin) {
        const miId = this.$store.auth.user?.perfilId;
        const misIds = this.proyectoUsuarios.filter(u => u.perfilId == miId).map(u => u.proyectoId);
        lista = lista.filter(p => misIds.includes(p.id));
      }
      if (this.filterPrioridad) lista = lista.filter(p => p.prioridad === this.filterPrioridad);
      if (this.filterEstado) lista = lista.filter(p => p.estado === this.filterEstado);
      return lista.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    },

    avanceProyecto(proyectoId) {
      const tareasProy = this.tareas.filter(t => t.proyectoId === proyectoId);
      if (!tareasProy.length) return 0;
      const confirmadas = tareasProy.filter(t => t.estado === 'confirmada').length;
      return Math.round((confirmadas / tareasProy.length) * 100);
    },

    async cargarProyecto(id) {
      this.currentProyecto = this.proyectos.find(p => p.id === id);
      if (!this.currentProyecto) {
        UI.toast('Proyecto no encontrado', 'error');
        this.view = 'list';
        return;
      }
      this.currentTareas = this.tareas.filter(t => t.proyectoId === id);
      const miembroIds = this.proyectoUsuarios.filter(u => u.proyectoId === id).map(u => u.perfilId);
      this.currentMiembros = this.perfiles.filter(p => miembroIds.includes(p.id));

      // Refresh desde Supabase si hay conexión
      if (navigator.onLine) {
        try {
          const supTareas = await dbLocal.getWhere('tareas', 'proyecto_id', id);
          if (supTareas && supTareas.length) {
            this.currentTareas = supTareas;
            for (const t of supTareas) await db.tareas.put(t).catch(() => {});
            this.tareas = await db.tareas.toArray().catch(() => []);
          }
        } catch (_) {}
      }
      this.view = 'detail';
    },

    async guardarProyecto() {
      if (!this.form.nombre || !this.formAsignados.length) {
        UI.toast('Debes ingresar nombre y asignar al menos un desarrollador', 'warning');
        return;
      }
      this.guardando = true;
      try {
        const proyectoData = {
          nombre: this.form.nombre,
          descripcion: this.form.descripcion || '',
          prioridad: this.form.prioridad || 'media',
          estado: 'abierto',
          fecha_limite: this.form.fecha_limite || null,
          notas_admin: this.form.notas_admin ? cryptoHelpers.encrypt(this.form.notas_admin) : '',
          creado_por: this.$store.auth.user?.perfilId || null,
          created_at: new Date(),
          updated_at: new Date()
        };

        let proyecto;
        try {
          proyecto = await dbOnline.add('proyectos', proyectoData);
        } catch (_) {
          proyecto = await db.proyectos.add(proyectoData);
          UI.toast('Sin conexión — proyecto guardado localmente', 'warning');
        }

        // Crear tareas
        for (const t of this.formTareas) {
          if (!t.nombre) continue;
          const tareaData = {
            proyecto_id: proyecto.id || proyecto,
            nombre: t.nombre,
            descripcion: t.descripcion || '',
            estado: 'pendiente',
            created_at: new Date(),
            updated_at: new Date()
          };
          try {
            if (proyecto.id) {
              // vino de dbOnline, tiene id real
              await dbOnline.add('tareas', { ...tareaData, proyecto_id: proyecto.id });
            } else {
              await db.tareas.add(tareaData);
            }
          } catch (_) {
            await db.tareas.add({ ...tareaData, proyectoId: proyecto.id || proyecto });
          }
        }

        // Crear asignaciones
        for (const pid of this.formAsignados) {
          const puData = { proyecto_id: proyecto.id || proyecto, perfil_id: pid };
          try {
            await dbOnline.add('proyecto_usuarios', puData);
          } catch (_) {
            await db.proyecto_usuarios.add(puData);
          }
        }

        await this.cargarDatos();
        UI.toast(`Proyecto "${this.form.nombre}" creado`, 'success');
        this.view = 'list';
      } catch (err) {
        UI.toast('Error al crear proyecto: ' + err.message, 'error');
      } finally {
        this.guardando = false;
      }
    },

    async cambiarEstadoTarea(tarea) {
      const estados = ['pendiente', 'en-progreso', 'completada', 'confirmada'];
      const idx = estados.indexOf(tarea.estado);
      let nuevoEstado;
      if (this.$store.auth.isAdmin && tarea.estado === 'completada') {
        nuevoEstado = 'confirmada';
      } else if (idx < 2) {
        nuevoEstado = estados[idx + 1];
      } else {
        return;
      }
      tarea.estado = nuevoEstado;
      tarea.updated_at = new Date();

      try {
        await dbOnline.update('tareas', tarea.id, {
          estado: nuevoEstado,
          updated_at: tarea.updated_at
        });
      } catch (_) {
        await db.tareas.put(tarea);
      }

      // Actualizar estado del proyecto si todas las tareas están confirmadas
      if (nuevoEstado === 'confirmada') {
        const todas = this.currentTareas.length;
        const confirmadas = this.currentTareas.filter(t => t.estado === 'confirmada').length;
        if (todas > 0 && confirmadas === todas) {
          const proy = this.proyectos.find(p => p.id === tarea.proyectoId);
          if (proy) {
            proy.estado = 'completado';
            proy.updated_at = new Date();
            try {
              await dbOnline.update('proyectos', proy.id, { estado: 'completado' });
            } catch (_) {
              await db.proyectos.put(proy);
            }
          }
        } else {
          const proy = this.proyectos.find(p => p.id === tarea.proyectoId);
          if (proy && proy.estado === 'abierto') {
            proy.estado = 'en-progreso';
            try {
              await dbOnline.update('proyectos', proy.id, { estado: 'en-progreso' });
            } catch (_) {
              await db.proyectos.put(proy);
            }
          }
        }
      }

      this.tareas = await db.tareas.toArray().catch(() => []);
      this.currentTareas = this.tareas.filter(t => t.proyectoId === tarea.proyectoId);
      window.dispatchEvent(new CustomEvent('db-change'));
    },

    async confirmarTarea(tarea) {
      if (!this.$store.auth.isAdmin) return;
      await this.cambiarEstadoTarea(tarea);
      UI.toast('Tarea confirmada', 'success');
    },

    async guardarComentario(tarea) {
      if (!tarea.comentario_dev) return;
      tarea.updated_at = new Date();
      try {
        await dbOnline.update('tareas', tarea.id, {
          comentario_dev: tarea.comentario_dev,
          updated_at: tarea.updated_at
        });
      } catch (_) {
        await db.tareas.put(tarea);
      }
      UI.toast('Comentario guardado', 'success');
    },

    async eliminarProyecto(id) {
      if (!this.$store.auth.isAdmin) return;
      const ok = await UI.confirm('¿Eliminar este proyecto? Las tareas asociadas también se eliminarán.');
      if (!ok) return;
      try {
        await dbOnline.bulkDelete('tareas', 'proyecto_id', id);
        await dbOnline.bulkDelete('proyecto_usuarios', 'proyecto_id', id);
        await dbOnline.delete('proyectos', id);
      } catch (_) {
        await db.tareas.where('proyectoId').equals(id).delete();
        await db.proyecto_usuarios.where('proyectoId').equals(id).delete();
        await db.proyectos.delete(id);
      }
      UI.toast('Proyecto eliminado', 'success');
      await this.cargarDatos();
    },

    async cerrarProyecto(id) {
      if (!this.$store.auth.isAdmin) return;
      const proy = this.proyectos.find(p => p.id === id);
      if (!proy) return;
      proy.estado = 'completado';
      proy.updated_at = new Date();
      try {
        await dbOnline.update('proyectos', id, { estado: 'completado' });
      } catch (_) {
        await db.proyectos.put(proy);
      }
      this.currentProyecto.estado = 'completado';
      UI.toast('Proyecto cerrado', 'success');
    },

    async agregarTarea(proyectoId) {
      const nombre = prompt('Nombre de la tarea:');
      if (!nombre) return;
      const tareaData = {
        proyecto_id: proyectoId,
        nombre,
        descripcion: '',
        estado: 'pendiente',
        created_at: new Date(),
        updated_at: new Date()
      };
      let tarea;
      try {
        tarea = await dbOnline.add('tareas', tareaData);
      } catch (_) {
        tarea = { ...tareaData, id: Date.now() };
        await db.tareas.add(tarea);
      }
      this.tareas = await db.tareas.toArray().catch(() => []);
      this.currentTareas = this.tareas.filter(t => t.proyectoId === proyectoId);
      UI.toast('Tarea agregada', 'success');
    },

    async agregarMiembro(proyectoId) {
      const disponibles = this.perfiles.filter(p => !this.proyectoUsuarios.some(u => u.proyectoId === proyectoId && u.perfilId === p.id));
      if (!disponibles.length) {
        UI.toast('Todos los desarrolladores ya están asignados', 'info');
        return;
      }
      const nombres = disponibles.map((p, i) => `${i + 1}. ${p.nombre}`).join('\n');
      const idx = parseInt(prompt(`Selecciona desarrollador:\n${nombres}`));
      if (isNaN(idx) || idx < 1 || idx > disponibles.length) return;
      const perfil = disponibles[idx - 1];
      const puData = { proyecto_id: proyectoId, perfil_id: perfil.id };
      try {
        await dbOnline.add('proyecto_usuarios', puData);
      } catch (_) {
        await db.proyecto_usuarios.add(puData);
      }
      this.proyectoUsuarios = await db.proyecto_usuarios.toArray().catch(() => []);
      const miembroIds = this.proyectoUsuarios.filter(u => u.proyectoId === proyectoId).map(u => u.perfilId);
      this.currentMiembros = this.perfiles.filter(p => miembroIds.includes(p.id));
      UI.toast(`${perfil.nombre} agregado al proyecto`, 'success');
    }
  };
}

window.MODULES = window.MODULES || {};
window.MODULES[PROYECTOS.id] = PROYECTOS;
appRouter.register(PROYECTOS);
