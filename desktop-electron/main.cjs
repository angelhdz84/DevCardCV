// main.cjs — DevCardCV Escritorio (Electron) — 100% offline
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const isPackaged = app.isPackaged;
let win = null;

// Carpeta del frontend (index.html + core + modules + assets)
function appDir() {
  if (isPackaged) {
    const pack = path.join(process.resourcesPath, 'app');
    if (fs.existsSync(path.join(pack, 'index.html'))) return pack;
  }
  const local = path.join(__dirname, 'app');
  if (fs.existsSync(path.join(local, 'index.html'))) return local;
  // Dev directo sobre el repositorio (sin staging)
  return path.join(__dirname, '..');
}

// Archivo SQLite real en la carpeta de datos de usuario
function dbPath() {
  return path.join(app.getPath('userData'), 'devcardcv.sqlite');
}

ipcMain.handle('devcardcv:db:read', async () => {
  try {
    const buf = await fsp.readFile(dbPath());
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  } catch (e) {
    return null; // primera ejecución: todavía no existe el archivo
  }
});

ipcMain.handle('devcardcv:db:write', async (_ev, bytes) => {
  try {
    const buf = Buffer.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
    const target = dbPath();
    await fsp.mkdir(path.dirname(target), { recursive: true });
    const tmp = target + '.tmp';
    await fsp.writeFile(tmp, buf);
    await fsp.rename(tmp, target); // escritura atómica: tmp → .sqlite
    return true;
  } catch (e) {
    console.error('❌ db:write', e);
    return false;
  }
});

ipcMain.handle('devcardcv:db:path', () => dbPath());

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    title: 'DevCardCV',
    autoHideMenuBar: true,
    backgroundColor: '#f8fafc',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  win.loadFile(path.join(appDir(), 'index.html'));
  // Sin barra de menú propia (la app trae la suya)
  win.setMenuBarVisibility(false);
  win.on('closed', () => { win = null; });
}

app.whenReady().then(() => {
  console.log('🗂️ SQLite en:', dbPath());
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
