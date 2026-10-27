// scripts/serve-local.cjs — Servidor estático mínimo para probar DevCardCV Offline
// Uso: node scripts/serve-local.cjs [puerto=8741]
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.argv[2]) || 8741;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.map': 'application/json'
};

function send(res, code, body, type) {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = path.join(ROOT, url === '/' ? 'index.html' : url);
  if (!file.startsWith(ROOT)) return send(res, 403, 'Ruta no permitida', 'text/plain');
  fs.stat(file, (err, st) => {
    if (err || st.isDirectory()) {
      if (fs.existsSync(file + '/index.html')) file = path.join(file, 'index.html');
      else if (fs.existsSync(file + '.html')) file += '.html';
      else return send(res, 404, '404', 'text/plain');
    }
    fs.readFile(file, (e2, data) => {
      if (e2) return send(res, 404, '404', 'text/plain');
      send(res, 200, data, MIME[path.extname(file).toLowerCase()] || 'application/octet-stream');
    });
  });
}).listen(PORT, () => {
  console.log(`🚀 DevCardCV servido en http://localhost:${PORT}`);
});
