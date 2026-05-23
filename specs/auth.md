# 📄 Especificación Técnica: Autenticación y Roles

## 🎯 Descripción
Sistema de autenticación offline-first con roles (admin/dev) para proteger el acceso a DevCardCV. El admin tiene acceso completo a todos los módulos; los devs pueden gestionar su propio perfil y leer CVs de otros. Los datos de usuarios se almacenan tanto en IndexedDB (Dexie) como en SQLite (sql.js) para exportación completa del sistema.

## ✅ Criterios de Aceptación (Gherkin)

```
Feature: Setup inicial
  Scenario: Primera ejecución sin usuarios
    Given la app se abre por primera vez
    When no hay usuarios registrados
    Then se muestra pantalla de configuración inicial
    And se pide la clave maestra de project.config.js
    And tras validar, se crea el usuario admin

Feature: Login
  Scenario: Usuario existente inicia sesión
    Given hay usuarios registrados
    When el usuario ingresa email y contraseña válidos
    Then se crea sesión persistente en localStorage
    And se redirige al dashboard

Feature: Roles y permisos
  Scenario: Admin edita cualquier perfil
    Given un usuario con rol admin
    When accede al módulo perfiles
    Then puede editar y eliminar cualquier perfil
    And puede gestionar habilidades
    And puede exportar/importar backups

  Scenario: Dev edita su propio perfil
    Given un usuario con rol dev
    When accede al módulo perfiles
    Then puede editar su propio perfil (vinculado por perfilId)
    And NO puede editar ni eliminar otros perfiles
    And NO puede gestionar habilidades
    And NO puede acceder a backup

Feature: Registro de devs
  Scenario: Nuevo dev se registra
    When un usuario completa el formulario de registro
    Then se crea su cuenta con rol dev
    And se crea un perfil de desarrollador vacío vinculado
    And se inicia sesión automáticamente
```

## 🧱 Arquitectura y Módulos

### Módulo auth (`modules/auth/module.js`)
- `#/login` — Pantalla de inicio de sesión (email + contraseña)
- `#/setup` — Pantalla de configuración inicial (solo si no hay usuarios)
- `#/register` — Pantalla de auto-registro para nuevos devs
- Maneja creación de sesión, cierre de sesión y verificación de token

### Alpine Store (`Alpine.store('auth')`)
```javascript
Alpine.store('auth', {
  user: null,           // { id, email, nombre, rol, perfilId }
  sessionToken: null,
  get isLoggedIn()      // boolean
  get isAdmin()         // boolean
  canEdit(perfilId)     // true si admin o perfil propio
  canManageSkills()     // true solo admin
  canBackup()           // true solo admin
})
```

### Route guard (`core/app.js`)
- Antes de cargar cualquier módulo, verifica `auth.isLoggedIn`
- Si no hay sesión activa, redirige a `#/login`
- Si no hay usuarios registrados, redirige a `#/setup`
- Las rutas `#/login`, `#/setup`, `#/register` son públicas

### Base de datos
**Dexie v4** — nueva tabla:
```
usuarios: '++id, email, rol, created_at'
```
Campos: `id, email, nombre, password_hash, rol, perfilId, created_at, updated_at`

**SQLite** — nueva tabla espejo:
```sql
CREATE TABLE usuarios (
  id INTEGER PRIMARY KEY,
  email TEXT, nombre TEXT, password_hash TEXT,
  rol TEXT DEFAULT 'dev', perfilId INTEGER,
  created_at TEXT, updated_at TEXT
)
```

### Flujo de sesión
1. Login → hash contraseña → buscar en tabla usuarios → generar sessionToken
2. SessionToken = SHA256(userId + timestamp + random)
3. Guardar en localStorage: `{ userId, email, nombre, rol, perfilId, token }`
4. Al cargar app: leer localStorage, verificar que userId existe en DB
5. Cerrar sesión: borrar localStorage, redirigir a `#/login`

## 🔐 Seguridad y Datos
- Contraseñas hasheadas con CryptoJS SHA256 (nunca en texto plano)
- Master key en `project.config.js` para bootstrap del admin (configurable por usuario)
- Email del usuario cifrado con CryptoJS AES (igual que en perfiles)
- Sesión en localStorage sin expiración automática
- El admin puede resetear contraseñas de devs desde el panel

## 🎨 UI/UX y Animaciones
- Pantalla de login: formulario centrado, tarjeta blanca sobre fondo canvas, logo + título
- Pantalla setup: similar pero con campo de master key
- Botón "Cerrar sesión" en navbar (solo visible si logueado)
- Registro: enlace "¿No tienes cuenta? Regístrate" en login
- Toast de error si credenciales incorrectas
- FadeIn en transiciones de auth (reutilizando clase `stagger-enter`)

## 📚 Librerías Adicionales
Ninguna. CryptoJS SHA256 ya disponible en el stack base.

## ⚙️ Configuración (project.config.js)

```diff
+ auth: {
+   masterKey: 'DevCardCV2024',
+   sessionKey: '_auth_session'
+ }
```

## 📦 Pre-requisitos y Checklist
- [ ] `core/db.js` actualizado a v4 con tabla `usuarios` + seed admin inicial
- [ ] `core/db-sqlite.js` actualizado con tabla `usuarios` + sync
- [ ] `project.config.js` con sección `auth`
- [ ] `modules/auth/module.js` creado con login/setup/register/logout
- [ ] `core/app.js` con route guard + auth store init
- [ ] `index.html` con script auth + navbar logout
- [ ] `modules/perfiles/module.js` con permisos editar/eliminar
- [ ] `modules/habilidades/module.js` con permisos admin-only
- [ ] `modules/dashboard/module.js` con permisos admin-only en backup
- [ ] `main.js` con checkSession inicial
- [ ] Backup/restore JSON incluye tabla usuarios
- [ ] Export .sqlite incluye tabla usuarios
