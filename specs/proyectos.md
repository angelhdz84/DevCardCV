# 📄 Especificación Técnica: Proyectos (DevCardCV)

## 🎯 Descripción
Módulo de gestión de proyectos dentro de DevCardCV. El admin crea proyectos, los asigna a uno o varios desarrolladores (individual o por equipos), define tareas y fechas límite. Cada Dev ve sus proyectos asignados y marca avance por tareas. El admin confirma y aprueba el progreso.

## ✅ Criterios de Aceptación (Gherkin)
- **Admin crea proyecto:** Dado que soy admin, cuando voy a `#/proyectos/nuevo`, ingresó nombre, descripción, prioridad, fecha límite (opcional), notas y seleccionó responsables, entonces el proyecto se guarda en IndexedDB + Supabase y aparece en la lista.
- **Admin asigna desarrolladores:** Dado un proyecto existente, puedo agregar/quitar desarrolladores o asignar un equipo completo.
- **Dev ve sus proyectos:** Dado que soy Dev, en `#/proyectos` solo veo los proyectos donde estoy asignado.
- **Dev marca tarea:** Dado un proyecto asignado, puedo cambiar estado de una tarea (pendiente → en-progreso → completada) y agregar un comentario. El cambio se persiste localmente y en Supabase.
- **Admin confirma tarea:** Dado que soy admin, veo las tareas marcadas como completadas por el Dev y puedo confirmarlas o rechazarlas.
- **Proyecto se cierra:** Cuando todas las tareas están confirmadas, el proyecto pasa automáticamente a estado "Completado". Admin puede forzar cierre manualmente.
- **Filtros:** Admin puede filtrar proyectos por prioridad, estado y responsable.
- **Fecha límite alerta:** Si un proyecto tiene fecha límite vencida, muestra badge rojo. Si vence en ≤3 días, badge amarillo.

## 🧱 Arquitectura y Módulos
- **Módulo**: `modules/proyectos/` con `module.js`, template inline en JS
- **Router**: `#/proyectos` (lista), `#/proyectos/nuevo` (crear), `#/proyectos/{id}` (detalle)
- **Auth**: Admin ve todo, Dev solo sus proyectos (filtro por `$store.auth.user.perfilId` en `proyecto_usuarios`)
- **Persistencia**: IndexedDB (Dexie) + Supabase sincronizado vía `dbOnline` (mismo patrón que perfiles/habilidades)
- **Modelo de datos (4 tablas)**:
  - `proyectos`: id, nombre, descripcion, prioridad (baja/media/alta), estado (abierto/en-progreso/completado), fecha_limite (opcional), notas_admin, creado_por, created_at, updated_at
  - `tareas`: id, proyecto_id, nombre, descripcion, estado (pendiente/en-progreso/completada/confirmada), comentario_dev, created_at, updated_at
  - `proyecto_usuarios`: id, proyecto_id, perfil_id
  - `equipos`: id, nombre, miembros (JSON array de perfil_ids)
- **Tablas Supabase**: mismas 4 tablas, sync automático con `dbOnline`

## 🔐 Seguridad y Datos
- `notas_admin` se cifra con AES (mismo patrón que email/teléfono) si contiene datos sensibles
- El campo `comentario_dev` NO se cifra (es contenido público del proyecto)
- Solo admin puede crear/editar proyectos y equipos, y confirmar tareas
- Dev solo puede:
  - Ver proyectos donde está asignado
  - Cambiar estado de sus tareas (pendiente→en-progreso→completada)
  - Agregar comentario a sus tareas

## 🎨 UI/UX y Animaciones
- **Lista proyectos (`#/proyectos`)**: Tabla con nombre, prioridad (badge verde/amarillo/rojo), estado (badge), fecha límite, avance % (barra progreso), responsables (avatares). Admin tiene columna acciones (editar/eliminar). Filtros: prioridad, estado.
- **Detalle proyecto (`#/proyectos/{id}`)**: Encabezado con info + barra de progreso general. Tabla de tareas con: checkbox estado, nombre, responsable, comentario, acción confirmar (admin). Dev puede cambiar estado y escribir comentario inline.
- **Crear/Editar proyecto**: Modal o formulario en página dedicada con select múltiple de devs y equipos.
- **Animaciones**: `stagger-enter` en filas de tareas, `fadeInUp` en cards, transiciones spring en cambios de estado.
- **Mobile-first**: Tablas con `overflow-x-auto`, botones `btn-sm`, gestión responsive.

## 📚 Librerías Adicionales
Ninguna — el stack base (Alpine.js, Dexie, DaisyUI, Bootstrap Icons, Animate.css, CryptoJS) cubre toda la funcionalidad.

## ⚙️ Configuración (project.config.js)
```js
// Agregar 'proyectos' a modulosActivos
modulosActivos: [
  'auth', 'dashboard', 'perfiles', 'habilidades', 'cv', 'proyectos'
],

// Agregar tablas en db.tablas
db: {
  nombre: 'DevCardCVDB',
  version: 2,
  tablas: {
    perfiles: '++id, nombre, email, cargo, created_at',
    habilidades: '++id, nombre, categoria',
    perfil_habilidades: '++id, perfil_id, habilidad_id',
    proyectos: '++id, nombre, estado, prioridad, fecha_limite, created_at',
    tareas: '++id, proyecto_id, nombre, estado, created_at',
    proyecto_usuarios: '++id, proyecto_id, perfil_id',
    equipos: '++id, nombre'
  }
},

// Agregar notas_admin a camposSensibles
crypto: {
  camposSensibles: ['email', 'telefono', 'direccion', 'notas_admin'],
  storageKey: 'devcardcv_key'
}
```

## 📦 Pre-requisitos y Checklist
- [ ] Registrar módulo `proyectos` en `project.config.js` (`modulosActivos` + `db.tablas` + versión DB)
- [ ] Crear estructura `modules/proyectos/module.js`
- [ ] Crear tablas en Supabase: `proyectos`, `tareas`, `proyecto_usuarios`, `equipos`
- [ ] Agregar columnas en Supabase
- [ ] Implementar vista lista `#/proyectos`
- [ ] Implementar vista detalle `#/proyectos/{id}`
- [ ] Implementar crear/editar proyecto
- [ ] Implementar asignación de devs/equipos
- [ ] Implementar flujo tareas (cambio estado + comentario Dev)
- [ ] Implementar confirmación admin
- [ ] Implementar filtros (prioridad, estado)
- [ ] Probar offline-first
- [ ] Exportar proyectos en backup JSON/Excel
```
