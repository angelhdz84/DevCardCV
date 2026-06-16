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

      const dniDecrypted = perfil.dni || '';
      perfilData = {
        ...perfil,
        email: perfil.email || '',
        telefono: perfil.telefono || '',
        direccion: perfil.direccion || '',
        dni: dniDecrypted,
        edad: calcularEdad(dniDecrypted),
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
      <p class="text-xs text-muted mt-1" x-show="perfil" x-text="perfil.nombre + ' — ' + perfil.cargo"></p>
    </div>
    <div class="flex flex-wrap gap-2">
      <select x-model="selectedId" @change="cambiarPerfil()" class="select select-bordered select-sm radius-md">
        <option value="" disabled>Seleccionar perfil</option>
        <template x-for="p in perfiles" :key="p.id">
          <option :value="p.id" x-text="p.nombre + ' — ' + p.cargo" :selected="p.id === currentId"></option>
        </template>
      </select>
      <button class="btn btn-primary btn-magnetic btn-sm radius-md" @click="exportarPDF()" :disabled="!perfil || exporting" aria-label="Exportar CV en PDF">
        <i class="bi bi-file-earmark-pdf-fill"></i>
        <span x-show="!exporting">Exportar PDF</span>
        <span x-show="exporting" class="loading loading-spinner loading-xs" role="status" aria-label="Exportando PDF"></span>
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
          <!-- Encabezado con foto -->
          <div class="relative p-6" style="background: linear-gradient(135deg, #065f46 0%, #059669 100%);">
            <div class="flex items-center gap-5">
              <div class="avatar">
                <div class="w-16 h-16 rounded-xl ring-2 ring-white/20 overflow-hidden bg-white/10 flex items-center justify-center">
                  <template x-if="perfil.fotoBase64">
                    <img :src="perfil.fotoBase64" alt="Foto de perfil" class="w-full h-full object-cover">
                  </template>
                  <template x-if="!perfil.fotoBase64">
                    <i class="bi bi-person-fill text-3xl text-white/30" role="img" aria-label="Avatar por defecto"></i>
                  </template>
                </div>
              </div>
              <div class="w-12 h-12 rounded-full bg-white/20 flex-shrink-0 flex items-center justify-center text-white font-bold text-base ring-2 ring-white/10"
                   x-show="perfil.edad" x-text="perfil.edad">
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
                <div class="flex items-center gap-2 text-muted">
                  <i class="bi bi-envelope text-accent/60"></i>
                  <span x-text="perfil.email"></span>
                </div>
                <div class="flex items-center gap-2 text-muted" x-show="perfil.dni">
                  <i class="bi bi-card-text text-accent/60"></i>
                  <span x-text="perfil.dni"></span>
                </div>
                <div class="flex items-center gap-2 text-muted" x-show="perfil.telefono">
                  <i class="bi bi-phone text-accent/60"></i>
                  <span x-text="perfil.telefono"></span>
                </div>
                <div class="flex items-center gap-2 text-muted" x-show="perfil.direccion">
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
              <p class="text-sm text-[var(--ink-secondary)] leading-relaxed" x-text="perfil.bio"></p>
            </div>

            <!-- Skills por categoría — tinted badges -->
            <div>
              <h3 class="section-label mb-3 flex items-center gap-2">
                <i class="bi bi-tools"></i> Habilidades Técnicas
              </h3>
              <div class="grid grid-cols-2 gap-3">
                <template x-for="(entry, i) in catEntries" :key="entry.cat">
                  <div :class="(entry.total % 2 === 1 && i === entry.total - 1) ? 'col-span-2' : ''">
                    <p class="text-xs font-medium text-muted mb-1.5 flex items-center gap-1.5"><i class="bi bi-folder-fill text-accent/40 text-[10px]"></i> <span x-text="entry.cat"></span></p>
                    <div class="border-t-default my-1.5"></div>
                    <div class="flex flex-wrap gap-1.5">
                      <template x-for="(skill, j) in entry.skills" :key="skill">
                        <span class="badge badge-sm stagger-enter radius-sm" :class="'badge-skill-' + _sanitizeCat(entry.cat)" x-text="skill" :style="'animation-delay: ' + (j * 40) + 'ms'"></span>
                      </template>
                    </div>
                  </div>
                </template>
                <template x-if="!catEntries.length">
                  <div class="col-span-2">
                    <p class="text-sm text-base-content/50" role="alert">No hay habilidades registradas.</p>
                  </div>
                </template>
              </div>
            </div>

            <!-- Footer -->
            <div class="mt-6 pt-4 border-t-default text-xs text-muted text-center">
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
              <span x-show="exporting" class="loading loading-spinner loading-xs" role="status" aria-label="Exportando PDF"></span>
            </button>
            <button class="btn btn-ghost w-full btn-sm mt-1 radius-md border-default transition-spring" @click="exportarPerfilJSON()">
              <i class="bi bi-filetype-json"></i> Exportar JSON
            </button>
          </div>
        </div>

        <!-- Exportar Excel (solo admin) -->
        <div x-show="$store.auth.isAdmin" class="card bg-white">
          <div class="card-body p-4">
            <h3 class="section-label mb-3 flex items-center gap-2">
              <i class="bi bi-file-earmark-spreadsheet text-accent"></i> Exportar Excel
            </h3>
            <button class="btn btn-primary btn-magnetic w-full btn-sm radius-md" @click="exportarExcelUnico()" :disabled="!perfil">
              <i class="bi bi-person-fill"></i> Este desarrollador
            </button>
            <button class="btn btn-ghost w-full btn-sm mt-1 radius-md border-default transition-spring" @click="exportarExcelTodos()">
              <i class="bi bi-people-fill"></i> Todos los desarrolladores
            </button>
          </div>
        </div>

        <!-- Info -->
        <div class="card bg-white">
          <div class="card-body p-4">
            <h3 class="section-label mb-3 flex items-center gap-2">
              <i class="bi bi-info-circle text-accent"></i> Info
            </h3>
            <div class="text-xs text-muted space-y-1.5">
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

    get catEntries() {
      if (!this.perfil?.skillsByCat) return [];
      return Object.entries(this.perfil.skillsByCat).map(([cat, skills], idx) => ({
        cat, skills,
        idx,
        total: Object.keys(this.perfil.skillsByCat).length
      }));
    },

    async cambiarPerfil() {
      window.location.hash = `#/cv/${this.selectedId}`;
    },

    // ── Helper: generar PDF ──
    _generarPDF(p, perfilSkills) {
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      const m = 22;
      let y = 0;

      const emailDecrypted = p.email || '';
      const telDecrypted = p.telefono || '';
      const dirDecrypted = p.direccion || '';
      const dniDecrypted = p.dni || '';

      const checkPage = (delta) => { if (y + (delta || 0) > ph - 18) { pdf.addPage(); y = 15; } };

      const acc = [21, 128, 61];
      const darkBg = [4, 120, 87];
      const darkFg = [255, 255, 255];
      const mutedFg = [180, 210, 195];
      const headingFg = [25, 35, 55];
      const bodyFg = [60, 70, 85];

      // ── Header: emerald bar ──
      const hh = 52;
      pdf.setFillColor(darkBg[0], darkBg[1], darkBg[2]);
      pdf.rect(0, 0, pw, hh, 'F');
      pdf.setFillColor(5, 150, 105);
      pdf.rect(0, hh - 3, pw, 3, 'F');
      pdf.setFillColor(5, 150, 105);
      pdf.rect(pw - 28, hh - 8, 22, 4, 'F');

      // ── Decorative: subtle circle pattern ──
      pdf.setDrawColor(5, 150, 105);
      pdf.setLineWidth(0.15);
      for (let i = 0; i < 3; i++) {
        pdf.circle(pw - 15 - i * 8, hh - 10, 2 + i * 2, 'S');
      }

      let hasAvatar = false;
      const avatarSize = 28;
      if (p.fotoBase64) {
        try {
          pdf.addImage(p.fotoBase64, 'JPEG', m, (hh - avatarSize) / 2, avatarSize, avatarSize, undefined, 'FAST');
          pdf.setDrawColor(255, 255, 255);
          pdf.setLineWidth(1);
          pdf.roundedRect(m, (hh - avatarSize) / 2, avatarSize, avatarSize, 1.5, 1.5, 'S');
          hasAvatar = true;
        } catch (_) {}
      }

      // ── Age circle ──
      let circleEnd = 0;
      const edadNum = calcularEdad(dniDecrypted);
      if (hasAvatar && edadNum != null) {
        const circleR = 5.5;
        const circleY = (hh - avatarSize) / 2 + avatarSize / 2;
        const circleX = m + avatarSize + 6;
        pdf.setFillColor(acc[0], acc[1], acc[2]);
        pdf.circle(circleX, circleY, circleR, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(9);
        pdf.setFont(undefined, 'bold');
        pdf.text(String(edadNum), circleX, circleY + 0.35, { align: 'center' });
        circleEnd = circleX + circleR + 4;
      }

      const textX = circleEnd || (hasAvatar ? m + avatarSize + 7 : m);
      const textY = hasAvatar ? (hh - avatarSize) / 2 + 6 : 16;
      pdf.setTextColor(darkFg[0], darkFg[1], darkFg[2]);
      pdf.setFontSize(22);
      pdf.setFont(undefined, 'bold');
      pdf.text(p.nombre, textX, textY);
      if (p.cargo) {
        pdf.setFontSize(11);
        pdf.setFont(undefined, 'bold');
        pdf.setTextColor(mutedFg[0], mutedFg[1], mutedFg[2]);
        pdf.text(p.cargo, textX, textY + 8);
      }

      // ── Contact info bar ──
      y = hh + 9;
      const visible = [];
      visible.push(['Email', emailDecrypted]);
      if (dniDecrypted) visible.push(['DNI', dniDecrypted]);
      if (telDecrypted) visible.push(['Tel', telDecrypted]);
      if (dirDecrypted) visible.push(['Direccion', dirDecrypted]);

      if (visible.length) {
        const contactPad = 5;
        const contactPillH = 5;
        const contactPillPad = 2;
        const contactTagH = 5;
        const contactCardH = contactPad + contactPillH + contactPillPad + contactTagH + contactPad;
        const contactGap = 6;

        const drawContactCard = (label, val, cx, cy, cw) => {
          pdf.setFillColor(248, 249, 251);
          pdf.roundedRect(cx, cy, cw, contactCardH, 2, 2, 'F');
          pdf.setDrawColor(224, 228, 234);
          pdf.setLineWidth(0.3);
          pdf.roundedRect(cx, cy, cw, contactCardH, 2, 2, 'S');
          pdf.setFillColor(acc[0], acc[1], acc[2]);
          pdf.roundedRect(cx + contactPad, cy + contactPad, cw - contactPad * 2, contactPillH, 1, 1, 'F');
          pdf.setFontSize(6.5);
          pdf.setFont(undefined, 'bold');
          pdf.setTextColor(255, 255, 255);
          pdf.text(label.toUpperCase(), cx + contactPad + 2.5, cy + contactPad + 3.5);
          const tagY = cy + contactPad + contactPillH + contactPillPad;
          pdf.setFillColor(255, 255, 255);
          pdf.roundedRect(cx + contactPad, tagY, cw - contactPad * 2, contactTagH, 0.8, 0.8, 'F');
          pdf.setDrawColor(215, 220, 227);
          pdf.setLineWidth(0.2);
          pdf.roundedRect(cx + contactPad, tagY, cw - contactPad * 2, contactTagH, 0.8, 0.8, 'S');
          pdf.setFontSize(8);
          pdf.setFont(undefined, 'normal');
          pdf.setTextColor(headingFg[0], headingFg[1], headingFg[2]);
          const trunc = val.length > 35 ? val.slice(0, 33) + '\u2026' : val;
          pdf.text(trunc, cx + contactPad + 3, tagY + 3.8);
        };

        for (let i = 0; i < visible.length; i += 2) {
          const [label1, val1] = visible[i];
          const pairContact = visible[i + 1];

          if (pairContact) {
            const contactW = (pw - m * 2 - contactGap) / 2;
            drawContactCard(label1, val1, m, y, contactW);
            drawContactCard(pairContact[0], pairContact[1], m + contactW + contactGap, y, contactW);
            y += contactCardH + 3;
          } else {
            const contactFullW = pw - m * 2;
            drawContactCard(label1, val1, m, y, contactFullW);
            y += contactCardH + 3;
          }
        }
      }

      // ── Bio section ──
      if (p.bio) {
        const bioPad = 6;
        const bioPillH = 5.5;
        const bioPillPad = 3;
        const bioLineH = 4.2;
        const bioFullW = pw - m * 2;

        pdf.setFontSize(9);
        pdf.setFont(undefined, 'normal');
        const bioLines = pdf.splitTextToSize(p.bio, bioFullW - bioPad * 2 - 6);
        const bioTagH = bioLines.length * bioLineH;
        const bioCardH = bioPad + bioPillH + bioPillPad + bioTagH + bioPad;

        checkPage(bioCardH + 5);

        pdf.setFillColor(248, 249, 251);
        pdf.roundedRect(m, y, bioFullW, bioCardH, 2, 2, 'F');
        pdf.setDrawColor(224, 228, 234);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(m, y, bioFullW, bioCardH, 2, 2, 'S');

        pdf.setFillColor(acc[0], acc[1], acc[2]);
        pdf.roundedRect(m + bioPad, y + bioPad, bioFullW - bioPad * 2, bioPillH, 1, 1, 'F');
        pdf.setFontSize(6.5);
        pdf.setFont(undefined, 'bold');
        pdf.setTextColor(255, 255, 255);
        pdf.text('PERFIL PROFESIONAL', m + bioPad + 2.5, y + bioPad + 3.5);

        const bioTagY = y + bioPad + bioPillH + bioPillPad;
        pdf.setFillColor(255, 255, 255);
        pdf.roundedRect(m + bioPad, bioTagY, bioFullW - bioPad * 2, bioTagH, 0.8, 0.8, 'F');
        pdf.setDrawColor(215, 220, 227);
        pdf.setLineWidth(0.2);
        pdf.roundedRect(m + bioPad, bioTagY, bioFullW - bioPad * 2, bioTagH, 0.8, 0.8, 'S');

        pdf.setFontSize(9);
        pdf.setFont(undefined, 'normal');
        pdf.setTextColor(bodyFg[0], bodyFg[1], bodyFg[2]);
        bioLines.forEach((line, li) => {
          pdf.text(line, m + bioPad + 3, bioTagY + 3.8 + li * bioLineH);
        });

        y += bioCardH + 5;
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
        pdf.roundedRect(m, y, 4, 12, 0.8, 0.8, 'F');
        pdf.setFontSize(10);
        pdf.setFont(undefined, 'bold');
        pdf.setTextColor(headingFg[0], headingFg[1], headingFg[2]);
        pdf.text('HABILIDADES TECNICAS', m + 8, y + 4);
        y += 14;

        const innerPad = 6;
        const innerCols = 2;
        const pillH = 5.5;
        const pillPad = 3;
        const tagH = 5;
        const colGap = 4;
        const cardGap = 8;
        const cardW = (pw - m * 2 - cardGap) / 2;

        const cardH = (skills, cw) => {
          const iw = (cw - innerPad * 2 - (innerCols - 1) * colGap) / innerCols;
          const rows = Math.ceil(skills.length / innerCols);
          return innerPad + pillH + pillPad + rows * (tagH + 1.2) + innerPad;
        };

        const drawCard = (cat, skills, x, yp, cw) => {
          const ch = cardH(skills, cw);
          const c = catColors[cat] || acc;
          pdf.setFillColor(248, 249, 251);
          pdf.roundedRect(x, yp, cw, ch, 2, 2, 'F');
          pdf.setDrawColor(224, 228, 234);
          pdf.setLineWidth(0.3);
          pdf.roundedRect(x, yp, cw, ch, 2, 2, 'S');
          pdf.setFillColor(c[0], c[1], c[2]);
          pdf.roundedRect(x + innerPad, yp + innerPad, cw - innerPad * 2, pillH, 1, 1, 'F');
          pdf.setFontSize(6.5);
          pdf.setFont(undefined, 'bold');
          pdf.setTextColor(255, 255, 255);
          pdf.text(cat.toUpperCase(), x + innerPad + 2.5, yp + innerPad + 4);
          const tagStartY = yp + innerPad + pillH + pillPad;
          const iw = (cw - innerPad * 2 - (innerCols - 1) * colGap) / innerCols;
          skills.forEach((skill, si) => {
            const scol = si % innerCols;
            const srow = Math.floor(si / innerCols);
            const sx = x + innerPad + scol * (iw + colGap);
            const sy = tagStartY + srow * (tagH + 1.2);
            pdf.setFillColor(255, 255, 255);
            pdf.roundedRect(sx, sy, iw, tagH, 0.8, 0.8, 'F');
            pdf.setDrawColor(215, 220, 227);
            pdf.setLineWidth(0.2);
            pdf.roundedRect(sx, sy, iw, tagH, 0.8, 0.8, 'S');
            pdf.setFillColor(c[0], c[1], c[2]);
            pdf.circle(sx + 3, sy + tagH / 2, 0.8, 'F');
            pdf.setFontSize(6.5);
            pdf.setFont(undefined, 'normal');
            pdf.setTextColor(bodyFg[0], bodyFg[1], bodyFg[2]);
            const display = skill.length > 14 ? skill.slice(0, 12) + '\u2026' : skill;
            pdf.text(display, sx + 5, sy + 3.8);
          });
          return ch;
        };

        const entries = Object.entries(skillsByCat);
        for (let i = 0; i < entries.length; i += 2) {
          const [cat1, skills1] = entries[i];
          const pair = entries[i + 1];

          if (pair) {
            const h1 = cardH(skills1, cardW);
            const h2 = cardH(pair[1], cardW);
            const maxH = Math.max(h1, h2);
            checkPage(maxH + 10);
            drawCard(cat1, skills1, m, y, cardW);
            drawCard(pair[0], pair[1], m + cardW + cardGap, y, cardW);
            y += maxH + 3;
          } else {
            const fullW = pw - m * 2;
            const h = cardH(skills1, fullW);
            checkPage(h + 10);
            drawCard(cat1, skills1, m, y, fullW);
            y += h + 3;
          }
        }
      }

      // ── Footer ──
      const drawFooter = (pageNum) => {
        pdf.setDrawColor(215, 220, 230);
        pdf.setLineWidth(0.6);
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

    async exportarExcelUnico() {
      if (!this.perfil) return;
      try {
        const p = this.perfil;
        const relaciones = await dbOnline.getWhere('perfil_habilidades', 'perfil_id', p.id);
        const habilidades = await dbOnline.getAll('habilidades');
        const perfilSkills = relaciones
          .map(r => habilidades.find(h => h.id == r.habilidad_id))
          .filter(Boolean);
        const row = {
          'Nombre': p.nombre,
          'Cargo': p.cargo,
          'DNI': p.dni || '',
          'Email': p.email || '',
          'Teléfono': p.telefono || '',
          'Dirección': p.direccion || '',
          'Biografía': p.bio || '',
          'Skills': perfilSkills.map(s => s.nombre).join(', '),
          'Categorías': [...new Set(perfilSkills.map(s => s.categoria))].join(', ')
        };
        const ws = XLSX.utils.json_to_sheet([row]);
        ws['!cols'] = [{ wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 30 }, { wch: 40 }, { wch: 40 }, { wch: 30 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Desarrollador');
        const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([buf], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `CV_${p.nombre.replace(/\s+/g, '_')}_${dayjs().format('YYYYMMDD')}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        UI.toast(`Excel exportado: ${p.nombre}`, 'success');
      } catch (err) {
        UI.toast('Error al exportar Excel: ' + err.message, 'error');
      }
    },

    async exportarExcelTodos() {
      try {
        const perfiles = await dbOnline.getAll('perfiles');
        const relaciones = await dbOnline.getAll('perfil_habilidades');
        const habilidades = await dbOnline.getAll('habilidades');
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
        a.download = `DevCardCV_todos_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        UI.toast(`Excel exportado: ${rows.length} desarrolladores`, 'success');
      } catch (err) {
        UI.toast('Error al exportar Excel: ' + err.message, 'error');
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
            email: this.perfil.email || '',
            telefono: this.perfil.telefono || '',
            direccion: this.perfil.direccion || '',
            dni: this.perfil.dni || ''
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
