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
      <div class="flex items-center gap-2">
        <button x-show="$store.auth.isAdmin" class="btn btn-ghost btn-sm radius-sm gap-1" @click="exportarExcelProyectos()" title="Exportar a Excel">
          <i class="bi bi-file-earmark-spreadsheet text-accent"></i> Excel
        </button>
        <button x-show="$store.auth.isAdmin" class="btn btn-primary btn-magnetic btn-sm radius-md" @click="view = 'create'; form = { nombre: '', descripcion: '', prioridad: 'media', fecha_limite: '', notas_admin: '' }; formTareas = []; formAsignados = []">
          <i class="bi bi-plus-lg"></i> Nuevo proyecto
        </button>
      </div>
    </div>

    <!-- Filtros -->
    <div class="mb-4 space-y-2">
      <div class="relative">
        <i class="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-xs text-faint"></i>
        <input type="search" x-model="busqueda" placeholder="Buscar proyecto por nombre o descripción..."
               class="input input-bordered input-xs radius-sm w-full pl-8" aria-label="Buscar proyecto">
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <select x-model="filterPrioridad" class="select select-bordered select-xs radius-sm" aria-label="Filtrar por prioridad">
        <option value="">Todas prioridades</option>
        <option value="baja">Baja</option>
        <option value="media">Media</option>
        <option value="alta">Alta</option>
      </select>
      <select x-model="filterEstado" class="select select-bordered select-xs radius-sm" aria-label="Filtrar por estado">
        <option value="">Todos estados</option>
        <option value="abierto">Abierto</option>
        <option value="en-progreso">En progreso</option>
        <option value="completado">Completado</option>
      </select>
      <select x-show="$store.auth.isAdmin" x-model="filterResponsable" class="select select-bordered select-xs radius-sm" aria-label="Filtrar por responsable">
        <option value="">Todos responsables</option>
        <template x-for="r in perfiles" :key="r.id">
          <option :value="r.id" x-text="r.nombre"></option>
        </template>
      </select>
        <button x-show="busqueda || filterPrioridad || filterEstado || filterResponsable"
                class="btn btn-ghost btn-xs gap-1 radius-sm" @click="busqueda=''; filterPrioridad=''; filterEstado=''; filterResponsable=''">
          <i class="bi bi-x-circle"></i> Limpiar
        </button>
      </div>
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
          <template x-for="(p, idx) in filteredProyectos" :key="p.id">
            <tr class="stagger-enter cursor-pointer hover:bg-muted/50" :style="'animation-delay: ' + (idx * 0.03) + 's'" @click="cargarProyecto(p.id)">
              <td class="font-medium">
                <span x-text="p.nombre" class="text-sm"></span>
                <span x-show="p.descripcion" class="text-xs text-muted block truncate max-w-[200px]" x-text="p.descripcion"></span>
              </td>
              <td class="hidden sm:table-cell">
                <span class="badge badge-sm gap-1" :class="p.prioridad === 'alta' ? 'badge-error' : p.prioridad === 'media' ? 'badge-warning' : 'badge-ghost'">
                  <i class="bi" :class="p.prioridad === 'alta' ? 'bi-arrow-up-circle-fill' : p.prioridad === 'media' ? 'bi-dash-circle-fill' : 'bi-arrow-down-circle-fill'"></i>
                  <span x-text="p.prioridad"></span>
                </span>
              </td>
              <td>
                <span class="badge badge-sm gap-1" :class="p.estado === 'completado' ? 'badge-success' : p.estado === 'en-progreso' ? 'badge-info' : 'badge-ghost'">
                  <i class="bi" :class="p.estado === 'completado' ? 'bi-check-circle-fill' : p.estado === 'en-progreso' ? 'bi-arrow-repeat' : 'bi-circle'"></i>
                  <span x-text="p.estado === 'en-progreso' ? 'En progreso' : p.estado"></span>
                </span>
              </td>
              <td class="hidden md:table-cell text-xs" :class="p.fechaLimite && dayjs(p.fechaLimite).isBefore(dayjs(), 'day') ? 'text-error font-medium' : dayjs(p.fechaLimite).diff(dayjs(), 'day') <= 3 && dayjs(p.fechaLimite).diff(dayjs(), 'day') >= 0 ? 'text-warning font-medium' : 'text-muted'">
                <span x-show="p.fechaLimite && dayjs(p.fechaLimite).isValid()" x-text="dayjs(p.fechaLimite).format('DD/MM/YYYY')"></span>
                <span x-show="!p.fechaLimite || !dayjs(p.fechaLimite).isValid()" class="text-faint">&mdash;</span>
              </td>
              <td>
                <div class="flex items-center gap-2">
                  <progress class="progress progress-accent w-16 h-2" :value="avanceProyecto(p.id)" max="100"></progress>
                  <span class="text-xs font-medium" x-text="avanceProyecto(p.id) + '%'"></span>
                </div>
              </td>
              <td class="hidden lg:table-cell">
                <div class="flex -space-x-2">
                  <template x-for="pu in proyectoUsuarios.filter(u => Number(u.proyectoId) === Number(p.id)).slice(0, 3)" :key="pu.id">
                    <div class="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center text-[10px] font-medium text-accent border-2 border-white bg-accent/20">
                      <template x-if="fotoDe(pu.perfilId)">
                        <img :src="fotoDe(pu.perfilId)" :alt="nombreDe(pu.perfilId)" class="w-full h-full object-cover">
                      </template>
                      <template x-if="!fotoDe(pu.perfilId)">
                        <span x-text="inicialDe(pu.perfilId)"></span>
                      </template>
                    </div>
                  </template>
                  <span x-show="proyectoUsuarios.filter(u => Number(u.proyectoId) === Number(p.id)).length > 3" class="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] text-muted border-2 border-white" x-text="'+' + (proyectoUsuarios.filter(u => Number(u.proyectoId) === Number(p.id)).length - 3)"></span>
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
      <p class="text-sm text-muted mt-3" x-text="busqueda || filterPrioridad || filterEstado ? 'No hay proyectos con esos filtros' : ($store.auth.isAdmin ? 'Crea tu primer proyecto' : 'No tienes proyectos asignados')"></p>
      <button x-show="busqueda || filterPrioridad || filterEstado" class="btn btn-ghost btn-xs radius-sm mt-3 gap-1"
              @click="busqueda=''; filterPrioridad=''; filterEstado=''; filterResponsable=''">
        <i class="bi bi-arrow-counterclockwise"></i> Quitar filtros
      </button>
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
              <div class="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-2">
                <input type="text" x-model="t.nombre" class="input input-bordered input-xs radius-sm" placeholder="Nombre de la tarea">
                <input type="text" x-model="t.descripcion" class="input input-bordered input-xs radius-sm" placeholder="Descripción">
                <select x-model="t.prioridad" class="select select-bordered select-xs radius-sm">
                  <option value="media">Prioridad media</option>
                  <option value="baja">Prioridad baja</option>
                  <option value="alta">Prioridad alta</option>
                </select>
                <input type="number" x-model="t.horas_estimadas" class="input input-bordered input-xs radius-sm" placeholder="Horas est." min="0" step="0.5">
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
                <span class="w-5 h-5 rounded-full overflow-hidden flex items-center justify-center bg-accent/15 text-accent text-[9px] font-semibold shrink-0">
                  <template x-if="perfil.fotoBase64">
                    <img :src="perfil.fotoBase64" :alt="perfil.nombre" class="w-full h-full object-cover">
                  </template>
                  <template x-if="!perfil.fotoBase64">
                    <span x-text="perfil.nombre.charAt(0).toUpperCase()"></span>
                  </template>
                </span>
                <span x-text="perfil.nombre"></span>
              </label>
            </template>
          </div>
          <p x-show="!perfiles.length" class="text-xs text-muted mt-1">No hay desarrolladores registrados</p>
        </div>

        <div class="flex gap-2">
          <button class="btn btn-primary btn-sm radius-md" @click="guardarProyecto()" :disabled="!form.nombre || guardando">
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
                  <template x-if="!editingProyecto">
                    <div>
                      <h3 class="text-lg font-semibold tracking-heading flex items-center gap-2" x-text="currentProyecto.nombre"></h3>
                      <p class="text-sm text-muted mt-1" x-show="currentProyecto.descripcion" x-text="currentProyecto.descripcion"></p>
                    </div>
                  </template>
                  <template x-if="editingProyecto">
                    <div class="space-y-2">
                      <input type="text" x-model="editForm.nombre" class="input input-bordered input-sm radius-sm w-full" placeholder="Nombre del proyecto">
                      <textarea x-model="editForm.descripcion" class="textarea textarea-bordered textarea-sm radius-sm w-full" rows="2" placeholder="Descripción"></textarea>
                    </div>
                  </template>
                </div>
                <div class="flex items-center gap-2">
                  <template x-if="!editingProyecto">
                    <div class="flex items-center gap-2">
                      <span class="badge" :class="currentProyecto.prioridad === 'alta' ? 'badge-error' : currentProyecto.prioridad === 'media' ? 'badge-warning' : 'badge-ghost'" x-text="'Prioridad: ' + currentProyecto.prioridad"></span>
                      <span class="badge" :class="currentProyecto.estado === 'completado' ? 'badge-success' : currentProyecto.estado === 'en-progreso' ? 'badge-info' : 'badge-ghost'" x-text="currentProyecto.estado"></span>
                      <button x-show="$store.auth.isAdmin" class="btn btn-ghost btn-xs btn-square" @click="iniciarEdicionProyecto()" title="Editar proyecto">
                        <i class="bi bi-pencil text-muted hover:text-accent"></i>
                      </button>
                    </div>
                  </template>
                  <template x-if="editingProyecto">
                    <div class="flex items-center gap-2">
                      <select x-model="editForm.prioridad" class="select select-bordered select-xs radius-sm">
                        <option value="baja">Baja</option>
                        <option value="media">Media</option>
                        <option value="alta">Alta</option>
                      </select>
                      <span class="badge" :class="currentProyecto.estado === 'completado' ? 'badge-success' : currentProyecto.estado === 'en-progreso' ? 'badge-info' : 'badge-ghost'" x-text="currentProyecto.estado"></span>
                    </div>
                  </template>
                </div>
              </div>

            <div class="flex flex-wrap gap-4 text-xs text-muted mb-4">
              <template x-if="!editingProyecto">
                <span x-show="currentProyecto.fechaLimite && dayjs(currentProyecto.fechaLimite).isValid()" :class="dayjs(currentProyecto.fechaLimite).isBefore(dayjs(), 'day') ? 'text-error font-medium' : ''">
                  <i class="bi bi-calendar3"></i> Límite: <span x-text="dayjs(currentProyecto.fechaLimite).format('DD/MM/YYYY')"></span>
                </span>
              </template>
              <template x-if="editingProyecto">
                <label class="form-control">
                  <span class="label-text text-xs text-muted mr-2">Fecha límite</span>
                  <input type="date" x-model="editForm.fecha_limite" class="input input-bordered input-xs radius-sm">
                </label>
              </template>
              <span><i class="bi bi-people"></i> <span x-text="currentMiembros.length + ' responsable(s)'"></span></span>
            </div>

            <!-- Notas admin + botones edición -->
            <div x-show="$store.auth.isAdmin && editingProyecto" class="mb-4">
              <label class="form-control mb-3">
                <span class="label-text text-xs font-medium text-muted mb-1">Notas del admin</span>
                <input type="text" x-model="editForm.notas_admin" class="input input-bordered input-sm radius-sm" placeholder="Notas internas">
              </label>
              <div class="flex gap-2">
                <button class="btn btn-primary btn-sm radius-sm gap-1" @click="guardarEdicionProyecto()">
                  <i class="bi bi-check-lg"></i> Guardar
                </button>
                <button class="btn btn-ghost btn-sm radius-sm" @click="cancelarEdicionProyecto()">Cancelar</button>
              </div>
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
                <div class="flex items-center gap-1">
                  <button class="btn btn-ghost btn-xs gap-1 radius-sm" @click="deshacerUltimoCambio()"
                          x-show="hayCambiosDeshacibles" title="Deshacer el último cambio de estado">
                    <i class="bi bi-arrow-counterclockwise"></i> Deshacer
                  </button>
                  <button x-show="$store.auth.isAdmin" class="btn btn-ghost btn-xs gap-1" @click="abrirFormTarea()">
                    <i class="bi bi-plus-lg"></i> Agregar
                  </button>
                </div>
              </div>

              <!-- Alta rápida de tarea -->
              <div x-show="showNuevaTarea" class="mb-3 p-3 rounded-lg border-default bg-muted">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input id="nueva-tarea-nombre" type="text" x-model="nuevaTarea.nombre" class="input input-bordered input-xs radius-sm" placeholder="Nombre de la tarea *" @keydown.enter="guardarNuevaTarea()">
                  <input type="text" x-model="nuevaTarea.descripcion" class="input input-bordered input-xs radius-sm" placeholder="Descripción (opcional)">
                  <select x-model="nuevaTarea.prioridad" class="select select-bordered select-xs radius-sm" aria-label="Prioridad de la nueva tarea">
                    <option value="baja">Prioridad baja</option>
                    <option value="media">Prioridad media</option>
                    <option value="alta">Prioridad alta</option>
                  </select>
                  <input type="date" x-model="nuevaTarea.fecha_limite" class="input input-bordered input-xs radius-sm" aria-label="Fecha límite de la nueva tarea">
                  <input type="number" x-model="nuevaTarea.horas_estimadas" class="input input-bordered input-xs radius-sm" placeholder="Horas estimadas" min="0" step="0.5">
                </div>
                <div class="flex gap-2 mt-2">
                  <button class="btn btn-primary btn-xs radius-sm gap-1" @click="guardarNuevaTarea()">
                    <i class="bi bi-check-lg"></i> Agregar tarea
                  </button>
                  <button class="btn btn-ghost btn-xs radius-sm" @click="showNuevaTarea = false">Cancelar</button>
                </div>
              </div>

              <!-- Filtros de tareas -->
              <div class="mb-3 space-y-2" x-show="currentTareas.length > 1">
                <div class="relative">
                  <i class="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-xs text-faint"></i>
                  <input type="search" x-model="busquedaTarea" placeholder="Buscar tarea..."
                         class="input input-bordered input-xs radius-sm w-full pl-8" aria-label="Buscar tarea">
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <select x-model="filterTareaEstado" class="select select-bordered select-xs radius-sm" aria-label="Filtrar tareas por estado">
                    <option value="">Todos los estados</option>
                    <option value="pendiente">Pendiente</option>
                    <option value="en-progreso">En progreso</option>
                    <option value="completada">Terminada</option>
                    <option value="confirmada">Confirmada</option>
                  </select>
                  <select x-model="filterTareaPrioridad" class="select select-bordered select-xs radius-sm" aria-label="Filtrar tareas por prioridad">
                    <option value="">Toda prioridad</option>
                    <option value="alta">Alta</option>
                    <option value="media">Media</option>
                    <option value="baja">Baja</option>
                  </select>
                  <select x-model="filterTareaAsignado" class="select select-bordered select-xs radius-sm" aria-label="Filtrar tareas por responsable">
                    <option value="">Todos</option>
                    <template x-for="m in currentMiembros" :key="m.id">
                      <option :value="m.id" x-text="m.nombre"></option>
                    </template>
                  </select>
                  <button x-show="busquedaTarea || filterTareaEstado || filterTareaPrioridad || filterTareaAsignado"
                          class="btn btn-ghost btn-xs radius-sm gap-1"
                          @click="busquedaTarea=''; filterTareaEstado=''; filterTareaPrioridad=''; filterTareaAsignado=''">
                    <i class="bi bi-x-circle"></i> Limpiar
                  </button>
                </div>
              </div>

              <div x-show="!currentTareas.length" class="text-center py-6 text-sm text-muted">
                <i class="bi bi-inbox text-2xl block mb-1 text-muted/30"></i>
                No hay tareas definidas
              </div>

              <div x-show="currentTareas.length && !filteredTareas.length" class="text-center py-6 text-xs text-muted">
                Ninguna tarea coincide con el filtro
              </div>

              <template x-for="t in filteredTareas" :key="t.id">
                <div class="flex items-start gap-3 py-2.5 border-b-default last:border-b-0">
                  <div class="pt-0.5">
                    <input type="checkbox" class="checkbox checkbox-sm checkbox-accent"
                           :checked="t.estado === 'completada' || t.estado === 'confirmada'"
                           :disabled="t.estado === 'confirmada' && !$store.auth.isAdmin"
                           @click="cambiarEstadoTarea(t)" :aria-label="'Marcar ' + t.nombre">
                  </div>

                  <!-- Vista normal de tarea -->
                  <template x-if="editingTareaId !== t.id">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-sm font-medium" :class="t.estado === 'confirmada' || t.estado === 'completada' ? 'line-through text-muted' : ''" x-text="t.nombre"></span>
                        <span class="badge badge-xs gap-1" :class="estadoBadgeClass(t.estado)">
                          <i class="bi" :class="t.estado === 'confirmada' ? 'bi-patch-check-fill' : t.estado === 'completada' ? 'bi-check-lg' : t.estado === 'en-progreso' ? 'bi-arrow-repeat' : 'bi-circle'"></i>
                          <span x-text="estadoLabel(t.estado)"></span>
                        </span>
                        <span x-show="t.prioridad" class="badge badge-xs" :class="t.prioridad === 'alta' ? 'badge-error' : t.prioridad === 'media' ? 'badge-warning' : 'badge-ghost'" x-text="t.prioridad"></span>
                        <span x-show="Number(t.horas_estimadas) > 0" class="text-xs text-muted"><i class="bi bi-clock"></i> <span x-text="t.horas_estimadas + 'h'"></span></span>
                        <span x-show="t.fechaLimite && dayjs(t.fechaLimite).isValid()" class="text-xs" :class="dayjs(t.fechaLimite).isBefore(dayjs(), 'day') ? 'text-error font-medium' : dayjs(t.fechaLimite).diff(dayjs(), 'day') <= 3 ? 'text-warning font-medium' : 'text-muted'">
                          <i class="bi bi-calendar3"></i> <span x-text="dayjs(t.fechaLimite).format('DD/MM')"></span>
                        </span>

                        <!-- Foto del desarrollador asignado -->
                        <span x-show="perfilDe(t.asignado_a)" class="inline-flex items-center gap-1.5 text-xs text-muted">
                          <span class="w-5 h-5 rounded-full overflow-hidden flex items-center justify-center bg-accent/15 text-accent text-[9px] font-semibold shrink-0">
                            <template x-if="fotoDe(t.asignado_a)">
                              <img :src="fotoDe(t.asignado_a)" :alt="nombreDe(t.asignado_a)" :title="nombreDe(t.asignado_a)" class="w-full h-full object-cover">
                            </template>
                            <template x-if="!fotoDe(t.asignado_a)">
                              <span x-text="inicialDe(t.asignado_a)" :title="nombreDe(t.asignado_a)"></span>
                            </template>
                          </span>
                          <span x-text="primerNombre(t.asignado_a)" class="hidden sm:inline"></span>
                        </span>

                        <!-- Acciones: estado + deshacer + edición -->
                        <div class="flex items-center gap-1 ml-auto shrink-0">
                          <select class="select select-bordered select-xs radius-sm" :value="t.estado"
                                  @change="aplicarEstadoTarea(t, $event.target.value)" aria-label="Cambiar estado de la tarea">
                            <option value="pendiente">Pendiente</option>
                            <option value="en-progreso">En progreso</option>
                            <option value="completada">Terminada</option>
                            <option value="confirmada">Confirmada</option>
                          </select>
                          <button x-show="puedeDeshacer(t)" class="btn btn-ghost btn-xs btn-square" @click="deshacerEstadoTarea(t)"
                                  :title="'Restablecer a ' + estadoLabel(ultimoEstado(t))" aria-label="Restablecer estado anterior">
                            <i class="bi bi-arrow-counterclockwise text-[10px] text-muted hover:text-accent"></i>
                          </button>
                          <button x-show="$store.auth.isAdmin" class="btn btn-ghost btn-xs btn-square" @click="iniciarEdicionTarea(t)" title="Editar tarea">
                            <i class="bi bi-pencil text-[10px] text-muted hover:text-accent"></i>
                          </button>
                          <button x-show="$store.auth.isAdmin" class="btn btn-ghost btn-xs btn-square" @click="eliminarTarea(t)" title="Eliminar tarea">
                            <i class="bi bi-trash text-[10px] text-muted hover:text-error"></i>
                          </button>
                        </div>
                      </div>
                      <p x-show="t.descripcion" class="text-xs text-muted mt-0.5" x-text="t.descripcion"></p>
                      <div x-show="t.estado !== 'pendiente' && t.estado !== 'confirmada'" class="mt-1.5 flex items-center gap-1.5">
                        <input type="text" x-model="t.comentario_dev" class="input input-xs input-bordered radius-sm flex-1" placeholder="Agregar comentario..." @keydown.enter="guardarComentario(t)">
                        <button class="btn btn-ghost btn-xs btn-square" @click="guardarComentario(t)" title="Guardar comentario">
                          <i class="bi bi-check text-xs"></i>
                        </button>
                      </div>
                      <div x-show="$store.auth.isAdmin && t.estado === 'completada'" class="mt-1.5">
                        <button class="btn btn-primary btn-xs gap-1 radius-sm" @click="confirmarTarea(t)">
                          <i class="bi bi-check2-all"></i> Confirmar
                        </button>
                      </div>
                    </div>
                  </template>

                  <!-- Edición inline de tarea -->
                  <template x-if="editingTareaId === t.id">
                    <div class="flex-1 min-w-0">
                      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                        <input type="text" x-model="editTareaForm.nombre" class="input input-bordered input-xs radius-sm" placeholder="Nombre">
                        <select x-model="editTareaForm.prioridad" class="select select-bordered select-xs radius-sm">
                          <option value="baja">Prioridad baja</option>
                          <option value="media">Prioridad media</option>
                          <option value="alta">Prioridad alta</option>
                        </select>
                        <input type="text" x-model="editTareaForm.descripcion" class="input input-bordered input-xs radius-sm" placeholder="Descripción">
                        <input type="date" x-model="editTareaForm.fecha_limite" class="input input-bordered input-xs radius-sm" :max="currentProyecto.fechaLimite || ''">
                        <input type="number" x-model="editTareaForm.horas_estimadas" class="input input-bordered input-xs radius-sm" placeholder="Horas est." min="0" step="0.5">
                        <div class="flex items-center gap-2">
                          <select x-model="editTareaForm.asignado_a" class="select select-bordered select-xs radius-sm flex-1" aria-label="Asignar tarea">
                            <option value="">Sin asignar</option>
                            <template x-for="m in currentMiembros" :key="m.id">
                              <option :value="m.id" x-text="m.nombre"></option>
                            </template>
                          </select>
                          <span x-show="editTareaForm.asignado_a" class="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center bg-accent/15 text-accent text-[10px] font-semibold shrink-0">
                            <template x-if="fotoDe(editTareaForm.asignado_a)">
                              <img :src="fotoDe(editTareaForm.asignado_a)" :alt="nombreDe(editTareaForm.asignado_a)" class="w-full h-full object-cover">
                            </template>
                            <template x-if="!fotoDe(editTareaForm.asignado_a)">
                              <span x-text="inicialDe(editTareaForm.asignado_a)"></span>
                            </template>
                          </span>
                        </div>
                      </div>
                      <div class="flex gap-2 mt-1">
                        <button class="btn btn-primary btn-xs gap-1 radius-sm" @click="guardarEdicionTarea(t)">
                          <i class="bi bi-check-lg"></i> Guardar
                        </button>
                        <button class="btn btn-ghost btn-xs radius-sm" @click="cancelarEdicionTarea()">Cancelar</button>
                      </div>
                    </div>
                  </template>
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
                  <span class="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center text-[10px] font-semibold text-accent bg-accent/15 shrink-0">
                    <template x-if="miembro.fotoBase64">
                      <img :src="miembro.fotoBase64" :alt="miembro.nombre" class="w-full h-full object-cover">
                    </template>
                    <template x-if="!miembro.fotoBase64">
                      <span x-text="miembro.nombre.charAt(0).toUpperCase()"></span>
                    </template>
                  </span>
                  <span x-text="miembro.nombre"></span>
                  <i class="bi bi-person-badge text-faint text-[10px] ml-auto" title="Responsable del proyecto"></i>
                </div>
              </template>
              <p x-show="!currentMiembros.length" class="text-xs text-faint">Sin responsables asignados</p>
            </div>
            <button x-show="$store.auth.isAdmin" class="btn btn-ghost btn-xs w-full mt-3 gap-1" @click="abrirModalMiembros()">
              <i class="bi bi-person-plus"></i> Agregar miembro
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
    </template>
  </div>

  <!-- Modal: agregar miembro (con foto de cada desarrollador) -->
  <div x-show="showMiembroModal" class="modal modal-open" @keydown.escape.window="showMiembroModal = false">
    <div class="modal-box w-11/12 max-w-md radius-lg">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-semibold text-base tracking-heading flex items-center gap-2">
          <i class="bi bi-person-plus text-accent"></i> Agregar responsable
        </h3>
        <button class="btn btn-ghost btn-xs btn-square" @click="showMiembroModal = false" aria-label="Cerrar">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>
      <p class="text-xs text-muted mb-3" x-text="'Proyecto: ' + (currentProyecto ? currentProyecto.nombre : '')"></p>
      <div class="space-y-2 max-h-80 overflow-y-auto">
        <template x-for="perfil in miembrosDisponibles" :key="perfil.id">
          <label class="flex items-center gap-3 p-2.5 rounded-lg border-default cursor-pointer transition-spring"
                 :class="miembroSeleccionado === perfil.id ? 'border-accent bg-accent/5' : ''">
            <input type="radio" name="nuevo-miembro" :value="perfil.id" x-model="miembroSeleccionado" class="radio radio-xs radio-accent">
            <span class="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center text-xs font-semibold text-accent bg-accent/15 shrink-0">
              <template x-if="perfil.fotoBase64">
                <img :src="perfil.fotoBase64" :alt="perfil.nombre" class="w-full h-full object-cover">
              </template>
              <template x-if="!perfil.fotoBase64">
                <span x-text="perfil.nombre.charAt(0).toUpperCase()"></span>
              </template>
            </span>
            <span class="min-w-0">
              <span class="block text-sm font-medium truncate" x-text="perfil.nombre"></span>
              <span class="block text-xs text-muted truncate" x-text="perfil.cargo || 'Sin cargo'"></span>
            </span>
          </label>
        </template>
        <p x-show="!miembrosDisponibles.length" class="text-xs text-muted text-center py-4">
          Todos los desarrolladores ya están asignados a este proyecto
        </p>
      </div>
      <div class="modal-action">
        <button class="btn btn-ghost btn-sm radius-sm" @click="showMiembroModal = false">Cancelar</button>
        <button class="btn btn-primary btn-sm radius-sm gap-1.5" :disabled="!miembroSeleccionado" @click="confirmarMiembro()">
          <i class="bi bi-check-lg"></i> Asignar
        </button>
      </div>
    </div>
  </div>
</div>
`;
  },

  destroy() {
    window._proyectosData = null;
    console.log('💡 [proyectos] Destruído');
  },

  // 💡 Refresco en vivo: recarga datos sin perder la vista (lista o detalle).
  async refresh() {
    const d = window._proyectosData;
    if (d && typeof d._refreshProyectos === 'function') await d._refreshProyectos();
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
    editingProyecto: false,
    editForm: { nombre: '', descripcion: '', prioridad: 'media', fecha_limite: '', notas_admin: '' },
    editingTareaId: null,
    editTareaForm: { nombre: '', descripcion: '', fecha_limite: '', asignado_a: null, prioridad: 'media', horas_estimadas: '' },
    filterResponsable: '',
    busqueda: '',
    busquedaTarea: '',
    filterTareaEstado: '',
    filterTareaPrioridad: '',
    filterTareaAsignado: '',
    cambiosUndo: 0,
    _estadosUndo: {},
    showMiembroModal: false,
    miembroSeleccionado: null,
    showNuevaTarea: false,
    nuevaTarea: { nombre: '', descripcion: '', prioridad: 'media', horas_estimadas: '', fecha_limite: '' },

    async init() {
      // Referencia para el refresco global (db-change) sin perder el detalle abierto.
      window._proyectosData = this;
      if (this.proyectoId) await this.cargarProyecto(this.proyectoId);
      this._checkDueDates();
    },

    async cargarDatos() {
      this.proyectos = await db.proyectos.toArray().catch(() => []);
      this.tareas = await db.tareas.toArray().catch(() => []);
      this.proyectoUsuarios = await db.proyecto_usuarios.toArray().catch(() => []);
      this.equipos = await db.equipos.toArray().catch(() => []);
      this.perfiles = await db.perfiles.toArray().catch(() => []);
    },

    // El router guarda esta referencia para refrescar el módulo en vivo (db-change).
    async _refreshProyectos() {
      await this.cargarDatos();
      if (this.view === 'detail' && this.currentProyecto) {
        await this.cargarProyecto(this.currentProyecto.id);
      }
    },

    get filteredProyectos() {
      // ⚠️ Copia: nunca ordenar/filtrar el array reactivo in-place. Hacerlo
      //    reordenaba las filas mientras Alpine las pintaba (se abría otro
      //    proyecto y los nombres "saltaban").
      let lista = Array.isArray(this.proyectos) ? this.proyectos.slice() : [];
      if (this.busqueda) {
        const q = this.busqueda.toLowerCase();
        lista = lista.filter(p =>
          (p.nombre || '').toLowerCase().includes(q) ||
          (p.descripcion || '').toLowerCase().includes(q)
        );
      }
      if (!this.$store.auth.isAdmin) {
        const miId = this.$store.auth.user?.perfilId;
        const misIds = this.proyectoUsuarios
          .filter(u => Number(u.perfilId) === Number(miId))
          .map(u => Number(u.proyectoId));
        lista = lista.filter(p => misIds.includes(Number(p.id)));
      }
      if (this.filterPrioridad) lista = lista.filter(p => p.prioridad === this.filterPrioridad);
      if (this.filterEstado) lista = lista.filter(p => p.estado === this.filterEstado);
      if (this.filterResponsable) {
        const idsConResp = this.proyectoUsuarios
          .filter(u => Number(u.perfilId) === Number(this.filterResponsable))
          .map(u => Number(u.proyectoId));
        lista = lista.filter(p => idsConResp.includes(Number(p.id)));
      }
      return lista.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    },

    avanceProyecto(proyectoId) {
      const tareasProy = this.tareas.filter(t => Number(t.proyectoId ?? t.proyecto_id) === Number(proyectoId));
      if (!tareasProy.length) return 0;
      const hechas = tareasProy.filter(t => t.estado === 'confirmada' || t.estado === 'completada').length;
      return Math.round((hechas / tareasProy.length) * 100);
    },

    // ── Utilidades de perfiles/fotos ──
    perfilDe(id) {
      if (id == null || id === '') return null;
      return this.perfiles.find(p => Number(p.id) === Number(id)) || null;
    },

    fotoDe(id) {
      const p = this.perfilDe(id);
      return (p && p.fotoBase64) || '';
    },

    inicialDe(id) {
      const p = this.perfilDe(id);
      return (p && p.nombre ? p.nombre.charAt(0) : '?').toUpperCase();
    },

    primerNombre(id) {
      const p = this.perfilDe(id);
      return p ? p.nombre.split(' ')[0] : '';
    },

    nombreDe(id) {
      const p = this.perfilDe(id);
      return p ? p.nombre : '';
    },

    // ── Estados de tarea ──
    estadoLabel(estado) {
      return ({
        'pendiente': 'Pendiente',
        'en-progreso': 'En progreso',
        'completada': 'Terminada',
        'confirmada': 'Confirmada'
      })[estado] || estado || 'Pendiente';
    },

    estadoBadgeClass(estado) {
      return ({
        'pendiente': 'badge-ghost',
        'en-progreso': 'badge-warning',
        'completada': 'badge-info',
        'confirmada': 'badge-success'
      })[estado] || 'badge-ghost';
    },

    get filteredTareas() {
      let lista = Array.isArray(this.currentTareas) ? this.currentTareas.slice() : [];
      if (!this.busquedaTarea) { /* sin filtro de texto */ } else {
        const q = this.busquedaTarea.toLowerCase();
        lista = lista.filter(t =>
          (t.nombre || '').toLowerCase().includes(q) ||
          (t.descripcion || '').toLowerCase().includes(q)
        );
      }
      if (this.filterTareaEstado) lista = lista.filter(t => (t.estado || 'pendiente') === this.filterTareaEstado);
      if (this.filterTareaPrioridad) lista = lista.filter(t => (t.prioridad || 'media') === this.filterTareaPrioridad);
      if (this.filterTareaAsignado) {
        lista = lista.filter(t => Number(t.asignado_a) === Number(this.filterTareaAsignado));
      }
      return lista;
    },

    async cargarProyecto(id) {
      // ⚠️ Comparación numérica: SQLite puede devolver ids como texto.
      const pid = Number(id);
      this.currentProyecto = this.proyectos.find(p => Number(p.id) === pid) || null;
      if (!this.currentProyecto) {
        UI.toast('Proyecto no encontrado', 'error');
        this.view = 'list';
        return;
      }
      this.proyectoId = pid;
      this.currentTareas = this.tareas.filter(t => Number(t.proyectoId ?? t.proyecto_id) === pid);
      const miembroIds = this.proyectoUsuarios
        .filter(u => Number(u.proyectoId) === pid)
        .map(u => Number(u.perfilId));
      this.currentMiembros = this.perfiles.filter(p => miembroIds.includes(Number(p.id)));
      this.view = 'detail';
    },

    async guardarProyecto() {
      // 💡 Solo el nombre es obligatorio (asignación de devs opcional)
      if (!this.form.nombre) {
        UI.toast('Debes ingresar el nombre del proyecto', 'warning');
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
          notas_admin: this.form.notas_admin || '',
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
            prioridad: t.prioridad || 'media',
            horas_estimadas: t.horas_estimadas ? parseFloat(t.horas_estimadas) : null,
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

    // ── Cambio de estado de tareas (cualquier estado + deshacer) ──
    // El historial se guarda indexado por id de tarea para sobrevivir a un
    // refresco de los datos (los objetos se reemplazan al volver a leer SQLite).
    _pushUndo(tarea, estadoAnterior) {
      const k = String(tarea.id);
      const mapa = this._estadosUndo || (this._estadosUndo = {});
      const arr = mapa[k] || (mapa[k] = []);
      arr.push(estadoAnterior);
      if (arr.length > 20) arr.shift();
      this.cambiosUndo = (this.cambiosUndo || 0) + 1;
    },

    puedeDeshacer(tarea) {
      const arr = (this._estadosUndo || {})[String(tarea && tarea.id)];
      return Array.isArray(arr) && arr.length > 0;
    },

    get hayCambiosDeshacibles() {
      return (this.cambiosUndo || 0) > 0;
    },

    ultimoEstado(tarea) {
      const arr = (this._estadosUndo || {})[String(tarea && tarea.id)];
      return Array.isArray(arr) && arr.length ? arr[arr.length - 1] : null;
    },

    async aplicarEstadoTarea(tarea, nuevoEstado) {
      if (!nuevoEstado || nuevoEstado === tarea.estado) return;
      const anterior = tarea.estado || 'pendiente';
      this._pushUndo(tarea, anterior);
      tarea.estado = nuevoEstado;
      await this._persistirTarea(tarea);
      await this._sincronizarEstadoProyecto(tarea.proyectoId ?? tarea.proyecto_id);
      UI.toast(`"${tarea.nombre}" → ${this.estadoLabel(nuevoEstado)}`, 'success');
    },

    async deshacerEstadoTarea(tarea) {
      const k = String(tarea.id);
      const arr = (this._estadosUndo || {})[k] || [];
      if (!arr.length) { UI.toast('No hay un estado anterior para esta tarea', 'info'); return; }
      const anterior = arr.pop();
      this.cambiosUndo = Math.max(0, (this.cambiosUndo || 1) - 1);
      tarea.estado = anterior;
      await this._persistirTarea(tarea);
      await this._sincronizarEstadoProyecto(tarea.proyectoId ?? tarea.proyecto_id);
      UI.toast(`Estado restablecido: ${this.estadoLabel(anterior)}`, 'success');
    },

    async deshacerUltimoCambio() {
      // Deshace el cambio de estado más reciente visible en pantalla.
      const lista = (this.currentTareas && this.currentTareas.length) ? this.currentTareas : this.tareas;
      for (let i = lista.length - 1; i >= 0; i--) {
        const t = lista[i];
        if ((this._estadosUndo || {})[String(t.id)] && this._estadosUndo[String(t.id)].length) {
          return this.deshacerEstadoTarea(t);
        }
      }
      UI.toast('No hay cambios de estado que deshacer', 'info');
    },

    async _persistirTarea(tarea) {
      tarea.updated_at = new Date();
      try {
        await dbOnline.update('tareas', tarea.id, { estado: tarea.estado, updated_at: tarea.updated_at });
      } catch (_) {
        await db.tareas.put(tarea);
      }
      // Sincronizar la copia del array general (avance y gráficos del listado).
      const enLista = this.tareas.find(t => Number(t.id) === Number(tarea.id));
      if (enLista && enLista !== tarea) {
        enLista.estado = tarea.estado;
        enLista.updated_at = tarea.updated_at;
      }
      const enActual = this.currentTareas.find(t => Number(t.id) === Number(tarea.id));
      if (enActual && enActual !== tarea) enActual.estado = tarea.estado;
    },

    async _sincronizarEstadoProyecto(proyectoId) {
      const pid = Number(proyectoId);
      const proy = this.proyectos.find(p => Number(p.id) === pid);
      if (!proy) return;
      const tareasProy = this.tareas.filter(t => Number(t.proyectoId ?? t.proyecto_id) === pid);
      if (!tareasProy.length) return;
      const total = tareasProy.length;
      const terminadas = tareasProy.filter(t => t.estado === 'completada' || t.estado === 'confirmada').length;
      const nuevo = terminadas === total ? 'completado' : (terminadas > 0 ? 'en-progreso' : 'abierto');
      if (proy.estado === nuevo) return;
      proy.estado = nuevo;
      proy.updated_at = new Date();
      try {
        await dbOnline.update('proyectos', proy.id, { estado: nuevo, updated_at: proy.updated_at });
      } catch (_) {
        await db.proyectos.put(proy);
      }
      if (this.currentProyecto && Number(this.currentProyecto.id) === pid) {
        this.currentProyecto.estado = nuevo;
      }
    },

    // Checkbox rápido: avanza pendiente → en progreso → terminada → confirmada
    async cambiarEstadoTarea(tarea) {
      const estados = ['pendiente', 'en-progreso', 'completada', 'confirmada'];
      const idx = estados.indexOf(tarea.estado || 'pendiente');
      if (idx < 0 || idx >= estados.length - 1) return;
      await this.aplicarEstadoTarea(tarea, estados[idx + 1]);
    },

    async confirmarTarea(tarea) {
      if (!this.$store.auth.isAdmin) return;
      await this.aplicarEstadoTarea(tarea, 'confirmada');
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
      const proy = this.proyectos.find(p => Number(p.id) === Number(id));
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

    // ── Alta de tarea (sin prompt) ──
    abrirFormTarea() {
      this.nuevaTarea = { nombre: '', descripcion: '', prioridad: 'media', horas_estimadas: '', fecha_limite: '' };
      this.showNuevaTarea = true;
      this.$nextTick(() => {
        const el = document.querySelector('#nueva-tarea-nombre');
        if (el) el.focus();
      });
    },

    async guardarNuevaTarea() {
      if (!this.currentProyecto) return;
      const nombre = String(this.nuevaTarea.nombre || '').trim();
      if (!nombre) { UI.toast('Escribe el nombre de la tarea', 'warning'); return; }
      const proyectoId = this.currentProyecto.id;
      const tareaData = {
        proyecto_id: proyectoId,
        nombre,
        descripcion: this.nuevaTarea.descripcion || '',
        estado: 'pendiente',
        prioridad: this.nuevaTarea.prioridad || 'media',
        horas_estimadas: this.nuevaTarea.horas_estimadas ? parseFloat(this.nuevaTarea.horas_estimadas) : null,
        fecha_limite: this.nuevaTarea.fecha_limite || null,
        created_at: new Date(),
        updated_at: new Date()
      };
      try {
        await dbOnline.add('tareas', tareaData);
      } catch (_) {
        await db.tareas.add({ ...tareaData, proyectoId });
      }
      this.tareas = await db.tareas.toArray().catch(() => []);
      this.currentTareas = this.tareas.filter(t => Number(t.proyectoId ?? t.proyecto_id) === Number(proyectoId));
      this.showNuevaTarea = false;
      UI.toast('Tarea agregada', 'success');
    },

    // ── Asignación de responsables (modal con fotos) ──
    get miembrosDisponibles() {
      if (!this.currentProyecto) return [];
      const pid = Number(this.currentProyecto.id);
      return this.perfiles.filter(p =>
        !this.proyectoUsuarios.some(u => Number(u.proyectoId) === pid && Number(u.perfilId) === Number(p.id))
      );
    },

    abrirModalMiembros() {
      this.miembroSeleccionado = null;
      this.showMiembroModal = true;
    },

    async confirmarMiembro() {
      if (!this.miembroSeleccionado || !this.currentProyecto) return;
      const proyectoId = this.currentProyecto.id;
      const perfil = this.perfilDe(this.miembroSeleccionado);
      const puData = { proyecto_id: proyectoId, perfil_id: Number(this.miembroSeleccionado) };
      try {
        await dbOnline.add('proyecto_usuarios', puData);
      } catch (_) {
        await db.proyecto_usuarios.add(puData);
      }
      this.proyectoUsuarios = await db.proyecto_usuarios.toArray().catch(() => []);
      const miembroIds = this.proyectoUsuarios.filter(u => Number(u.proyectoId) === Number(proyectoId)).map(u => Number(u.perfilId));
      this.currentMiembros = this.perfiles.filter(p => miembroIds.includes(Number(p.id)));
      this.showMiembroModal = false;
      this.miembroSeleccionado = null;
      UI.toast(`${perfil ? perfil.nombre : 'Desarrollador'} asignado al proyecto`, 'success');
    },

    // ── Editar proyecto inline ──
    iniciarEdicionProyecto() {
      this.editForm = {
        nombre: this.currentProyecto.nombre || '',
        descripcion: this.currentProyecto.descripcion || '',
        prioridad: this.currentProyecto.prioridad || 'media',
        fecha_limite: this.currentProyecto.fechaLimite || '',
        notas_admin: this.currentProyecto.notas_admin || ''
      };
      this.editingProyecto = true;
    },

    cancelarEdicionProyecto() {
      this.editingProyecto = false;
      this.editForm = { nombre: '', descripcion: '', prioridad: 'media', fecha_limite: '', notas_admin: '' };
    },

    async guardarEdicionProyecto() {
      if (!this.editForm.nombre) { UI.toast('El nombre es obligatorio', 'warning'); return; }
      const updates = {
        nombre: this.editForm.nombre,
        descripcion: this.editForm.descripcion || '',
        prioridad: this.editForm.prioridad || 'media',
        fecha_limite: this.editForm.fecha_limite || null,
        notas_admin: this.editForm.notas_admin || '',
        updated_at: new Date()
      };
      try {
        await dbOnline.update('proyectos', this.currentProyecto.id, updates);
      } catch (_) {
        await db.proyectos.put({ ...this.currentProyecto, ...updates });
      }
      Object.assign(this.currentProyecto, updates);
      this.editingProyecto = false;
      await this.cargarDatos();
      UI.toast('Proyecto actualizado', 'success');
    },

    // ── Editar tarea inline ──
    iniciarEdicionTarea(t) {
      this.editTareaForm = {
        nombre: t.nombre || '',
        descripcion: t.descripcion || '',
        fecha_limite: t.fechaLimite || '',
        asignado_a: t.asignado_a || null,
        prioridad: t.prioridad || 'media',
        horas_estimadas: t.horas_estimadas || ''
      };
      this.editingTareaId = t.id;
    },

    cancelarEdicionTarea() {
      this.editingTareaId = null;
      this.editTareaForm = { nombre: '', descripcion: '', fecha_limite: '', asignado_a: null, prioridad: 'media', horas_estimadas: '' };
    },

    async guardarEdicionTarea(t) {
      if (!this.editTareaForm.nombre) { UI.toast('El nombre es obligatorio', 'warning'); return; }
      const updates = {
        nombre: this.editTareaForm.nombre,
        descripcion: this.editTareaForm.descripcion || '',
        fecha_limite: this.editTareaForm.fecha_limite || null,
        asignado_a: this.editTareaForm.asignado_a || null,
        prioridad: this.editTareaForm.prioridad || 'media',
        horas_estimadas: this.editTareaForm.horas_estimadas ? parseFloat(this.editTareaForm.horas_estimadas) : null,
        updated_at: new Date()
      };
      try {
        await dbOnline.update('tareas', t.id, updates);
      } catch (_) {
        await db.tareas.put({ ...t, ...updates });
      }
      Object.assign(t, updates);
      this.editingTareaId = null;
      this.tareas = await db.tareas.toArray().catch(() => []);
      this.currentTareas = this.tareas.filter(ta => Number(ta.proyectoId ?? ta.proyecto_id) === Number(this.currentProyecto.id));
      UI.toast('Tarea actualizada', 'success');
    },

    async eliminarTarea(t) {
      if (!this.$store.auth.isAdmin) return;
      const ok = await UI.confirm(`¿Eliminar la tarea "${t.nombre}"?`, 'Eliminar tarea');
      if (!ok) return;
      try {
        await dbOnline.delete('tareas', t.id);
      } catch (_) {
        await db.tareas.delete(t.id);
      }
      this.tareas = await db.tareas.toArray().catch(() => []);
      this.currentTareas = this.tareas.filter(ta => Number(ta.proyectoId ?? ta.proyecto_id) === Number(this.currentProyecto.id));
      UI.toast('Tarea eliminada', 'success');
    },

    // ── Exportar Excel ──
    async exportarExcelProyectos() {
      try {
        const wb = XLSX.utils.book_new();

        // Hoja 1: Proyectos
        const proyRows = this.proyectos.map(p => ({
          'ID': p.id,
          'Nombre': p.nombre,
          'Descripción': p.descripcion || '',
          'Prioridad': p.prioridad,
          'Estado': p.estado,
          'Fecha límite': p.fechaLimite ? dayjs(p.fechaLimite).format('DD/MM/YYYY') : '',
          'Avance %': this.avanceProyecto(p.id),
          'Responsables': this.proyectoUsuarios.filter(u => u.proyectoId === p.id).map(u => this.perfiles.find(r => r.id === u.perfilId)?.nombre || '').join(', '),
          'Creado': p.created_at ? dayjs(p.created_at).format('DD/MM/YYYY') : ''
        }));
        const ws1 = XLSX.utils.json_to_sheet(proyRows);
        ws1['!cols'] = [{ wch: 5 }, { wch: 30 }, { wch: 40 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 8 }, { wch: 30 }, { wch: 14 }];
        XLSX.utils.book_append_sheet(wb, ws1, 'Proyectos');

        // Hoja 2: Tareas
        const tarRows = this.tareas.map(t => {
          const proy = this.proyectos.find(p => p.id === t.proyectoId);
          const asignado = t.asignado_a ? this.perfiles.find(r => r.id === t.asignado_a)?.nombre : '';
          return {
            'ID': t.id,
            'Proyecto': proy?.nombre || '',
            'Nombre': t.nombre,
            'Descripción': t.descripcion || '',
            'Estado': t.estado,
            'Prioridad': t.prioridad || 'media',
            'Asignado a': asignado,
            'Horas est.': t.horas_estimadas || '',
            'Fecha límite': t.fechaLimite ? dayjs(t.fechaLimite).format('DD/MM/YYYY') : '',
            'Comentario': t.comentario_dev || '',
            'Creado': t.created_at ? dayjs(t.created_at).format('DD/MM/YYYY') : ''
          };
        });
        const ws2 = XLSX.utils.json_to_sheet(tarRows);
        ws2['!cols'] = [{ wch: 5 }, { wch: 25 }, { wch: 30 }, { wch: 35 }, { wch: 14 }, { wch: 10 }, { wch: 20 }, { wch: 10 }, { wch: 14 }, { wch: 30 }, { wch: 14 }];
        XLSX.utils.book_append_sheet(wb, ws2, 'Tareas');

        const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        await UI.descargar(`proyectos_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`, blob, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        UI.toast(`Excel exportado: ${this.proyectos.length} proyectos, ${this.tareas.length} tareas`, 'success');
      } catch (err) {
        UI.toast('Error al exportar Excel: ' + err.message, 'error');
      }
    },

    // ── Notificación de fechas próximas ──
    _checkDueDates() {
      const now = dayjs();
      const vencidos = [];
      const proximos = [];
      for (const p of this.proyectos) {
        if (!p.fechaLimite || p.estado === 'completado') continue;
        const diff = dayjs(p.fechaLimite).diff(now, 'day');
        if (diff < 0) vencidos.push(p);
        else if (diff <= 3) proximos.push(p);
      }
      for (const t of this.tareas) {
        if (!t.fechaLimite || t.estado === 'confirmada') continue;
        const diff = dayjs(t.fechaLimite).diff(now, 'day');
        if (diff < 0 && !vencidos.some(v => v.nombre === t.nombre && v.fechaLimite === t.fechaLimite)) {
          const proy = this.proyectos.find(p => p.id === t.proyectoId);
          vencidos.push({ ...t, _tipo: 'tarea', _proyNombre: proy?.nombre });
        } else if (diff <= 3 && diff >= 0 && !proximos.some(v => v.nombre === t.nombre && v.fechaLimite === t.fechaLimite)) {
          const proy = this.proyectos.find(p => p.id === t.proyectoId);
          proximos.push({ ...t, _tipo: 'tarea', _proyNombre: proy?.nombre });
        }
      }
      if (vencidos.length) {
        const msgs = vencidos.slice(0, 3).map(v => {
          if (v._tipo === 'tarea') return `"${v.nombre}" (${v._proyNombre})`;
          return `"${v.nombre}"`;
        }).join(', ');
        UI.toast(`${vencidos.length} vencido(s): ${msgs}${vencidos.length > 3 ? ` y ${vencidos.length - 3} más` : ''}`, 'warning');
      }
      if (proximos.length) {
        const msgs = proximos.slice(0, 3).map(v => {
          if (v._tipo === 'tarea') return `"${v.nombre}" (${v._proyNombre})`;
          return `"${v.nombre}"`;
        }).join(', ');
        UI.toast(`${proximos.length} por vencer en 3 días: ${msgs}${proximos.length > 3 ? ` y ${proximos.length - 3} más` : ''}`, 'info');
      }
    }
  };
}

window.MODULES = window.MODULES || {};
window.MODULES[PROYECTOS.id] = PROYECTOS;
appRouter.register(PROYECTOS);
