// preload.cjs — puente seguro (contextIsolation) entre el motor SQLite de la webapp
// y el sistema de archivos del escritorio. La webapp detecta window.devcardcvFs.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('devcardcvFs', {
  // Devuelve Uint8Array con los bytes del .sqlite, o null si aún no existe
  readDb: () => ipcRenderer.invoke('devcardcv:db:read'),
  // Guarda los bytes del snapshot SQLite (escritura atómica en userData)
  writeDb: (bytes) => {
    const copy = (bytes instanceof Uint8Array) ? bytes.slice() : new Uint8Array(bytes);
    return ipcRenderer.invoke('devcardcv:db:write', copy);
  },
  // Ruta informativa del archivo (p. ej. para pantalla de ajustes)
  dbPath: () => ipcRenderer.invoke('devcardcv:db:path')
});
