/**
 * Ghost-Chat | Anonymous Identity System v1.0
 * ─────────────────────────────────────────────────────────────────
 * Generates and manages anonymous ghost identities:
 * - ECDSA P-256 keypair for signing/verification
 * - Random ghost alias
 * - Procedurally generated ghost avatar (SVG)
 * - Persisted in IndexedDB
 */

const GhostIdentity = (() => {
  'use strict';

  const DB_NAME = 'ghost-chat-identity';
  const DB_VERSION = 1;
  const STORE_NAME = 'identity';

  // ── Ghost Name Generator ──────────────────────────────────────
  const adjectives = [
    'Phantom', 'Shadow', 'Crimson', 'Spectral', 'Ethereal', 'Obsidian',
    'Midnight', 'Cursed', 'Haunted', 'Mystic', 'Arcane', 'Void',
    'Silent', 'Frozen', 'Burning', 'Ancient', 'Hollow', 'Wicked',
    'Lunar', 'Solar', 'Nether', 'Astral', 'Eldritch', 'Feral',
    'Veiled', 'Twisted', 'Cryptic', 'Abyssal', 'Gilded', 'Iron'
  ];

  const nouns = [
    'Wraith', 'Specter', 'Raven', 'Serpent', 'Phoenix', 'Wolf',
    'Shade', 'Banshee', 'Revenant', 'Ghoul', 'Phantom', 'Reaper',
    'Oracle', 'Harbinger', 'Sentinel', 'Wanderer', 'Monarch', 'Cipher',
    'Scribe', 'Herald', 'Warlock', 'Siren', 'Chimera', 'Valkyrie',
    'Golem', 'Sphinx', 'Djinn', 'Doppel', 'Kraken', 'Drake'
  ];

  function generateGhostName() {
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const hex = Array.from(crypto.getRandomValues(new Uint8Array(2)))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    return `${adj}${noun}_${hex}`;
  }

  // ── Procedural Ghost Avatar (SVG) ────────────────────────────
  function generateAvatarSVG(seed) {
    // Use seed to deterministically generate colors and shape
    const bytes = new Uint8Array(seed.length);
    for (let i = 0; i < seed.length; i++) {
      bytes[i % bytes.length] ^= seed.charCodeAt(i);
    }

    const hue1 = (bytes[0] * 1.41) % 360;
    const hue2 = (hue1 + 40 + (bytes[1] % 60)) % 360;
    const eyeType = bytes[2] % 4;
    const mouthType = bytes[3] % 3;
    const bodyWobble = 2 + (bytes[4] % 4);

    const color1 = `hsl(${hue1}, 70%, 55%)`;
    const color2 = `hsl(${hue2}, 60%, 45%)`;
    const glowColor = `hsl(${hue1}, 80%, 65%)`;

    // Eye shapes
    const eyes = {
      0: `<circle cx="36" cy="38" r="4" fill="#fff" opacity="0.9"/><circle cx="52" cy="38" r="4" fill="#fff" opacity="0.9"/><circle cx="37" cy="38" r="2" fill="#111"/><circle cx="53" cy="38" r="2" fill="#111"/>`,
      1: `<ellipse cx="36" cy="38" rx="5" ry="3" fill="#fff" opacity="0.9"/><ellipse cx="52" cy="38" rx="5" ry="3" fill="#fff" opacity="0.9"/><circle cx="37" cy="38" r="1.5" fill="#111"/><circle cx="53" cy="38" r="1.5" fill="#111"/>`,
      2: `<rect x="32" y="35" width="8" height="6" rx="1" fill="#fff" opacity="0.9"/><rect x="48" y="35" width="8" height="6" rx="1" fill="#fff" opacity="0.9"/><circle cx="36" cy="38" r="2" fill="#f00"/><circle cx="52" cy="38" r="2" fill="#f00"/>`,
      3: `<circle cx="36" cy="38" r="5" fill="#fff" opacity="0.9"/><circle cx="52" cy="38" r="3" fill="#fff" opacity="0.9"/><circle cx="37" cy="38" r="2.5" fill="#111"/><circle cx="52" cy="38" r="1.5" fill="#111"/>`
    };

    // Mouth shapes
    const mouths = {
      0: `<path d="M38 50 Q44 56, 50 50" stroke="#fff" fill="none" stroke-width="1.5" opacity="0.6"/>`,
      1: `<ellipse cx="44" cy="51" rx="4" ry="3" fill="#222" opacity="0.7"/>`,
      2: `<path d="M39 50 L44 54 L49 50" stroke="#fff" fill="none" stroke-width="1.5" opacity="0.5"/>`
    };

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 88 88" width="88" height="88">
  <defs>
    <linearGradient id="gBg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color1}"/>
      <stop offset="100%" stop-color="${color2}"/>
    </linearGradient>
    <filter id="gGlow">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="88" height="88" rx="16" fill="#0a0015"/>
  <path d="M44 12 C22 12, 16 30, 16 48 C16 60, 20 68, 24 72 L24 78 C24 80, 28 80, 28 76 L30 72 C32 74, 36 76, 40 76 L40 78 C40 80, 44 80, 44 76 L44 76 C44 80, 48 80, 48 78 L48 76 C52 76, 56 74, 58 72 L60 76 C60 80, 64 80, 64 78 L64 72 C68 68, 72 60, 72 48 C72 30, 66 12, 44 12Z"
        fill="url(#gBg)" filter="url(#gGlow)" opacity="0.9">
    <animate attributeName="d"
      values="M44 12 C22 12, 16 30, 16 48 C16 60, 20 68, 24 72 L24 78 C24 80, 28 80, 28 76 L30 72 C32 74, 36 76, 40 76 L40 78 C40 80, 44 80, 44 76 L44 76 C44 80, 48 80, 48 78 L48 76 C52 76, 56 74, 58 72 L60 76 C60 80, 64 80, 64 78 L64 72 C68 68, 72 60, 72 48 C72 30, 66 12, 44 12Z;
             M44 ${12-bodyWobble} C22 ${12-bodyWobble}, ${16-bodyWobble} 30, ${16-bodyWobble} 48 C${16-bodyWobble} 60, 20 68, 24 72 L24 78 C24 80, 28 80, 28 76 L30 72 C32 74, 36 76, 40 76 L40 78 C40 80, 44 80, 44 76 L44 76 C44 80, 48 80, 48 78 L48 76 C52 76, 56 74, 58 72 L60 76 C60 80, 64 80, 64 78 L64 72 C68 68, ${72+bodyWobble} 60, ${72+bodyWobble} 48 C${72+bodyWobble} 30, 66 ${12-bodyWobble}, 44 ${12-bodyWobble}Z;
             M44 12 C22 12, 16 30, 16 48 C16 60, 20 68, 24 72 L24 78 C24 80, 28 80, 28 76 L30 72 C32 74, 36 76, 40 76 L40 78 C40 80, 44 80, 44 76 L44 76 C44 80, 48 80, 48 78 L48 76 C52 76, 56 74, 58 72 L60 76 C60 80, 64 80, 64 78 L64 72 C68 68, 72 60, 72 48 C72 30, 66 12, 44 12Z"
      dur="4s" repeatCount="indefinite"/>
  </path>
  ${eyes[eyeType]}
  ${mouths[mouthType]}
</svg>`;
  }

  function avatarToDataURL(svgString) {
    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)));
  }

  // ── ECDSA Keypair ─────────────────────────────────────────────
  async function generateKeypair() {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true, // extractable for export
      ['sign', 'verify']
    );
    return keyPair;
  }

  async function exportKey(key) {
    return await crypto.subtle.exportKey('jwk', key);
  }

  async function importPublicKey(jwk) {
    return await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']);
  }

  async function importPrivateKey(jwk) {
    return await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
  }

  function getFingerprint(publicKeyJwk) {
    const raw = publicKeyJwk.x + publicKeyJwk.y;
    // Create a short visual fingerprint
    const chars = '0123456789ABCDEF';
    let fp = '';
    for (let i = 0; i < raw.length && fp.length < 20; i++) {
      fp += chars[raw.charCodeAt(i) % 16];
      if (fp.length % 5 === 4 && fp.length < 19) fp += '-';
    }
    return fp;
  }

  // ── IndexedDB Persistence ────────────────────────────────────
  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        e.target.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function saveIdentity(identity) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({ id: 'primary', ...identity });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function loadIdentity() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get('primary');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  // ── Public API ────────────────────────────────────────────────
  let _cached = null;

  async function getOrCreate() {
    if (_cached) return _cached;

    let stored = await loadIdentity();
    if (stored && stored.alias && stored.publicKey && stored.privateKey) {
      stored.avatarSVG = generateAvatarSVG(stored.alias);
      stored.avatarURL = avatarToDataURL(stored.avatarSVG);
      stored.fingerprint = getFingerprint(stored.publicKey);
      _cached = stored;
      return stored;
    }

    // Generate new identity
    const alias = generateGhostName();
    const keyPair = await generateKeypair();
    const publicKey = await exportKey(keyPair.publicKey);
    const privateKey = await exportKey(keyPair.privateKey);
    const avatarSVG = generateAvatarSVG(alias);

    const identity = {
      alias,
      publicKey,
      privateKey,
      avatarSVG,
      avatarURL: avatarToDataURL(avatarSVG),
      fingerprint: getFingerprint(publicKey),
      createdAt: Date.now()
    };

    await saveIdentity(identity);
    _cached = identity;
    return identity;
  }

  async function regenerate() {
    _cached = null;
    const alias = generateGhostName();
    const keyPair = await generateKeypair();
    const publicKey = await exportKey(keyPair.publicKey);
    const privateKey = await exportKey(keyPair.privateKey);
    const avatarSVG = generateAvatarSVG(alias);

    const identity = {
      alias,
      publicKey,
      privateKey,
      avatarSVG,
      avatarURL: avatarToDataURL(avatarSVG),
      fingerprint: getFingerprint(publicKey),
      createdAt: Date.now()
    };

    await saveIdentity(identity);
    _cached = identity;
    return identity;
  }

  async function exportIdentity() {
    const id = await getOrCreate();
    return JSON.stringify({
      alias: id.alias,
      publicKey: id.publicKey,
      privateKey: id.privateKey,
      createdAt: id.createdAt
    }, null, 2);
  }

  async function importIdentity(jsonString) {
    const data = JSON.parse(jsonString);
    if (!data.alias || !data.publicKey || !data.privateKey) {
      throw new Error('Invalid identity file');
    }
    _cached = null;
    const avatarSVG = generateAvatarSVG(data.alias);
    const identity = {
      alias: data.alias,
      publicKey: data.publicKey,
      privateKey: data.privateKey,
      avatarSVG,
      avatarURL: avatarToDataURL(avatarSVG),
      fingerprint: getFingerprint(data.publicKey),
      createdAt: data.createdAt || Date.now()
    };
    await saveIdentity(identity);
    _cached = identity;
    return identity;
  }

  return {
    getOrCreate,
    regenerate,
    exportIdentity,
    importIdentity,
    generateAvatarSVG,
    avatarToDataURL,
    getFingerprint
  };
})();
