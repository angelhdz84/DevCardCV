# 📄 Especificación Técnica: DevCardCV

## 🎯 Descripción
App offline-first para que desarrolladores de software creen fichas técnicas (CV simplificado) con datos personales, foto y habilidades categorizadas. El jefe de proyectos puede visualizar todos los perfiles, buscar por skills y exportar CVs a PDF con envío por email.

## ✅ Criterios de Aceptación (Gherkin)

**Feature: Gestión de Perfiles**
  Scenario: Crear perfil de desarrollador
    Given un usuario abre la app
    When va a "Perfiles" y hace clic en "Nuevo desarrollador"
    Then completa nombre, email, cargo, bio y selecciona una foto
    And asigna habilidades desde el catálogo categorizado
    Then el perfil se guarda en IndexedDB con los datos cifrados

  Scenario: Jefe visualiza todos los perfiles
    Given existen 3+ desarrolladores registrados
    When el jefe abre el Dashboard
    Then ve una tabla con todos los devs, su cargo y skills principales
    And puede buscar por nombre o filtrar por skill

**Feature: Catálogo de Habilidades**
  Scenario: Categorías editables
    Given un usuario administra habilidades
    When crea una nueva categoría "Cloud" con skill "AWS"
    Then la categoría y skill aparecen disponibles al asignar a perfiles

  Scenario: Asignar habilidades a perfil
    Given un perfil de dev está abierto
    When selecciona habilidades del catálogo
    Then se guarda la relación perfil-habilidad en la BD

**Feature: Exportación CV**
  Scenario: Exportar a PDF
    Given un perfil de dev existe
    When el usuario hace clic en "Exportar PDF"
    Then se genera un PDF profesional con foto, datos y skills en tabla
    And se descarga automáticamente

  Scenario: Enviar por email
    Given un PDF ha sido generado
    When el usuario ingresa un correo destino y hace clic en "Enviar"
    Then el PDF se envía al correo indicado (si hay conexión)
    And se muestra notificación de éxito o error

**Feature: Backup JSON**
  Scenario: Exportar todo el sistema
    Given el usuario está en el Dashboard
    When hace clic en "Exportar JSON"
    Then se descarga un archivo .json con todos los perfiles, habilidades y relaciones
    And el archivo incluye metadatos (fecha, versión)

  Scenario: Importar sistema completo
    Given el usuario está en el Dashboard
    When hace clic en "Importar JSON" y selecciona un archivo válido
    Then se reemplazan todos los datos con los del archivo
    And se muestra confirmación con cantidad de registros importados

  Scenario: Exportar perfil individual
    Given un perfil de dev está abierto en Perfiles o CV
    When hace clic en "Exportar JSON"
    Then se descarga un .json con los datos de ese perfil y sus habilidades

  Scenario: Importar perfil individual
    Given el usuario está en Perfiles
    When hace clic en "Importar perfil JSON" y selecciona un archivo válido
    Then se agrega el perfil al sistema (o se actualiza si ya existe por email)
    And se muestran sus habilidades asignadas

## 🧱 Arquitectura y Módulos

**Enfoque:** SPA Modular con router hash-based
**Router:** `core/app.js` — escucha hashchange, renderiza módulos en `#app-content`

### Módulos

| Módulo | ID | Ruta | Descripción |
|--------|----|------|-------------|
| Dashboard | `dashboard` | `#/dashboard` | Panel con tarjetas de todos los devs, buscador y gráfico de skills |
| Perfiles | `perfiles` | `#/perfiles` | CRUD completo de desarrolladores con foto y skills |
| Habilidades | `habilidades` | `#/habilidades` | CRUD de categorías y habilidades del catálogo |
| CV | `cv` | `#/cv` | Vista previa del CV + exportar PDF + enviar por email |

### Estructura de archivos
```
index.html
project.config.js
core/            app.js, db.js, crypto.js, ui.js, theme.js
modules/         _template/, dashboard/, perfiles/, habilidades/, cv/
assets/          css/, js/libs/, fonts/
docs/            validacion-devcardcv.md
scripts/         descargar-libs.bat
```

### Modelo de datos (Dexie)
```javascript
perfiles:           '++id, nombre, email, cargo, bio, fotoBase64, created_at, updated_at'
habilidades:        '++id, nombre, categoria, created_at'
perfil_habilidades: '++id, perfil_id, habilidad_id'
```

## 🔐 Seguridad y Datos
- **Campos cifrados** (CryptoJS AES): `email`, `telefono`
- **Clave**: generada aleatoriamente, almacenada en localStorage con prefijo `devcardcv_`
- **Fotos**: almacenadas como base64 en IndexedDB
- **Datos mínimos**: solo nombre, email, cargo, bio, foto y skills
- **Privacidad**: 100% local. EmailJS usa conexión externa solo al enviar.

## 🎨 UI/UX y Animaciones
**Tono visual:** Profesional (1) — Azul #2563eb / Gris pizarra / Fondo claro
**Framework:** DaisyUI + Tailwind + Bootstrap Icons + Animate.css
**Responsive:** Sidebar colapsable en móvil, tabla→tarjetas en <768px
**Oscuro/Claro:** Toggle persistente en navbar
**UX:** Empty states, loading skeletons, toast feedback, offline banner, búsqueda en tiempo real

## 📚 Librerías Adicionales
```yaml
libreriasAdicionales:
  - nombre: html2canvas.min.js
    ruta: assets/js/libs/html2canvas.min.js
    descarga: curl -o assets/js/libs/html2canvas.min.js https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js
    tipo: script
    proposito: Capturar CV renderizado como imagen para PDF
  - nombre: dayjs.min.js
    ruta: assets/js/libs/dayjs.min.js
    descarga: curl -o assets/js/libs/dayjs.min.js https://cdn.jsdelivr.net/npm/dayjs@1.11.13/dayjs.min.js
    tipo: script
    proposito: Formateo de fechas en CV y dashboard
  - nombre: emailjs.min.js
    ruta: assets/js/libs/emailjs.min.js
    descarga: curl -o assets/js/libs/emailjs.min.js https://cdn.jsdelivr.net/npm/@emailjs/browser@4.4.1/dist/email.min.js
    tipo: script
    proposito: Envío de PDF por email desde el navegador
```
**IDs únicos:** `crypto.randomUUID()` nativo.

## ⚙️ Configuración (project.config.js)
```javascript
modulosActivos: ['dashboard', 'perfiles', 'habilidades', 'cv']
tema: { modo: 'light', colores: { primario: '#2563eb', ... }, tono: 'profesional' }
db: { nombre: 'DevCardCVDB', version: 1, tablas: { perfiles, habilidades, perfil_habilidades } }
```

## 📦 Pre-requisitos y Checklist
- [x] 16 librerías descargadas en assets/
- [x] index.html con orden de carga correcto
- [x] project.config.js configurado
- [x] Estructura de directorios lista
- [ ] core/*.js generados (FASE 3)
- [ ] modules/*/*.js + module.html generados (FASE 3)
- [ ] Validación de stack compliance (FASE 4)
- [ ] Reporte de validación generado (FASE 4)
