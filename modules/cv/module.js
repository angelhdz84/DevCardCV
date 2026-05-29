// modules/cv/module.js
const CV = {
  id: 'cv',
  titulo: 'CV',

  async init() {
    console.log('💡 [cv] Inicializado');
  },

  async render(params = {}) {
    // 💡 Obtener ID del perfil de la ruta: #/cv/3
    const perfilId = params.params ? parseInt(params.params[0]) : null;
    const perfiles = (await dbOnline.getAll('perfiles')).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
    const habilidades = await dbOnline.getAll('habilidades');
    const relaciones = await dbOnline.getAll('perfil_habilidades');

    // 💡 Seleccionar perfil por ID o el primero
    const perfil = perfilId ? perfiles.find(p => p.id === perfilId) : perfiles[0];

    // 💡 Preparar datos del perfil seleccionado
    let perfilData = null;
    if (perfil) {
      const perfilSkills = relaciones
        .filter(r => r.perfil_id == perfil.id)
        .map(r => habilidades.find(h => h.id == r.habilidad_id))
        .filter(Boolean);

      // 💡 Agrupar skills por categoría (sin duplicados)
      const skillsByCat = {};
      perfilSkills.forEach(s => {
        if (!skillsByCat[s.categoria]) skillsByCat[s.categoria] = [];
        if (!skillsByCat[s.categoria].includes(s.nombre)) skillsByCat[s.categoria].push(s.nombre);
      });

      perfilData = {
        ...perfil,
        email: cryptoHelpers.decrypt(perfil.email || ''),
        telefono: perfil.telefono ? cryptoHelpers.decrypt(perfil.telefono) : '',
        direccion: perfil.direccion ? cryptoHelpers.decrypt(perfil.direccion) : '',
        skillsByCat
      };
    }

    return `
<div x-data="cvData(${JSON.stringify(perfiles).replace(/"/g, '&quot;')}, ${perfilData ? JSON.stringify(perfilData).replace(/"/g, '&quot;') : 'null'}, ${perfilId})"
     x-init="init()">

  <!-- Header con selector -->
  <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
    <div>
      <h2 class="text-xl font-semibold tracking-heading flex items-center gap-2">
        <i class="bi bi-file-earmark-richtext-fill text-accent"></i> CV del Desarrollador
      </h2>
      <p class="text-xs text-base-content/50 mt-1" x-show="perfil" x-text="perfil.nombre + ' — ' + perfil.cargo"></p>
    </div>
    <div class="flex gap-2">
      <select x-model="selectedId" @change="cambiarPerfil()" class="select select-bordered select-sm radius-md">
        <option value="" disabled>Seleccionar perfil</option>
        <template x-for="p in perfiles" :key="p.id">
          <option :value="p.id" x-text="p.nombre + ' — ' + p.cargo" :selected="p.id === currentId"></option>
        </template>
      </select>
      <button class="btn btn-primary btn-magnetic btn-sm radius-md" @click="exportarPDF()" :disabled="!perfil || exporting" aria-label="Exportar CV en PDF">
        <i class="bi bi-file-earmark-pdf-fill"></i>
        <span x-show="!exporting">Exportar PDF</span>
        <span x-show="exporting" class="loading loading-spinner loading-xs"></span>
      </button>
    </div>
  </div>

  <!-- Sin perfil -->
  <template x-if="!perfil">
    <div x-html="UI.emptyState('No hay perfiles creados aún.', 'bi-person-x')"></div>
  </template>

  <!-- CV Preview -->
  <template x-if="perfil">
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Vista previa del CV -->
      <div class="lg:col-span-2">
        <div id="cv-preview" class="card bg-white overflow-hidden">
          <!-- Encabezado con foto — Firecrawl gradient -->
          <div class="relative p-6" style="background: linear-gradient(135deg, #065f46 0%, #059669 100%);">
            <div class="flex items-center gap-5">
              <div class="avatar">
                <div class="w-16 h-16 rounded-xl ring-2 ring-white/20 overflow-hidden bg-white/10 flex items-center justify-center">
                  <template x-if="perfil.fotoBase64">
                    <img :src="perfil.fotoBase64" alt="Foto de perfil" class="w-full h-full object-cover">
                  </template>
                  <template x-if="!perfil.fotoBase64">
                    <i class="bi bi-person-fill text-3xl text-white/30"></i>
                  </template>
                </div>
              </div>
              <div>
                <h1 class="text-lg font-semibold text-white tracking-heading" x-text="perfil.nombre"></h1>
                <p class="text-sm text-white" x-text="perfil.cargo"></p>
              </div>
            </div>
          </div>

          <!-- Cuerpo del CV -->
          <div class="p-6">
            <!-- Contacto -->
            <div class="mb-6">
              <h3 class="section-label mb-3 flex items-center gap-2">
                <i class="bi bi-person-badge"></i> Contacto
              </h3>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div class="flex items-center gap-2 text-base-content/60">
                  <i class="bi bi-envelope text-accent/60"></i>
                  <span x-text="perfil.email"></span>
                </div>
                <div class="flex items-center gap-2 text-base-content/60" x-show="perfil.telefono">
                  <i class="bi bi-phone text-accent/60"></i>
                  <span x-text="perfil.telefono"></span>
                </div>
                <div class="flex items-center gap-2 text-base-content/60" x-show="perfil.direccion">
                  <i class="bi bi-geo-alt text-accent/60"></i>
                  <span x-text="perfil.direccion"></span>
                </div>
              </div>
            </div>

            <!-- Bio -->
            <div class="mb-6" x-show="perfil.bio">
              <h3 class="section-label mb-3 flex items-center gap-2">
                <i class="bi bi-person-lines-fill"></i> Perfil Profesional
              </h3>
              <p class="text-sm text-base-content leading-relaxed" x-text="perfil.bio"></p>
            </div>

            <!-- Skills por categoría — tinted badges -->
            <div>
              <h3 class="section-label mb-3 flex items-center gap-2">
                <i class="bi bi-tools"></i> Habilidades Técnicas
              </h3>
              <div class="space-y-3">
                <template x-for="(skills, cat) in perfil.skillsByCat" :key="cat">
                  <div>
                    <p class="text-xs font-medium text-base-content/40 mb-1.5" x-text="cat"></p>
                    <div class="flex flex-wrap gap-1.5">
                      <template x-for="(skill, i) in skills" :key="skill">
                        <span class="badge badge-sm stagger-enter radius-sm" :class="'badge-skill-' + _sanitizeCat(cat)" x-text="skill" :style="'animation-delay: ' + (i * 40) + 'ms'"></span>
                      </template>
                      <template x-if="Object.keys(perfil.skillsByCat).length === 0">
                        <p class="text-sm text-base-content/50" role="alert">No hay habilidades registradas.</p>
                      </template>
              </div>
            </div>

            <!-- Footer -->
            <div class="mt-6 pt-4 border-t border-base-100 text-xs text-base-content/40 text-center">
              Generado por DevCardCV — <span x-text="UI.formatDate(new Date(), 'DD/MM/YYYY HH:mm')"></span>
            </div>
          </div>
        </div>
      </div>

      <!-- Panel lateral -->
      <div class="space-y-3">
        <!-- Exportar -->
        <div class="card bg-white">
          <div class="card-body p-4">
            <h3 class="section-label mb-3 flex items-center gap-2">
              <i class="bi bi-download text-accent"></i> Exportar
            </h3>
            <button class="btn btn-primary btn-magnetic w-full btn-sm radius-md" @click="exportarPDF()" :disabled="exporting" aria-label="Exportar CV en PDF">
              <i class="bi bi-file-earmark-pdf-fill"></i>
              <span x-show="!exporting">Descargar PDF</span>
              <span x-show="exporting" class="loading loading-spinner loading-xs"></span>
            </button>
            <button class="btn btn-ghost w-full btn-sm mt-1 radius-md border-default" @click="exportarPerfilJSON()">
              <i class="bi bi-filetype-json"></i> Exportar JSON
            </button>
          </div>
        </div>

        <!-- Compartir CV (destacado) — Firecrawl accent -->
        <div class="card" style="background: var(--accent-light); border: 1px solid var(--accent-border); box-shadow: none;">
          <div class="card-body p-4">
            <h3 class="section-label mb-3 flex items-center gap-2" style="color: var(--accent);">
              <i class="bi bi-share-fill"></i> Compartir CV
            </h3>
            <button class="btn w-full btn-sm gap-2 radius-md" style="background: var(--accent); color: white; border: none;" @click="compartirCV()" :disabled="!perfil || compartiendo" aria-label="Compartir CV">
              <i class="bi bi-share-fill"></i>
              <span x-show="!compartiendo">Compartir PDF + JSON</span>
              <span x-show="compartiendo" class="loading loading-spinner loading-xs"></span>
            </button>
            <p class="text-xs text-base-content/50 mt-1.5">
              Comparte ambos archivos para importar después
            </p>
          </div>
        </div>

        <!-- Info -->
        <div class="card bg-white">
          <div class="card-body p-4">
            <h3 class="section-label mb-3 flex items-center gap-2">
              <i class="bi bi-info-circle text-accent"></i> Info
            </h3>
            <div class="text-xs text-base-content/50 space-y-1.5">
              <p class="flex items-center gap-1.5"><i class="bi bi-calendar3 text-[10px]"></i> Creado: <span x-text="UI.formatDate(perfil.created_at)"></span></p>
              <p class="flex items-center gap-1.5"><i class="bi bi-pencil text-[10px]"></i> Actualizado: <span x-text="UI.formatDate(perfil.updated_at)"></span></p>
              <p class="flex items-center gap-1.5"><i class="bi bi-tools text-[10px]"></i> Skills: <span x-text="Object.values(perfil.skillsByCat).flat().length"></span></p>
              <p class="flex items-center gap-1.5"><i class="bi bi-folder text-[10px]"></i> Categorías: <span x-text="Object.keys(perfil.skillsByCat).length"></span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </template>
</div>
`;
  },

  destroy() {
    console.log('💡 [cv] Destruído');
  }
};

function cvData(perfiles, perfil, currentId) {
  return {
    perfiles,
    perfil,
    currentId,
    selectedId: currentId || '',
    exporting: false,
    compartiendo: false,

    async cambiarPerfil() {
      window.location.hash = `#/cv/${this.selectedId}`;
    },

    // ── Helper: generar PDF (compartido entre exportarPDF y compartirCV) ──
    _generarPDF(p, perfilSkills) {
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      const m = 22;
      let y = 0;

      const emailDecrypted = p.email ? cryptoHelpers.decrypt(p.email) || p.email : '';
      const telDecrypted = p.telefono ? cryptoHelpers.decrypt(p.telefono) || p.telefono : '';
      const dirDecrypted = p.direccion ? cryptoHelpers.decrypt(p.direccion) || p.direccion : '';

      const checkPage = (delta) => { if (y + (delta || 0) > ph - 18) { pdf.addPage(); y = 15; } };

      const acc = [21, 128, 61];
      const darkBg = [4, 120, 87];
      const darkFg = [255, 255, 255];
      const mutedFg = [180, 210, 195];
      const headingFg = [25, 35, 55];
      const bodyFg = [60, 70, 85];

      // ── Header: emerald bar ──
      const hh = 46;
      pdf.setFillColor(darkBg[0], darkBg[1], darkBg[2]);
      pdf.rect(0, 0, pw, hh, 'F');
      pdf.setFillColor(5, 150, 105);
      pdf.rect(0, hh - 3, pw, 3, 'F');
      pdf.setFillColor(5, 150, 105);
      pdf.rect(pw - 28, hh - 8, 22, 4, 'F');

      let hasAvatar = false;
      const avatarSize = 20;
      if (p.fotoBase64) {
        try {
          pdf.addImage(p.fotoBase64, 'JPEG', m, (hh - avatarSize) / 2, avatarSize, avatarSize, undefined, 'FAST');
          pdf.setDrawColor(255, 255, 255);
          pdf.setLineWidth(0.5);
          pdf.circle(m + avatarSize / 2, hh / 2, avatarSize / 2);
          hasAvatar = true;
        } catch (_) {}
      }

      const textX = hasAvatar ? m + avatarSize + 7 : m;
      const textY = hasAvatar ? (hh - avatarSize) / 2 + 6 : 16;
      pdf.setTextColor(darkFg[0], darkFg[1], darkFg[2]);
      pdf.setFontSize(18);
      pdf.setFont(undefined, 'bold');
      pdf.text(p.nombre, textX, textY);
      if (p.cargo) {
        pdf.setFontSize(9);
        pdf.setFont(undefined, 'normal');
        pdf.setTextColor(mutedFg[0], mutedFg[1], mutedFg[2]);
        pdf.text(p.cargo, textX, textY + 6);
      }

      // ── Contact info bar ──
      y = hh + 9;
      const visible = [];
      visible.push(['Email', emailDecrypted]);
      if (telDecrypted) visible.push(['Tel', telDecrypted]);
      if (dirDecrypted) visible.push(['Direccion', dirDecrypted]);

      if (visible.length) {
        pdf.setFillColor(246, 248, 250);
        pdf.rect(m - 3, y - 3.5, pw - m * 2 + 6, 11, 'F');
        let cx = m;
        visible.forEach(([label, val]) => {
          pdf.setFontSize(7);
          pdf.setFont(undefined, 'normal');
          pdf.setTextColor(140, 150, 165);
          pdf.text(label + ':', cx, y);
          pdf.setFontSize(8);
          pdf.setTextColor(bodyFg[0], bodyFg[1], bodyFg[2]);
          const trunc = val.length > 30 ? val.slice(0, 28) + '\u2026' : val;
          pdf.text(trunc, cx + (label === 'Email' ? 16 : 12), y);
          cx += (pw - m * 2) / visible.length;
        });
        y += 13;
      }

      // ── Bio section ──
      if (p.bio) {
        checkPage(20);
        pdf.setFillColor(acc[0], acc[1], acc[2]);
        pdf.roundedRect(m, y, 3, 11, 0.5, 0.5, 'F');
        pdf.setFontSize(10);
        pdf.setFont(undefined, 'bold');
        pdf.setTextColor(headingFg[0], headingFg[1], headingFg[2]);
        pdf.text('PERFIL PROFESIONAL', m + 8, y + 4);
        y += 14;
        pdf.setFont(undefined, 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(bodyFg[0], bodyFg[1], bodyFg[2]);
        const bioLines = pdf.splitTextToSize(p.bio, pw - m * 2 - 6);
        bioLines.forEach(line => {
          checkPage(4);
          pdf.text(line, m + 3, y);
          y += 4.2;
        });
        y += 5;
      }

      // ── Skills section ──
      const skillsByCat = {};
      perfilSkills.forEach(s => {
        if (!skillsByCat[s.categoria]) skillsByCat[s.categoria] = [];
        if (!skillsByCat[s.categoria].includes(s.nombre)) skillsByCat[s.categoria].push(s.nombre);
      });

      const catColors = {
        'Lenguajes': [59, 130, 246], 'Frameworks': [139, 92, 246],
        'Backend': [16, 185, 129], 'Bases de Datos': [245, 158, 11],
        'DevOps': [239, 68, 68], 'Herramientas': [107, 114, 128],
        'Diseno': [236, 72, 153], 'Metodologias': [168, 85, 247],
        'Testing': [34, 197, 94], 'Cloud': [59, 130, 246],
        'Frontend': [59, 130, 246], 'Redes & Seguridad': [239, 68, 68],
        'Soft Skills': [34, 197, 94], 'DevOps & Cloud': [245, 158, 11],
        'Diseño UX/UI & Gráfico': [236, 72, 153], 'Analítica de Datos': [16, 185, 129],
        'CMS': [107, 114, 128]
      };

      if (Object.keys(skillsByCat).length) {
        checkPage(20);
        pdf.setFillColor(acc[0], acc[1], acc[2]);
        pdf.roundedRect(m, y, 3, 11, 0.5, 0.5, 'F');
        pdf.setFontSize(10);
        pdf.setFont(undefined, 'bold');
        pdf.setTextColor(headingFg[0], headingFg[1], headingFg[2]);
        pdf.text('HABILIDADES TECNICAS', m + 8, y + 4);
        y += 14;

        for (const [cat, skills] of Object.entries(skillsByCat)) {
          checkPage(28);
          const c = catColors[cat] || acc;
          pdf.setFillColor(c[0], c[1], c[2]);
          pdf.roundedRect(m, y, 55, 5.5, 1.2, 1.2, 'F');
          pdf.setFontSize(7);
          pdf.setFont(undefined, 'bold');
          pdf.setTextColor(255, 255, 255);
          pdf.text(cat.toUpperCase(), m + 3, y + 4);
          y += 9;

          const cols = 3;
          const gap = 6;
          const tagW = (pw - m * 2 - (cols - 1) * gap) / cols;
          const startY = y;
          const rows = Math.ceil(skills.length / cols);
          const rowH = 7;
          for (let r = 0; r < rows; r++) {
            if (r % 2 === 1) {
              pdf.setFillColor(245, 247, 250);
              pdf.rect(m, startY + r * rowH - 0.5, pw - m * 2, rowH, 'F');
            }
          }
          skills.forEach((skill, i) => {
            checkPage(7);
            const col = i % cols;
            const row = Math.floor(i / cols);
            const ax = m + col * (tagW + gap);
            const ay = startY + row * rowH;
            pdf.setFillColor(240, 244, 248);
            pdf.roundedRect(ax, ay, tagW, 5.5, 1, 1, 'F');
            pdf.setFontSize(7);
            pdf.setFont(undefined, 'normal');
            pdf.setTextColor(c[0], c[1], c[2]);
            const display = skill.length > 18 ? skill.slice(0, 16) + '\u2026' : skill;
            pdf.text(display, ax + 2.5, ay + 4);
          });
          y = startY + rows * rowH + 6;
        }
      }

      // ── Footer ──
      const drawFooter = (pageNum) => {
        pdf.setDrawColor(215, 220, 230);
        pdf.setLineWidth(0.3);
        pdf.line(m, ph - 13, pw - m, ph - 13);
        pdf.setFontSize(7);
        pdf.setTextColor(155, 165, 180);
        pdf.text('Generado por DevCardCV v' + APP_CONFIG.app.version, m, ph - 7);
        pdf.text(dayjs().format('DD/MM/YYYY HH:mm'), pw - m, ph - 7, { align: 'right' });
        pdf.text('Pagina ' + pageNum, pw / 2, ph - 7, { align: 'center' });
      };

      drawFooter(1);
      const total = pdf.getNumberOfPages();
      for (let i = 2; i <= total; i++) { pdf.setPage(i); drawFooter(i); }

      return pdf;
    },

    async exportarPDF() {
      if (!this.perfil) return;
      this.exporting = true;
      UI.toast('Generando PDF...', 'info');
      try {
        const p = this.perfil;
        const relaciones = await dbOnline.getWhere('perfil_habilidades', 'perfil_id', p.id);
        const habilidades = await dbOnline.getAll('habilidades');
        const perfilSkills = relaciones
          .map(r => habilidades.find(h => h.id == r.habilidad_id))
          .filter(Boolean);
        const pdf = this._generarPDF(p, perfilSkills);
        const blob = pdf.output('blob');
        const nombre = p.nombre.replace(/\s+/g, '_');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `CV_${nombre}_${dayjs().format('YYYYMMDD')}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        UI.toast('PDF descargado', 'success');
      } catch (err) {
        UI.toast('Error: ' + err.message, 'error');
      } finally {
        this.exporting = false;
      }
    },

    async compartirCV() {
      if (!this.perfil) return;
      this.compartiendo = true;
      UI.toast('Preparando para compartir...', 'info');
      try {
        const p = this.perfil;
        const relaciones = await dbOnline.getWhere('perfil_habilidades', 'perfil_id', p.id);
        const habilidades = await dbOnline.getAll('habilidades');
        const perfilSkills = relaciones
          .map(r => habilidades.find(h => h.id == r.habilidad_id))
          .filter(Boolean);
        const pdf = this._generarPDF(p, perfilSkills);
        const pdfBlob = pdf.output('blob');
        const nombre = p.nombre.replace(/\s+/g, '_');
        const fecha = dayjs().format('YYYYMMDD');
        const pdfName = `CV_${nombre}_${fecha}.pdf`;

        const perfilData = {
          version: APP_CONFIG.app.version,
          fecha: new Date().toISOString(),
          app: APP_CONFIG.app.nombre,
          tipo: 'perfil_individual',
          perfil: {
            ...p,
            email: p.email || '',
            telefono: p.telefono ? p.telefono : '',
            direccion: p.direccion ? p.direccion : ''
          },
          habilidades: perfilSkills.map(s => ({ nombre: s.nombre, categoria: s.categoria }))
        };
        const jsonBlob = new Blob([JSON.stringify(perfilData, null, 2)], { type: 'application/json' });
        const jsonName = `CV_${nombre}_${fecha}.json`;

        const pdfFile = new File([pdfBlob], pdfName, { type: 'application/pdf' });
        const jsonFile = new File([jsonBlob], jsonName, { type: 'application/json' });

        if (window.isSecureContext && navigator.share && navigator.canShare && navigator.canShare({ files: [pdfFile, jsonFile] })) {
          await navigator.share({
            files: [pdfFile, jsonFile],
            title: `CV de ${p.nombre}`,
            text: `CV + datos importables de ${p.nombre} — ${p.cargo}`
          });
          UI.toast('CV compartido exitosamente', 'success');
        } else {
          UI.toast('Tu navegador no soporta compartir archivos. Usa "Descargar PDF".', 'warning');
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          UI.toast('Compartir cancelado', 'info');
        } else {
          console.error('Error compartiendo CV:', err);
          UI.toast('Error: ' + err.message, 'error');
        }
      } finally {
        this.compartiendo = false;
      }
    },

    async exportarPerfilJSON() {
      if (!this.perfil) return;
      try {
        const relaciones = await dbOnline.getWhere('perfil_habilidades', 'perfil_id', this.perfil.id);
        const habilidades = await dbOnline.getAll('habilidades');
        const perfilSkills = relaciones
          .map(r => habilidades.find(h => h.id == r.habilidad_id))
          .filter(Boolean);

        const perfilData = {
          version: APP_CONFIG.app.version,
          fecha: new Date().toISOString(),
          app: APP_CONFIG.app.nombre,
          tipo: 'perfil_individual',
          perfil: {
            ...this.perfil,
            email: cryptoHelpers.decrypt(this.perfil.email || ''),
            telefono: this.perfil.telefono ? cryptoHelpers.decrypt(this.perfil.telefono) : '',
            direccion: this.perfil.direccion ? cryptoHelpers.decrypt(this.perfil.direccion) : ''
          },
          habilidades: perfilSkills.map(s => ({ nombre: s.nombre, categoria: s.categoria }))
        };

        const blob = new Blob([JSON.stringify(perfilData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `perfil_${this.perfil.nombre.replace(/\s+/g, '_')}_${dayjs().format('YYYYMMDD')}.json`;
        a.click();
        URL.revokeObjectURL(url);
        UI.toast(`Perfil de "${this.perfil.nombre}" exportado`, 'success');
      } catch (err) {
        UI.toast('Error al exportar: ' + err.message, 'error');
      }
    },

    _sanitizeCat(cat) {
      return cat.toLowerCase().replace(/[&\/]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
    },

    init() {
      window.UI = UI;
    }
  };
}

window.MODULES = window.MODULES || {};
window.MODULES[CV.id] = CV;
appRouter.register(CV);
