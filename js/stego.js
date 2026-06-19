/**
 * Ghost-Chat | Steganography Web Worker Bridge v2.0
 * ─────────────────────────────────────────────────────────────────
 * Bridge between main thread and stego-worker.
 * V2: Now supports metadata in encode, returns {message, meta} from decode.
 */

const GhostStego = (() => {
  'use strict';

  const worker = new Worker('js/stego-worker.js');

  let callId    = 0;
  const pending = {};

  worker.onmessage = (e) => {
    const { id, result, error } = e.data;
    const cb = pending[id];
    if (!cb) return;
    delete pending[id];
    if (error) {
      cb.reject(new Error(error));
    } else {
      cb.resolve(result);
    }
  };

  worker.onerror = (e) => {
    console.error('[GhostStego] Worker error:', e);
    for (const id in pending) {
      pending[id].reject(new Error(
        'Worker crashed: ' + (e.message || 'Unknown error. Check the console.')
      ));
      delete pending[id];
    }
  };

  function exec(action, payload) {
    return new Promise((resolve, reject) => {
      const id = callId++;
      pending[id] = { resolve, reject };
      worker.postMessage({ id, action, payload });
    });
  }

  return {
    encode:      (imageFile, message, password, metadata) => exec('encode', { imageFile, message, password, metadata }),
    decode:      (imageFile, password) => exec('decode', { imageFile, password }),
    getCapacity: (imageFile) => exec('getCapacity', { imageFile })
  };
})();
