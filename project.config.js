// project.config.js — DevCardCV v1.0
// Configuración white-label para stack offline-first
const APP_CONFIG = {
  app: {
    nombre: 'DevCardCV',
    version: '1.0.0',
    descripcion: 'Fichas técnicas de desarrolladores — offline-first',
    autor: ''
  },

  modulosActivos: [
    'auth',
    'dashboard',
    'perfiles',
    'habilidades',
    'cv',
    'proyectos'
  ],

  tema: {
    colores: {
      primario: '#0f172a',
      secundario: '#334155',
      acento: '#15803d',
      fondo: '#f8fafc',
      superficie: '#ffffff',
      texto: '#0f172a',
      exito: '#22C55E',
      error: '#EF4444'
    },
    tono: 'profesional',
    animaciones: true
  },

  db: {
    nombre: 'DevCardCVDB',
    version: 1,
    sqliteCacheKey: '_sqlite_db',
    tablas: {
      perfiles: '++id, nombre, email, cargo, created_at',
      habilidades: '++id, nombre, categoria',
      perfil_habilidades: '++id, perfil_id, habilidad_id',
      categorias: '++id, nombre, created_at'
    }
  },

  crypto: {
    camposSensibles: [],
    storageKey: 'devcardcv_key'
  },

  exportar: {
    pdfNombre: 'CV_{nombre}_{fecha}.pdf',
    incluirFoto: true
  },

  email: {
    libreria: 'emailjs',
    publicKey: '2JSK5jc3nWZWEw3OU',
    serviceId: 'service_4q9ftyf',
    templateId: 'template_uykn9xe',
    desde: ''
  },

  auth: {
    masterKey: 'DevCardCV2024',
    sessionKey: '_auth_session',
    admin: {
      email: 'admin@devcardcv.com',
      password: 'ArKangel*GDAIS*',
      nombre: 'ArKangel'
    }
  },

  supabase: {
    url: 'https://uwvjqjeijvjxuhrhvqfr.supabase.co',
    anonKey: 'sb_publishable_iJHaIMk8_2lny37WFLAYqw_HKoNKq7T'
  },

  cloud: {
    syncUrl: 'https://fragrant-mountain-65df.84angel-hdz.workers.dev',
    autoSync: true
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = APP_CONFIG;
}


