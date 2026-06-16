// modules/perfiles/module.js
const Perfiles = {
  id: 'perfiles',
  titulo: 'Perfiles',

  async init() {
    console.log('💡 [perfiles] Inicializado');
  },

  async render({ params: routeParams } = { params: [] }) {
    let perfiles = (await dbLocal.getAll('perfiles')).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
    const habilidades = (await dbLocal.getAll('habilidades')).sort((a, b) => (a.categoria || '').localeCompare(b.categoria || ''));
    const relaciones = await dbLocal.getAll('perfil_habilidades');

    // 💡 Preparar perfiles con sus skills
    const perfilesData = [];
    for (const p of perfiles) {
      const perfilSkills = relaciones
        .filter(r => r.perfil_id == p.id)
        .map(r => habilidades.find(h => h.id == r.habilidad_id))
        .filter(Boolean);
      const dniDecrypted = cryptoHelpers.decrypt(p.dni || '');
      perfilesData.push({
        ...p,
        email: cryptoHelpers.decrypt(p.email || '') || (p.email ? '·· Reingresar ··' : ''),
        telefono: cryptoHelpers.decrypt(p.telefono || '') || (p.telefono ? '·· Reingresar ··' : ''),
        direccion: cryptoHelpers.decrypt(p.direccion || '') || (p.direccion ? '·· Reingresar ··' : ''),
        dni: dniDecrypted,
        edad: calcularEdad(dniDecrypted),
        skills: perfilSkills.map(s => s.id),
        skillNames: perfilSkills.map(s => s.nombre)
      });
    }

    // 💡 Agrupar habilidades por categoría
    const categorias = {};
    habilidades.forEach(h => {
      if (!categorias[h.categoria]) categorias[h.categoria] = [];
      categorias[h.categoria].push(h);
    });

    return `
<div x-data="perfilesData(${JSON.stringify(perfilesData).replace(/"/g, '&quot;')}, ${JSON.stringify(categorias).replace(/"/g, '&quot;')}, ${JSON.stringify(habilidades).replace(/"/g, '&quot;')}, ${JSON.stringify(routeParams.includes('nuevo'))})">

  <!-- Header con contador -->
  <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
    <div>
      <h2 class="text-xl font-semibold tracking-heading flex items-center gap-2">
        <i class="bi bi-people-fill text-accent"></i> Perfiles
      </h2>
      <p class="text-xs mt-1 text-muted" x-text="perfiles.length + ' dev' + (perfiles.length !== 1 ? 's' : '') + ' en el equipo'"></p>
    </div>
    <div class="flex flex-wrap gap-2">
      <label x-show="$store.auth.isAdmin" class="btn btn-ghost btn-sm cursor-pointer gap-1.5 radius-sm">
        <i class="bi bi-upload"></i> Importar
        <input type="file" accept=".json" class="hidden" @change="importarPerfilJSON($event)">
      </label>
      <button x-show="$store.auth.isAdmin" class="btn btn-ghost btn-sm gap-1.5 radius-sm" @click="exportarExcel()">
        <i class="bi bi-file-earmark-spreadsheet-fill text-accent"></i> Excel
      </button>
      <button x-show="$store.auth.isAdmin" class="btn btn-primary btn-magnetic btn-sm gap-1.5 radius-sm" @click="abrirFormulario()">
        <i class="bi bi-person-plus-fill"></i> Nuevo desarrollador
      </button>
    </div>
  </div>

  <!-- Grid de tarjetas -->
  <template x-if="perfiles.length === 0">
    <div x-html="UI.emptyState('No hay perfiles aún. Crea el primero.', 'bi-person-plus', { handler: 'abrirFormulario()', label: 'Crear perfil', icon: 'bi-person-plus-fill' })"></div>
  </template>

  <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" x-show="perfiles.length > 0">
    <template x-for="(dev, index) in perfiles" :key="dev.id">
      <div class="card bg-white group stagger-enter card-hover" :style="'animation-delay: ' + (index * 60) + 'ms'">
        <div class="card-body p-5">
          <!-- Foto + Nombre -->
          <div class="flex items-start gap-4">
            <div class="avatar">
              <div class="w-14 h-14 rounded-xl overflow-hidden flex items-center justify-center bg-muted">
                <template x-if="dev.fotoBase64">
                  <img :src="dev.fotoBase64" :alt="dev.nombre" class="w-full h-full object-cover">
                </template>
                <template x-if="!dev.fotoBase64">
                  <i class="bi bi-person-fill text-xl text-faint"></i>
                </template>
              </div>
            </div>
            <div class="w-10 h-10 rounded-full bg-accent flex-shrink-0 flex items-center justify-center text-white font-bold text-sm"
                 x-show="dev.edad" x-text="dev.edad">
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="font-semibold text-sm tracking-heading truncate" x-text="dev.nombre"></h3>
              <p class="text-sm text-accent" x-text="dev.cargo"></p>
              <p class="text-xs mt-0.5 text-faint" x-text="UI.formatDateRelative(dev.created_at)"></p>
            </div>
          </div>

          <!-- Bio -->
          <p class="text-sm mt-3 leading-relaxed line-clamp-2 text-muted" x-text="dev.bio || 'Sin descripción'"></p>

          <!-- Contacto -->
          <div class="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-muted">
            <span x-show="dev.dni" class="flex items-center gap-1">
              <i class="bi bi-card-text"></i> <span x-text="dev.dni"></span>
            </span>
            <span x-show="dev.email" class="flex items-center gap-1">
              <i class="bi bi-envelope"></i> <span x-text="dev.email"></span>
            </span>
            <span x-show="dev.telefono" class="flex items-center gap-1">
              <i class="bi bi-telephone"></i> <span x-text="dev.telefono"></span>
            </span>
            <span x-show="dev.direccion" class="flex items-center gap-1">
              <i class="bi bi-geo-alt"></i> <span x-text="dev.direccion"></span>
            </span>
          </div>

          <!-- Skills -->
          <div class="flex flex-wrap gap-1.5 mt-3">
            <template x-for="skill in dev.skillNames.slice(0, 5)" :key="skill">
              <span class="badge badge-sm radius-sm" x-text="skill"></span>
            </template>
            <span x-show="dev.skillNames.length > 5" class="badge badge-sm badge-ghost radius-sm" x-text=" '+' + (dev.skillNames.length - 5)"></span>
          </div>

          <!-- Acciones -->
          <div class="flex justify-end gap-0.5 mt-4 pt-3 border-t-default">
            <button class="btn btn-ghost btn-xs btn-square" @click="exportarPerfilJSON(dev)" aria-label="Exportar JSON" title="Exportar JSON">
              <i class="bi bi-download"></i>
            </button>
            <button class="btn btn-ghost btn-xs gap-1" @click="verCV(dev.id)" aria-label="Ver CV" title="Ver CV">
              <i class="bi bi-file-earmark-richtext"></i> CV
            </button>
            <button x-show="$store.auth.canEdit(dev.id)" class="btn btn-ghost btn-xs btn-square" @click="editar(dev.id)" aria-label="Editar" title="Editar">
              <i class="bi bi-pencil"></i>
            </button>
            <button x-show="$store.auth.isAdmin" class="btn btn-ghost btn-xs text-error" @click="eliminar(dev.id)" aria-label="Eliminar" title="Eliminar">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>

  <!-- Modal Formulario — Linear-inspired -->
  <div x-show="showModal" class="modal modal-open" @keydown.escape.window="cerrarFormulario()">
    <div class="modal-box w-11/12 max-w-3xl p-0 overflow-hidden radius-lg" style="max-height: 90vh; display: flex; flex-direction: column;">
      <!-- Header sticky -->
      <div class="flex justify-between items-center px-6 py-4 shrink-0 border-b-default bg-elevated">
        <div>
          <h3 class="font-semibold text-base tracking-heading flex items-center gap-2">
            <i class="bi bi-person-badge text-accent"></i>
            <span x-text="editando ? 'Editar perfil' : 'Nuevo desarrollador'"></span>
          </h3>
          <p class="text-xs text-muted mt-0.5" x-text="editando ? 'Actualiza los datos del desarrollador' : 'Completa la información para crear la ficha'"></p>
        </div>
<button class="btn btn-ghost btn-sm btn-circle radius-sm" @click="cerrarFormulario()" title="Cerrar" aria-label="Cerrar">
  <i class="bi bi-x-lg text-sm"></i>
</button>
      </div>

      <!-- Scrollable body -->
      <div class="overflow-y-auto flex-1 px-6 py-5">
        <div class="divide-y divide-[var(--border)]">
          <!-- Sección: Foto + Identidad -->
          <div class="pb-5 mb-5 border-b-default">
            <span class="section-label block mb-3">Foto e identidad</span>
            <div class="flex items-start gap-5 p-4 rounded-lg bg-muted border-default" @dragover.prevent="dragOver = true" @dragleave.prevent="dragOver = false" @drop.prevent="procesarArchivo($event.dataTransfer.files[0])">
              <!-- Avatar preview -->
              <div class="shrink-0">
                <div class="w-20 h-20 rounded-xl overflow-hidden flex items-center justify-center ring-1 ring-base-200 transition-all"
                     :style="form.fotoBase64 ? 'ring-color: var(--accent-border)' : ''">
                  <template x-if="form.fotoBase64">
                    <img :src="form.fotoBase64" alt="Foto del desarrollador" class="w-full h-full object-cover">
                  </template>
                  <template x-if="!form.fotoBase64">
                    <div class="w-full h-full flex items-center justify-center bg-elevated">
                      <i class="bi bi-person-fill text-3xl text-base-content/15"></i>
                    </div>
                  </template>
                </div>
              </div>
              <!-- Upload controls -->
               <div class="flex-1 pt-1">
                <p class="text-sm font-medium mb-1">Foto de perfil</p>
                <p class="text-xs text-base-content/35 mb-3">JPG o PNG. Se almacena localmente en la base de datos.</p>
                <div class="flex gap-2">
                  <label class="btn btn-sm gap-1.5 radius-sm border-default cursor-pointer" for="foto-input" style="background: transparent;"
                         :style="dragOver ? 'border-color: var(--accent); background: rgba(21,128,61,0.08);' : ''">
                    <i class="bi bi-camera text-xs"></i>
                    <span x-text="form.fotoBase64 ? 'Cambiar' : 'Subir foto'"></span>
                  </label>
                  <button x-show="form.fotoBase64" class="btn btn-sm btn-ghost gap-1.5 radius-sm" @click="form.fotoBase64 = ''">
                    <i class="bi bi-trash text-xs text-error"></i> Quitar
                  </button>
                  <input type="file" id="foto-input" accept="image/*" class="hidden" @change="cargarFoto($event)">
                </div>
              </div>
            </div>
          </div>

          <!-- Sección: Datos personales -->
          <div class="pb-5 mb-5 border-b-default">
            <span class="section-label block mb-3">Datos personales</span>
            <div class="space-y-3">
              <label class="form-control w-full">
                <span class="label-text font-medium text-xs uppercase tracking-wider text-base-content/50 mb-1.5">Nombre completo <span class="text-accent">*</span></span>
                <input type="text" x-model="form.nombre" class="input input-bordered w-full radius-sm" placeholder="Ej: Ana García" aria-describedby="error-nombre">
                <span x-show="formErrors.nombre" x-text="formErrors.nombre" class="text-xs text-error mt-1 flex items-center gap-1" id="error-nombre" data-error><i class="bi bi-exclamation-triangle-fill"></i> </span>
              </label>
              <label class="form-control w-full">
                <span class="label-text font-medium text-xs uppercase tracking-wider text-base-content/50 mb-1.5">Cargo / Rol <span class="text-accent">*</span></span>
                <input type="text" x-model="form.cargo" class="input input-bordered w-full radius-sm" placeholder="Ej: Frontend Senior" aria-describedby="error-cargo">
                <span x-show="formErrors.cargo" x-text="formErrors.cargo" class="text-xs text-error mt-1 flex items-center gap-1" id="error-cargo" data-error><i class="bi bi-exclamation-triangle-fill"></i> </span>
              </label>
              <label class="form-control w-full">
                <span class="label-text font-medium text-xs uppercase tracking-wider text-base-content/50 mb-1.5">Biografía</span>
                <textarea x-model="form.bio" class="textarea textarea-bordered w-full h-20 radius-sm" placeholder="Breve descripción profesional..."></textarea>
              </label>
              <label class="form-control w-full">
                <span class="label-text font-medium text-xs uppercase tracking-wider text-base-content/50 mb-1.5">DNI / Documento de identidad</span>
                <input type="text" x-model="form.dni" class="input input-bordered w-full radius-sm" placeholder="Ej: 12345678A">
              </label>
            </div>
          </div>

          <!-- Sección: Contacto -->
          <div class="pb-5 mb-5 border-b-default">
            <span class="section-label block mb-3">Contacto</span>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label class="form-control w-full">
                <span class="label-text font-medium text-xs uppercase tracking-wider text-base-content/50 mb-1.5">Email <span class="text-accent">*</span></span>
                <input type="email" x-model="form.email" class="input input-bordered w-full radius-sm" placeholder="correo@ejemplo.com" aria-describedby="error-email">
                <span x-show="formErrors.email" x-text="formErrors.email" class="text-xs text-error mt-1 flex items-center gap-1" id="error-email" data-error><i class="bi bi-exclamation-triangle-fill"></i> </span>
              </label>
              <label class="form-control w-full">
                <span class="label-text font-medium text-xs uppercase tracking-wider text-base-content/50 mb-1.5">Teléfono</span>
                <input type="tel" x-model="form.telefono" class="input input-bordered w-full radius-sm" placeholder="+34 600 000 000">
              </label>
            </div>
            <div class="mt-3">
              <label class="form-control w-full">
                <span class="label-text font-medium text-xs uppercase tracking-wider text-base-content/50 mb-1.5">Dirección particular</span>
                <input type="text" x-model="form.direccion" class="input input-bordered w-full radius-sm" placeholder="Calle, número, ciudad, código postal">
              </label>
            </div>
          </div>

          <!-- Sección: Habilidades -->
          <div>
            <div class="flex items-center justify-between mb-3">
              <span class="section-label">Habilidades técnicas</span>
              <div class="flex gap-2">
                <button type="button" class="btn btn-ghost btn-xs gap-1 radius-sm transition-spring" @click="agregarCategoria()" title="Nueva categoría">
                  <i class="bi bi-folder-plus text-accent"></i> <span class="text-xs">Categoría</span>
                </button>
                <button type="button" class="btn btn-ghost btn-xs gap-1 radius-sm transition-spring" @click="agregarSkill()" title="Nueva habilidad">
                  <i class="bi bi-plus-lg text-accent"></i> <span class="text-xs">Habilidad</span>
                </button>
                <span class="badge badge-sm badge-ghost radius-sm text-muted font-normal" x-text="form.skills.length + ' seleccionadas'"></span>
              </div>
            </div>
            <div class="space-y-3 max-h-56 overflow-y-auto pr-1">
              <template x-for="(skills, categoria) in categorias" :key="categoria">
                <div class="p-2.5 rounded-lg stagger-enter bg-muted border-default" :style="'animation-delay: ' + (Object.keys(categorias).indexOf(categoria) * 0.05) + 's'">
                  <div class="flex items-center justify-between mb-2">
                    <p class="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 text-muted">
                      <i class="bi bi-folder-fill text-accent/50 text-[10px]"></i>
                      <span x-text="categoria"></span>
                    </p>
                    <span class="badge badge-xs badge-ghost text-faint font-mono-data" x-text="skills.length"></span>
                  </div>
                  <div class="flex flex-wrap gap-1">
                    <template x-for="skill in skills" :key="skill.id">
                      <label class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md cursor-pointer transition-spring radius-sm"
                             :class="form.skills.includes(skill.id) ? 'bg-accent/10 border-accent-border' : 'bg-base-200/50 hover:bg-base-200'"
                             style="border: 1px solid transparent;">
                        <input type="checkbox" class="checkbox checkbox-xs"
                               style="border-radius: 3px; --chkbg: var(--accent);"
                               :aria-label="'Seleccionar ' + skill.nombre"
                               :value="skill.id"
                               :checked="form.skills.includes(skill.id)"
                               @change="toggleSkill(skill.id, $event)">
                        <span class="text-xs" :class="form.skills.includes(skill.id) ? 'text-accent font-medium' : 'text-base-content/70'" x-text="skill.nombre"></span>
                      </label>
                    </template>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer sticky -->
      <div class="flex justify-between items-center px-6 py-4 shrink-0 border-t-default bg-elevated">
        <div class="text-xs text-base-content/50">
          <i class="bi bi-shield-lock text-[10px]"></i> <span>Email, teléfono, DNI y dirección se cifran automáticamente</span>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-ghost btn-sm radius-sm" @click="cerrarFormulario()">Cancelar</button>
          <button class="btn btn-primary btn-magnetic btn-sm gap-1.5 radius-sm" @click="guardar()" :disabled="!form.nombre || !form.email || !form.cargo || saving">
            <i class="bi bi-check-lg"></i>
            <span x-show="!saving" x-text="editando ? 'Actualizar' : 'Guardar'"></span>
            <span x-show="saving" class="loading loading-spinner loading-xs"></span>
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Modal: Nueva categoría -->
  <div x-show="showCatModal" class="modal modal-open" data-modal="cat" @keydown.escape.window="showCatModal = false">
    <div class="modal-box w-11/12 max-w-md radius-lg">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-semibold text-base tracking-heading flex items-center gap-2">
          <i class="bi bi-folder-plus text-accent"></i> Nueva categoría
        </h3>
      </div>
      <label class="form-control w-full">
        <span class="label-text font-medium text-xs uppercase tracking-wider text-base-content/50 mb-1.5">Nombre de la categoría</span>
        <input type="text" x-model="newCat" class="input input-bordered w-full radius-sm" placeholder="Ej: Lenguajes" @keydown.enter.prevent="guardarCategoria()">
      </label>
      <div class="modal-action">
        <button class="btn btn-ghost btn-sm radius-sm" @click="showCatModal = false">Cancelar</button>
        <button class="btn btn-primary btn-magnetic btn-sm radius-sm" @click="guardarCategoria()" :disabled="!newCat.trim()">
          <i class="bi bi-check-lg"></i> Crear
        </button>
      </div>
    </div>
  </div>

  <!-- Modal: Nueva habilidad -->
  <div x-show="showSkillModal" class="modal modal-open" data-modal="skill" @keydown.escape.window="showSkillModal = false">
    <div class="modal-box w-11/12 max-w-md radius-lg">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-semibold text-base tracking-heading flex items-center gap-2">
          <i class="bi bi-plus-lg text-accent"></i> Nueva habilidad
        </h3>
      </div>
      <div class="space-y-3">
        <label class="form-control w-full">
          <span class="label-text font-medium text-xs uppercase tracking-wider text-base-content/50 mb-1.5">Categoría</span>
          <select x-model="newSkillCategoria" class="select select-bordered w-full radius-sm">
            <template x-for="cat in Object.keys(categorias)" :key="cat">
              <option :value="cat" x-text="cat"></option>
            </template>
          </select>
        </label>
        <label class="form-control w-full">
          <span class="label-text font-medium text-xs uppercase tracking-wider text-base-content/50 mb-1.5">Nombre de la habilidad</span>
          <input type="text" x-model="newSkillNombre" class="input input-bordered w-full radius-sm" placeholder="Ej: React" @keydown.enter.prevent="guardarSkill()">
        </label>
      </div>
      <div class="modal-action">
        <button class="btn btn-ghost btn-sm radius-sm" @click="showSkillModal = false">Cancelar</button>
        <button class="btn btn-primary btn-magnetic btn-sm radius-sm" @click="guardarSkill()" :disabled="!newSkillNombre.trim()">
          <i class="bi bi-check-lg"></i> Crear
        </button>
      </div>
    </div>
  </div>
</div>
`;
  },

  destroy() {
    console.log('💡 [perfiles] Destruído');
  }
};

// 💡 Alpine data factory
function perfilesData(perfiles, categorias, habilidades, abrirForm) {
  return {
    perfiles,
    categorias,
    habilidades,
    showModal: false,
    editando: null,
    saved: false,
    saving: false,
    dragOver: false,
    _prevFocus: null,
    form: {
      id: null,
      nombre: '',
      email: '',
      telefono: '',
      direccion: '',
      dni: '',
      cargo: '',
      bio: '',
      fotoBase64: '',
      skills: []
    },
    formErrors: { nombre: '', email: '', cargo: '' },
    showCatModal: false,
    newCat: '',
    showSkillModal: false,
    newSkillNombre: '',
    newSkillCategoria: '',

    agregarCategoria() {
      this.newCat = '';
      this.showCatModal = true;
    },

    guardarCategoria() {
      const name = this.newCat.trim();
      if (!name) { UI.toast('Nombre de categoría requerido', 'warning'); return; }
      if (this.categorias[name]) { UI.toast('Esa categoría ya existe', 'warning'); return; }
      this.categorias[name] = [];
      this.showCatModal = false;
      UI.toast(`Categoría "${name}" creada`, 'success');
    },

    agregarSkill() {
      const cats = Object.keys(this.categorias);
      if (cats.length === 0) { UI.toast('Crea una categoría primero', 'warning'); return; }
      this.newSkillNombre = '';
      this.newSkillCategoria = cats[0];
      this.showSkillModal = true;
    },

    async guardarSkill() {
      const name = this.newSkillNombre.trim();
      const cat = this.newSkillCategoria;
      if (!name) { UI.toast('Nombre de habilidad requerido', 'warning'); return; }
      const existente = this.categorias[cat].find(s => s.nombre.toLowerCase() === name.toLowerCase());
      if (existente) { UI.toast('Esa habilidad ya existe en la categoría', 'warning'); return; }
      await dbOnline.add('habilidades', { nombre: name, categoria: cat, created_at: new Date() });
      const hb = await dbLocal.getAll('habilidades');
      this.habilidades = hb;
      this.categorias = {};
      hb.forEach(h => {
        if (!this.categorias[h.categoria]) this.categorias[h.categoria] = [];
        this.categorias[h.categoria].push(h);
      });
      this.showSkillModal = false;
      UI.toast(`Habilidad "${name}" creada exitosamente`, 'success');
    },

    abrirFormulario() {
      this.formErrors = { nombre: '', email: '', cargo: '' };
      this.form = { id: null, nombre: '', email: '', telefono: '', direccion: '', dni: '', cargo: '', bio: '', fotoBase64: '', skills: [] };
      this.editando = null;
      this.showModal = true;
    },

    editar(id) {
      const dev = this.perfiles.find(p => p.id === id);
      if (!dev) return;
      this.form = {
        id: dev.id,
        nombre: dev.nombre,
        email: dev.email || '',
        telefono: dev.telefono || '',
        direccion: dev.direccion || '',
        dni: dev.dni || '',
        cargo: dev.cargo,
        bio: dev.bio || '',
        fotoBase64: dev.fotoBase64 || '',
        skills: [...dev.skills]
      };
      this.editando = id;
      this.showModal = true;
    },

    cerrarFormulario() {
      this.showModal = false;
      this.saved = false;
      if (this._prevFocus) {
        this._prevFocus.focus();
        this._prevFocus = null;
      }
    },

    toggleSkill(skillId, event) {
      if (event.target.checked) {
        if (!this.form.skills.includes(skillId)) this.form.skills.push(skillId);
      } else {
        this.form.skills = this.form.skills.filter(s => s !== skillId);
      }
    },

    cargarFoto(event) {
      const file = event.target.files[0];
      this.procesarArchivo(file);
    },

    procesarArchivo(file) {
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        UI.toast('Solo se permiten archivos de imagen', 'warning');
        return;
      }
      this.dragOver = false;
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const maxSize = 400;
          let { width, height } = img;
          if (width > maxSize || height > maxSize) {
            const ratio = Math.min(maxSize / width, maxSize / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          this.form.fotoBase64 = canvas.toDataURL('image/jpeg', 0.8);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    },

    async guardar() {
      if (this.saving) return;
      this.saving = true;
      this.formErrors = { nombre: '', email: '', cargo: '' };
      try {
        if (!this.form.nombre) this.formErrors.nombre = 'El nombre es obligatorio';
        if (!this.form.email) this.formErrors.email = 'El email es obligatorio';
        if (!this.form.cargo) this.formErrors.cargo = 'El cargo es obligatorio';
        if (this.formErrors.nombre || this.formErrors.email || this.formErrors.cargo) {
          UI.toast('Corrige los campos marcados', 'warning');
          this.$nextTick(() => {
            const firstError = this.$el.querySelector('[data-error]');
            if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
          });
          return;
        }

        // Verificar email duplicado — consulta directa a DB, no array local
        const emailNormalizado = this.form.email.toLowerCase().trim();
        const emailHash = CryptoJS.SHA256(emailNormalizado).toString(CryptoJS.enc.Hex);
        const existentes = await dbLocal.getWhere('perfiles', 'email_hash', emailHash);
        const duplicado = existentes.some(p => (this.editando ? p.id !== this.editando : true));
        if (duplicado) {
          this.formErrors.email = 'Ya existe un perfil con este email';
          UI.toast('Ya existe un perfil con este email', 'warning');
          return;
        }

        const datos = {
          nombre: this.form.nombre,
          email: cryptoHelpers.encrypt(this.form.email),
          email_hash: emailHash,
          telefono: this.form.telefono ? cryptoHelpers.encrypt(this.form.telefono) : '',
          direccion: this.form.direccion ? cryptoHelpers.encrypt(this.form.direccion) : '',
          dni: this.form.dni ? cryptoHelpers.encrypt(this.form.dni) : '',
          cargo: this.form.cargo,
          bio: this.form.bio,
          fotoBase64: this.form.fotoBase64,
          updated_at: new Date()
        };

        let perfilId;
        let modoOffline = false;
        if (this.editando) {
          datos.created_at = this.perfiles.find(p => p.id === this.editando)?.created_at || new Date();
          try {
            await dbOnline.update('perfiles', this.editando, datos);
          } catch (_) {
            await db.perfiles.put({ ...datos, id: this.editando });
            modoOffline = true;
          }
          perfilId = this.editando;
        } else {
          datos.created_at = new Date();
          try {
            const creado = await dbOnline.add('perfiles', datos);
            perfilId = creado.id;
          } catch (_) {
            perfilId = await db.perfiles.add(datos);
            modoOffline = true;
          }
        }

        // 💡 Actualizar habilidades — con fallback a local
        try {
          await dbOnline.bulkDelete('perfil_habilidades', 'perfil_id', perfilId);
        } catch (_) {
          await db.perfil_habilidades.where('perfil_id').equals(perfilId).delete();
        }

        if (this.form.skills.length) {
          const relaciones = this.form.skills.map(skillId => ({
            perfil_id: perfilId,
            habilidad_id: skillId
          }));
          try {
            await Promise.all(relaciones.map(rel => dbOnline.add('perfil_habilidades', rel)));
          } catch (_) {
            await db.perfil_habilidades.bulkAdd(relaciones);
          }
        }

        this.cerrarFormulario();
        window.dispatchEvent(new CustomEvent('db-change'));
        UI.toast(modoOffline
          ? (this.editando ? 'Perfil guardado localmente (sin conexión)' : 'Desarrollador guardado localmente (sin conexión)')
          : (this.editando ? 'Perfil actualizado correctamente' : 'Desarrollador creado correctamente'),
          modoOffline ? 'warning' : 'success');
        const authStore = Alpine.store('auth');
        if (authStore.isLoggedIn && authStore.user?.perfilId === perfilId) {
          const perfilActualizado = await dbLocal.get('perfiles', perfilId);
          authStore.setPerfil(perfilActualizado);
        }
        window.location.hash = '#/perfiles';
      } catch (err) {
        UI.toast('Error al guardar: ' + err.message, 'error');
      } finally {
        this.saving = false;
      }
    },

    async eliminar(id) {
      const dev = this.perfiles.find(p => p.id === id);
      if (!dev) return;
      const ok = await UI.confirm(`¿Eliminar el perfil de "${dev.nombre}"?`, 'Eliminar perfil');
      if (!ok) return;

      try {
        await dbOnline.bulkDelete('perfil_habilidades', 'perfil_id', id);
        await dbOnline.delete('perfiles', id);
        UI.toast('Perfil eliminado', 'success');
        window.dispatchEvent(new CustomEvent('db-change'));
        window.location.hash = '#/perfiles';
      } catch (err) {
        UI.toast('Error al eliminar: ' + err.message, 'error');
      }
    },

    verCV(id) {
      window.location.hash = `#/cv/${id}`;
    },

    async exportarPerfilJSON(dev) {
      try {
        const relaciones = await dbLocal.getWhere('perfil_habilidades', 'perfil_id', dev.id);
        const habilidades = await dbLocal.getAll('habilidades');
        const perfilSkills = relaciones
          .map(r => habilidades.find(h => h.id == r.habilidad_id))
          .filter(Boolean);

        const perfilData = {
          version: APP_CONFIG.app.version,
          fecha: new Date().toISOString(),
          app: APP_CONFIG.app.nombre,
          tipo: 'perfil_individual',
          perfil: {
            ...dev,
            email: dev.email || '',
            telefono: dev.telefono || ''
          },
          habilidades: perfilSkills.map(s => ({ nombre: s.nombre, categoria: s.categoria }))
        };

        const blob = new Blob([JSON.stringify(perfilData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `perfil_${dev.nombre.replace(/\s+/g, '_')}_${dayjs().format('YYYYMMDD')}.json`;
        a.click();
        URL.revokeObjectURL(url);
        UI.toast(`Perfil de "${dev.nombre}" exportado`, 'success');
      } catch (err) {
        UI.toast('Error al exportar: ' + err.message, 'error');
      }
    },

    async importarPerfilJSON(event) {
      const file = event.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (!data.app || data.app !== APP_CONFIG.app.nombre || data.tipo !== 'perfil_individual') {
          UI.toast('Archivo no es un perfil de DevCardCV válido', 'error');
          return;
        }

        const perfil = data.perfil;
        const ok = await UI.confirm(
          `¿Importar perfil de "${perfil.nombre}" (${perfil.cargo})?<br>Si ya existe un perfil con el mismo email, se actualizará.`,
          'Importar perfil'
        );
        if (!ok) return;

        // 💡 Buscar si ya existe por email
        const todos = await dbLocal.getAll('perfiles');
        const existente = todos.find(p => cryptoHelpers.decrypt(p.email || '') === perfil.email);

        // 💡 Asegurar que las habilidades existen
        for (const skill of (data.habilidades || [])) {
          const existentes = await dbLocal.getWhere('habilidades', 'nombre', skill.nombre);
          if (existentes.length === 0) {
            await dbOnline.add('habilidades', { nombre: skill.nombre, categoria: skill.categoria, created_at: new Date(), updated_at: new Date() });
          }
        }

        // 💡 Insertar o actualizar perfil
        let perfilId;
        const emailHash = perfil.email ? CryptoJS.SHA256(perfil.email.toLowerCase().trim()).toString(CryptoJS.enc.Hex) : '';
        const datos = {
          nombre: perfil.nombre,
          email: cryptoHelpers.encrypt(perfil.email || ''),
          email_hash: emailHash,
          telefono: perfil.telefono ? cryptoHelpers.encrypt(perfil.telefono) : '',
          dni: perfil.dni ? cryptoHelpers.encrypt(perfil.dni) : '',
          cargo: perfil.cargo,
          bio: perfil.bio || '',
          fotoBase64: perfil.fotoBase64 || '',
          updated_at: new Date()
        };

        if (existente) {
          datos.created_at = existente.created_at;
          await dbOnline.update('perfiles', existente.id, datos);
          perfilId = existente.id;
          await dbOnline.bulkDelete('perfil_habilidades', 'perfil_id', perfilId);
          UI.toast(`Perfil de "${perfil.nombre}" actualizado`, 'success');
        } else {
          datos.created_at = new Date();
          const creadoImport = await dbOnline.add('perfiles', datos);
          perfilId = creadoImport.id;
          UI.toast(`Perfil de "${perfil.nombre}" importado`, 'success');
        }

        // 💡 Asignar habilidades
        const todasHabilidades = await dbLocal.getAll('habilidades');
        for (const skill of (data.habilidades || [])) {
          const hab = todasHabilidades.find(h => h.nombre === skill.nombre);
          if (hab) {
            await dbOnline.add('perfil_habilidades', { perfil_id: perfilId, habilidad_id: hab.id });
          }
        }

        window.dispatchEvent(new CustomEvent('db-change'));
        window.location.hash = '#/perfiles';
      } catch (err) {
        UI.toast('Error al importar: ' + err.message, 'error');
      }
      event.target.value = '';
    },

    async exportarExcel() {
      try {
        const todos = await dbLocal.getAll('perfiles');
        const relaciones = await dbLocal.getAll('perfil_habilidades');
        const habilidades = await dbLocal.getAll('habilidades');

        const rows = todos.map(p => {
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

    init() {
      window.UI = UI;
      ['showModal', 'showCatModal', 'showSkillModal'].forEach(prop => {
        this.$watch(prop, (val) => {
          if (val) {
            this._prevFocus = document.activeElement;
            if (prop === 'showModal') {
              this._handleBeforeUnload = (e) => {
                e.preventDefault();
                e.returnValue = '';
              };
              window.addEventListener('beforeunload', this._handleBeforeUnload);
            }
            this.$nextTick(() => {
              const sel = prop === 'showCatModal' ? '[data-modal="cat"] .modal-box' :
                          prop === 'showSkillModal' ? '[data-modal="skill"] .modal-box' :
                          '.modal-box';
              const modal = this.$el.querySelector(sel);
              if (modal) UI.focusTrap(modal);
            });
          } else {
            if (prop === 'showModal' && this._handleBeforeUnload) {
              window.removeEventListener('beforeunload', this._handleBeforeUnload);
              this._handleBeforeUnload = null;
            }
            if (this._prevFocus) {
              this._prevFocus.focus();
              this._prevFocus = null;
            }
          }
        });
      });
      if (abrirForm) this.abrirFormulario();
    }
  };
}

window.MODULES = window.MODULES || {};
window.MODULES[Perfiles.id] = Perfiles;
appRouter.register(Perfiles);
