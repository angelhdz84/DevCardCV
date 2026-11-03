// modules/habilidades/module.js
const Habilidades = {
  id: 'habilidades',
  titulo: 'Habilidades',

  async init() {
    console.log('💡 [habilidades] Inicializado');
  },

  async render(params = {}) {
    const habilidades = (await dbLocal.getAll('habilidades')).sort((a, b) => (a.categoria || '').localeCompare(b.categoria || ''));
    const relaciones = await dbLocal.getAll('perfil_habilidades');
    const perfiles = await dbLocal.getAll('perfiles');

    // 💡 Mapa de devs por habilidad. Las fotos NO viajan dentro del atributo
    //    x-data (serían megabytes de base64): se guardan en un lookup global.
    const fotos = {};
    perfiles.forEach(p => {
      fotos[p.id] = {
        nombre: p.nombre,
        foto: p.fotoBase64 || '',
        inicial: (p.nombre || '?').charAt(0).toUpperCase()
      };
    });
    window._fotosPerfil = fotos;

    const devsPorSkill = {};
    relaciones.forEach(r => {
      if (!fotos[r.perfil_id]) return;
      (devsPorSkill[r.habilidad_id] = devsPorSkill[r.habilidad_id] || []).push(Number(r.perfil_id));
    });

    // 💡 Agrupar por categoría
    const categorias = {};
    habilidades.forEach(h => {
      if (!categorias[h.categoria]) categorias[h.categoria] = [];
      const devs = devsPorSkill[h.id] || [];
      categorias[h.categoria].push({ ...h, uso: devs.length, devs: devs.slice(0, 5) });
    });

    return `
<div x-data="habilidadesData(${JSON.stringify(categorias).replace(/"/g, '&quot;')})"
     x-init="init()">

  <!-- Header con contador -->
  <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
    <div>
      <h2 class="text-xl font-semibold tracking-heading flex items-center gap-2">
        <i class="bi bi-tools text-accent"></i> Habilidades
      </h2>
      <p class="text-xs mt-1 text-muted" x-text="Object.keys(cats).length + ' categorías, ' + Object.values(cats).flat().length + ' skills'"></p>
    </div>
    <div class="flex gap-2">
      <button class="btn btn-ghost btn-sm gap-1.5 radius-sm" @click="showCatModal = true">
        <i class="bi bi-folder-plus"></i> Nueva categoría
      </button>
      <button class="btn btn-primary btn-magnetic btn-sm gap-1.5 radius-sm" @click="showSkillModal = true">
        <i class="bi bi-plus-lg"></i> Nueva habilidad
      </button>
    </div>
  </div>

  <!-- Buscador -->
  <div class="mb-4" x-show="Object.keys(cats).length > 0">
    <div class="relative">
      <i class="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted"></i>
      <input type="search" x-model="searchSkill" placeholder="Buscar habilidad..."
             class="input input-bordered w-full max-w-xs pl-8 radius-md text-sm">
    </div>
  </div>

  <!-- Categorías y skills -->
  <template x-if="Object.keys(filteredCats).length === 0">
    <div x-html="UI.emptyState(searchSkill ? 'No se encontraron habilidades para &quot;' + searchSkill + '&quot;' : 'No hay habilidades. Crea categorías y habilidades.', 'bi-tools', searchSkill ? {} : { handler: 'showCatModal=true', label: 'Crear categoría', icon: 'bi-folder-plus' })"></div>
  </template>

  <div class="space-y-4" x-show="Object.keys(filteredCats).length > 0">
    <template x-for="(skills, categoria) in filteredCats" :key="categoria">
      <div class="card bg-white stagger-enter" :style="'animation-delay: ' + (Object.keys(cats).indexOf(categoria) * 0.06) + 's'" :aria-label="'Categoría: ' + categoria">
        <div class="card-body p-5">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-xs font-semibold uppercase tracking-wider flex items-center gap-2 text-muted">
              <i class="bi bi-folder-fill text-accent"></i>
              <span x-text="categoria"></span>
              <span class="badge badge-sm badge-ghost ml-1 radius-pill" x-text="skills.length"></span>
            </h3>
            <button class="btn btn-ghost btn-xs btn-square text-faint" @click="eliminarCategoria(categoria)" aria-label="Eliminar categoría" title="Eliminar categoría">
              <i class="bi bi-trash"></i>
            </button>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
            <template x-for="(skill, i) in skills" :key="skill.id">
              <div class="flex items-center justify-between px-3 py-2 rounded-lg skill-chip group border-default stagger-enter" :style="'animation-delay: ' + (i * 40) + 'ms'">
                <div class="flex items-center gap-2 min-w-0">
                  <i class="bi bi-tag-fill text-accent text-xs shrink-0"></i>
                  <span class="text-sm font-medium truncate" style="color: var(--ink);" x-text="skill.nombre"></span>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <div class="flex -space-x-1.5" x-show="skill.devs && skill.devs.length" :title="skill.uso + ' desarrollador(es) con esta habilidad'">
                    <template x-for="(d, di) in (skill.devs || [])" :key="di">
                      <span class="w-5 h-5 rounded-full overflow-hidden flex items-center justify-center text-[9px] font-semibold text-accent bg-accent/15 border border-white">
                        <template x-if="perfilInfo(d).foto">
                          <img :src="perfilInfo(d).foto" :alt="perfilInfo(d).nombre" :title="perfilInfo(d).nombre" class="w-full h-full object-cover">
                        </template>
                        <template x-if="!perfilInfo(d).foto">
                          <span x-text="perfilInfo(d).inicial" :title="perfilInfo(d).nombre"></span>
                        </template>
                      </span>
                    </template>
                    <span x-show="skill.uso > 5" class="w-5 h-5 rounded-full bg-muted border border-white flex items-center justify-center text-[9px] text-muted" x-text="'+' + (skill.uso - 5)"></span>
                  </div>
                  <div class="flex items-center gap-0.5 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                    <button class="btn btn-ghost btn-xs btn-square" @click="editarSkill(skill)" aria-label="Editar" title="Editar">
                      <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-ghost btn-xs btn-square text-faint" @click="eliminarSkill(skill)" aria-label="Eliminar" title="Eliminar">
                      <i class="bi bi-x-lg"></i>
                    </button>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </template>
  </div>

  <!-- Modal Nueva Categoría -->
  <div x-show="showCatModal" class="modal modal-open" @keydown.escape.window="showCatModal = false">
    <div class="modal-box w-11/12 max-w-md radius-lg">
      <h3 class="font-semibold text-base tracking-heading mb-4 flex items-center gap-2">
        <i class="bi bi-folder-plus text-accent"></i> Nueva categoría
      </h3>
      <label class="form-control w-full">
        <span class="label-text font-medium text-xs uppercase tracking-wider text-base-content/50 mb-1">Nombre de la categoría</span>
        <input type="text" x-model="newCat" class="input input-bordered w-full radius-md" placeholder="Ej: Cloud, DevOps, Testing...">
      </label>
      <div class="modal-action">
        <button class="btn btn-ghost btn-sm radius-md" @click="showCatModal = false">Cancelar</button>
        <button class="btn btn-primary btn-magnetic btn-sm radius-md" @click="guardarCategoria()" :disabled="!newCat.trim()">
          <i class="bi bi-check-lg"></i> Crear
        </button>
      </div>
    </div>
  </div>

  <!-- Modal Nueva/Editar Skill -->
  <div x-show="showSkillModal" class="modal modal-open" @keydown.escape.window="showSkillModal = false">
    <div class="modal-box w-11/12 max-w-md radius-lg">
      <h3 class="font-semibold text-base tracking-heading mb-4 flex items-center gap-2">
        <i class="bi bi-plus-lg text-accent"></i>
        <span x-text="editingSkill ? 'Editar habilidad' : 'Nueva habilidad'"></span>
      </h3>
      <div class="space-y-4">
        <label class="form-control w-full">
          <span class="label-text font-medium text-xs uppercase tracking-wider text-base-content/50 mb-1">Nombre</span>
          <input type="text" x-model="newSkill.nombre" class="input input-bordered w-full radius-md" placeholder="Ej: React, PostgreSQL...">
        </label>
        <label class="form-control w-full">
          <span class="label-text font-medium text-xs uppercase tracking-wider text-base-content/50 mb-1">Categoría</span>
          <select x-model="newSkill.categoria" class="select select-bordered w-full radius-md">
            <option value="" disabled>Selecciona categoría</option>
            <template x-for="cat in Object.keys(cats)" :key="cat">
              <option :value="cat" x-text="cat"></option>
            </template>
          </select>
        </label>
      </div>
      <div class="modal-action">
        <button class="btn btn-ghost btn-sm radius-md" @click="showSkillModal = false; editingSkill = null">Cancelar</button>
        <button class="btn btn-primary btn-magnetic btn-sm radius-md" @click="guardarSkill()" :disabled="!newSkill.nombre || !newSkill.categoria">
          <i class="bi bi-check-lg"></i> <span x-text="editingSkill ? 'Actualizar' : 'Crear'"></span>
        </button>
      </div>
    </div>
  </div>
</div>
`;
  },

  destroy() {
    console.log('💡 [habilidades] Destruído');
  }
};

function habilidadesData(categorias) {
  return {
    cats: categorias,
    searchSkill: '',
    showCatModal: false,
    showSkillModal: false,
    newCat: '',
    newSkill: { nombre: '', categoria: '' },
    editingSkill: null,
    _prevFocus: null,

    // 💡 Foto/inicial de un desarrollador (lookup global, fuera del x-data)
    perfilInfo(id) {
      const mapa = window._fotosPerfil || {};
      return mapa[id] || mapa[String(id)] || { nombre: 'Desarrollador', foto: '', inicial: '?' };
    },

    get filteredCats() {
      if (!this.searchSkill.trim()) return this.cats;
      const q = this.searchSkill.toLowerCase().trim();
      const result = {};
      for (const [cat, skills] of Object.entries(this.cats)) {
        const matching = skills.filter(s => s.nombre.toLowerCase().includes(q));
        if (matching.length > 0) result[cat] = matching;
      }
      return result;
    },

    async guardarCategoria() {
      if (!this.newCat.trim()) return;
      if (this.cats[this.newCat.trim()]) {
        UI.toast('Esa categoría ya existe', 'warning');
        return;
      }
      this.cats[this.newCat.trim()] = [];
      this.newCat = '';
      this.showCatModal = false;
      UI.toast('Categoría creada exitosamente', 'success');
    },

    async eliminarCategoria(cat) {
      const ok = await UI.confirm(`¿Eliminar la categoría "${cat}" y todas sus habilidades?`, 'Eliminar categoría');
      if (!ok) return;

      try {
        const skills = this.cats[cat];
        for (const skill of skills) {
          await dbOnline.bulkDelete('perfil_habilidades', 'habilidad_id', skill.id);
          await dbOnline.delete('habilidades', skill.id);
        }
        delete this.cats[cat];
        UI.toast('Categoría eliminada', 'success');
        window.dispatchEvent(new CustomEvent('db-change'));
      } catch (err) {
        UI.toast('Error: ' + err.message, 'error');
      }
    },

    editarSkill(skill) {
      this.newSkill = { nombre: skill.nombre, categoria: skill.categoria, id: skill.id };
      this.editingSkill = skill.id;
      this.showSkillModal = true;
    },

    async guardarSkill() {
      if (!this.newSkill.nombre.trim() || !this.newSkill.categoria) return;

      try {
        if (this.editingSkill) {
          await dbOnline.update('habilidades', this.editingSkill, {
            nombre: this.newSkill.nombre.trim(),
            categoria: this.newSkill.categoria,
            updated_at: new Date()
          });
          UI.toast('Habilidad actualizada', 'success');
        } else {
          await dbOnline.add('habilidades', {
            nombre: this.newSkill.nombre.trim(),
            categoria: this.newSkill.categoria,
            created_at: new Date()
          });
          UI.toast('Habilidad creada', 'success');
        }
        this.showSkillModal = false;
        this.editingSkill = null;
        this.newSkill = { nombre: '', categoria: '' };
        window.dispatchEvent(new CustomEvent('db-change'));
      } catch (err) {
        UI.toast('Error: ' + err.message, 'error');
      }
    },

    async eliminarSkill(skill) {
      const ok = await UI.confirm(`¿Eliminar "${skill.nombre}"?`, 'Eliminar habilidad');
      if (!ok) return;

      try {
        await dbOnline.bulkDelete('perfil_habilidades', 'habilidad_id', skill.id);
        await dbOnline.delete('habilidades', skill.id);
        UI.toast('Habilidad eliminada', 'success');
        window.dispatchEvent(new CustomEvent('db-change'));
      } catch (err) {
        UI.toast('Error: ' + err.message, 'error');
      }
    },

    init() {
      window.UI = UI;
      this.$watch('showCatModal', (val) => {
        if (val) {
          this._prevFocus = document.activeElement;
          this.$nextTick(() => {
            const modal = this.$el.querySelector('.modal-open .modal-box');
            if (modal) UI.focusTrap(modal);
          });
        } else if (this._prevFocus) {
          this._prevFocus.focus();
          this._prevFocus = null;
        }
      });
      this.$watch('showSkillModal', (val) => {
        if (val) {
          this._prevFocus = document.activeElement;
          this.$nextTick(() => {
            const modal = this.$el.querySelector('.modal-open .modal-box');
            if (modal) UI.focusTrap(modal);
          });
        } else if (this._prevFocus) {
          this._prevFocus.focus();
          this._prevFocus = null;
        }
      });
    }
  };
}

window.MODULES = window.MODULES || {};
window.MODULES[Habilidades.id] = Habilidades;
appRouter.register(Habilidades);
