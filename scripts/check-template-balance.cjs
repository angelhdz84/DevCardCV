// scripts/check-template-balance.cjs — Comprueba el balance de etiquetas HTML
// dentro de la plantilla que devuelve render() en un módulo.
// Uso: node scripts/check-template-balance.cjs modules/proyectos/module.js
const fs = require('fs');
const path = require('path');

const target = process.argv[2];
if (!target) { console.error('Falta el fichero'); process.exit(1); }
const src = fs.readFileSync(path.resolve(__dirname, '..', target), 'utf8');

// Busca el return ` ... ` de render()
const start = src.indexOf('return `');
if (start < 0) { console.error('No se encontró return `'); process.exit(1); }
let i = start + 'return `'.length;
let tpl = '';
while (i < src.length) {
  const ch = src[i];
  if (ch === '\\') { tpl += src[i] + (src[i + 1] || ''); i += 2; continue; }
  if (ch === '`') break;
  if (ch === '$' && src[i + 1] === '{') {   // salta interpolaciones
    let depth = 0;
    do {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') depth--;
      i++;
    } while (depth > 0 && i < src.length);
    tpl += '\u0000';
    continue;
  }
  tpl += ch;
  i++;
}

const VOID = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'source', 'path', 'circle', 'rect', 'line', 'use', 'area', 'base', 'col', 'embed', 'param', 'track', 'wbr', 'polygon', 'polyline', 'ellipse', 'stop']);
const stack = [];
const re = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>/g;
let m;
let line = src.slice(0, start).split(/\r?\n/).length;
const problems = [];
while ((m = re.exec(tpl))) {
  const closing = m[1] === '/';
  const name = m[2].toLowerCase();
  const selfClose = /\/\s*$/.test(m[3]);
  const lineInTpl = tpl.slice(0, m.index).split('\n').length;
  const absLine = line + lineInTpl - 1;
  if (VOID.has(name) || selfClose) continue;
  if (!closing) {
    stack.push({ name, absLine });
  } else {
    const top = stack[stack.length - 1];
    if (!top) {
      problems.push(`  línea ${absLine}: </${name}> sin apertura`);
    } else if (top.name !== name) {
      problems.push(`  línea ${absLine}: </${name}> cierra <${top.name}> abierto en la línea ${top.absLine}`);
      // intenta recuperarse
      const idx = stack.map(s => s.name).lastIndexOf(name);
      if (idx >= 0) stack.length = idx; else stack.pop();
    } else {
      stack.pop();
    }
  }
}
console.log('Objetivo:', target);
if (problems.length) {
  console.log('DESBALANCES (' + problems.length + '):');
  console.log(problems.slice(0, 25).join('\n'));
} else {
  console.log('Sin cierres cruzados.');
}
if (stack.length) {
  console.log('SIN CERRAR (' + stack.length + '):');
  stack.slice(0, 25).forEach(s => console.log(`  <${s.name}> abierto en línea ${s.absLine}`));
} else {
  console.log('Pila final vacía: todo balanceado.');
}
