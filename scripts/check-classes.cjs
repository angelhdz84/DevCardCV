// Verifica si clases utilitarias existen en el CSS precompilado (Tailwind/DaisyUI).
// Uso: node scripts/check-classes.cjs "text-[9px]" "min-w-[10rem]" ...
const fs = require('fs');
const path = require('path');
const files = [
  'assets/css/tailwind.min.css',
  'assets/css/daisyui.min.css',
  'index.html'
];
const css = files.map(f => {
  try { return fs.readFileSync(path.join(__dirname, '..', f), 'utf8'); } catch (e) { return ''; }
}).join('\n');

const args = process.argv.slice(2);
const list = args.length ? args : [
  'text-[9px]', 'text-[10px]', 'text-[11px]', 'min-w-[10rem]', 'min-w-[8rem]',
  'max-w-[200px]', 'space-y-2', 'shrink-0', 'flex-1', 'w-5', 'h-5', 'w-6', 'h-6',
  'w-7', 'h-7', 'w-9', 'h-9', 'object-cover', 'max-h-80', 'overflow-y-auto',
  'ring-1', 'gap-1.5', 'truncate', 'line-clamp-2', 'last:border-b-0', '-space-x-2',
  'min-w-0', 'flex-col-reverse', 'sm:flex-row', 'sm:justify-between', 'w-full', 'sm:w-auto',
  'sm:flex-none', 'flex-none', 'mt-2', 'py-3', 'px-4', 'sm:px-6', 'text-base-content/50',
  'divide-y', 'border-b-default', 'radius-sm', 'radius-md', 'bg-elevated', 'text-faint',
  'text-muted', 'bg-muted', 'text-accent', 'bg-accent/15', 'bg-accent/5', 'border-accent',
  'checkbox-accent', 'radio-accent', 'select-xs', 'input-xs', 'badge-xs', 'radio-xs'
];

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const missing = [];
for (const c of list) {
  // En el CSS escapado, los caracteres especiales pueden ir precedidos de "\"
  // (.bg-accent\/15, .sm\:flex-row, .text-\[9px\])
  const pattern = c.split('').map(ch => (/[\\/:.\[\]%(),!#&>~*+|=^$?'"]/.test(ch) ? '\\\\?' + esc(ch) : esc(ch))).join('');
  const re = new RegExp('\\.' + pattern + '(?=[\\s,{:.>\\[])');
  if (!re.test(css)) missing.push(c);
}
console.log('FALTAN (' + missing.length + '):\n' + missing.map(m => '  ' + m).join('\n'));
