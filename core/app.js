// core/app.js — Router hash-based + registro de módulos + auth guard
const appRouter = {
  currentRoute: '',
  modules: {},
  authChecked: false,

  // 💡 Registrar un módulo

  // 💡 Registrar un módulo
  register(module) {
    if (!APP_CONFIG.modulosActivos.includes(module.id)) return;
    this.modules[module.id] = module;
    console.log(`📦 Módulo registrado: ${module.id} — ${module.titulo}`);
  },

  // 💡 Navegar a una ruta
  navigate(route) {
    window.location.hash = route;
  },

  // 💡 Manejar cambio de hash
  async handleRoute() {
    let hash = window.location.hash.slice(1) || '/dashboard';
    let parts = hash.split('/').filter(Boolean);
    let moduleId = parts[0];
    let params = parts.slice(1);

    // 💡 Route aliases: login/setup/register → auth module
    if (['login', 'setup', 'register'].includes(moduleId)) {
      window.location.hash = '#/auth/' + moduleId;
      return;
    }

    // 💡 Route guard: redirigir a login si no hay sesión
    const auth = Alpine.store('auth');
    if (this.authChecked && !auth.isLoggedIn && moduleId !== 'auth') {
      window.location.hash = '#/auth/login';
      return;
    }

    // 💡 Si hay sesión y está en auth, redirigir a dashboard
    if (this.authChecked && auth.isLoggedIn && moduleId === 'auth') {
      window.location.hash = '#/dashboard';
      return;
    }

    // 💡 Re-parsed después de alias redirect
    hash = window.location.hash.slice(1) || '/dashboard';
    parts = hash.split('/').filter(Boolean);
    moduleId = parts[0];
    params = parts.slice(1);

    if (this.currentRoute === hash) return;
    this.currentRoute = hash;

    const container = document.getElementById('app-content');
    if (!container) return;

    // 💡 Destruir módulo anterior
    if (window._currentModule && this.modules[window._currentModule]?.destroy) {
      this.modules[window._currentModule].destroy();
    }

    const module = this.modules[moduleId];
    if (!module) {
      container.innerHTML = UI.emptyState('Módulo no encontrado', 'bi-exclamation-triangle');
      return;
    }

    UI.showLoading('app-content', `Cargando ${module.titulo}...`);

    try {
      await module.init();
      container.style.opacity = '0';
      container.style.transform = 'translateY(8px)';
      container.innerHTML = await module.render({ params });
      requestAnimationFrame(() => {
        container.style.opacity = '1';
        container.style.transform = 'translateY(0)';
      });
      window._currentModule = moduleId;
      window._currentParams = params;

      // 💡 Actualizar navegación activa
      document.querySelectorAll('#nav-menu li').forEach(li => {
        li.classList.toggle('active', li.dataset.module === moduleId);
      });

      // 💡 Cerrar sidebar en móvil
      const drawer = document.getElementById('sidebar-drawer');
      if (drawer) drawer.checked = false;
    } catch (err) {
      console.error(`❌ Error en módulo ${moduleId}:`, err);
      container.innerHTML = UI.emptyState('Error al cargar el módulo', 'bi-bug');
    }
  },

  // 💡 Generar menú de navegación
  buildMenu() {
    const menu = document.getElementById('nav-menu');
    if (!menu) return;

    const icons = {
      dashboard: 'bi-speedometer2',
      perfiles: 'bi-people-fill',
      habilidades: 'bi-tools',
      cv: 'bi-file-earmark-richtext-fill',
      proyectos: 'bi-kanban'
    };

    menu.innerHTML = APP_CONFIG.modulosActivos
      .filter(id => id !== 'auth')
      .map(id => {
        const mod = this.modules[id];
        if (!mod) return '';
        const icon = icons[id] || 'bi-circle';
        return `<li data-module="${id}">
          <a href="#/${id}" class="flex items-center gap-2.5 rounded-lg text-sm">
            <i class="bi ${icon} text-base"></i>
            <span>${mod.titulo}</span>
          </a>
        </li>`;
      }).join('');
  },

  // 💡 Inicializar router
  init() {
    this._initAuthStore();
    window.addEventListener('hashchange', () => this.handleRoute());
    this.buildMenu();
    this.handleRoute();

    // 💡 Atajos de teclado globales
    document.addEventListener('keydown', (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 'n') {
        e.preventDefault();
        window.location.hash = '#/perfiles/nuevo/' + Date.now();
      }
      if (mod && e.key === 'f') {
        e.preventDefault();
        const searchInput = document.querySelector('#app-content input[type="text"][placeholder*="Buscar"]');
        if (searchInput) searchInput.focus();
      }
      if (mod && e.key === 'e') {
        e.preventDefault();
        const exportBtn = document.querySelector('#app-content button:has(.bi-download)');
        if (exportBtn) exportBtn.click();
      }
    });
  },

  // 💡 Auto-crear admin desde project.config.js si no existe en DB
  async _bootstrapAdmin() {
    if (!APP_CONFIG.auth || !APP_CONFIG.auth.admin) return;
    const { email, password, nombre } = APP_CONFIG.auth.admin;
    if (!email || !password || !nombre) return;
    try {
      const emailHash = CryptoJS.SHA256(email.toLowerCase().trim()).toString(CryptoJS.enc.Hex);
      const existentes = await dbOnline.getWhere('usuarios', 'email_hash', emailHash);
      if (existentes.length > 0) return true;
      const hash = CryptoJS.SHA256(password).toString(CryptoJS.enc.Hex);
      await dbOnline.add('usuarios', {
        email: cryptoHelpers.encrypt(email), email_hash: emailHash, nombre, password_hash: hash, rol: 'admin', perfilId: null, created_at: new Date(), updated_at: new Date()
      });
    } catch (e) { /* ignorar */ }
  },

  // 💡 Inicializar stores globales
  _initAuthStore() {
    if (!Alpine.store('ui')) {
      Alpine.store('ui', {
        sidebarCollapsed: (() => { try { return localStorage.getItem('_sidebar_collapsed') === 'true'; } catch(e) { return false; } })(),
        toggleSidebar() {
          this.sidebarCollapsed = !this.sidebarCollapsed;
          try { localStorage.setItem('_sidebar_collapsed', this.sidebarCollapsed); } catch(e) {}
        }
      });
    }
    if (Alpine.store('auth')) return;
    Alpine.store('auth', {
      user: null,
      sessionToken: null,
      perfil: null,
      fotoBase64: null,

      get isLoggedIn() { return !!this.user; },
      get isAdmin() { return this.user?.rol === 'admin'; },

      setSession(session) {
        this.user = session;
        this.sessionToken = session.token;
      },

      setPerfil(p) {
        this.perfil = p;
        this.fotoBase64 = (p && p.fotoBase64) || null;
      },

      clearSession() {
        this.user = null;
        this.sessionToken = null;
        this.perfil = null;
        this.fotoBase64 = null;
        localStorage.removeItem(APP_CONFIG.auth.sessionKey);
      },

      canEdit(perfilId) {
        if (!this.user) return false;
        if (this.user.rol === 'admin') return true;
        return this.user.perfilId === perfilId;
      },

      canManageSkills() { return !!this.user; },
      canBackup() { return this.user?.rol === 'admin'; }
    });
  },

  // 💡 Restaurar sesión desde localStorage
  async checkSession() {
    const raw = localStorage.getItem(APP_CONFIG.auth.sessionKey);
    if (!raw) { this.authChecked = true; return; }
    try {
      const session = JSON.parse(raw);
      if (!session.userId) { localStorage.removeItem(APP_CONFIG.auth.sessionKey); this.authChecked = true; return; }
      // 💡 Verificar que el usuario aún existe en la DB
      const exists = await dbOnline.get('usuarios', session.userId);
      if (exists) {
        Alpine.store('auth').setSession(session);
        const perfil = exists.perfilId ? await dbOnline.get('perfiles', exists.perfilId) : null;
        Alpine.store('auth').setPerfil(perfil);
      } else {
        localStorage.removeItem(APP_CONFIG.auth.sessionKey);
      }
    } catch (e) { /* ignorar */ }
    this.authChecked = true;
  },

  // 💡 Crear dev demo si no existe
  async _bootstrapDemoDev() {
    try {
      const email = 'carlos@dev.com';
      const emailHash = CryptoJS.SHA256(email.toLowerCase().trim()).toString(CryptoJS.enc.Hex);
      const existentes = await dbOnline.getWhere('usuarios', 'email_hash', emailHash);
      if (existentes.length > 0) return;

      const perfil = await dbOnline.add('perfiles', {
        nombre: 'Carlos Dev',
        email: cryptoHelpers.encrypt(email),
        cargo: 'Full Stack Developer',
        bio: 'Desarrollador full stack con 5+ años de experiencia. Especialista en React, Node.js y PostgreSQL. Apasionado por construir aplicaciones escalables con buenas prácticas de UX y código limpio.',
        fotoBase64: '',
        created_at: new Date(),
        updated_at: new Date()
      });

      const hash = CryptoJS.SHA256('dev123').toString(CryptoJS.enc.Hex);
      await dbOnline.add('usuarios', {
        email: cryptoHelpers.encrypt(email),
        email_hash: emailHash,
        nombre: 'Carlos Dev',
        password_hash: hash,
        rol: 'dev',
        perfilId: perfil.id,
        created_at: new Date(),
        updated_at: new Date()
      });

      const allSkills = await dbOnline.getAll('habilidades');
      const devSkills = ['JavaScript', 'TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Docker', 'Git', 'Python'];
      for (const name of devSkills) {
        const skill = allSkills.find(s => s.nombre.toLowerCase() === name.toLowerCase());
        if (skill) {
          await dbOnline.add('perfil_habilidades', { perfil_id: perfil.id, habilidad_id: skill.id });
        }
      }

      window.dispatchEvent(new CustomEvent('db-change'));
      console.log('✅ Dev demo creado: carlos@dev.com / dev123');
    } catch (e) { /* ignorar */ }
  }
};
