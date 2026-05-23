// modules/perfiles/module.js
const Perfiles = {
  id: 'perfiles',
  titulo: 'Perfiles',

  async init() {
    console.log('💡 [perfiles] Inicializado');
  },

  async render(params = {}) {
    const auth = Alpine.store('auth');
    const esAdmin = auth && auth.isAdmin;
    const userId = auth && auth.user ? auth.user.userId : null;

    let perfiles = await db.perfiles.orderBy('nombre').toArray();
    if (!esAdmin && userId) {
      const user = await db.usuarios.get(userId);
      if (user && user.perfilId) {
        perfiles = perfiles.filter(p => p.id === user.perfilId);
      } else {
        perfiles = [];
      }
    }
    const habilidades = await db.habilidades.orderBy('categoria').toArray();
    const relaciones = await db.perfil_habilidades.toArray();

    // 💡 Preparar perfiles con sus skills
    const perfilesData = [];
    for (const p of perfiles) {
      const perfilSkills = relaciones
        .filter(r => r.perfil_id === p.id)
        .map(r => habilidades.find(h => h.id === r.habilidad_id))
        .filter(Boolean);
      perfilesData.push({
        ...p,
        email: cryptoHelpers.decrypt(p.email || ''),
        telefono: cryptoHelpers.decrypt(p.telefono || ''),
        direccion: cryptoHelpers.decrypt(p.direccion || ''),
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
<div x-data="perfilesData(${JSON.stringify(perfilesData).replace(/"/g, '&quot;')}, ${JSON.stringify(categorias).replace(/"/g, '&quot;')}, ${JSON.stringify(habilidades).replace(/"/g, '&quot;')})"
     x-init="init()">

  <!-- Header con contador -->
  <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
    <div>
      <h2 class="text-xl font-semibold tracking-heading flex items-center gap-2">
        <i class="bi bi-people-fill text-accent"></i> Perfiles
      </h2>
      <p class="text-xs text-base-content/50 mt-1" x-text="perfiles.length + ' dev' + (perfiles.length !== 1 ? 's' : '') + ' en el equipo'"></p>
    </div>
    <div class="flex flex-wrap gap-2">
      <label x-show="$store.auth.isAdmin" class="btn btn-ghost btn-sm cursor-pointer" style="border-radius: 8px; border: 1px solid var(--border);">
        <i class="bi bi-upload"></i> Importar
        <input type="file" accept=".json" class="hidden" @change="importarPerfilJSON($event)">
      </label>
      <button x-show="$store.auth.isAdmin" class="btn btn-primary btn-sm" style="border-radius: 8px;" @click="abrirFormulario()">
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
      <div class="card bg-white group stagger-enter" :style="'animation-delay: ' + (index * 0.04) + 's'">
        <div class="card-body p-5">
          <!-- Foto + Nombre -->
          <div class="flex items-start gap-4">
            <div class="avatar">
              <div class="w-16 h-16 rounded-xl overflow-hidden bg-base-200 flex items-center justify-center ring-1 ring-base-200 group-hover:ring-accent/20 transition-all">
                <template x-if="dev.fotoBase64">
                  <img :src="dev.fotoBase64" :alt="dev.nombre" class="w-full h-full object-cover">
                </template>
                <template x-if="!dev.fotoBase64">
                  <i class="bi bi-person-fill text-2xl text-base-content/20"></i>
                </template>
              </div>
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="font-semibold text-sm tracking-heading truncate" x-text="dev.nombre"></h3>
              <p class="text-sm text-accent" x-text="dev.cargo"></p>
              <p class="text-xs text-base-content/50 mt-0.5" x-text="UI.formatDateRelative(dev.created_at)"></p>
            </div>
          </div>

          <!-- Bio -->
          <p class="text-sm text-base-content/50 mt-3 leading-relaxed line-clamp-2" x-text="dev.bio || 'Sin descripción'"></p>

          <!-- Contacto -->
          <div class="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-base-content/50">
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
              <span class="badge badge-sm" style="border-radius: 4px;" x-text="skill"></span>
            </template>
            <span x-show="dev.skillNames.length > 5" class="badge badge-sm badge-ghost" style="border-radius: 4px;" x-text=" '+' + (dev.skillNames.length - 5)"></span>
          </div>

          <!-- Acciones -->
          <div class="flex justify-end gap-1 mt-3 pt-3 border-t border-base-100">
            <button class="btn btn-ghost btn-xs" @click="exportarPerfilJSON(dev)" aria-label="Exportar JSON" title="Exportar JSON">
              <i class="bi bi-download"></i>
            </button>
            <button class="btn btn-ghost btn-xs" @click="verCV(dev.id)" aria-label="Ver CV" title="Ver CV">
              <i class="bi bi-file-earmark-richtext"></i> CV
            </button>
            <button x-show="$store.auth.isAdmin || $store.auth.user?.perfilId === dev.id" class="btn btn-ghost btn-xs" @click="editar(dev.id)" aria-label="Editar" title="Editar">
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
    <div class="modal-box w-11/12 max-w-3xl p-0 overflow-hidden" style="border-radius: 12px; max-height: 90vh; display: flex; flex-direction: column;">
      <!-- Header sticky -->
      <div class="flex justify-between items-center px-6 py-4 shrink-0" style="border-bottom: 1px solid var(--border); background: var(--surface-elevated);">
        <div>
          <h3 class="font-semibold text-base tracking-heading flex items-center gap-2">
            <i class="bi bi-person-badge text-accent"></i>
            <span x-text="editando ? 'Editar perfil' : 'Nuevo desarrollador'"></span>
          </h3>
          <p class="text-xs text-base-content/35 mt-0.5" x-text="editando ? 'Actualiza los datos del desarrollador' : 'Completa la información para crear la ficha'"></p>
        </div>
        <button class="btn btn-ghost btn-sm btn-circle" @click="cerrarFormulario()" title="Cerrar" style="border-radius: 6px;">
          <i class="bi bi-x-lg text-sm"></i>
        </button>
      </div>

      <!-- Scrollable body -->
      <div class="overflow-y-auto flex-1 px-6 py-5">
        <div class="space-y-6">
          <!-- Sección: Foto + Identidad -->
          <div>
            <span class="section-label block mb-3">Foto e identidad</span>
            <div class="flex items-start gap-5 p-4 rounded-lg" style="background: var(--surface-muted); border: 1px solid var(--border);">
              <!-- Avatar preview -->
              <div class="shrink-0">
                <div class="w-20 h-20 rounded-xl overflow-hidden flex items-center justify-center ring-1 ring-base-200 transition-all"
                     :style="form.fotoBase64 ? 'ring-color: var(--accent-border)' : ''">
                  <template x-if="form.fotoBase64">
                    <img :src="form.fotoBase64" class="w-full h-full object-cover">
                  </template>
                  <template x-if="!form.fotoBase64">
                    <div class="w-full h-full flex items-center justify-center" style="background: var(--surface-elevated);">
                      <i class="bi bi-person-fill text-3xl text-base-content/15"></i>
                    </div>
                  </template>
                </div>
              </div>
              <!-- Upload controls -->
              <div class="flex-1 pt-1" @dragover.prevent="dragOver = true" @dragleave.prevent="dragOver = false" @drop.prevent="procesarArchivo($event.dataTransfer.files[0])">
                <p class="text-sm font-medium mb-1">Foto de perfil</p>
                <p class="text-xs text-base-content/35 mb-3">JPG o PNG. Se almacena localmente en la base de datos.</p>
                <div class="flex gap-2">
                  <label class="btn btn-sm gap-1.5" for="foto-input" style="border-radius: 6px; border: 1px solid var(--border); background: transparent;"
                         :style="dragOver ? 'border-color: var(--accent); background: rgba(21,128,61,0.08);' : ''">
                    <i class="bi bi-camera text-xs"></i>
                    <span x-text="form.fotoBase64 ? 'Cambiar' : 'Subir foto'"></span>
                  </label>
                  <button x-show="form.fotoBase64" class="btn btn-sm btn-ghost gap-1.5" @click="form.fotoBase64 = ''" style="border-radius: 6px;">
                    <i class="bi bi-trash text-xs text-error"></i> Quitar
                  </button>
                  <input type="file" id="foto-input" accept="image/*" class="hidden" @change="cargarFoto($event)">
                </div>
              </div>
            </div>
          </div>

          <!-- Sección: Datos personales -->
          <div>
            <span class="section-label block mb-3">Datos personales</span>
            <div class="space-y-3">
              <label class="form-control w-full">
                <span class="label-text font-medium text-xs uppercase tracking-wider text-base-content/50 mb-1.5">Nombre completo <span class="text-accent">*</span></span>
                <input type="text" x-model="form.nombre" class="input input-bordered w-full" placeholder="Ej: Ana García" style="border-radius: 6px;" aria-describedby="error-nombre">
                <span x-show="formErrors.nombre" x-text="formErrors.nombre" class="text-xs text-error mt-1 flex items-center gap-1" id="error-nombre" data-error><i class="bi bi-exclamation-triangle-fill"></i> </span>
              </label>
              <label class="form-control w-full">
                <span class="label-text font-medium text-xs uppercase tracking-wider text-base-content/50 mb-1.5">Cargo / Rol <span class="text-accent">*</span></span>
                <input type="text" x-model="form.cargo" class="input input-bordered w-full" placeholder="Ej: Frontend Senior" style="border-radius: 6px;" aria-describedby="error-cargo">
                <span x-show="formErrors.cargo" x-text="formErrors.cargo" class="text-xs text-error mt-1 flex items-center gap-1" id="error-cargo" data-error><i class="bi bi-exclamation-triangle-fill"></i> </span>
              </label>
              <label class="form-control w-full">
                <span class="label-text font-medium text-xs uppercase tracking-wider text-base-content/50 mb-1.5">Biografía</span>
                <textarea x-model="form.bio" class="textarea textarea-bordered w-full h-20" placeholder="Breve descripción profesional..." style="border-radius: 6px;"></textarea>
              </label>
            </div>
          </div>

          <!-- Sección: Contacto -->
          <div>
            <span class="section-label block mb-3">Contacto</span>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label class="form-control w-full">
                <span class="label-text font-medium text-xs uppercase tracking-wider text-base-content/50 mb-1.5">Email <span class="text-accent">*</span></span>
                <input type="email" x-model="form.email" class="input input-bordered w-full" placeholder="correo@ejemplo.com" style="border-radius: 6px;" aria-describedby="error-email">
                <span x-show="formErrors.email" x-text="formErrors.email" class="text-xs text-error mt-1 flex items-center gap-1" id="error-email" data-error><i class="bi bi-exclamation-triangle-fill"></i> </span>
              </label>
              <label class="form-control w-full">
                <span class="label-text font-medium text-xs uppercase tracking-wider text-base-content/50 mb-1.5">Teléfono</span>
                <input type="tel" x-model="form.telefono" class="input input-bordered w-full" placeholder="+34 600 000 000" style="border-radius: 6px;">
              </label>
            </div>
            <div class="mt-3">
              <label class="form-control w-full">
                <span class="label-text font-medium text-xs uppercase tracking-wider text-base-content/50 mb-1.5">Dirección particular</span>
                <input type="text" x-model="form.direccion" class="input input-bordered w-full" placeholder="Calle, número, ciudad, código postal" style="border-radius: 6px;">
              </label>
            </div>
          </div>

          <!-- Sección: Habilidades -->
          <div>
            <div class="flex items-center justify-between mb-3">
              <span class="section-label">Habilidades técnicas</span>
              <div class="flex gap-2">
                <button type="button" class="btn btn-ghost btn-xs gap-1" style="border-radius: 6px;" @click="agregarCategoriaInline()" title="Nueva categoría">
                  <i class="bi bi-folder-plus text-accent"></i> <span class="text-xs">Categoría</span>
                </button>
                <button type="button" class="btn btn-ghost btn-xs gap-1" style="border-radius: 6px;" @click="agregarSkillInline()" title="Nueva habilidad">
                  <i class="bi bi-plus-lg text-accent"></i> <span class="text-xs">Habilidad</span>
                </button>
                <span class="text-xs text-base-content/50" x-text="form.skills.length + ' seleccionadas'"></span>
              </div>
            </div>
            <div class="space-y-3 max-h-56 overflow-y-auto pr-1">
              <template x-for="(skills, categoria) in categorias" :key="categoria">
                <div class="p-3 rounded-lg stagger-enter" style="background: var(--surface-muted); border: 1px solid var(--border);" :style="'animation-delay: ' + (Object.keys(categorias).indexOf(categoria) * 0.05) + 's'">
                  <p class="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <i class="bi bi-folder-fill text-accent/50 text-[10px]"></i>
                    <span x-text="categoria"></span>
                  </p>
                  <div class="flex flex-wrap gap-1">
                    <template x-for="skill in skills" :key="skill.id">
                      <label class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md cursor-pointer transition-all hover:bg-base-200"
                             style="border-radius: 4px; border: 1px solid transparent;"
                             :style="form.skills.includes(skill.id) ? 'background: var(--accent-light); border-color: var(--accent-border);' : ''">
                        <input type="checkbox" class="checkbox checkbox-xs"
                               style="border-radius: 3px; --chkbg: var(--accent);"
                               :value="skill.id"
                               :checked="form.skills.includes(skill.id)"
                               @change="toggleSkill(skill.id, $event)">
                        <span class="text-xs" x-text="skill.nombre"></span>
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
      <div class="flex justify-between items-center px-6 py-4 shrink-0" style="border-top: 1px solid var(--border); background: var(--surface-elevated);">
        <div class="text-xs text-base-content/50">
          <i class="bi bi-shield-lock text-[10px]"></i> Email, teléfono y dirección se cifran automáticamente
        </div>
        <div class="flex gap-2">
          <button class="btn btn-ghost btn-sm" @click="cerrarFormulario()" style="border-radius: 6px;">Cancelar</button>
          <button class="btn btn-primary btn-sm gap-1.5" style="border-radius: 6px;" @click="guardar()" :disabled="!form.nombre || !form.email || !form.cargo">
            <i class="bi bi-check-lg"></i>
            <span x-text="editando ? 'Actualizar' : 'Guardar'"></span>
          </button>
        </div>
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
function perfilesData(perfiles, categorias, habilidades) {
  return {
    perfiles,
    categorias,
    habilidades,
    showModal: false,
    editando: null,
    saved: false,
    dragOver: false,
    _prevFocus: null,
    form: {
      id: null,
      nombre: '',
      email: '',
      telefono: '',
      direccion: '',
      cargo: '',
      bio: '',
      fotoBase64: '',
      skills: []
    },
    formErrors: { nombre: '', email: '', cargo: '' },
    newCatInline: '',
    newSkillInline: { nombre: '', categoria: '' },

    async agregarCategoriaInline() {
      const name = prompt('Nombre de la nueva categoría:');
      if (!name || !name.trim()) return;
      if (this.categorias[name.trim()]) { UI.toast('Esa categoría ya existe', 'warning'); return; }
      this.categorias[name.trim()] = [];
      UI.toast(`Categoría "${name.trim()}" creada`, 'success');
    },

    async agregarSkillInline() {
      const cats = Object.keys(this.categorias);
      if (cats.length === 0) { UI.toast('Crea una categoría primero', 'warning'); return; }
      const cat = prompt(`Categoría (${cats.join(', ')}):`);
      if (!cat || !this.categorias[cat]) { UI.toast('Categoría no válida', 'warning'); return; }
      const name = prompt('Nombre de la habilidad:');
      if (!name || !name.trim()) return;
      const existente = this.categorias[cat].find(s => s.nombre.toLowerCase() === name.trim().toLowerCase());
      if (existente) { UI.toast('Esa habilidad ya existe en la categoría', 'warning'); return; }
      await db.habilidades.add({ nombre: name.trim(), categoria: cat, created_at: new Date() });
      const hb = await db.habilidades.toArray();
      this.habilidades = hb;
      this.categorias = {};
      hb.forEach(h => {
        if (!this.categorias[h.categoria]) this.categorias[h.categoria] = [];
        this.categorias[h.categoria].push(h);
      });
      UI.toast(`Habilidad "${name.trim()}" creada exitosamente`, 'success');
    },

    abrirFormulario() {
      this.formErrors = { nombre: '', email: '', cargo: '' };
      this.form = { id: null, nombre: '', email: '', telefono: '', direccion: '', cargo: '', bio: '', fotoBase64: '', skills: [] };
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
      this.formErrors = { nombre: '', email: '', cargo: '' };
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

      const datos = {
        nombre: this.form.nombre,
        email: cryptoHelpers.encrypt(this.form.email),
        telefono: this.form.telefono ? cryptoHelpers.encrypt(this.form.telefono) : '',
        direccion: this.form.direccion ? cryptoHelpers.encrypt(this.form.direccion) : '',
        cargo: this.form.cargo,
        bio: this.form.bio,
        fotoBase64: this.form.fotoBase64,
        updated_at: new Date()
      };

      try {
        let perfilId;
        if (this.editando) {
          datos.created_at = this.perfiles.find(p => p.id === this.editando)?.created_at || new Date();
          await db.perfiles.update(this.editando, datos);
          perfilId = this.editando;
          UI.toast('Perfil actualizado correctamente', 'success');
        } else {
          datos.created_at = new Date();
          perfilId = await db.perfiles.add(datos);
          UI.toast('Desarrollador creado correctamente', 'success');
        }

        // 💡 Actualizar habilidades
        await db.perfil_habilidades.where('perfil_id').equals(perfilId).delete();
        for (const skillId of this.form.skills) {
          await db.perfil_habilidades.add({ perfil_id: perfilId, habilidad_id: skillId });
        }

        this.cerrarFormulario();
        window.dispatchEvent(new CustomEvent('db-change'));
        window.location.hash = '#/perfiles';
      } catch (err) {
        UI.toast('Error al guardar: ' + err.message, 'error');
      }
    },

    async eliminar(id) {
      const dev = this.perfiles.find(p => p.id === id);
      if (!dev) return;
      const ok = await UI.confirm(`¿Eliminar el perfil de "${dev.nombre}"?`, 'Eliminar perfil');
      if (!ok) return;

      try {
        await db.perfil_habilidades.where('perfil_id').equals(id).delete();
        await db.perfiles.delete(id);
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
        const relaciones = await db.perfil_habilidades.where('perfil_id').equals(dev.id).toArray();
        const habilidades = await db.habilidades.toArray();
        const perfilSkills = relaciones
          .map(r => habilidades.find(h => h.id === r.habilidad_id))
          .filter(Boolean);

        const perfilData = {
          version: APP_CONFIG.app.version,
          fecha: new Date().toISOString(),
          app: APP_CONFIG.app.nombre,
          tipo: 'perfil_individual',
          perfil: {
            ...dev,
            email: cryptoHelpers.decrypt(dev.email || ''),
            telefono: dev.telefono ? cryptoHelpers.decrypt(dev.telefono) : ''
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
        const todos = await db.perfiles.toArray();
        const existente = todos.find(p => cryptoHelpers.decrypt(p.email || '') === perfil.email);

        // 💡 Asegurar que las habilidades existen
        for (const skill of (data.habilidades || [])) {
          const existe = await db.habilidades.where('nombre').equals(skill.nombre).first();
          if (!existe) {
            await db.habilidades.add({ nombre: skill.nombre, categoria: skill.categoria, created_at: new Date(), updated_at: new Date() });
          }
        }

        // 💡 Insertar o actualizar perfil
        let perfilId;
        const datos = {
          nombre: perfil.nombre,
          email: cryptoHelpers.encrypt(perfil.email || ''),
          telefono: perfil.telefono ? cryptoHelpers.encrypt(perfil.telefono) : '',
          cargo: perfil.cargo,
          bio: perfil.bio || '',
          fotoBase64: perfil.fotoBase64 || '',
          updated_at: new Date()
        };

        if (existente) {
          datos.created_at = existente.created_at;
          await db.perfiles.update(existente.id, datos);
          perfilId = existente.id;
          await db.perfil_habilidades.where('perfil_id').equals(perfilId).delete();
          UI.toast(`Perfil de "${perfil.nombre}" actualizado`, 'success');
        } else {
          datos.created_at = new Date();
          perfilId = await db.perfiles.add(datos);
          UI.toast(`Perfil de "${perfil.nombre}" importado`, 'success');
        }

        // 💡 Asignar habilidades
        const todasHabilidades = await db.habilidades.toArray();
        for (const skill of (data.habilidades || [])) {
          const hab = todasHabilidades.find(h => h.nombre === skill.nombre);
          if (hab) {
            await db.perfil_habilidades.add({ perfil_id: perfilId, habilidad_id: hab.id });
          }
        }

        window.dispatchEvent(new CustomEvent('db-change'));
        window.location.hash = '#/perfiles';
      } catch (err) {
        UI.toast('Error al importar: ' + err.message, 'error');
      }
      event.target.value = '';
    },

    init() {
      window.UI = UI;
      // 💡 Escuchar evento del FAB para abrir formulario automáticamente
      window.addEventListener('fab-open-form', () => {
        this.abrirFormulario();
      });
      this.$watch('showModal', (val) => {
        if (val) {
          this._prevFocus = document.activeElement;
          this._handleBeforeUnload = (e) => {
            e.preventDefault();
            e.returnValue = '';
          };
          window.addEventListener('beforeunload', this._handleBeforeUnload);
          this.$nextTick(() => {
            const modal = this.$el.querySelector('.modal-box');
            if (modal) UI.focusTrap(modal);
          });
        } else {
          if (this._handleBeforeUnload) {
            window.removeEventListener('beforeunload', this._handleBeforeUnload);
            this._handleBeforeUnload = null;
          }
          if (this._prevFocus) {
            this._prevFocus.focus();
            this._prevFocus = null;
          }
        }
      });
    }
  };
}

window.MODULES = window.MODULES || {};
window.MODULES[Perfiles.id] = Perfiles;
appRouter.register(Perfiles);
