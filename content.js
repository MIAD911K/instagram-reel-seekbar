(() => {
  if (window.__reelSeekBarLoaded) return;
  window.__reelSeekBarLoaded = true;

  const SKIP_SECONDS = 5;       // ← / → 
  const SKIP_SHIFT_SECONDS = 10; // Shift + ← / →
  const BAR_HEIGHT = 28;

  // ---------- build UI ----------
  const bar = document.createElement('div');
  bar.id = 'rs-bar';
  bar.innerHTML = `
    <span class="rs-time rs-cur">0:00</span>
    <div class="rs-track">
      <div class="rs-rail">
        <div class="rs-buf"></div>
        <div class="rs-fill"></div>
        <div class="rs-thumb"></div>
        <div class="rs-tip">0:00</div>
      </div>
    </div>
    <span class="rs-time rs-dur">0:00</span>`;
  document.body.appendChild(bar);

  const track = bar.querySelector('.rs-track');
  const rail = bar.querySelector('.rs-rail');
  const fill = bar.querySelector('.rs-fill');
  const buf = bar.querySelector('.rs-buf');
  const thumb = bar.querySelector('.rs-thumb');
  const tip = bar.querySelector('.rs-tip');
  const curLabel = bar.querySelector('.rs-cur');
  const durLabel = bar.querySelector('.rs-dur');

  let current = null;
  let dragging = false;
  let mx = -1, my = -1;

  // keep Instagram from treating our clicks as "pause/play" or "like"
  ['click', 'dblclick', 'mousedown', 'mouseup', 'contextmenu', 'touchstart', 'touchend']
    .forEach(type => bar.addEventListener(type, e => e.stopPropagation()));

  // ---------- helpers ----------
  const fmt = s => {
    if (!isFinite(s) || s < 0) s = 0;
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  };
  const clamp01 = n => Math.min(1, Math.max(0, n));

  function pctFromEvent(e) {
    const r = rail.getBoundingClientRect();
    return clamp01((e.clientX - r.left) / r.width);
  }

  function pickVideo() {
    let best = null, bestScore = 0;
    for (const v of document.querySelectorAll('video')) {
      const r = v.getBoundingClientRect();
      const w = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0));
      const h = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
      let score = w * h;
      if (!v.paused) score *= 1.5;
      if (score > bestScore) { bestScore = score; best = v; }
    }
    return bestScore > 8000 ? best : null;
  }

  // ---------- scrubbing ----------
  function seekFromEvent(e) {
    if (!current || !isFinite(current.duration)) return;
    current.currentTime = pctFromEvent(e) * current.duration;
  }

  track.addEventListener('pointerdown', e => {
    e.preventDefault();
    e.stopPropagation();
    dragging = true;
    track.setPointerCapture(e.pointerId);
    seekFromEvent(e);
  });
  track.addEventListener('pointermove', e => {
    const pct = pctFromEvent(e);
    if (current && isFinite(current.duration)) {
      tip.textContent = fmt(pct * current.duration);
      tip.style.left = `${pct * 100}%`;
    }
    if (dragging) seekFromEvent(e);
  });
  const endDrag = e => {
    if (!dragging) return;
    dragging = false;
    try { track.releasePointerCapture(e.pointerId); } catch (_) {}
  };
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);

  // ---------- keyboard: ← / → ----------
  window.addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    const v = current || pickVideo();
    if (!v || !isFinite(v.duration)) return;
    const step = e.shiftKey ? SKIP_SHIFT_SECONDS : SKIP_SECONDS;
    const dir = e.key === 'ArrowLeft' ? -1 : 1;
    v.currentTime = Math.min(v.duration, Math.max(0, v.currentTime + dir * step));
    e.preventDefault();
  }, true);

  // ---------- track the mouse (to show the full bar when hovering a video) ----------
  window.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; }, { passive: true });

  // ---------- fullscreen support ----------
  document.addEventListener('fullscreenchange', () => {
    (document.fullscreenElement || document.body).appendChild(bar);
  });

  // ---------- main loop ----------
  function tick() {
    const v = pickVideo();
    if (!v || !isFinite(v.duration) || v.duration <= 0) {
      bar.classList.remove('rs-show');
      current = v; // keep reference for keyboard shortcuts
    } else {
      current = v;
      const r = v.getBoundingClientRect();
      const left = Math.max(r.left, 0);
      const right = Math.min(r.right, innerWidth);
      const bottom = Math.min(r.bottom, innerHeight);

      bar.style.transform = `translate(${left}px, ${bottom - BAR_HEIGHT}px)`;
      bar.style.width = `${right - left}px`;
      bar.classList.add('rs-show');

      const inside = mx >= r.left && mx <= r.right && my >= r.top && my <= r.bottom;
      bar.classList.toggle('rs-active', inside || dragging);

      const pct = clamp01(v.currentTime / v.duration) * 100;
      fill.style.width = `${pct}%`;
      thumb.style.left = `${pct}%`;
      curLabel.textContent = fmt(v.currentTime);
      durLabel.textContent = fmt(v.duration);

      if (v.buffered && v.buffered.length) {
        buf.style.width = `${clamp01(v.buffered.end(v.buffered.length - 1) / v.duration) * 100}%`;
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
