// capacitor/generar-iconos.cjs — Genera los mipmap de Android desde ../assets/icon-512.png
// Uso: npx cap add android && npx cap sync android && node generar-iconos.cjs
// Requiere: pngjs (devDependency de este package.json)
const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'assets', 'icon-512.png');
const RES = path.join(__dirname, 'android', 'app', 'src', 'main', 'res');
const DENSITIES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };

function resizeBox(src, size) {
  const out = new PNG({ width: size, height: size });
  const scaleX = src.width / size;
  const scaleY = src.height / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const x0 = Math.floor(x * scaleX);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * scaleX));
      const y0 = Math.floor(y * scaleY);
      const y1 = Math.max(y0 + 1, Math.floor((y + 1) * scaleY));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const idx = (sy * src.width + sx) * 4;
          r += src.data[idx]; g += src.data[idx + 1]; b += src.data[idx + 2]; a += src.data[idx + 3];
          n++;
        }
      }
      const o = (y * size + x) * 4;
      out.data[o] = Math.round(r / n);
      out.data[o + 1] = Math.round(g / n);
      out.data[o + 2] = Math.round(b / n);
      out.data[o + 3] = Math.round(a / n);
    }
  }
  return out;
}

if (!fs.existsSync(SRC)) {
  console.error('❌ No existe ' + SRC);
  process.exit(1);
}
if (!fs.existsSync(RES)) {
  console.error('❌ No existe android/ — ejecuta antes: npx cap add android && npx cap sync android');
  process.exit(1);
}

const src = PNG.sync.read(fs.readFileSync(SRC));
for (const [density, size] of Object.entries(DENSITIES)) {
  const dir = path.join(RES, 'mipmap-' + density);
  if (!fs.existsSync(dir)) {
    console.warn('⚠️ skip mipmap-' + density + ' (no existe)');
    continue;
  }
  const buf = PNG.sync.write(resizeBox(src, size));
  fs.writeFileSync(path.join(dir, 'ic_launcher.png'), buf);
  fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), buf);
  console.log('✅ mipmap-' + density + ' → ' + size + 'px');
}

// 💡 Los XMLs adaptativos (mipmap-anydpi-v26) tienen PRIORIDAD en Android 8+
//    y mostrarian el icono por defecto de Capacitor → se eliminan para usar
//    nuestros PNG en todas las versiones de Android.
const anydpi = path.join(RES, 'mipmap-anydpi-v26');
if (fs.existsSync(anydpi)) {
  fs.rmSync(anydpi, { recursive: true, force: true });
  console.log('✅ eliminados XMLs adaptativos (mipmap-anydpi-v26) → se usan los PNG');
}
console.log('🎨 Iconos Android generados desde assets/icon-512.png');
