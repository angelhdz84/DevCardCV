// modules/auth/module.js — Autenticación offline con roles admin/dev
const Auth = {
  id: 'auth',
  titulo: 'Iniciar Sesión',

  async init() {
    console.log('💡 [auth] Inicializado');
  },

  async render(params = {}) {
    const view = params.params[0] || 'login';
    if (view === 'register') return this._renderRegister();
    return this._renderLogin();
  },

  _renderLogin() {
    return `
<div x-data="authLogin()" x-init="init()" class="h-screen overflow-hidden flex items-center justify-center">
  <div class="w-full max-w-sm stagger-enter" style="animation-delay: 0s;">
    <div class="text-center mb-8">
      <div class="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-4" style="background: var(--accent-light);">
        <i class="bi bi-shield-lock-fill text-2xl text-accent"></i>
      </div>
      <h1 class="text-lg font-semibold tracking-heading">DevCardCV</h1>
      <p class="text-xs mt-1 text-muted">Inicia sesión para continuar</p>
    </div>

    <div class="card bg-white radius-lg">
      <div class="card-body p-6">
        <form @submit.prevent="login()" class="space-y-4">
          <label class="form-control w-full">
            <span class="label-text font-medium text-xs uppercase tracking-wider mb-1.5 text-muted">Email</span>
            <input type="email" x-model="email" class="input input-bordered w-full radius-sm" placeholder="correo@ejemplo.com" required>
          </label>
          <label class="form-control w-full">
            <span class="label-text font-medium text-xs uppercase tracking-wider mb-1.5 text-muted">Contraseña</span>
            <input type="password" x-model="password" class="input input-bordered w-full radius-sm" placeholder="••••••••" required>
          </label>
          <button type="submit" class="btn btn-primary btn-magnetic w-full radius-md" :disabled="!email || !password">
            <i class="bi bi-box-arrow-in-right"></i> Iniciar Sesión
          </button>
          <p x-show="error" x-text="error" class="text-xs text-error text-center mt-2"></p>
        </form>
        <p class="text-xs text-center mt-4 text-muted">
          ¿No tienes cuenta?
          <a href="#/auth/register" class="text-accent font-medium hover:underline">Regístrate</a>
        </p>
      </div>
    </div>
  </div>
</div>
`;
  },

  _renderRegister() {
    return `
<div x-data="authRegister()" x-init="init()" class="h-screen overflow-hidden flex items-center justify-center">
  <div class="w-full max-w-sm stagger-enter" style="animation-delay: 0s;">
    <div class="text-center mb-8">
      <div class="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-4" style="background: var(--accent-light);">
        <i class="bi bi-person-plus-fill text-2xl text-accent"></i>
      </div>
      <h1 class="text-lg font-semibold tracking-heading">Crear cuenta</h1>
      <p class="text-xs mt-1 text-muted">Regístrate como desarrollador</p>
    </div>

    <div class="card bg-white radius-lg">
      <div class="card-body p-6">
        <form @submit.prevent="register()" class="space-y-4">
          <label class="form-control w-full">
            <span class="label-text font-medium text-xs uppercase tracking-wider mb-1.5 text-muted">Nombre completo</span>
            <input type="text" x-model="nombre" class="input input-bordered w-full radius-sm" placeholder="Ej: Ana García" required>
          </label>
          <label class="form-control w-full">
            <span class="label-text font-medium text-xs uppercase tracking-wider mb-1.5 text-muted">Email</span>
            <input type="email" x-model="email" class="input input-bordered w-full radius-sm" placeholder="correo@ejemplo.com" required>
          </label>
          <label class="form-control w-full">
            <span class="label-text font-medium text-xs uppercase tracking-wider mb-1.5 text-muted">Contraseña</span>
            <input type="password" x-model="password" class="input input-bordered w-full radius-sm" placeholder="Mínimo 6 caracteres" minlength="6" required>
          </label>
          <button type="submit" class="btn btn-primary btn-magnetic w-full radius-md" :disabled="!nombre || !email || !password">
            <i class="bi bi-person-plus-fill"></i> Crear cuenta
          </button>
          <p x-show="error" x-text="error" class="text-xs text-error text-center mt-2"></p>
        </form>
        <p class="text-xs text-center mt-4 text-muted">
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
      const users = await dbLocal.getWhere('usuarios', 'email_hash', emailHash);
      const user = users[0] || null;
      if (!user) { this.error = 'Credenciales incorrectas'; return; }
      const hash = CryptoJS.SHA256(this.password).toString(CryptoJS.enc.Hex);
      if (user.password_hash !== hash) { this.error = 'Credenciales incorrectas'; return; }
      const session = { userId: user.id, email: this.email, nombre: user.nombre, rol: user.rol, perfilId: user.perfilId, token: CryptoJS.SHA256(user.id + '|' + Date.now() + '|' + Math.random()).toString(CryptoJS.enc.Hex) };
      localStorage.setItem(APP_CONFIG.auth.sessionKey, JSON.stringify(session));
      Alpine.store('auth').setSession(session);
      if (user.perfilId) {
        const perfil = await dbLocal.get('perfiles', user.perfilId);
        Alpine.store('auth').setPerfil(perfil);
      }
      UI.toast('Bienvenido, ' + user.nombre, 'success');
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
      const existentes = await dbLocal.getWhere('usuarios', 'email_hash', emailHash);
      if (existentes.length > 0) { this.error = 'Ya existe un usuario con ese email'; return; }
      const hash = CryptoJS.SHA256(this.password).toString(CryptoJS.enc.Hex);
      const perfilCreado = await dbOnline.add('perfiles', {
        nombre: this.nombre, email: this.email, cargo: '', bio: '',
        fotoBase64: '', created_at: new Date(), updated_at: new Date()
      });
      const perfilId = perfilCreado.id;
      const userCreado = await dbOnline.add('usuarios', {
        email: this.email,
        email_hash: emailHash,
        nombre: this.nombre,
        password_hash: hash,
        rol: 'dev',
        perfilId: perfilId,
        created_at: new Date(),
        updated_at: new Date()
      });
      window.dispatchEvent(new CustomEvent('db-change'));
      const session = { userId: userCreado.id, email: this.email, nombre: this.nombre, rol: 'dev', perfilId: perfilId, token: CryptoJS.SHA256(userCreado.id + '|' + Date.now() + '|' + Math.random()).toString(CryptoJS.enc.Hex) };
      localStorage.setItem(APP_CONFIG.auth.sessionKey, JSON.stringify(session));
      Alpine.store('auth').setSession(session);
      const perfilNuevo = await dbLocal.get('perfiles', perfilId);
      Alpine.store('auth').setPerfil(perfilNuevo);
      UI.toast('Cuenta creada. Bienvenido, ' + this.nombre, 'success');
      window.location.hash = '#/perfiles';
    },
    init() { window.UI = UI; }
  };
}

window.MODULES = window.MODULES || {};
window.MODULES[Auth.id] = Auth;
appRouter.register(Auth);
