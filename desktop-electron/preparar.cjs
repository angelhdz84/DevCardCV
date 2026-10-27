// preparar.cjs — Copia el frontend de DevCardCV a desktop-electron/app/
// Lo usan `npm run dev` y `npm run dist` antes de abrir/empaquetar Electron.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DEST = path.join(__dirname, 'app');

const FILES = ['index.html', 'main.js', 'project.config.js', 'netlify.toml'];
const DIRS = ['core', 'modules', 'assets'];

function copyFile(f) {
  const src = path.join(ROOT, f);
  const dest = path.join(DEST, f);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
  }
}

function copyDir(d) {
  const src = path.join(ROOT, d);
  const dest = path.join(DEST, d);
  if (fs.existsSync(src)) {
    fs.cpSync(src, dest, {
      recursive: true,
      filter: (s) => !s.includes('node_modules')
    });
  }
}

function main() {
  console.log('📦 Preparando app/ para Electron...');
  if (fs.existsSync(DEST)) fs.rmSync(DEST, { recursive: true, force: true });
  fs.mkdirSync(DEST, { recursive: true });
  for (const f of FILES) {
    copyFile(f);
  }
  for (const d of DIRS) {
    copyDir(d);
  }
  console.log('✅ app/ listo en', DEST);
}

main();
