// core/crypto.js — Cifrado AES con CryptoJS
const cryptoHelpers = {
  _key: null,

  // 💡 Obtiene o genera la clave de cifrado
  getKey() {
    if (this._key) return this._key;
    let key = localStorage.getItem(APP_CONFIG.crypto.storageKey);
    if (!key) {
      key = CryptoJS.lib.WordArray.random(16).toString();
      localStorage.setItem(APP_CONFIG.crypto.storageKey, key);
    }
    this._key = key;
    return key;
  },

  // Cifrar texto
  encrypt(text) {
    if (!text) return '';
    const key = this.getKey();
    return CryptoJS.AES.encrypt(text, key).toString();
  },

  // Descifrar texto
  decrypt(cipherText) {
    if (!cipherText) return '';
    try {
      const key = this.getKey();
      const bytes = CryptoJS.AES.decrypt(cipherText, key);
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch (e) {
      console.warn('⚠️ Error descifrando:', e.message);
      return cipherText; // Si falla, devuelve el texto original
    }
  },

  // Cifrar objeto (solo campos sensibles)
  encryptObject(obj, sensitiveFields) {
    const result = { ...obj };
    for (const field of sensitiveFields) {
      if (result[field]) {
        result[field] = this.encrypt(result[field]);
      }
    }
    return result;
  },

  // Descifrar objeto
  decryptObject(obj, sensitiveFields) {
    const result = { ...obj };
    for (const field of sensitiveFields) {
      if (result[field]) {
        result[field] = this.decrypt(result[field]);
      }
    }
    return result;
  }
};

window.cryptoHelpers = cryptoHelpers;
