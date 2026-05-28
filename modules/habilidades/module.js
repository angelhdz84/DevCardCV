// modules/habilidades/module.js
const Habilidades = {
  id: 'habilidades',
  titulo: 'Habilidades',

  async init() {
    console.log('💡 [habilidades] Inicializado');
  },

  async render(params = {}) {
    const habilidades = (await dbOnline.getAll('habilidades')).sort((a, b) => (a.categoria || '').localeCompare(b.categoria || ''));
    const relaciones = await dbOnline.getAll('perfil_habilidades');

    // 💡 Contar cuántos devs tienen cada skill
    const skillUses = {};
    relaciones.forEach(r => {
      skillUses[r.habilidad_id] = (skillUses[r.habilidad_id] || 0) + 1;
    });

    // 💡 Agrupar por categoría
    const categorias = {};
    habilidades.forEach(h => {
      if (!categorias[h.categoria]) categorias[h.categoria] = [];
      categorias[h.categoria].push({ ...h, uso: skillUses[h.id] || 0 });
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
      <button class="btn btn-primary btn-sm gap-1.5 radius-sm" @click="showSkillModal = true">
        <i class="bi bi-plus-lg"></i> Nueva habilidad
      </button>
    </div>
  </div>

  <!-- Categorías y skills -->
  <template x-if="Object.keys(cats).length === 0">
    <div x-html="UI.emptyState('No hay habilidades. Crea categorías y habilidades.', 'bi-tools', { handler: 'showCatModal=true', label: 'Crear categoría', icon: 'bi-folder-plus' })"></div>
  </template>

  <div class="space-y-4" x-show="Object.keys(cats).length > 0">
    <template x-for="(skills, categoria) in cats" :key="categoria">
      <div class="card bg-white stagger-enter" :style="'animation-delay: ' + (Object.keys(cats).indexOf(categoria) * 0.06) + 's'" :aria-label="'Categoría: ' + categoria">
        <div class="card-body p-5">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-xs font-semibold uppercase tracking-wider flex items-center gap-2 text-muted">
              <i class="bi bi-folder-fill text-accent"></i>
              <span x-text="categoria"></span>
              <span class="badge badge-sm badge-ghost ml-1" style="border-radius: 4px;" x-text="skills.length"></span>
            </h3>
            <button class="btn btn-ghost btn-xs btn-square text-faint" @click="eliminarCategoria(categoria)" aria-label="Eliminar categoría" title="Eliminar categoría">
              <i class="bi bi-trash"></i>
            </button>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
            <template x-for="(skill, i) in skills" :key="skill.id">
              <div class="flex items-center justify-between px-3 py-2 rounded-lg bg-base-100 group border-default stagger-enter" :style="'animation-delay: ' + (i * 40) + 'ms'">
                <div class="flex items-center gap-2">
                  <i class="bi bi-tag-fill text-accent/40 text-xs"></i>
                  <span class="text-sm" x-text="skill.nombre"></span>
                </div>
                <div class="flex items-center gap-0.5 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                  <span class="text-xs mr-1 text-faint" x-text="skill.uso"></span>
                  <button class="btn btn-ghost btn-xs btn-square" @click="editarSkill(skill)" aria-label="Editar" title="Editar">
                    <i class="bi bi-pencil"></i>
                  </button>
                  <button class="btn btn-ghost btn-xs btn-square text-faint" @click="eliminarSkill(skill)" aria-label="Eliminar" title="Eliminar">
                    <i class="bi bi-x-lg"></i>
                  </button>
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
        <button class="btn btn-primary btn-sm radius-md" @click="guardarCategoria()" :disabled="!newCat.trim()">
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
        <button class="btn btn-primary btn-sm radius-md" @click="guardarSkill()" :disabled="!newSkill.nombre || !newSkill.categoria">
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
    showCatModal: false,
    showSkillModal: false,
    newCat: '',
    newSkill: { nombre: '', categoria: '' },
    editingSkill: null,
    _prevFocus: null,

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
