/* ============================================================
   fx.js — "juice"
   ------------------------------------------------------------
   Same lesson every action game learns: identical mechanics feel
   completely different depending on the feedback layer. Hit-stop,
   screen shake, floating numbers, particles and squash/stretch
   cost nothing mechanically and are most of what makes an action
   feel satisfying rather than merely registered.
   ============================================================ */

const FX = (() => {
  let layer = null;
  function root() {
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'fx-layer';
      document.body.appendChild(layer);
    }
    return layer;
  }

  const rnd = (a, b) => a + Math.random() * (b - a);

  /** screen shake — scaled by how big the moment was */
  function shake(power) {
    const el = document.getElementById('app');
    if (!el) return;
    el.style.setProperty('--shake', (power || 6) + 'px');
    el.classList.remove('shaking');
    void el.offsetWidth;
    el.classList.add('shaking');
    setTimeout(() => el.classList.remove('shaking'), 380);
  }

  /** 60–80ms freeze so a hit lands instead of sliding past */
  function hitstop(ms) {
    const el = document.getElementById('app');
    if (!el) return;
    el.style.filter = 'brightness(1.5) contrast(1.1)';
    setTimeout(() => { el.style.filter = ''; }, ms || 70);
  }

  function rectOf(sel) {
    const e = typeof sel === 'string' ? document.querySelector(sel) : sel;
    if (!e) return { x: innerWidth / 2, y: innerHeight / 2 };
    const r = e.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  /** floating combat text */
  function float(text, target, kind) {
    const p = rectOf(target);
    const d = document.createElement('div');
    d.className = 'fx-float ' + (kind || '');
    d.textContent = text;
    d.style.left = (p.x + rnd(-18, 18)) + 'px';
    d.style.top = p.y + 'px';
    root().appendChild(d);
    setTimeout(() => d.remove(), 1100);
  }

  /** particle burst */
  function burst(target, colors, n) {
    const p = rectOf(target);
    const cols = colors || ['#ffcf4d', '#fff', '#ffb020'];
    for (let i = 0; i < (n || 14); i++) {
      const d = document.createElement('i');
      d.className = 'fx-p';
      const a = rnd(0, Math.PI * 2), v = rnd(40, 150);
      d.style.left = p.x + 'px';
      d.style.top = p.y + 'px';
      d.style.background = cols[i % cols.length];
      d.style.setProperty('--dx', Math.cos(a) * v + 'px');
      d.style.setProperty('--dy', (Math.sin(a) * v - 40) + 'px');
      d.style.width = d.style.height = rnd(4, 9) + 'px';
      root().appendChild(d);
      setTimeout(() => d.remove(), 900);
    }
  }

  /** squash-and-stretch pop on an element */
  function pop(sel, cls) {
    const e = typeof sel === 'string' ? document.querySelector(sel) : sel;
    if (!e) return;
    e.classList.remove('fx-pop', 'fx-hurt');
    void e.offsetWidth;
    e.classList.add(cls || 'fx-pop');
    setTimeout(() => e.classList.remove(cls || 'fx-pop'), 420);
  }

  /** big centre-screen banner for combos and milestones */
  let banT = null;
  function banner(text, sub, kind) {
    let b = document.getElementById('fx-banner');
    if (!b) {
      b = document.createElement('div');
      b.id = 'fx-banner';
      root().appendChild(b);
    }
    b.className = 'show ' + (kind || '');
    b.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    clearTimeout(banT);
    banT = setTimeout(() => b.classList.remove('show'), 1000);
  }

  /** full-screen colour wash */
  function wash(color) {
    const d = document.createElement('div');
    d.className = 'fx-wash';
    d.style.background = color || 'rgba(255,255,255,.5)';
    root().appendChild(d);
    setTimeout(() => d.remove(), 460);
  }

  /** confetti rain for a big win */
  function confetti(n) {
    const cols = ['#ffcf4d', '#4fd18b', '#5ab8ff', '#ff6b6b', '#b48bff'];
    for (let i = 0; i < (n || 40); i++) {
      const d = document.createElement('i');
      d.className = 'fx-conf';
      d.style.left = rnd(0, innerWidth) + 'px';
      d.style.background = cols[i % cols.length];
      d.style.animationDelay = rnd(0, .5) + 's';
      d.style.setProperty('--rot', rnd(-360, 360) + 'deg');
      root().appendChild(d);
      setTimeout(() => d.remove(), 2600);
    }
  }

  return { shake, hitstop, float, burst, pop, banner, wash, confetti };
})();
