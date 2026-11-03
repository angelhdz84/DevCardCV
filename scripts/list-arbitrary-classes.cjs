// scripts/list-arbitrary-classes.cjs — Lista las clases de Tailwind con valores
// arbitrarios (p.ej. text-[10px], max-w-[200px]) usadas en HTML/JS de la app,
// para comprobar si existen en el CSS precompilado.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TARGETS = ['index.html', 'modules', 'core'];

function walk(p, acc) {
  const st = fs.statSync(p);
  if (st.isDirectory()) {
    for (const f of fs.readdirSync(p)) walk(path.join(p, f), acc);
  } else if (/\.(html|js)$/.test(p)) {
    acc.push(p);
  }
  return acc;
}

const files = TARGETS.flatMap(t => walk(path.join(ROOT, t), []));
const found = new Map();
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  const re = /(?:class|:class|className)="([^"]*)"/g;
  let m;
  while ((m = re.exec(s))) {
    for (const token of m[1].split(/\s+/)) {
      if (/\[[^\]]+\]/.test(token) || /\\\[/.test(token)) {
        if (!found.has(token)) found.set(token, new Set());
        found.get(token).add(path.relative(ROOT, f));
      }
    }
  }
  // :class="'...'" con comillas simples dentro del value
  const re2 = /:class="'([^']*)'"/g;
  while ((m = re2.exec(s))) {
    for (const token of m[1].split(/\s+/)) {
      if (/\[[^\]]+\]/.test(token)) {
        if (!found.has(token)) found.set(token, new Set());
        found.get(token).add(path.relative(ROOT, f));
      }
    }
  }
}

const cssFiles = ['assets/css/tailwind.min.css', 'assets/css/daisyui.min.css']
  .map(f => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch (e) { return ''; } })
  .join('\n');

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const rows = [...found.keys()].sort();
for (const c of rows) {
  const pattern = c.split('').map(ch => (/[\\/:.\[\]%(),!#&>~*+|=^$?'"{}]/.test(ch) ? '\\\\?' + esc(ch) : esc(ch))).join('');
  const inCss = new RegExp('\\.' + pattern + '(?=[\\s,{:.>\\[])').test(cssFiles);
  console.log((inCss ? 'OK    ' : 'FALTA ') + c + '   <- ' + [...found.get(c)].join(', '));
}
console.log('\nTotal:', rows.length);
