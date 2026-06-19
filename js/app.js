/**
 * Ghost Chat | Application Controller v2.1
 * ─────────────────────────────────────────────────────────────────
 * Professional minimal dark theme updates.
 */

if (window.location.protocol === 'file:') {
  alert("⚠️ Ghost Chat requires a local web server (Web Workers & Crypto API).\nUse VS Code Live Server or similar.");
}

const GhostApp = (() => {
  'use strict';

  let state = {
    activeTab: 'encode',
    encodeFile: null,
    decodeFile: null,
    encodeCapacity: 0,
    selfDestructSeconds: 0,
    sidebarOpen: false,
  };

  const $ = id => document.getElementById(id);
  const $$ = sel => document.querySelectorAll(sel);

  function formatBytes(n) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  }

  function now() {
    return new Date().toLocaleTimeString('en-US', { hour12: false });
  }

  function sanitizeHTML(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function timeAgo(ts) {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  }

  // ── Log Feed ─────────────────────────────────────────────────
  function addLog(type, title, detail = '') {
    const feed = $('log-feed');
    const empty = feed.querySelector('.log-empty');
    if (empty) empty.remove();

    // Clean text badges instead of emojis
    const icons = { encode: 'ENC', decode: 'DEC', success: 'OK', error: 'ERR', info: 'SYS', warn: 'WRN' };
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    entry.innerHTML = `
      <div class="log-entry-header">
        <span class="log-icon">[${icons[type] || '---'}]</span>
        <span class="log-title">${sanitizeHTML(title)}</span>
        <span class="log-time">${now()}</span>
      </div>
      ${detail ? `<div class="log-detail">${sanitizeHTML(detail)}</div>` : ''}
    `;
    entry.style.opacity = '0';
    entry.style.transform = 'translateY(10px)';
    feed.appendChild(entry);
    feed.scrollTop = feed.scrollHeight;
    requestAnimationFrame(() => {
      entry.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      entry.style.opacity = '1';
      entry.style.transform = 'translateY(0)';
    });
  }

  // ── Toast ────────────────────────────────────────────────────
  function showToast(message, type = 'info') {
    const existing = document.querySelector('.ghost-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = `ghost-toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => {
      toast.classList.add('toast-show');
      setTimeout(() => {
        toast.classList.remove('toast-show');
        setTimeout(() => toast.remove(), 400);
      }, 3000);
    });
  }

  // ── Tab Switching ────────────────────────────────────────────
  function switchTab(tab) {
    state.activeTab = tab;
    $$('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
    $$('.tab-section').forEach(sec => sec.classList.toggle('active', sec.id === `section-${tab}`));
    $$('.mobile-nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.nav === tab);
    });
  }

  // ── Image Upload ─────────────────────────────────────────────
  async function handleEncodeImage(file) {
    if (!file || !file.type.startsWith('image/')) {
      showToast('Please select a valid image file.', 'error');
      return;
    }
    $('encode-msg').value = '';
    $('encode-pw').value = '';
    $('encode-status').textContent = '';
    $('msg-charcount').textContent = '0 characters';
    state.encodeFile = file;

    const url = URL.createObjectURL(file);
    $('encode-img').src = url;
    $('encode-preview').classList.remove('hidden');
    addLog('info', 'Carrier image loaded', `${file.name} — ${formatBytes(file.size)}`);

    try {
      const cap = await GhostStego.getCapacity(file);
      state.encodeCapacity = cap.usableBytes;
      $('cap-text').textContent = `0 / ${cap.usableBytes.toLocaleString()} bytes usable`;
      $('cap-dimension').textContent = `${cap.width} × ${cap.height}px | ${formatBytes(cap.usableBytes)}`;
      updateCapacityBar(0, cap.usableBytes);
      updateEncodeButton();
    } catch (e) {
      addLog('error', 'Capacity check failed', e.message);
    }
  }

  async function handleDecodeImage(file) {
    if (!file || !file.type.startsWith('image/')) {
      showToast('Please select a valid image file.', 'error');
      return;
    }
    $('decode-pw').value = '';
    $('decoded-text').textContent = '';
    $('decode-output').classList.add('hidden');
    state.decodeFile = file;

    const url = URL.createObjectURL(file);
    $('decode-img').src = url;
    $('decode-preview').classList.remove('hidden');
    $('decode-btn').disabled = false;
    addLog('info', 'Target loaded for analysis', `${file.name} — ${formatBytes(file.size)}`);
  }

  // ── Capacity Bar ─────────────────────────────────────────────
  function updateCapacityBar(used, total) {
    if (!total) return;
    const pct = Math.min(100, (used / total) * 100);
    const fill = $('cap-fill');
    fill.style.width = `${pct}%`;
    fill.className = 'cap-fill';
    if (pct > 90) fill.classList.add('cap-danger');
    else if (pct > 70) fill.classList.add('cap-warn');
  }

  function updateEncodeButton() {
    const msgLen = ($('encode-msg').value || '').length;
    $('encode-btn').disabled = !state.encodeFile || msgLen === 0;
  }

  // ── Encode ───────────────────────────────────────────────────
  async function runEncode() {
    const message = $('encode-msg').value.trim();
    const password = $('encode-pw').value;
    const file = state.encodeFile;

    if (!file) { showToast('Select a carrier image first.', 'warn'); return; }
    if (!message) { showToast('Enter a message to hide.', 'warn'); return; }

    const btn = $('encode-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-spinner"></span> ENCODING...';
    $('encode-status').textContent = '';

    let identity;
    try { identity = await GhostIdentity.getOrCreate(); } catch { identity = { alias: 'Unknown' }; }

    const metadata = {
      sender: identity.alias,
      sd: state.selfDestructSeconds
    };

    addLog('encode', 'Encoding initiated', password ? 'AES-256-GCM encryption enabled' : 'No encryption');

    try {
      const blob = await GhostStego.encode(file, message, password, metadata);
      const url = URL.createObjectURL(blob);
      const name = file.name.replace(/\.[^.]+$/, '') + '_ghost.png';

      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);

      $('encode-status').textContent = `✓ Process complete. Saved as "${name}"`;
      $('encode-status').className = 'encode-status success';

      addLog('success', 'Transmission encoded', `"${name}" — ${message.length} chars hidden${password ? ' (encrypted)' : ''}`);
      showToast('Image encoded and downloaded!', 'success');

      // Save to history
      try {
        await GhostHistory.addMessage({
          type: 'encode',
          message,
          fileName: name,
          fileSize: blob.size,
          encrypted: !!password,
          senderAlias: identity.alias,
          selfDestruct: state.selfDestructSeconds
        });
        await refreshHistory();
        updateStats();
      } catch (e) { console.warn('History save failed:', e); }

    } catch (err) {
      $('encode-status').textContent = `✗ ${err.message}`;
      $('encode-status').className = 'encode-status error';
      addLog('error', 'Encoding failed', err.message);
      showToast('Encoding failed.', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 15V3m0 12l-4-4m4 4l4-4M2 17l.621 2.485A2 2 0 0 0 4.561 21h14.878a2 2 0 0 0 1.94-1.515L22 17"/></svg> ENCODE & DOWNLOAD';
      updateEncodeButton();
    }
  }

  // ── Decode ───────────────────────────────────────────────────
  let sdTimer = null;

  async function runDecode() {
    const password = $('decode-pw').value;
    const file = state.decodeFile;
    if (!file) { showToast('Load an encoded image first.', 'warn'); return; }

    const btn = $('decode-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-spinner"></span> ANALYZING...';
    $('decode-output').classList.add('hidden');
    $('sd-countdown').classList.add('hidden');
    if (sdTimer) clearInterval(sdTimer);

    addLog('decode', 'Decode scan initiated', file.name);

    try {
      const result = await GhostStego.decode(file, password);
      const message = typeof result === 'string' ? result : result.message;
      const meta = (typeof result === 'object' && result.meta) ? result.meta : {};

      $('decoded-text').textContent = message;
      $('decode-output').classList.remove('hidden');

      // Show metadata
      const metaEl = $('output-meta');
      metaEl.innerHTML = '';
      if (meta.sender) {
        metaEl.innerHTML += `<span class="output-meta-item">ID: ${sanitizeHTML(meta.sender)}</span>`;
      }
      if (meta.t) {
        metaEl.innerHTML += `<span class="output-meta-item">TIME: ${new Date(meta.t).toLocaleString()}</span>`;
      }
      if (meta.v) {
        metaEl.innerHTML += `<span class="output-meta-item">PROTO: v${meta.v}</span>`;
      }

      // Self-destruct countdown
      const sdSeconds = meta.sd || 0;
      if (sdSeconds > 0) {
        const sdEl = $('sd-countdown');
        const barEl = $('sd-countdown-bar');
        const textEl = $('sd-countdown-text');
        sdEl.classList.remove('hidden');
        let remaining = sdSeconds;
        barEl.style.width = '100%';
        textEl.textContent = `System purge in ${remaining}s`;

        sdTimer = setInterval(() => {
          remaining--;
          const pct = (remaining / sdSeconds) * 100;
          barEl.style.width = `${pct}%`;
          textEl.textContent = `System purge in ${remaining}s`;
          if (remaining <= 0) {
            clearInterval(sdTimer);
            $('decoded-text').textContent = '[ DATA PURGED ]';
            $('decoded-text').style.color = 'var(--rose)';
            $('decoded-text').style.textAlign = 'center';
            textEl.textContent = 'Message has been purged';
            barEl.style.width = '0%';
            setTimeout(() => {
              $('decoded-text').style.color = '';
              $('decoded-text').style.textAlign = '';
            }, 5000);
          }
        }, 1000);
      }

      $('decode-output').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      addLog('success', 'Payload recovered', `${message.length} chars revealed${password ? ' (decrypted)' : ''}`);
      showToast('Hidden payload recovered!', 'success');

      // Save to history
      try {
        let identity;
        try { identity = await GhostIdentity.getOrCreate(); } catch { identity = { alias: 'Unknown' }; }
        await GhostHistory.addMessage({
          type: 'decode',
          message,
          fileName: file.name,
          fileSize: file.size,
          encrypted: !!password,
          senderAlias: meta.sender || 'Unknown',
          selfDestruct: sdSeconds
        });
        await refreshHistory();
        updateStats();
      } catch (e) { console.warn('History save failed:', e); }

    } catch (err) {
      addLog('error', 'Decoding failed', err.message);
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg> DECODE MESSAGE';
    }
  }

  // ── Copy ─────────────────────────────────────────────────────
  async function copyDecoded() {
    const text = $('decoded-text').textContent;
    if (text === '[ DATA PURGED ]') return;
    try {
      await navigator.clipboard.writeText(text);
      const btn = $('copy-btn');
      btn.textContent = 'Copied';
      setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
      showToast('Copied to clipboard.', 'success');
    } catch {
      showToast('Copy failed.', 'error');
    }
  }

  // ── Drag & Drop ──────────────────────────────────────────────
  function setupDropZone(zoneId, inputId, handler) {
    const zone = $(zoneId);
    const input = $(inputId);
    if (!zone || !input) return;

    zone.addEventListener('click', (e) => { e.preventDefault(); input.click(); });
    input.addEventListener('change', e => {
      if (e.target.files && e.target.files.length > 0) {
        handler(e.target.files[0]);
        input.value = '';
      }
    });
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', e => { e.preventDefault(); zone.classList.remove('drag-over'); });
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) handler(e.dataTransfer.files[0]);
    });
  }

  function togglePw(inputId) {
    const input = $(inputId);
    input.type = input.type === 'password' ? 'text' : 'password';
  }

  // ── Keyboard Shortcut ────────────────────────────────────────
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      if (state.activeTab === 'encode') runEncode();
      else runDecode();
    }
  });

  // ── History ──────────────────────────────────────────────────
  async function refreshHistory() {
    const list = $('history-list');
    const empty = $('history-empty');
    try {
      const messages = await GhostHistory.getAll(50);
      if (messages.length === 0) {
        list.innerHTML = '';
        if (empty) list.appendChild(empty);
        $('history-count').textContent = '0';
        return;
      }
      $('history-count').textContent = messages.length.toString();
      list.innerHTML = messages.map(m => `
        <div class="history-item ${m.type}">
          <div class="history-item-header">
            <span class="history-item-type">${m.type === 'encode' ? 'Encoded' : 'Decoded'}</span>
            <span class="history-item-time">${timeAgo(m.timestamp)}</span>
          </div>
          <div class="history-item-preview">${sanitizeHTML(m.preview || '—')}</div>
        </div>
      `).join('');
    } catch (e) {
      console.warn('History load failed:', e);
    }
  }

  async function updateStats() {
    try {
      const all = await GhostHistory.getAll(10000);
      const count = all.length;
      $('settings-msg-count').textContent = count;
    } catch {}
  }

  // ── Identity UI ──────────────────────────────────────────────
  async function loadIdentityUI() {
    try {
      const id = await GhostIdentity.getOrCreate();
      // Sidebar
      $('identity-avatar').innerHTML = id.avatarSVG;
      $('identity-alias').textContent = id.alias;
      $('identity-fp').textContent = `FP: ${id.fingerprint}`;
      // Settings
      $('settings-avatar').innerHTML = id.avatarSVG;
      $('settings-alias').textContent = id.alias;
      $('settings-fingerprint').textContent = `FP: ${id.fingerprint}`;
    } catch (e) {
      console.warn('Identity load failed:', e);
    }
  }

  // ── Onboarding ───────────────────────────────────────────────
  async function initOnboarding() {
    const done = localStorage.getItem('ghost-chat-onboarded');
    if (done) {
      $('onboarding-overlay').classList.add('hidden');
      return;
    }

    $('onboard-next-1').addEventListener('click', async () => {
      $('onboard-step-1').classList.remove('active');
      $('onboard-step-2').classList.add('active');
      try {
        const id = await GhostIdentity.getOrCreate();
        $('onboard-avatar').innerHTML = id.avatarSVG;
        $('onboard-alias').textContent = id.alias;
        $('onboard-fingerprint').textContent = `FP: ${id.fingerprint}`;
      } catch (e) {
        $('onboard-alias').textContent = 'Identity Initialized';
      }
    });

    $('onboard-finish').addEventListener('click', () => {
      localStorage.setItem('ghost-chat-onboarded', '1');
      $('onboarding-overlay').style.opacity = '0';
      $('onboarding-overlay').style.transition = 'opacity 0.4s ease';
      setTimeout(() => $('onboarding-overlay').classList.add('hidden'), 400);
    });
  }

  // ── Settings ─────────────────────────────────────────────────
  function initSettings() {
    $('header-settings-btn').addEventListener('click', async () => {
      $('settings-overlay').classList.remove('hidden');
      await loadIdentityUI();
      try {
        const count = await GhostHistory.getCount();
        $('settings-msg-count').textContent = count;
      } catch {}
    });

    $('settings-close').addEventListener('click', () => {
      $('settings-overlay').classList.add('hidden');
    });

    $('settings-overlay').addEventListener('click', (e) => {
      if (e.target === $('settings-overlay')) $('settings-overlay').classList.add('hidden');
    });

    $('btn-regenerate-identity').addEventListener('click', async () => {
      if (!confirm('Regenerate identity? Your old keys will be lost.')) return;
      try {
        await GhostIdentity.regenerate();
        await loadIdentityUI();
        showToast('Identity regenerated.', 'success');
        addLog('info', 'Identity regenerated');
      } catch (e) { showToast('Failed to regenerate.', 'error'); }
    });

    $('btn-export-identity').addEventListener('click', async () => {
      try {
        const json = await GhostIdentity.exportIdentity();
        const blob = new Blob([json], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'ghost-identity.json';
        a.click();
        showToast('Identity exported.', 'success');
      } catch (e) { showToast('Export failed.', 'error'); }
    });

    $('btn-import-identity').addEventListener('click', () => {
      $('import-identity-input').click();
    });

    $('import-identity-input').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        await GhostIdentity.importIdentity(text);
        await loadIdentityUI();
        showToast('Identity imported.', 'success');
        addLog('info', 'Identity imported from file');
      } catch (err) { showToast('Import failed: ' + err.message, 'error'); }
      e.target.value = '';
    });

    $('btn-export-history').addEventListener('click', async () => {
      try {
        const json = await GhostHistory.exportHistory();
        const blob = new Blob([json], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'ghost-history.json';
        a.click();
        showToast('Log exported.', 'success');
      } catch (e) { showToast('Export failed.', 'error'); }
    });

    $('btn-clear-history').addEventListener('click', async () => {
      if (!confirm('Purge all local data? This cannot be undone.')) return;
      try {
        await GhostHistory.clearAll();
        await refreshHistory();
        updateStats();
        $('settings-msg-count').textContent = '0';
        showToast('Data purged.', 'success');
        addLog('info', 'Local data purged');
      } catch (e) { showToast('Failed to purge.', 'error'); }
    });
  }

  // ── Self-Destruct Selection ──────────────────────────────────
  function initSelfDestruct() {
    $$('.sd-option').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.sd-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.selfDestructSeconds = parseInt(btn.dataset.sd) || 0;
      });
    });
  }

  // ── Sidebar Toggle ──────────────────────────────────────────
  function initSidebar() {
    $('sidebar-toggle').addEventListener('click', () => {
      const sidebar = $('sidebar');
      sidebar.classList.toggle('open');
      state.sidebarOpen = sidebar.classList.contains('open');
    });

    document.addEventListener('click', (e) => {
      const sidebar = $('sidebar');
      if (state.sidebarOpen && !sidebar.contains(e.target) && e.target !== $('sidebar-toggle') && !$('sidebar-toggle').contains(e.target)) {
        sidebar.classList.remove('open');
        state.sidebarOpen = false;
      }
    });
  }

  // ── Mobile Nav ───────────────────────────────────────────────
  function initMobileNav() {
    $$('.mobile-nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const nav = btn.dataset.nav;
        if (nav === 'settings') {
          $('header-settings-btn').click();
        } else if (nav === 'history') {
          const sidebar = $('sidebar');
          sidebar.classList.toggle('open');
          state.sidebarOpen = sidebar.classList.contains('open');
        } else {
          switchTab(nav);
        }
        $$('.mobile-nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  // ── History Search ──────────────────────────────────────────
  function initHistorySearch() {
    let debounce;
    $('history-search').addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(async () => {
        const q = $('history-search').value.trim();
        if (!q) { await refreshHistory(); return; }
        try {
          const results = await GhostHistory.search(q);
          const list = $('history-list');
          if (results.length === 0) {
            list.innerHTML = '<div class="history-empty"><div>No records found</div></div>';
            return;
          }
          list.innerHTML = results.map(m => `
            <div class="history-item ${m.type}">
              <div class="history-item-header">
                <span class="history-item-type">${m.type === 'encode' ? 'Encoded' : 'Decoded'}</span>
                <span class="history-item-time">${timeAgo(m.timestamp)}</span>
              </div>
              <div class="history-item-preview">${sanitizeHTML(m.preview || '—')}</div>
            </div>
          `).join('');
        } catch {}
      }, 300);
    });
  }

  // ── Particles ────────────────────────────────────────────────
  // Reduced to ambient dust effect per specs
  function initParticles() {
    const canvas = $('particle-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W = canvas.width = window.innerWidth;
    let H = canvas.height = window.innerHeight;

    const particles = Array.from({ length: 25 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: Math.random() * 1.5 + 0.5,
      vx: (Math.random() - 0.5) * 0.1, vy: (Math.random() - 0.5) * 0.1,
      alpha: Math.random() * 0.5 + 0.1,
    }));

    window.addEventListener('resize', () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    });

    function draw() {
      ctx.clearRect(0, 0, W, H);
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        // Teal (#4fd1c5) and Purple (#8b7fc7)
        ctx.fillStyle = (Math.random() > 0.5) ? `rgba(79, 209, 197, ${p.alpha * 0.5})` : `rgba(139, 127, 199, ${p.alpha * 0.4})`;
        ctx.fill();
      }
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(79, 209, 197, ${0.02 * (1 - dist / 100)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      requestAnimationFrame(draw);
    }
    draw();
  }

  // ── PWA ──────────────────────────────────────────────────────
  function registerSW() {
    if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  // ── Init ─────────────────────────────────────────────────────
  async function init() {
    $$('.tab-btn').forEach(btn => { btn.addEventListener('click', () => switchTab(btn.dataset.tab)); });
    
    setupDropZone('encode-drop', 'encode-file-input', handleEncodeImage);
    setupDropZone('decode-drop', 'decode-file-input', handleDecodeImage);

    $('encode-msg').addEventListener('input', () => {
      const len = $('encode-msg').value.length;
      const cap = state.encodeCapacity;
      $('msg-charcount').textContent = `${len.toLocaleString()} characters`;
      if (cap > 0) {
        updateCapacityBar(len, cap);
        $('cap-text').textContent = `${len.toLocaleString()} / ${cap.toLocaleString()} bytes usable`;
      }
      updateEncodeButton();
    });

    $('encode-btn').addEventListener('click', runEncode);
    $('decode-btn').addEventListener('click', runDecode);
    $('copy-btn').addEventListener('click', copyDecoded);

    $('toggle-encode-pw').addEventListener('click', () => togglePw('encode-pw'));
    $('toggle-decode-pw').addEventListener('click', () => togglePw('decode-pw'));

    $('clear-encode')?.addEventListener('click', () => {
      state.encodeFile = null;
      state.encodeCapacity = 0;
      $('encode-preview').classList.add('hidden');
      $('encode-msg').value = '';
      $('encode-pw').value = '';
      $('encode-status').textContent = '';
      $('encode-btn').disabled = true;
      $('cap-text').textContent = '— / — bytes';
      $('cap-fill').style.width = '0%';
      $('cap-dimension').textContent = '';
      $('msg-charcount').textContent = '0 characters';
      $('encode-file-input').value = '';
      addLog('info', 'Workspace cleared');
    });

    $('clear-decode')?.addEventListener('click', () => {
      state.decodeFile = null;
      $('decode-preview').classList.add('hidden');
      $('decode-pw').value = '';
      $('decode-output').classList.add('hidden');
      $('decode-btn').disabled = true;
      $('decode-file-input').value = '';
      if (sdTimer) clearInterval(sdTimer);
      addLog('info', 'Workspace cleared');
    });

    initSelfDestruct();
    initSidebar();
    initMobileNav();
    initSettings();
    initHistorySearch();
    initParticles();
    registerSW();
    
    await initOnboarding();
    await loadIdentityUI();
    await refreshHistory();
    await updateStats();

    addLog('info', 'Engine active', 'LSB + AES-256-GCM + DeflateRaw');
  }

  document.addEventListener('DOMContentLoaded', init);
  return {};
})();