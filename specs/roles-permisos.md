# 📄 Especificación Técnica: Roles y Permisos Extendidos

## 🎯 Descripción
Extensión del sistema de roles existente para permitir que desarrolladores con rol `dev` puedan crear habilidades y gestionar su propio perfil, y que el administrador pueda promocionar/demover usuarios entre los roles `dev` y `admin` desde el panel de equipo.

## ✅ Criterios de Aceptación (Gherkin)

```
Feature: Dev gestiona habilidades
  Scenario: Dev crea una nueva habilidad
    Given un usuario con rol dev autenticado
    When accede al módulo Habilidades
    Then puede crear, editar y eliminar habilidades del catálogo
    And las habilidades creadas quedan disponibles para todos los perfiles

Feature: Dev crea su perfil vía registro
  Scenario: Dev se registra y obtiene perfil automático
    Given un usuario nuevo completa el registro
    When se crea su cuenta con rol dev
    Then se crea automáticamente un perfil en perfiles con su nombre y email
    And el perfil queda vinculado por perfilId
    And el dev puede completar su perfil (cargo, bio, foto) después

  Scenario: Dev edita su perfil
    Given un dev autenticado con perfil vinculado
    When accede al módulo Perfiles
    Then puede editar todos los campos de su propio perfil
    And NO puede editar ni eliminar perfiles de otros usuarios

Feature: Admin gestiona roles
  Scenario: Admin promueve un dev a admin
    Given un usuario administrador en el Dashboard
    When hace clic en el toggle de rol de un dev en la tabla Equipo
    Then se muestra confirmación del cambio
    And tras confirmar, el usuario cambia a rol admin
    And sus permisos se actualizan sin necesidad de relogin

  Scenario: Admin degrada un admin a dev
    Given existe al menos otro admin en el sistema
    When el admin hace clic en el toggle de rol de otro admin
    Then se muestra confirmación advirtiendo del cambio
    And tras confirmar, el usuario cambia a rol dev

  Scenario: Bloquear degradación del último admin
    Given solo existe un admin en el sistema
    When ese admin intenta degradarse a sí mismo o a otro admin (que es el único)
    Then el toggle muestra un tooltip "Debe haber al menos un admin"
    And la acción se bloquea

Feature: Permisos de admin no cambian
  Scenario: Admin mantiene acceso completo
    Given un usuario con rol admin
    Then puede editar cualquier perfil, gestionar habilidades, backups y exports
    And puede ver Reporte SQL
```

## 🧱 Arquitectura y Módulos

### Cambios en `Alpine.store('auth')`

```javascript
// Cambios en getters existentes:
canManageSkills() { return !!this.user; }              // ANTES: solo admin
canBackup() { return this.user?.rol === 'admin'; }     // SIN CAMBIOS
canEdit(pid) {                                         // SIN CAMBIOS
  return this.user ? this.user.rol === 'admin' || this.user.perfilId === pid : false;
}
```

### Cambios en `modules/dashboard/module.js`

- Agregar columna "Rol" en la tabla Equipo con toggle/badge
- El toggle solo visible si `$store.auth.isAdmin`
- Al hacer clic: confirmación (SweetAlert nativo) → llamar a función de cambio de rol
- Bloquear si es el último admin

### Nuevas funciones en `modules/auth/module.js`

```javascript
cambiarRol(userId, nuevoRol) {
  // 1. Verificar que no sea el último admin si se degrada
  // 2. Actualizar en Dexie: db.usuarios.update(userId, { rol: nuevoRol })
  // 3. Si el usuario actual es el que cambia de rol, actualizar store
  // 4. Sincronizar a Supabase si aplica
}
```

### Protección último admin

```javascript
esUltimoAdmin() {
  // Contar admins en db.usuarios
  // Si count === 1 y se intenta degradar → bloquear
}
```

### Auto-creación de perfil al registrarse

Ya definido en `specs/auth.md`. Verificar que al crear un usuario con `rol: 'dev'`, se ejecute:
```javascript
const perfilId = await db.perfiles.add({
  nombre: userData.nombre,
  email: cryptoHelpers.encrypt(userData.email),
  cargo: '',
  bio: '',
  fotoBase64: '',
  created_at: new Date(),
  updated_at: new Date()
});
await db.usuarios.update(newUserId, { perfilId });
```

### Rutas afectadas

| Módulo | Archivo | Cambio |
|--------|---------|--------|
| Auth | `modules/auth/module.js` | Nueva función `cambiarRol()`, `esUltimoAdmin()` |
| Dashboard | `modules/dashboard/module.js` | Columna Rol + toggle en tabla Equipo |
| Habilidades | `modules/habilidades/module.js` | Eliminar guard `canManageSkills` de admin-only |
| Auth store | `core/app.js` o `index.html` | Actualizar getter `canManageSkills()` |
| Perfiles | `modules/perfiles/module.js` | Eliminar guard no-admin en creación (pero mantener en edición de otros) |

### Base de datos

Sin cambios en schema. Tablas existentes:
- `usuarios` ya tiene campo `rol` (TEXT: 'admin' | 'dev')
- `perfiles` ya tiene campos `nombre`, `email`
- Relación por `usuarios.perfilId` → `perfiles.id`

## 🔐 Seguridad y Datos

- El cambio de rol requiere confirmación explícita (doble clic no, confirmación sí)
- No se puede eliminar el último admin
- Los permisos se evalúan desde el store reactivo de Alpine, no desde localStorage directamente
- Al cambiar el rol del usuario actual, el store se actualiza inmediatamente para reflejar nuevos permisos sin recargar
- El registro de devs es abierto (cualquiera puede registrarse como dev)

## 🎨 UI/UX y Animaciones

- **Toggle de rol**: Switch compacto con badges "Admin" / "Dev" con colores distintivos (accent para admin, ghost para dev)
- **Confirmación**: Modal simple (confirm nativo o DaisyUI modal) con texto claro
- **Tooltip en toggle bloqueado**: Al hover sobre toggle del último admin, mostrar "Debe haber al menos un administrador"
- **Transición**: Al cambiar rol propio, el sidebar badge y nav items se actualizan con fade (clase `stagger-enter`)
- **Añadir habilidad**: Sin cambios visuales, el botón "+ Nueva habilidad" ya no requiere rol admin

## 📚 Librerías Adicionales

Ninguna. Stack base cubre todos los requisitos.

## ⚙️ Configuración (project.config.js)

Sin cambios. `modulosActivos` existentes cubren la funcionalidad.

## 📦 Pre-requisitos y Checklist

- [ ] `Alpine.store('auth').canManageSkills()` cambiado a `return !!this.user`
- [ ] `modules/dashboard/module.js`: columna Rol + toggle + confirmación + guard último admin
- [ ] `modules/auth/module.js`: función `cambiarRol()` + `esUltimoAdmin()`
- [ ] `modules/habilidades/module.js`: eliminar restricción admin-only en vista
- [ ] `modules/perfiles/module.js`: eliminar guard no-admin en creación (solo si el perfil es propio)
- [ ] Auto-creación de perfil en registro dev (verificar implementación en `modules/auth/module.js`)
- [ ] Sincronización con Supabase: el cambio de rol debe replicarse al hacer push
