// modules/auth/module.js — Autenticación offline con roles admin/dev
const Auth = {
  id: 'auth',
  titulo: 'Iniciar Sesión',

  async init() {
    console.log('💡 [auth] Inicializado');
  },

  async render(params = {}) {
    const view = params.params[0] || 'login';
    const userCount = await db.usuarios.count();

    if (userCount === 0 && view !== 'setup') {
      window.location.hash = '#/auth/setup';
      return '';
    }
    if (view === 'setup') return this._renderSetup();
    if (view === 'register') return this._renderRegister();
    return this._renderLogin();
  },

  _renderLogin() {
    return `
<div x-data="authLogin()" x-init="init()" class="min-h-[70vh] flex items-center justify-center">
  <div class="w-full max-w-sm stagger-enter" style="animation-delay: 0s;">
    <div class="text-center mb-8">
      <div class="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-4" style="background: var(--accent-light);">
        <i class="bi bi-shield-lock-fill text-2xl text-accent"></i>
      </div>
      <h2 class="text-lg font-semibold tracking-heading">DevCardCV</h2>
      <p class="text-xs mt-1" style="color: var(--ink-muted);">Inicia sesión para continuar</p>
    </div>

    <div class="card bg-white" style="border-radius: 12px;">
      <div class="card-body p-6">
        <form @submit.prevent="login()" class="space-y-4">
          <label class="form-control w-full">
            <span class="label-text font-medium text-xs uppercase tracking-wider mb-1.5" style="color: var(--ink-muted);">Email</span>
            <input type="email" x-model="email" class="input input-bordered w-full" placeholder="correo@ejemplo.com" style="border-radius: 6px;" required>
          </label>
          <label class="form-control w-full">
            <span class="label-text font-medium text-xs uppercase tracking-wider mb-1.5" style="color: var(--ink-muted);">Contraseña</span>
            <input type="password" x-model="password" class="input input-bordered w-full" placeholder="••••••••" style="border-radius: 6px;" required>
          </label>
          <button type="submit" class="btn btn-primary w-full" style="border-radius: 8px;" :disabled="!email || !password">
            <i class="bi bi-box-arrow-in-right"></i> Iniciar Sesión
          </button>
          <p x-show="error" x-text="error" class="text-xs text-error text-center mt-2"></p>
        </form>
        <p class="text-xs text-center mt-4" style="color: var(--ink-muted);">
          ¿No tienes cuenta?
          <a href="#/auth/register" class="text-accent font-medium hover:underline">Regístrate</a>
        </p>
      </div>
    </div>
  </div>
</div>
`;
  },

  _renderSetup() {
    return `
<div x-data="authSetup()" x-init="init()" class="min-h-[70vh] flex items-center justify-center">
  <div class="w-full max-w-sm stagger-enter" style="animation-delay: 0s;">
    <div class="text-center mb-8">
      <div class="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-4" style="background: var(--accent-light);">
        <i class="bi bi-gear-fill text-2xl text-accent"></i>
      </div>
      <h2 class="text-lg font-semibold tracking-heading">Configuración Inicial</h2>
      <p class="text-xs mt-1" style="color: var(--ink-muted);">Crea el primer usuario administrador</p>
    </div>

    <div class="card bg-white" style="border-radius: 12px;">
      <div class="card-body p-6">
        <form @submit.prevent="setup()" class="space-y-4">
          <label class="form-control w-full">
            <span class="label-text font-medium text-xs uppercase tracking-wider mb-1.5" style="color: var(--ink-muted);">Clave maestra</span>
            <input type="password" x-model="masterKey" class="input input-bordered w-full" placeholder="Ingresa la clave de configuración" style="border-radius: 6px;" required>
          </label>
          <hr style="border-color: var(--border);">
          <label class="form-control w-full">
            <span class="label-text font-medium text-xs uppercase tracking-wider mb-1.5" style="color: var(--ink-muted);">Nombre del admin</span>
            <input type="text" x-model="nombre" class="input input-bordered w-full" placeholder="Ej: Admin" style="border-radius: 6px;" required>
          </label>
          <label class="form-control w-full">
            <span class="label-text font-medium text-xs uppercase tracking-wider mb-1.5" style="color: var(--ink-muted);">Email</span>
            <input type="email" x-model="email" class="input input-bordered w-full" placeholder="admin@ejemplo.com" style="border-radius: 6px;" required>
          </label>
          <label class="form-control w-full">
            <span class="label-text font-medium text-xs uppercase tracking-wider mb-1.5" style="color: var(--ink-muted);">Contraseña</span>
            <input type="password" x-model="password" class="input input-bordered w-full" placeholder="Mínimo 6 caracteres" style="border-radius: 6px;" minlength="6" required>
          </label>
          <button type="submit" class="btn btn-primary w-full" style="border-radius: 8px;" :disabled="!masterKey || !nombre || !email || !password">
            <i class="bi bi-check-lg"></i> Crear Administrador
          </button>
          <p x-show="error" x-text="error" class="text-xs text-error text-center mt-2"></p>
        </form>
      </div>
    </div>
  </div>
</div>
`;
  },

  _renderRegister() {
    return `
<div x-data="authRegister()" x-init="init()" class="min-h-[70vh] flex items-center justify-center">
  <div class="w-full max-w-sm stagger-enter" style="animation-delay: 0s;">
    <div class="text-center mb-8">
      <div class="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-4" style="background: var(--accent-light);">
        <i class="bi bi-person-plus-fill text-2xl text-accent"></i>
      </div>
      <h2 class="text-lg font-semibold tracking-heading">Crear cuenta</h2>
      <p class="text-xs mt-1" style="color: var(--ink-muted);">Regístrate como desarrollador</p>
    </div>

    <div class="card bg-white" style="border-radius: 12px;">
      <div class="card-body p-6">
        <form @submit.prevent="register()" class="space-y-4">
          <label class="form-control w-full">
            <span class="label-text font-medium text-xs uppercase tracking-wider mb-1.5" style="color: var(--ink-muted);">Nombre completo</span>
            <input type="text" x-model="nombre" class="input input-bordered w-full" placeholder="Ej: Ana García" style="border-radius: 6px;" required>
          </label>
          <label class="form-control w-full">
            <span class="label-text font-medium text-xs uppercase tracking-wider mb-1.5" style="color: var(--ink-muted);">Email</span>
            <input type="email" x-model="email" class="input input-bordered w-full" placeholder="correo@ejemplo.com" style="border-radius: 6px;" required>
          </label>
          <label class="form-control w-full">
            <span class="label-text font-medium text-xs uppercase tracking-wider mb-1.5" style="color: var(--ink-muted);">Contraseña</span>
            <input type="password" x-model="password" class="input input-bordered w-full" placeholder="Mínimo 6 caracteres" style="border-radius: 6px;" minlength="6" required>
          </label>
          <button type="submit" class="btn btn-primary w-full" style="border-radius: 8px;" :disabled="!nombre || !email || !password">
            <i class="bi bi-person-plus-fill"></i> Crear cuenta
          </button>
          <p x-show="error" x-text="error" class="text-xs text-error text-center mt-2"></p>
        </form>
        <p class="text-xs text-center mt-4" style="color: var(--ink-muted);">
          ¿Ya tienes cuenta?
          <a href="#/auth/login" class="text-accent font-medium hover:underline">Inicia sesión</a>
        </p>
      </div>
    </div>
  </div>
</div>
`;
  },

  destroy() {
    console.log('💡 [auth] Destruído');
  }
};

// 💡 Alpine stores
function authLogin() {
  return {
    email: '',
    password: '',
    error: '',
    async login() {
      this.error = '';
      const emailHash = CryptoJS.SHA256(this.email.toLowerCase().trim()).toString(CryptoJS.enc.Hex);
      const user = await db.usuarios.where('email_hash').equals(emailHash).first();
      if (!user) { this.error = 'Credenciales incorrectas'; return; }
      const hash = CryptoJS.SHA256(this.password).toString(CryptoJS.enc.Hex);
      if (user.password_hash !== hash) { this.error = 'Credenciales incorrectas'; return; }
      const session = { userId: user.id, email: this.email, nombre: user.nombre, rol: user.rol, perfilId: user.perfilId, token: CryptoJS.SHA256(user.id + '|' + Date.now() + '|' + Math.random()).toString(CryptoJS.enc.Hex) };
      localStorage.setItem(APP_CONFIG.auth.sessionKey, JSON.stringify(session));
      Alpine.store('auth').setSession(session);
      if (user.perfilId) {
        const perfil = await db.perfiles.get(user.perfilId);
        if (perfil && perfil.fotoBase64) {
          Alpine.store('auth').user.fotoBase64 = perfil.fotoBase64;
        }
      }
      UI.toast('Bienvenido, ' + user.nombre, 'success');
      window.location.hash = '#/dashboard';
    },
    init() { window.UI = UI; }
  };
}

function authSetup() {
  return {
    masterKey: '',
    nombre: '',
    email: '',
    password: '',
    error: '',
    async setup() {
      this.error = '';
      if (this.masterKey !== APP_CONFIG.auth.masterKey) { this.error = 'Clave maestra incorrecta'; return; }
      const emailHash = CryptoJS.SHA256(this.email.toLowerCase().trim()).toString(CryptoJS.enc.Hex);
      const existente = await db.usuarios.where('email_hash').equals(emailHash).first();
      if (existente) { this.error = 'Ya existe un usuario con ese email'; return; }
      const hash = CryptoJS.SHA256(this.password).toString(CryptoJS.enc.Hex);
      const id = await db.usuarios.add({
        email: cryptoHelpers.encrypt(this.email),
        email_hash: emailHash,
        nombre: this.nombre,
        password_hash: hash,
        rol: 'admin',
        perfilId: null,
        created_at: new Date(),
        updated_at: new Date()
      });
      window.dispatchEvent(new CustomEvent('db-change'));
      const session = { userId: id, email: this.email, nombre: this.nombre, rol: 'admin', perfilId: null, token: CryptoJS.SHA256(id + '|' + Date.now() + '|' + Math.random()).toString(CryptoJS.enc.Hex) };
      localStorage.setItem(APP_CONFIG.auth.sessionKey, JSON.stringify(session));
      Alpine.store('auth').setSession(session);
      UI.toast('Admin creado correctamente', 'success');
      window.location.hash = '#/dashboard';
    },
    init() { window.UI = UI; }
  };
}

function authRegister() {
  return {
    nombre: '',
    email: '',
    password: '',
    error: '',
    async register() {
      this.error = '';
      const emailHash = CryptoJS.SHA256(this.email.toLowerCase().trim()).toString(CryptoJS.enc.Hex);
      const existente = await db.usuarios.where('email_hash').equals(emailHash).first();
      if (existente) { this.error = 'Ya existe un usuario con ese email'; return; }
      const hash = CryptoJS.SHA256(this.password).toString(CryptoJS.enc.Hex);
      const perfilId = await db.perfiles.add({
        nombre: this.nombre, email: cryptoHelpers.encrypt(this.email), cargo: '', bio: '',
        fotoBase64: '', created_at: new Date(), updated_at: new Date()
      });
      const id = await db.usuarios.add({
        email: cryptoHelpers.encrypt(this.email),
        email_hash: emailHash,
        nombre: this.nombre,
        password_hash: hash,
        rol: 'dev',
        perfilId: perfilId,
        created_at: new Date(),
        updated_at: new Date()
      });
      window.dispatchEvent(new CustomEvent('db-change'));
      const session = { userId: id, email: this.email, nombre: this.nombre, rol: 'dev', perfilId: perfilId, token: CryptoJS.SHA256(id + '|' + Date.now() + '|' + Math.random()).toString(CryptoJS.enc.Hex) };
      localStorage.setItem(APP_CONFIG.auth.sessionKey, JSON.stringify(session));
      Alpine.store('auth').setSession(session);
      UI.toast('Cuenta creada. Bienvenido, ' + this.nombre, 'success');
      window.location.hash = '#/perfiles';
    },
    init() { window.UI = UI; }
  };
}

window.MODULES = window.MODULES || {};
window.MODULES[Auth.id] = Auth;
appRouter.register(Auth);
