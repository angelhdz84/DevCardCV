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
    'cv'
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
      perfil_habilidades: '++id, perfil_id, habilidad_id'
    }
  },

  crypto: {
    camposSensibles: ['email', 'telefono', 'direccion'],
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
      password: 'admin123',
      nombre: 'Admin Root'
    }
  },

  turso: {
    url: 'libsql://devcardcv-gd4is.turso.io',
    token: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NDc5NzU0NDcsImlkIjoiMmQ2YjAxN2ItNzYyYy00OGI5LWIzNjgtM2FhYjQ1ODg2NDZiIn0.7rm_avPJIo0eqgYXk3J30gq1B8J47VFRF4akDJL38Lq9NFG6M6K5O1bHHhfm_8COlyKjBS5LhGrzMx5pCWn3Dg',
    autoSync: true
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = APP_CONFIG;
}


