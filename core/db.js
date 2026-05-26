// core/db.js — Configuración de IndexedDB con Dexie + SQLite cache
const db = new Dexie(APP_CONFIG.db.nombre);

// v5: email_hash para búsqueda determinista de usuarios
db.version(5).stores({
  perfiles: '++id, nombre, email, cargo, created_at',
  habilidades: '++id, nombre, categoria, created_at',
  perfil_habilidades: '++id, perfil_id, habilidad_id',
  _sqlite_cache: 'key',
  usuarios: '++id, email, email_hash, rol, created_at'
}).upgrade(tx => {
  return tx.usuarios.toCollection().modify(u => {
    const email = cryptoHelpers.decrypt(u.email) || '';
    u.email_hash = email ? CryptoJS.SHA256(email.toLowerCase().trim()).toString(CryptoJS.enc.Hex) : '';
  });
});

db.version(4).stores({
  perfiles: '++id, nombre, email, cargo, created_at',
  habilidades: '++id, nombre, categoria, created_at',
  perfil_habilidades: '++id, perfil_id, habilidad_id',
  _sqlite_cache: 'key',
  usuarios: '++id, email, rol, created_at'
});

db.version(3).stores({
  perfiles: '++id, nombre, email, cargo, created_at',
  habilidades: '++id, nombre, categoria, created_at',
  perfil_habilidades: '++id, perfil_id, habilidad_id',
  _sqlite_cache: 'key'
});

db.version(2).stores({
  perfiles: '++id, nombre, email, cargo, created_at',
  habilidades: '++id, nombre, categoria, created_at',
  perfil_habilidades: '++id, perfil_id, habilidad_id'
}).upgrade(tx => {
  return Promise.all([tx.perfiles.clear(), tx.habilidades.clear(), tx.perfil_habilidades.clear()]);
});

// 💡 Datos de ejemplo al iniciar por primera vez
async function seedInitialData() {
  const count = await db.perfiles.count();
  if (count > 0) return; // Ya hay perfiles

  // Skills seed solo si no hay (fallback offline)
  const habCount = await db.habilidades.count();
  if (habCount === 0) {
    const categorias = [
      { nombre: 'Lenguajes', skills: ['JavaScript', 'TypeScript', 'Python', 'Java', 'C#', 'Go', 'Rust'] },
      { nombre: 'Frameworks', skills: ['React', 'Vue.js', 'Angular', 'Node.js', 'Django', 'Spring Boot', '.NET'] },
      { nombre: 'Bases de Datos', skills: ['PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'SQLite'] },
      { nombre: 'Herramientas', skills: ['Git', 'Docker', 'AWS', 'Linux', 'CI/CD', 'Figma'] }
    ];
    for (const cat of categorias) {
      for (const skill of cat.skills) {
        await db.habilidades.add({ nombre: skill, categoria: cat.nombre, created_at: new Date() });
      }
    }
  }

  // Perfiles de ejemplo
  const ejemplos = [
    { nombre: 'Ana García', email: cryptoHelpers.encrypt('ana.garcia@dev.com'), cargo: 'Frontend Senior', bio: 'Especialista en React y Vue.js con 6 años de experiencia.', fotoBase64: '', created_at: new Date(), updated_at: new Date() },
    { nombre: 'Carlos López', email: cryptoHelpers.encrypt('carlos.lopez@dev.com'), cargo: 'Backend Developer', bio: 'Experto en Node.js, Python y arquitecturas de microservicios.', fotoBase64: '', created_at: new Date(), updated_at: new Date() },
    { nombre: 'María Torres', email: cryptoHelpers.encrypt('maria.torres@dev.com'), cargo: 'Full Stack', bio: 'Desarrolladora versátil con experiencia en React, Node.js y AWS.', fotoBase64: '', created_at: new Date(), updated_at: new Date() }
  ];

  for (const perfil of ejemplos) {
    const id = await db.perfiles.add(perfil);
    const allSkills = await db.habilidades.toArray();
    const shuffled = allSkills.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, Math.floor(Math.random() * 4) + 3);
    for (const skill of selected) {
      await db.perfil_habilidades.add({ perfil_id: id, habilidad_id: skill.id });
    }
  }

  console.log('💡 Datos de ejemplo cargados');
}

window.db = db;
