// main.js — Punto de entrada de la aplicación (deploy trigger)
document.addEventListener('DOMContentLoaded', async () => {
  console.log(`🚀 ${APP_CONFIG.app.nombre} v${APP_CONFIG.app.version}`);

  // 💡 Inicializar stores Alpine antes de cualquier operación
  if (!Alpine.store('network')) Alpine.store('network', { online: navigator.onLine });
  if (!Alpine.store('supabase')) Alpine.store('supabase', { status: 'disconnected' });
  if (!Alpine.store('loading')) Alpine.store('loading', { phase: 'Iniciando...', visible: true, progress: 0 });

  function setPhase(msg, pct) {
    Alpine.store('loading').phase = msg;
    if (pct !== undefined) Alpine.store('loading').progress = pct;
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

    // 💡 Fase 1: Abrir IndexedDB (rápido, local)
    setPhase('Abriendo base de datos...', 20);
    await db.open();
    console.log('✅ IndexedDB abierta');

    // 💡 Fase 2: dbOnline en background (NO bloquea — conecta a Supabase + Realtime)
    setPhase('Conectando a la nube...', 40);
    dbOnline.init().then(() => {
      console.log('✅ dbOnline inicializado (background)');
    }).catch(err => {
      console.warn('⚠️ dbOnline init:', err.message);
    });

    // 💡 Fase 3: Sesión + Admin en paralelo (ambos usan IndexedDB, rápidos)
    setPhase('Preparando sesión...', 60);
    appRouter._initAuthStore();
    await appRouter.checkSession();

    // 💡 Bootstrap admin en background — no bloquea la UI
    // El admin ya existe en Supabase; refreshCache() lo trae a IndexedDB
    appRouter._bootstrapAdmin().catch(() => {});

    // 💡 Fase 4: Router — mostrar UI INMEDIATAMENTE con datos cacheados
    setPhase('Iniciando aplicación...', 80);
    appRouter.init();

    // 💡 OCULTAR LOADING instantáneamente — la UI ya tiene datos de IndexedDB
    Alpine.store('loading').visible = false;
    Alpine.store('loading').progress = 100;

    // 💡 Seed + refresh en background (actualizan caché, UI se refresca con db-change)
    Promise.all([
      seedInitialData(),
      dbOnline.refreshCache()
    ]).then(() => {
      window.dispatchEvent(new CustomEvent('db-change'));
      console.log('✅ Sync en segundo plano completada');
    }).catch(err => {
      console.warn('⚠️ Sync en segundo plano:', err.message);
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
