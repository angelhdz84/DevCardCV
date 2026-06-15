// main.js — Punto de entrada de la aplicación (deploy trigger)
document.addEventListener('DOMContentLoaded', async () => {
  console.log(`🚀 ${APP_CONFIG.app.nombre} v${APP_CONFIG.app.version}`);

  // 💡 Inicializar stores Alpine antes de cualquier operación
  if (!Alpine.store('network')) Alpine.store('network', { online: navigator.onLine });
  if (!Alpine.store('supabase')) Alpine.store('supabase', { status: 'disconnected' });
  if (!Alpine.store('loading')) Alpine.store('loading', { phase: 'Iniciando...', visible: true });

  function setPhase(msg) {
    Alpine.store('loading').phase = msg;
  }

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
    setPhase('Abriendo base de datos...');
    await db.open();
    console.log('✅ IndexedDB abierta');

    // 💡 Inicializar dbOnline (conecta a Supabase + inicia Realtime)
    setPhase('Conectando a la nube...');
    await dbOnline.init();
    console.log('✅ dbOnline inicializado');

    // 💡 Inicializar store de auth antes de restaurar sesión
    setPhase('Preparando sesión...');
    appRouter._initAuthStore();

    // 💡 Restaurar sesión desde caché local (sin esperar red)
    await appRouter.checkSession();

    // 💡 Router — mostrar UI inmediatamente con datos cacheados
    setPhase('Iniciando aplicación...');
    appRouter.init();

    // 💡 Bootstrap + refresh en background (no bloquean la UI)
    Promise.all([
      appRouter._bootstrapAdmin(),
      seedInitialData(),
      dbOnline.refreshCache()
    ]).then(() => {
      Alpine.store('loading').visible = false;
      window.dispatchEvent(new CustomEvent('db-change'));
      console.log('✅ Sync en segundo plano completada');
    }).catch(err => {
      console.warn('⚠️ Sync en segundo plano:', err.message);
      Alpine.store('loading').visible = false;
    });

    console.log('✅ App inicializada correctamente');
  } catch (err) {
    console.error('❌ Error iniciando app:', err);
    document.getElementById('app-content').innerHTML = `
      <div class="alert alert-error">
        <i class="bi bi-exclamation-triangle"></i>
        <div>Error al inicializar: ${err.message}</div>
      </div>
    `;
    Alpine.store('loading').visible = false;
  }
});
