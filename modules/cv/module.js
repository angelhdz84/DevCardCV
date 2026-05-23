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
    const perfiles = await db.perfiles.orderBy('nombre').toArray();
    const habilidades = await db.habilidades.toArray();
    const relaciones = await db.perfil_habilidades.toArray();

    // 💡 Seleccionar perfil por ID o el primero
    const perfil = perfilId ? perfiles.find(p => p.id === perfilId) : perfiles[0];

    // 💡 Preparar datos del perfil seleccionado
    let perfilData = null;
    if (perfil) {
      const perfilSkills = relaciones
        .filter(r => r.perfil_id === perfil.id)
        .map(r => habilidades.find(h => h.id === r.habilidad_id))
        .filter(Boolean);

      // 💡 Agrupar skills por categoría
      const skillsByCat = {};
      perfilSkills.forEach(s => {
        if (!skillsByCat[s.categoria]) skillsByCat[s.categoria] = [];
        skillsByCat[s.categoria].push(s.nombre);
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
      <select x-model="selectedId" @change="cambiarPerfil()" class="select select-bordered select-sm" style="border-radius: 8px;">
        <option value="" disabled>Seleccionar perfil</option>
        <template x-for="p in perfiles" :key="p.id">
          <option :value="p.id" x-text="p.nombre + ' — ' + p.cargo" :selected="p.id === currentId"></option>
        </template>
      </select>
      <button class="btn btn-primary btn-sm" style="border-radius: 8px;" @click="exportarPDF()" :disabled="!perfil || exporting">
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
          <div class="relative p-6" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);">
            <div class="flex items-center gap-5">
              <div class="avatar">
                <div class="w-16 h-16 rounded-xl ring-2 ring-white/20 overflow-hidden bg-white/10 flex items-center justify-center">
                  <template x-if="perfil.fotoBase64">
                    <img :src="perfil.fotoBase64" class="w-full h-full object-cover">
                  </template>
                  <template x-if="!perfil.fotoBase64">
                    <i class="bi bi-person-fill text-3xl text-white/30"></i>
                  </template>
                </div>
              </div>
              <div>
                <h1 class="text-lg font-semibold text-white tracking-heading" x-text="perfil.nombre"></h1>
                <p class="text-sm text-white/60" x-text="perfil.cargo"></p>
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
                      <template x-for="skill in skills" :key="skill">
                        <span class="badge badge-sm" :class="'badge-skill-' + cat.toLowerCase().replace(/ /g, '-')" style="border-radius: 4px;" x-text="skill"></span>
                      </template>
                    </div>
                  </div>
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
            <button class="btn btn-primary w-full btn-sm" style="border-radius: 8px;" @click="exportarPDF()" :disabled="exporting">
              <i class="bi bi-file-earmark-pdf-fill"></i>
              <span x-show="!exporting">Descargar PDF</span>
              <span x-show="exporting" class="loading loading-spinner loading-xs"></span>
            </button>
            <button class="btn btn-ghost w-full btn-sm mt-1" style="border-radius: 8px; border: 1px solid var(--border);" @click="exportarPerfilJSON()">
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
            <button class="btn w-full btn-sm gap-2" style="border-radius: 8px; background: var(--accent); color: white; border: none;" @click="compartirCV()" :disabled="!perfil || compartiendo">
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

    async exportarPDF() {
      if (!this.perfil) return;
      this.exporting = true;
      UI.toast('Generando PDF...', 'info');
      try {
        const p = this.perfil;
        const relaciones = await db.perfil_habilidades.where('perfil_id').equals(p.id).toArray();
        const habilidades = await db.habilidades.toArray();
        const perfilSkills = relaciones
          .map(r => habilidades.find(h => h.id === r.habilidad_id))
          .filter(Boolean);

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pw = pdf.internal.pageSize.getWidth();
        const ph = pdf.internal.pageSize.getHeight();
        const m = 25;
        let y = 0;

        const hh = 42;
        pdf.setFillColor(15, 23, 42);
        pdf.rect(0, 0, pw, hh, 'F');

        if (p.fotoBase64) {
          try {
            const s = 16;
            const ix = m;
            const iy = (hh - s) / 2;
            pdf.addImage(p.fotoBase64, 'JPEG', ix, iy, s, s, undefined, 'FAST');
            pdf.setDrawColor(255, 255, 255);
            pdf.setLineWidth(0.3);
            pdf.roundedRect(ix, iy, s, s, 2, 2, 'S');
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(16);
            pdf.setFont(undefined, 'bold');
            pdf.text(p.nombre, m + s + 5, iy + 4);
            pdf.setFontSize(9);
            pdf.setFont(undefined, 'normal');
            pdf.setTextColor(180, 200, 220);
            pdf.text(p.cargo, m + s + 5, iy + 11);
          } catch (_) {
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(18);
            pdf.setFont(undefined, 'bold');
            pdf.text(p.nombre, m, 18);
            pdf.setFontSize(10);
            pdf.setFont(undefined, 'normal');
            pdf.setTextColor(180, 200, 220);
            pdf.text(p.cargo, m, 26);
          }
        } else {
          pdf.setTextColor(255, 255, 255);
          pdf.setFontSize(18);
          pdf.setFont(undefined, 'bold');
          pdf.text(p.nombre, m, 18);
          pdf.setFontSize(10);
          pdf.setFont(undefined, 'normal');
          pdf.setTextColor(180, 200, 220);
          pdf.text(p.cargo, m, 26);
        }

        y = hh + 8;
        pdf.setFillColor(248, 250, 252);
        pdf.rect(m - 5, y - 4, pw - m * 2 + 10, 14, 'F');
        pdf.setFontSize(8);
        pdf.setFont(undefined, 'normal');
        pdf.setTextColor(100, 116, 139);
        let cx = m;
        pdf.text('Email', cx, y);
        pdf.setTextColor(47, 55, 65);
        pdf.text(p.email || '', cx + 14, y);
        cx += 65;
        if (p.telefono) {
          pdf.setTextColor(100, 116, 139);
          pdf.text('Tel', cx, y);
          pdf.setTextColor(47, 55, 65);
          pdf.text(p.telefono, cx + 10, y);
          cx += 55;
        }
        if (p.direccion) {
          pdf.setTextColor(100, 116, 139);
          pdf.text('Dir', cx, y);
          pdf.setTextColor(47, 55, 65);
          pdf.text(p.direccion, cx + 10, y);
        }
        y += 14;

        if (p.bio) {
          y += 2;
          pdf.setFillColor(21, 128, 61);
          pdf.rect(m, y, 3, 10, 'F');
          pdf.setFontSize(10);
          pdf.setFont(undefined, 'bold');
          pdf.setTextColor(15, 23, 42);
          pdf.text('PERFIL PROFESIONAL', m + 8, y + 3.5);
          y += 13;
          pdf.setFont(undefined, 'normal');
          pdf.setFontSize(9);
          pdf.setTextColor(60, 70, 85);
          const bioLines = pdf.splitTextToSize(p.bio, pw - m * 2 - 5);
          bioLines.forEach((line, i) => {
            if (y > ph - 20) { pdf.addPage(); y = 15; }
            pdf.text(line, m + 3, y);
            y += 4;
          });
          y += 4;
        }

        const skillsByCat = {};
        perfilSkills.forEach(s => {
          if (!skillsByCat[s.categoria]) skillsByCat[s.categoria] = [];
          skillsByCat[s.categoria].push(s.nombre);
        });

        if (Object.keys(skillsByCat).length) {
          pdf.setFillColor(21, 128, 61);
          pdf.rect(m, y, 3, 10, 'F');
          pdf.setFontSize(10);
          pdf.setFont(undefined, 'bold');
          pdf.setTextColor(15, 23, 42);
          pdf.text('HABILIDADES TECNICAS', m + 8, y + 3.5);
          y += 13;
          pdf.setFont(undefined, 'normal');
          pdf.setFontSize(9);

          for (const [cat, skills] of Object.entries(skillsByCat)) {
            if (y > ph - 25) { pdf.addPage(); y = 15; }
            pdf.setFont(undefined, 'bold');
            pdf.setTextColor(21, 128, 61);
            pdf.text(cat, m + 3, y);
            y += 4;
            pdf.setFont(undefined, 'normal');
            pdf.setTextColor(60, 70, 85);
            const text = skills.join(', ');
            const wrapped = pdf.splitTextToSize(text, pw - m * 2 - 10);
            wrapped.forEach(line => {
              if (y > ph - 20) { pdf.addPage(); y = 15; }
              pdf.text('  ' + line, m + 3, y);
              y += 4;
            });
            y += 2;
          }
        }

        pdf.setDrawColor(215, 220, 230);
        pdf.setLineWidth(0.3);
        pdf.line(m, ph - 12, pw - m, ph - 12);
        pdf.setFontSize(7);
        pdf.setTextColor(155, 165, 180);
        pdf.text(`Generado por DevCardCV`, m, ph - 6);
        pdf.text(dayjs().format('DD/MM/YYYY HH:mm'), pw - m, ph - 6, { align: 'right' });

        const pdfBlob = pdf.output('blob');
        const nombre = p.nombre.replace(/\s+/g, '_');
        const fecha = dayjs().format('YYYYMMDD');
        const pdfName = `CV_${nombre}_${fecha}.pdf`;
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = pdfName;
        a.click();
        URL.revokeObjectURL(url);
        UI.toast(`PDF descargado: ${pdfName}`, 'success');
      } catch (err) {
        console.error('Error exportando PDF:', err);
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
        const relaciones = await db.perfil_habilidades.where('perfil_id').equals(p.id).toArray();
        const habilidades = await db.habilidades.toArray();
        const perfilSkills = relaciones
          .map(r => habilidades.find(h => h.id === r.habilidad_id))
          .filter(Boolean);

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pw = pdf.internal.pageSize.getWidth();
        const ph = pdf.internal.pageSize.getHeight();
        const m = 25;
        let y = 0;

        const hh = 42;
        pdf.setFillColor(15, 23, 42);
        pdf.rect(0, 0, pw, hh, 'F');

        if (p.fotoBase64) {
          try {
            const s = 16;
            const ix = m;
            const iy = (hh - s) / 2;
            pdf.addImage(p.fotoBase64, 'JPEG', ix, iy, s, s, undefined, 'FAST');
            pdf.setDrawColor(255, 255, 255);
            pdf.setLineWidth(0.3);
            pdf.roundedRect(ix, iy, s, s, 2, 2, 'S');
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(16);
            pdf.setFont(undefined, 'bold');
            pdf.text(p.nombre, m + s + 5, iy + 4);
            pdf.setFontSize(9);
            pdf.setFont(undefined, 'normal');
            pdf.setTextColor(180, 200, 220);
            pdf.text(p.cargo, m + s + 5, iy + 11);
          } catch (_) {
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(18);
            pdf.setFont(undefined, 'bold');
            pdf.text(p.nombre, m, 18);
            pdf.setFontSize(10);
            pdf.setFont(undefined, 'normal');
            pdf.setTextColor(180, 200, 220);
            pdf.text(p.cargo, m, 26);
          }
        } else {
          pdf.setTextColor(255, 255, 255);
          pdf.setFontSize(18);
          pdf.setFont(undefined, 'bold');
          pdf.text(p.nombre, m, 18);
          pdf.setFontSize(10);
          pdf.setFont(undefined, 'normal');
          pdf.setTextColor(180, 200, 220);
          pdf.text(p.cargo, m, 26);
        }

        y = hh + 8;
        pdf.setFillColor(248, 250, 252);
        pdf.rect(m - 5, y - 4, pw - m * 2 + 10, 14, 'F');
        pdf.setFontSize(8);
        pdf.setFont(undefined, 'normal');
        pdf.setTextColor(100, 116, 139);
        let cx = m;
        pdf.text('Email', cx, y);
        pdf.setTextColor(47, 55, 65);
        pdf.text(p.email || '', cx + 14, y);
        cx += 65;
        if (p.telefono) {
          pdf.setTextColor(100, 116, 139);
          pdf.text('Tel', cx, y);
          pdf.setTextColor(47, 55, 65);
          pdf.text(p.telefono, cx + 10, y);
          cx += 55;
        }
        if (p.direccion) {
          pdf.setTextColor(100, 116, 139);
          pdf.text('Dir', cx, y);
          pdf.setTextColor(47, 55, 65);
          pdf.text(p.direccion, cx + 10, y);
        }
        y += 14;

        if (p.bio) {
          y += 2;
          pdf.setFillColor(21, 128, 61);
          pdf.rect(m, y, 3, 10, 'F');
          pdf.setFontSize(10);
          pdf.setFont(undefined, 'bold');
          pdf.setTextColor(15, 23, 42);
          pdf.text('PERFIL PROFESIONAL', m + 8, y + 3.5);
          y += 13;
          pdf.setFont(undefined, 'normal');
          pdf.setFontSize(9);
          pdf.setTextColor(60, 70, 85);
          const bioLines = pdf.splitTextToSize(p.bio, pw - m * 2 - 5);
          bioLines.forEach((line, i) => {
            if (y > ph - 20) { pdf.addPage(); y = 15; }
            pdf.text(line, m + 3, y);
            y += 4;
          });
          y += 4;
        }

        const skillsByCat = {};
        perfilSkills.forEach(s => {
          if (!skillsByCat[s.categoria]) skillsByCat[s.categoria] = [];
          skillsByCat[s.categoria].push(s.nombre);
        });

        if (Object.keys(skillsByCat).length) {
          pdf.setFillColor(21, 128, 61);
          pdf.rect(m, y, 3, 10, 'F');
          pdf.setFontSize(10);
          pdf.setFont(undefined, 'bold');
          pdf.setTextColor(15, 23, 42);
          pdf.text('HABILIDADES TECNICAS', m + 8, y + 3.5);
          y += 13;
          pdf.setFont(undefined, 'normal');
          pdf.setFontSize(9);

          for (const [cat, skills] of Object.entries(skillsByCat)) {
            if (y > ph - 25) { pdf.addPage(); y = 15; }
            pdf.setFont(undefined, 'bold');
            pdf.setTextColor(21, 128, 61);
            pdf.text(cat, m + 3, y);
            y += 4;
            pdf.setFont(undefined, 'normal');
            pdf.setTextColor(60, 70, 85);
            const text = skills.join(', ');
            const wrapped = pdf.splitTextToSize(text, pw - m * 2 - 10);
            wrapped.forEach(line => {
              if (y > ph - 20) { pdf.addPage(); y = 15; }
              pdf.text('  ' + line, m + 3, y);
              y += 4;
            });
            y += 2;
          }
        }

        pdf.setDrawColor(215, 220, 230);
        pdf.setLineWidth(0.3);
        pdf.line(m, ph - 12, pw - m, ph - 12);
        pdf.setFontSize(7);
        pdf.setTextColor(155, 165, 180);
        pdf.text(`Generado por DevCardCV`, m, ph - 6);
        pdf.text(dayjs().format('DD/MM/YYYY HH:mm'), pw - m, ph - 6, { align: 'right' });

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
        const relaciones = await db.perfil_habilidades.where('perfil_id').equals(this.perfil.id).toArray();
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

    init() {
      window.UI = UI;
    }
  };
}

window.MODULES = window.MODULES || {};
window.MODULES[CV.id] = CV;
appRouter.register(CV);
