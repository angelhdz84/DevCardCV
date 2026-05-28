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
          <div class="relative p-6" style="background: linear-gradient(135deg, #065f46 0%, #059669 100%);">
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
                      <template x-for="skill in skills" :key="skill">
                        <span class="badge badge-sm" :class="'badge-skill-' + _sanitizeCat(cat)" style="border-radius: 4px;" x-text="skill"></span>
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
        const relaciones = await dbOnline.getWhere('perfil_habilidades', 'perfil_id', p.id);
        const habilidades = await dbOnline.getAll('habilidades');
        const perfilSkills = relaciones
          .map(r => habilidades.find(h => h.id == r.habilidad_id))
          .filter(Boolean);

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pw = pdf.internal.pageSize.getWidth();
        const ph = pdf.internal.pageSize.getHeight();
        const m = 22;
        let y = 0;

        const emailDecrypted = p.email ? cryptoHelpers.decrypt(p.email) || p.email : '';
        const telDecrypted = p.telefono ? cryptoHelpers.decrypt(p.telefono) || p.telefono : '';
        const dirDecrypted = p.direccion ? cryptoHelpers.decrypt(p.direccion) || p.direccion : '';

        function checkPage(delta) {
          if (y + (delta || 0) > ph - 18) { pdf.addPage(); y = 15; }
        }

        const acc = [21, 128, 61];
        const darkBg = [4, 120, 87];
        const darkFg = [255, 255, 255];
        const mutedFg = [180, 210, 195];
        const headingFg = [25, 35, 55];
        const bodyFg = [60, 70, 85];

        // ── Header: emerald gradient bar ──
        const hh = 46;
        pdf.setFillColor(darkBg[0], darkBg[1], darkBg[2]);
        pdf.rect(0, 0, pw, hh, 'F');
        pdf.setFillColor(5, 150, 105);
        pdf.rect(0, hh - 3, pw, 3, 'F');

        const avatarSize = 20;
        const avatarX = m;
        const avatarY = (hh - avatarSize) / 2;

        let hasAvatar = false;
        if (p.fotoBase64) {
          try {
            pdf.addImage(p.fotoBase64, 'JPEG', avatarX, avatarY, avatarSize, avatarSize, undefined, 'FAST');
            pdf.setDrawColor(255, 255, 255);
            pdf.setLineWidth(0.5);
            pdf.circle(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2);
            pdf.setFillColor(darkBg[0], darkBg[1], darkBg[2]);
            hasAvatar = true;
          } catch (_) {}
        }

        const textX = hasAvatar ? m + avatarSize + 7 : m;
        const textY = hasAvatar ? avatarY + 6 : 16;
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
        const contactItems = [];
        contactItems.push(['email', emailDecrypted]);
        if (telDecrypted) contactItems.push(['tel', telDecrypted]);
        if (dirDecrypted) contactItems.push(['direccion', dirDecrypted]);
        const contactsShown = contactItems.length;

        if (contactsShown) {
          pdf.setFillColor(246, 248, 250);
          pdf.rect(m - 3, y - 3.5, pw - m * 2 + 6, 11, 'F');
          let cx = m;
          contactItems.forEach((item) => {
            const [key, val] = item;
            pdf.setFontSize(7);
            pdf.setFont(undefined, 'normal');
            pdf.setTextColor(140, 150, 165);
            pdf.text(key.charAt(0).toUpperCase() + key.slice(1) + ':', cx, y);
            pdf.setFontSize(8);
            pdf.setTextColor(bodyFg[0], bodyFg[1], bodyFg[2]);
            const valTrunc = val.length > 32 ? val.slice(0, 30) + '\u2026' : val;
            pdf.text(valTrunc, cx + (key === 'email' ? 14 : 10), y);
            cx += (pw - m * 2) / contactsShown;
          });
          y += 13;
        }

        // ── Bio section ──
        if (p.bio) {
          checkPage(20);
          pdf.setFillColor(acc[0], acc[1], acc[2]);
          pdf.rect(m, y, 3, 11, 'F');
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
          pdf.rect(m, y, 3, 11, 'F');
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

            const tagsPerRow = 3;
            const tagW = (pw - m * 2 - (tagsPerRow - 1) * 4) / tagsPerRow;
            let col = 0;
            const startY = y;
            skills.forEach((skill, i) => {
              checkPage(7);
              const tx = m + col * (tagW + 4);
              const ty = startY + Math.floor(col / tagsPerRow) * 7;
              if (col >= tagsPerRow) col = 0;
              const actualX = m + col * (tagW + 4);
              const actualY = ty;
              pdf.setFillColor(240, 244, 248);
              pdf.roundedRect(actualX, actualY, tagW, 5.5, 1, 1, 'F');
              pdf.setFontSize(7);
              pdf.setFont(undefined, 'normal');
              pdf.setTextColor(c[0], c[1], c[2]);
              const display = skill.length > 18 ? skill.slice(0, 16) + '\u2026' : skill;
              pdf.text(display, actualX + 2.5, actualY + 4);
              col++;
            });
            if (col > 0) y = startY + (Math.ceil(col / tagsPerRow)) * 7 + 6;
            else y += 6;
          }
        }

        // ── Footer ──
        pdf.setDrawColor(215, 220, 230);
        pdf.setLineWidth(0.3);
        pdf.line(m, ph - 13, pw - m, ph - 13);
        pdf.setFontSize(7);
        pdf.setTextColor(155, 165, 180);
        pdf.text('Generado por DevCardCV', m, ph - 7);
        pdf.text(dayjs().format('DD/MM/YYYY HH:mm'), pw - m, ph - 7, { align: 'right' });
        pdf.text('P\u00E1gina 1', pw / 2, ph - 7, { align: 'center' });

        const totalPages = pdf.getNumberOfPages();
        for (let i = 2; i <= totalPages; i++) {
          pdf.setPage(i);
          pdf.setDrawColor(215, 220, 230);
          pdf.setLineWidth(0.3);
          pdf.line(m, ph - 13, pw - m, ph - 13);
          pdf.setFontSize(7);
          pdf.setTextColor(155, 165, 180);
          pdf.text('Generado por DevCardCV', m, ph - 7);
          pdf.text(dayjs().format('DD/MM/YYYY HH:mm'), pw - m, ph - 7, { align: 'right' });
          pdf.text('P\u00E1gina ' + i, pw / 2, ph - 7, { align: 'center' });
        }

        const pdfBlob = pdf.output('blob');
        const nombre = p.nombre.replace(/\s+/g, '_');
        const fecha = dayjs().format('YYYYMMDD');
        const pdfName = 'CV_' + nombre + '_' + fecha + '.pdf';
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = pdfName;
        a.click();
        URL.revokeObjectURL(url);
        UI.toast('PDF descargado: ' + pdfName, 'success');
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
        const relaciones = await dbOnline.getWhere('perfil_habilidades', 'perfil_id', p.id);
        const habilidades = await dbOnline.getAll('habilidades');
        const perfilSkills = relaciones
          .map(r => habilidades.find(h => h.id == r.habilidad_id))
          .filter(Boolean);

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pw = pdf.internal.pageSize.getWidth();
        const ph = pdf.internal.pageSize.getHeight();
        const m = 22;
        let y = 0;

        const emailDecrypted = p.email ? cryptoHelpers.decrypt(p.email) || p.email : '';
        const telDecrypted = p.telefono ? cryptoHelpers.decrypt(p.telefono) || p.telefono : '';
        const dirDecrypted = p.direccion ? cryptoHelpers.decrypt(p.direccion) || p.direccion : '';

        function checkPage(delta) {
          if (y + (delta || 0) > ph - 18) { pdf.addPage(); y = 15; }
        }

        const acc = [21, 128, 61];
        const darkBg = [4, 120, 87];
        const darkFg = [255, 255, 255];
        const mutedFg = [180, 210, 195];
        const headingFg = [25, 35, 55];
        const bodyFg = [60, 70, 85];

        const hh = 46;
        pdf.setFillColor(darkBg[0], darkBg[1], darkBg[2]);
        pdf.rect(0, 0, pw, hh, 'F');
        pdf.setFillColor(5, 150, 105);
        pdf.rect(0, hh - 3, pw, 3, 'F');

        const avatarSize = 20;
        const avatarX = m;
        const avatarY = (hh - avatarSize) / 2;

        let hasAvatar = false;
        if (p.fotoBase64) {
          try {
            pdf.addImage(p.fotoBase64, 'JPEG', avatarX, avatarY, avatarSize, avatarSize, undefined, 'FAST');
            pdf.setDrawColor(255, 255, 255);
            pdf.setLineWidth(0.5);
            pdf.circle(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2);
            pdf.setFillColor(darkBg[0], darkBg[1], darkBg[2]);
            hasAvatar = true;
          } catch (_) {}
        }

        const textX = hasAvatar ? m + avatarSize + 7 : m;
        const textY = hasAvatar ? avatarY + 6 : 16;
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

        y = hh + 9;
        const contactItems = [];
        contactItems.push(['email', emailDecrypted]);
        if (telDecrypted) contactItems.push(['tel', telDecrypted]);
        if (dirDecrypted) contactItems.push(['direccion', dirDecrypted]);
        const contactsShown = contactItems.length;

        if (contactsShown) {
          pdf.setFillColor(246, 248, 250);
          pdf.rect(m - 3, y - 3.5, pw - m * 2 + 6, 11, 'F');
          let cx = m;
          contactItems.forEach((item) => {
            const [key, val] = item;
            pdf.setFontSize(7);
            pdf.setFont(undefined, 'normal');
            pdf.setTextColor(140, 150, 165);
            pdf.text(key.charAt(0).toUpperCase() + key.slice(1) + ':', cx, y);
            pdf.setFontSize(8);
            pdf.setTextColor(bodyFg[0], bodyFg[1], bodyFg[2]);
            const valTrunc = val.length > 32 ? val.slice(0, 30) + '\u2026' : val;
            pdf.text(valTrunc, cx + (key === 'email' ? 14 : 10), y);
            cx += (pw - m * 2) / contactsShown;
          });
          y += 13;
        }

        if (p.bio) {
          checkPage(20);
          pdf.setFillColor(acc[0], acc[1], acc[2]);
          pdf.rect(m, y, 3, 11, 'F');
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
          pdf.rect(m, y, 3, 11, 'F');
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

            const tagsPerRow = 3;
            const tagW = (pw - m * 2 - (tagsPerRow - 1) * 4) / tagsPerRow;
            let col = 0;
            const startY = y;
            skills.forEach((skill) => {
              checkPage(7);
              if (col >= tagsPerRow) col = 0;
              const actualX = m + col * (tagW + 4);
              const actualY = startY + Math.floor(col / tagsPerRow) * 7;
              pdf.setFillColor(240, 244, 248);
              pdf.roundedRect(actualX, actualY, tagW, 5.5, 1, 1, 'F');
              pdf.setFontSize(7);
              pdf.setFont(undefined, 'normal');
              pdf.setTextColor(c[0], c[1], c[2]);
              const display = skill.length > 18 ? skill.slice(0, 16) + '\u2026' : skill;
              pdf.text(display, actualX + 2.5, actualY + 4);
              col++;
            });
            if (col > 0) y = startY + (Math.ceil(col / tagsPerRow)) * 7 + 6;
            else y += 6;
          }
        }

        pdf.setDrawColor(215, 220, 230);
        pdf.setLineWidth(0.3);
        pdf.line(m, ph - 13, pw - m, ph - 13);
        pdf.setFontSize(7);
        pdf.setTextColor(155, 165, 180);
        pdf.text('Generado por DevCardCV', m, ph - 7);
        pdf.text(dayjs().format('DD/MM/YYYY HH:mm'), pw - m, ph - 7, { align: 'right' });
        pdf.text('P\u00E1gina 1', pw / 2, ph - 7, { align: 'center' });

        const totalPages = pdf.getNumberOfPages();
        for (let i = 2; i <= totalPages; i++) {
          pdf.setPage(i);
          pdf.setDrawColor(215, 220, 230);
          pdf.setLineWidth(0.3);
          pdf.line(m, ph - 13, pw - m, ph - 13);
          pdf.setFontSize(7);
          pdf.setTextColor(155, 165, 180);
          pdf.text('Generado por DevCardCV', m, ph - 7);
          pdf.text(dayjs().format('DD/MM/YYYY HH:mm'), pw - m, ph - 7, { align: 'right' });
          pdf.text('P\u00E1gina ' + i, pw / 2, ph - 7, { align: 'center' });
        }

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
