// main.js — Punto de entrada de la aplicación (deploy trigger)
document.addEventListener('DOMContentLoaded', async () => {
  console.log(`🚀 ${APP_CONFIG.app.nombre} v${APP_CONFIG.app.version}`);

  // 💡 Inicializar stores Alpine antes de cualquier operación
  if (!Alpine.store('network')) Alpine.store('network', { online: navigator.onLine });
  if (!Alpine.store('turso')) Alpine.store('turso', { status: 'disabled' });
  if (!Alpine.store('supabase')) Alpine.store('supabase', { status: 'disabled' });

  try {
    // 💡 Listeners de conexión
    window.addEventListener('online', () => {
      Alpine.store('network').online = true;
      window.dispatchEvent(new CustomEvent('connection-change', { detail: { online: true } }));
    });
    window.addEventListener('offline', () => {
      Alpine.store('network').online = false;
      window.dispatchEvent(new CustomEvent('connection-change', { detail: { online: false } }));
    });

    // 💡 Abrir base de datos
    await db.open();
    console.log('✅ IndexedDB abierta');

    // 💡 Inicializar SQLite (sql.js) como motor complementario
    await dbSQLite.init();
    console.log('✅ SQLite (sql.js) inicializado');

    // 💡 Inicializar Supabase sync
    await dbSupabase.init();
    console.log('✅ Supabase sync inicializado');

    // 💡 Pull inicial desde Supabase (si hay datos remotos)
    await dbSupabase.pull();

    // 💡 Auto-pull periódico (cada 30s)
    dbSupabase.startAutoPull();

    // 💡 Escuchar cambios: sync SQLite + push a Turso + refrescar módulo activo
    window.addEventListener('db-change', async () => {
      await dbSQLite.sync();
      dbSupabase.schedulePush();
      const modId = window._currentModule;
      if (modId && appRouter.modules[modId]) {
        const container = document.getElementById('app-content');
        if (!container) return;
        const mod = appRouter.modules[modId];
        const params = window._currentParams || [];
        try {
          await mod.init();
          container.style.opacity = '0';
          container.style.transform = 'translateY(8px)';
          container.innerHTML = await mod.render({ params });
          requestAnimationFrame(() => {
            container.style.opacity = '1';
            container.style.transform = 'translateY(0)';
          });
        } catch (e) {
          console.error('Error refrescando módulo:', e);
        }
      }
    });

    // 💡 Escuchar cierre de sesión
    window.addEventListener('auth-logout', () => {
      Alpine.store('auth').clearSession();
      appRouter.currentRoute = '';
      UI.toast('Sesión cerrada', 'info');
      window.location.hash = '#/auth/login';
    });

    // 💡 Auto-crear admin desde project.config.js si no existe en DB
    await appRouter._bootstrapAdmin();

    // 💡 Cargar datos de ejemplo si es primera vez
    await seedInitialData();

    // 💡 Inicializar store de auth antes de restaurar sesión
    appRouter._initAuthStore();

    // 💡 Restaurar sesión y marcar auth como checked
    await appRouter.checkSession();

    // 💡 Push inicial si hay datos locales no subidos nunca
    if (dbSupabase._connected) {
      const hasLocalData = await db.perfiles.count() > 0 || await db.usuarios.count() > 0;
      if (hasLocalData) {
        console.log('📤 Push inicial automático...');
        await dbSupabase.push();
      }
    }

    // 💡 Inicializar router
    appRouter.init();

    console.log('✅ App inicializada correctamente');
  } catch (err) {
    console.error('❌ Error iniciando app:', err);
    document.getElementById('app-content').innerHTML = `
      <div class="alert alert-error">
        <i class="bi bi-exclamation-triangle"></i>
        <div>Error al inicializar: ${err.message}</div>
      </div>
    `;
  }
});
