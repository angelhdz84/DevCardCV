// copiar-web.cjs — Copia el frontend de DevCardCV (raíz del repo) a capacitor/www/
// para que `cap add/sync` lo empaquete en la APK Android.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DEST = path.join(__dirname, 'www');

const FILES = ['index.html', 'main.js', 'project.config.js'];
const DIRS = ['core', 'modules', 'assets'];

function main() {
  console.log('📦 Copiando frontend a www/...');
  if (fs.existsSync(DEST)) fs.rmSync(DEST, { recursive: true, force: true });
  fs.mkdirSync(DEST, { recursive: true });
  for (const f of FILES) {
    if (fs.existsSync(path.join(ROOT, f))) fs.copyFileSync(path.join(ROOT, f), path.join(DEST, f));
  }
  for (const d of DIRS) {
    if (fs.existsSync(path.join(ROOT, d))) {
      fs.cpSync(path.join(ROOT, d), path.join(DEST, d), {
        recursive: true,
        filter: (s) => !s.includes('node_modules')
      });
    }
  }
  console.log('✅ www/ listo en', DEST);
}

main();
