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

    // 💡 Fase 1: Abrir la base de datos (SQLite en offline / IndexedDB en online)
    setPhase('Abriendo base de datos...', 20);
    await db.open();
    console.log('✅ Base de datos abierta (modo: ' + (window.DB_OFFLINE_SQLITE ? 'SQLite local' : 'Dexie + Supabase') + ')');

    // 💡 Fase 2: Motor de datos
    setPhase(window.DB_OFFLINE_SQLITE ? 'Cargando SQLite local...' : 'Conectando a la nube...', 40);
    if (window.DB_OFFLINE_SQLITE && window.sqliteOffline) {
      // 💡 Modo offline: SQLite local es la fuente de verdad (debe estar listo antes del router)
      await window.sqliteOffline.init();
      dbOnline.init().catch(() => {});
    } else {
      // 💡 Modo online: Supabase en background (NO bloquea — conecta + Realtime)
      dbOnline.init().then(() => {
        console.log('✅ dbOnline inicializado (background)');
      }).catch(err => {
        console.warn('⚠️ dbOnline init:', err.message);
      });
    }

    // 💡 Fase 3: Sesión monousuario automática (sin pantalla de login)
    setPhase('Preparando sesión...', 60);
    appRouter._initAuthStore();
    await appRouter.checkSession();

    // 💡 Fase 4: Router — mostrar UI INMEDIATAMENTE
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
