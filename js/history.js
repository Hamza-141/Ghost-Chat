/**
 * Ghost-Chat | Message History System v1.0
 * ─────────────────────────────────────────────────────────────────
 * IndexedDB-backed message history for encoded/decoded messages.
 * Stores metadata, supports search, auto-purge, and export.
 */

const GhostHistory = (() => {
  'use strict';

  const DB_NAME = 'ghost-chat-history';
  const DB_VERSION = 1;
  const STORE_NAME = 'messages';

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('type', 'type', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function addMessage(entry) {
    const db = await openDB();
    const record = {
      type: entry.type, // 'encode' | 'decode'
      message: entry.message || '',
      fileName: entry.fileName || '',
      fileSize: entry.fileSize || 0,
      encrypted: !!entry.encrypted,
      senderAlias: entry.senderAlias || 'Unknown',
      selfDestruct: entry.selfDestruct || 0,
      timestamp: Date.now(),
      preview: (entry.message || '').substring(0, 120)
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).add(record);
      req.onsuccess = () => { record.id = req.result; resolve(record); };
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getAll(limit = 100) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('timestamp');
      const results = [];
      const req = index.openCursor(null, 'prev');
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor && results.length < limit) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results.reverse());
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  async function search(query) {
    const all = await getAll(500);
    const q = query.toLowerCase();
    return all.filter(m => 
      m.message.toLowerCase().includes(q) ||
      m.fileName.toLowerCase().includes(q) ||
      m.senderAlias.toLowerCase().includes(q)
    );
  }

  async function deleteMessage(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function clearAll() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function purgeOlderThan(hours) {
    const cutoff = Date.now() - (hours * 3600 * 1000);
    const all = await getAll(10000);
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    let purged = 0;
    for (const msg of all) {
      if (msg.timestamp < cutoff) {
        store.delete(msg.id);
        purged++;
      }
    }
    return new Promise((resolve) => {
      tx.oncomplete = () => resolve(purged);
    });
  }

  async function getCount() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function exportHistory() {
    const all = await getAll(10000);
    return JSON.stringify(all, null, 2);
  }

  return {
    addMessage,
    getAll,
    search,
    deleteMessage,
    clearAll,
    purgeOlderThan,
    getCount,
    exportHistory
  };
})();
