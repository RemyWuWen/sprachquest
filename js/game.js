/* ============================================================
   game.js — state, loop, screens, lessons, progression
   ============================================================ */

const Game = (() => {
  const $ = id => document.getElementById(id);
  const SAVE_KEY = 'gq_save_v1';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------------- data access ---------------- */
  const DATA = (window.GQ_DATA || { packs: [], lemmas: [] });
  const PACKS = DATA.packs || [];
  const ALL = [];
  PACKS.forEach(p => (p.chunks || []).forEach(c => { c.packId = p.packId; ALL.push(c); }));
  const BY_ID = Object.fromEntries(ALL.map(c => [c.id, c]));

  const pack = id => PACKS.find(p => p.packId === id);
  const allChunks = () => ALL;
  const chunk = id => BY_ID[id];

  /* ---------------- state ---------------- */
  let state = null;

  function fresh() {
    return {
      v: 1,
      profile: {
        name: 'Held', xp: 0, level: 1, hp: 100, maxHp: 100, coins: 0,
        region: 'dorf', unlocked: ['dorf'], bosses: [],
        streak: 0, lastDay: '', bestCombo: 0, started: Date.now()
      },
      cards: {},           // chunkId → SRS card
      taught: {},          // packId → how many chunks introduced
      dex: {},             // caught Wortgeister
      party: [],           // up to 3 equipped
      inv: {},             // shop items
      badges: {},
      buff: {},
      settings: { lang: 'es', tts: true, sfx: true, rate: 0.85, newPer: 6, model: 'claude-opus-5' }
    };
  }

  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {} }
  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      const f = fresh();
      s.profile = Object.assign(f.profile, s.profile || {});
      s.settings = Object.assign(f.settings, s.settings || {});
      s.cards = s.cards || {}; s.taught = s.taught || {};
      s.dex = s.dex || {}; s.party = s.party || []; s.inv = s.inv || {};
      s.badges = s.badges || {}; s.buff = s.buff || {};
      return s;
    } catch (e) { return null; }
  }
  const hasSave = () => !!localStorage.getItem(SAVE_KEY);

  function card(id) {
    if (!state.cards[id]) state.cards[id] = SRS.newCard();
    return state.cards[id];
  }
  const knownChunks = () => ALL.filter(c => (state.cards[c.id] || {}).seen > 0);
  const dueChunks = () => { const n = Date.now(); return knownChunks().filter(c => state.cards[c.id].due <= n); };
  const strongCount = () => ALL.filter(c => (state.cards[c.id] || {}).strength >= 2).length;

  /** How many of the 1000 high-frequency words you have actually met.
      `cov` is precomputed at build time and already accounts for
      inflected forms (geht → gehen, Häuser → Haus). */
  function lemmasKnown() {
    const s = new Set();
    knownChunks().forEach(c => (c.cov || []).forEach(i => s.add(i)));
    return s.size;
  }
  const lemmaTotal = () => (DATA.lemmas && DATA.lemmas.length) || 1000;

  /* ---------------- screens ---------------- */
  const MODALS = ['screen-lesson', 'screen-journal', 'screen-chat', 'screen-map', 'screen-settings', 'screen-meta'];
  function show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    if (MODALS.includes(id)) $('screen-world').classList.add('active');
    $(id).classList.add('active');
    if (id === 'screen-world') updateHud();
  }

  let toastT = null;
  function toast(msg, ms) {
    const t = $('toast');
    t.innerHTML = msg; t.classList.remove('hidden');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.add('hidden'), ms || 2600);
  }
  function flash() { const f = $('flash'); f.classList.remove('hidden'); f.style.animation = 'none'; void f.offsetWidth; f.style.animation = ''; setTimeout(() => f.classList.add('hidden'), 340); }

  /* ---------------- progression ---------------- */
  const xpFor = lv => Math.floor(60 * Math.pow(lv, 1.45));

  function addXp(n) {
    if (!n) return;
    const p = state.profile;
    p.xp += n;
    while (p.xp >= xpFor(p.level)) {
      p.xp -= xpFor(p.level);
      p.level++;
      p.maxHp += 10; p.hp = p.maxHp;
      SFX.levelup(); flash();
      toast(`⬆️ Level ${p.level}! Volle Energie.`);
    }
    updateHud();
  }

  let lastStrong = -1;
  function updateHud() {
    if (!state) return;
    const p = state.profile;
    // regions open the moment you earn them, not on the next reload
    const st = strongCount();
    if (st !== lastStrong) { lastStrong = st; unlockCheck(); }
    $('hud-region').textContent = (World.region ? World.region.icon + ' ' + World.region.name : '—');
    $('hud-hp').style.width = (p.hp / p.maxHp * 100) + '%';
    $('hud-hp-txt').textContent = `${Math.max(0, Math.round(p.hp))} / ${p.maxHp}`;
    $('hud-xp').style.width = (p.xp / xpFor(p.level) * 100) + '%';
    $('hud-xp-txt').textContent = `${p.xp} / ${xpFor(p.level)} XP`;
    $('hud-level').textContent = 'Lv ' + p.level;
    $('hud-words').textContent = `${lemmasKnown()} / ${lemmaTotal()} Wörter`;
    $('hud-streak').textContent = '🔥 ' + p.streak;
    $('hud-coins').textContent = '🪙 ' + (p.coins || 0);
    const d = dueChunks().length;
    const b = $('due-badge');
    if (d > 0) { b.textContent = d > 99 ? '99+' : d; b.classList.remove('hidden'); } else b.classList.add('hidden');

    // unclaimed quest rewards are the strongest "come back" nudge there is
    const q = Meta.quests().list.filter(x => x.done && !x.claimed).length;
    const qb = $('quest-badge');
    if (q > 0) { qb.textContent = q; qb.classList.remove('hidden'); } else qb.classList.add('hidden');
  }

  function checkStreak() { Meta.rollStreak(); }

  /* ---------------- translation peek ----------------
     Spanish is hidden by default and revealed on demand (Tab, or the 👁
     button). Comprehension you reach for sticks; comprehension handed to
     you unprompted gets skimmed past. The choice is remembered. */
  function applyTranslations() {
    const on = !!(state && state.settings.showTr);
    document.body.classList.toggle('show-tr', on);
    document.querySelectorAll('[data-act="peek"]').forEach(b => {
      b.classList.toggle('on', on);
      b.title = on ? 'Ocultar traducción (Tab)' : 'Ver traducción (Tab)';
    });
  }
  function toggleTranslations() {
    if (!state) return;
    state.settings.showTr = !state.settings.showTr;
    applyTranslations(); save(); SFX.blip();
    toast(state.settings.showTr ? '👁 Traducciones visibles' : '🙈 Traducciones ocultas — Tab para verlas', 1600);
  }

  /* ---------------- player / loop ---------------- */
  const player = { px: 0, py: 0, dir: 'down', moving: false, speed: 2.4, steps: 0 };
  const cam = { x: 0, y: 0 };
  const keys = {};
  let ctx = null, running = false;

  function enterRegion(id, spawn) {
    const r = World.load(id);
    state.profile.region = id;
    const sp = spawn || r.spawn;
    player.px = sp.x * TS; player.py = sp.y * TS;
    player.dir = 'up';
    updateHud();
    toast(`${r.icon} ${r.name}`);
    save();
  }

  function collides(px, py) {
    // feet hitbox
    const x1 = px + 8, x2 = px + 23, y1 = py + 20, y2 = py + 31;
    for (const [x, y] of [[x1, y1], [x2, y1], [x1, y2], [x2, y2]]) {
      const tx = Math.floor(x / TS), ty = Math.floor(y / TS);
      if (tx < 0 || ty < 0 || tx >= World.W || ty >= World.H) return true;
      if (World.solidAt(tx, ty)) return true;
      const n = World.npcAt(tx, ty);
      if (n) return true;
    }
    return false;
  }

  function facingTile() {
    const tx = Math.floor((player.px + 16) / TS), ty = Math.floor((player.py + 26) / TS);
    const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[player.dir];
    return [tx + d[0], ty + d[1]];
  }

  function update() {
    if (!$('screen-world').classList.contains('active')) return;
    if (Dialogue.open || document.querySelector('.screen.modal.active')) { player.moving = false; return; }

    let dx = 0, dy = 0;
    if (keys.up) { dy = -1; player.dir = 'up'; }
    else if (keys.down) { dy = 1; player.dir = 'down'; }
    if (keys.left) { dx = -1; player.dir = 'left'; }
    else if (keys.right) { dx = 1; player.dir = 'right'; }

    player.moving = !!(dx || dy);
    if (player.moving) {
      const sp = player.speed * (dx && dy ? .72 : 1);
      const nx = player.px + dx * sp, ny = player.py + dy * sp;
      if (!collides(nx, player.py)) player.px = nx;
      if (!collides(player.px, ny)) player.py = ny;

      player.steps += sp;
      if (player.steps > 26) {
        player.steps = 0;
        SFX.step();
        maybeEncounter();
      }
    }

    cam.x = Math.max(0, Math.min(World.W * TS - 640, player.px + 16 - 320));
    cam.y = Math.max(0, Math.min(World.H * TS - 480, player.py + 16 - 240));

    // interact hint
    const [fx, fy] = facingTile();
    const n = World.npcAt(fx, fy);
    $('interact-hint').classList.toggle('hidden', !n);
  }

  function maybeEncounter() {
    const tx = Math.floor((player.px + 16) / TS), ty = Math.floor((player.py + 26) / TS);
    if (World.tileAt(tx, ty) !== T.TALL) return;

    const buff = state.buff || {};
    const rate = buff.lure > 0 ? 0.26 : 0.13;
    if (buff.lure > 0) { buff.lure--; state.buff = buff; }
    if (Math.random() > rate) return;

    const due = dueChunks();
    const pool = due.length >= 4 ? due
      : knownChunks().sort((a, b) => (state.cards[a.id].strength - state.cards[b.id].strength)).slice(0, 8);
    if (pool.length < 3) return;

    const sp = Meta.rollWild(World.region.id);
    const R = Meta.RARITY[sp.rarity];
    flash();
    FX.shake(sp.rarity === 'legend' ? 14 : 6);
    if (sp.rarity !== 'common') {
      FX.banner(sp.rarity === 'legend' ? '⭐ LEGENDÄR!' : '💠 SELTEN!', sp.name, 'gold');
      SFX.great();
    }
    Battle.start({
      title: sp.name, face: sp.face, species: sp,
      chunks: shuffle(pool).slice(0, sp.rarity === 'legend' ? 8 : 6),
      max: sp.rarity === 'legend' ? 8 : 6
    });
  }

  function loop() {
    if (!running) return;
    update();
    if ($('screen-world').classList.contains('active') && !Battle.active) {
      World.render(ctx, cam, player);
    }
    requestAnimationFrame(loop);
  }

  const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[b[i], b[j]] = [b[j], b[i]]; } return b; };

  /* ============================================================
     Dialogue
     ============================================================ */
  const Dialogue = {
    open: false, queue: [], onDone: null,
    show(name, face, lines, choices, onDone) {
      this.open = true;
      this.queue = Array.isArray(lines) ? lines.slice() : [lines];
      this.choices = choices || null;
      this.onDone = onDone || null;
      $('dlg-name').textContent = name;
      $('dlg-face').textContent = face;
      $('dialogue').classList.remove('hidden');
      $('dlg-choices').innerHTML = '';
      SFX.open();
      this.advance();
    },
    advance() {
      if (this.queue.length) {
        const line = this.queue.shift();
        const de = typeof line === 'string' ? line : line.de;
        const tr = typeof line === 'string' ? '' : (line.tr || '');
        // The Spanish is always in the DOM but stays hidden until you ask for
        // it. Reaching for the meaning before you're given it is most of the
        // learning; handing it over unprompted turns reading into skimming.
        $('dlg-text').innerHTML = `<span class="de">${esc(de)}</span>` +
          (tr ? `<span class="tr">${esc(tr)}</span>` : '<span class="tr tr-none">—</span>');
        Speech.say(de);
        $('dlg-next').classList.toggle('hidden', this.queue.length === 0 && !!this.choices);
        return;
      }
      if (this.choices) {
        const box = $('dlg-choices');
        box.innerHTML = '';
        $('dlg-next').classList.add('hidden');
        this.choices.forEach(ch => {
          const b = document.createElement('button');
          b.innerHTML = ch.label;
          b.onclick = () => { this.close(); ch.act && ch.act(); };
          box.appendChild(b);
        });
        this.choices = null;
        return;
      }
      this.close();
      if (this.onDone) { const f = this.onDone; this.onDone = null; f(); }
    },
    close() { this.open = false; $('dialogue').classList.add('hidden'); }
  };

  /* ============================================================
     NPC interaction
     ============================================================ */
  function interact() {
    if (Dialogue.open) { Dialogue.advance(); return; }
    const [fx, fy] = facingTile();
    const n = World.npcAt(fx, fy);
    if (!n) return;

    if (n.role === 'sign') { Dialogue.show(n.name, n.face, [{ de: n.greet, tr: n.greetEs || '' }]); return; }

    const p = pack(n.pack);
    const packChunks = p ? p.chunks : [];
    const taught = state.taught[n.pack] || 0;
    const seenHere = packChunks.filter(c => card(c.id).seen > 0);

    if (n.role === 'teacher') {
      const remaining = packChunks.length - taught;
      const choices = [];
      if (remaining > 0) choices.push({ label: `📚 Unterricht — neue Ausdrücke lernen <em style="color:#8fa3bd">(${remaining} übrig)</em>`, act: () => startLesson(n) });
      if (seenHere.length >= 3) choices.push({ label: `🔁 Wiederholen — ${seenHere.length} Ausdrücke`, act: () => Battle.start({ title: n.name + 's Übung', face: n.face, chunks: pickForReview(seenHere, 8), max: 8 }) });
      choices.push({ label: '👋 Tschüss', act: () => {} });
      Dialogue.show(n.name, n.face, [{ de: n.greet, tr: n.greetEs || '' }], choices);
      return;
    }

    if (n.role === 'trainer') {
      if (seenHere.length < 3) {
        Dialogue.show(n.name, n.face, [{ de: 'Du kennst noch zu wenig. Geh zuerst zum Lehrer!', tr: 'Aún sabes muy poco. Ve primero al profesor.' }]);
        return;
      }
      Dialogue.show(n.name, n.face, [{ de: n.greet, tr: n.greetEs || '' }], [
        { label: '⚔️ Kämpfen!', act: () => Battle.start({ title: n.name, face: n.face, chunks: pickForReview(seenHere, 10), max: 10 }) },
        { label: '🏃 Später', act: () => {} }
      ]);
      return;
    }

    if (n.role === 'boss') {
      const beaten = state.profile.bosses.includes(n.name);
      if (seenHere.length < 6) {
        Dialogue.show(n.name, n.face, [{ de: 'Noch nicht. Lerne mehr, dann reden wir.', tr: 'Todavía no. Aprende más y hablamos.' }]);
        return;
      }
      Dialogue.show(n.name, n.face, [{ de: n.greet, tr: n.greetEs || '' }], [
        { label: beaten ? '💬 Nochmal reden' : '💬 Gespräch beginnen', act: () => startBoss(n) },
        { label: '🏃 Später', act: () => {} }
      ]);
    }
  }

  /** due first, then weakest — never a random dump */
  function pickForReview(pool, n) {
    const now = Date.now();
    const due = pool.filter(c => card(c.id).due <= now);
    const rest = pool.filter(c => card(c.id).due > now)
      .sort((a, b) => card(a.id).strength - card(b.id).strength);
    return shuffle(due).concat(rest).slice(0, n);
  }

  /* ============================================================
     Lesson (comprehensible input phase)
     ============================================================ */
  let L = null;

  function startLesson(npc) {
    const p = pack(npc.pack);
    if (!p) { toast('Dieser Lehrer hat noch keine Lektion.'); return; }
    const taught = state.taught[npc.pack] || 0;
    const ordered = p.chunks.slice().sort((a, b) => (a.level || 1) - (b.level || 1));
    const batch = ordered.slice(taught, taught + (state.settings.newPer || 6));
    if (!batch.length) { toast('Du hast schon alles von ' + npc.name + ' gelernt!'); return; }

    L = { npc, pack: p, batch, i: 0 };
    $('lesson-title').textContent = p.title || p.titleDe || npc.name;
    $('lesson-tag').textContent = 'Unterricht';
    show('screen-lesson');
    renderLesson();
  }

  function renderLesson() {
    if (!L) return;
    const c = L.batch[L.i];
    $('lesson-prog').style.width = ((L.i) / L.batch.length * 100) + '%';
    const t = state.settings.lang === 'en' ? (c.en || c.es) : (c.es || c.en);
    const de = esc(c.de).replace(/_+/g, '<span class="slot">___</span>');

    $('lesson-card').innerHTML = `
      <div class="chunk-de">${de}</div>
      <div class="chunk-say" data-say="${esc(c.de)}">🔊 anhören</div>
      <div class="chunk-tr">${esc(t)}</div>
      ${c.gloss ? `<div class="chunk-gloss">↳ ${esc(c.gloss)}</div>` : ''}
      ${c.note ? `<div class="chunk-note">💡 ${esc(c.note)}</div>` : ''}
      ${(c.fillers && c.fillers.length) ? `<div class="chunk-fillers">${c.fillers.map(f => `<span data-say="${esc(c.de.replace(/_+/, f.de))}">${esc(f.de)} <em style="color:#8fa3bd;font-style:normal">· ${esc(f.es)}</em></span>`).join('')}</div>` : ''}
      <div class="chunk-meta">${L.i + 1} / ${L.batch.length} · Level ${c.level || 1} · ${esc(c.type || 'phrase')}</div>
    `;
    $('lesson-card').querySelectorAll('[data-say]').forEach(el => {
      el.onclick = () => Speech.say(el.dataset.say, { force: true });
    });
    Speech.say(c.de);
  }

  function lessonNext() {
    if (!L) return;
    const c = L.batch[L.i];
    const cd = card(c.id);
    if (cd.seen === 0) {
      cd.seen = 1; cd.due = Date.now() + 60 * 1000;   // enters the schedule
      Meta.progress('learn', 1);
    }
    L.i++;
    if (L.i >= L.batch.length) {
      state.taught[L.npc.pack] = (state.taught[L.npc.pack] || 0) + L.batch.length;
      const batch = L.batch; const npc = L.npc;
      L = null; save(); updateHud();
      // test-enhanced learning: retrieve immediately after input
      Dialogue.show(npc.name, npc.face,
        [{ de: 'Gut! Jetzt zeig mir, was hängen geblieben ist.', tr: '¡Bien! Ahora demuéstrame qué se te ha quedado.' }],
        [{ label: '⚔️ Sofort üben', act: () => Battle.start({ title: 'Übung: ' + (npc.name), face: npc.face, chunks: batch, max: batch.length }) },
         { label: '🚶 Später', act: () => {} }]);
      show('screen-world');
      return;
    }
    renderLesson();
  }
  function lessonPrev() { if (L && L.i > 0) { L.i--; renderLesson(); } }
  function lessonAgain() { if (L) Speech.say(L.batch[L.i].de, { force: true }); }
  function lessonClose() { if (L) { state.taught[L.npc.pack] = (state.taught[L.npc.pack] || 0) + L.i; L = null; save(); } show('screen-world'); }

  /* ============================================================
     Boss conversation
     ============================================================ */
  function startBoss(npc) {
    AI.start({
      npc, packId: npc.pack, final: npc.final, targetCount: npc.final ? 6 : 4,
      onWin: () => {
        if (!state.profile.bosses.includes(npc.name)) state.profile.bosses.push(npc.name);
        unlockCheck();
        save();
      }
    });
  }

  function unlockCheck() {
    const strong = strongCount();
    let opened = 0;
    REGIONS.forEach(r => {
      if (state.profile.unlocked.includes(r.id)) return;
      if (strong >= r.unlockAt) {
        state.profile.unlocked.push(r.id);
        opened++;
        if (r.unlockAt > 0) toast(`🗺️ Neue Region freigeschaltet: ${r.icon} ${r.name}`, 4200);
      }
    });
    if (opened) save();
  }

  /* ============================================================
     Journal
     ============================================================ */
  function openJournal() {
    const sel = $('journal-pack');
    if (!sel.options.length) {
      sel.innerHTML = '<option value="all">Alle Pakete</option>' +
        PACKS.map(p => `<option value="${p.packId}">${esc(p.title || p.packId)}</option>`).join('');
      sel.onchange = renderJournal;
      $('journal-state').onchange = renderJournal;
      $('journal-search').oninput = renderJournal;
    }
    show('screen-journal');
    renderJournal();
  }

  function renderJournal() {
    const q = SRS.normalize($('journal-search').value || '');
    const pk = $('journal-pack').value;
    const st = $('journal-state').value;
    const now = Date.now();

    const known = knownChunks();
    const strong = known.filter(c => state.cards[c.id].strength >= 4).length;
    const learning = known.filter(c => state.cards[c.id].strength < 4).length;
    $('journal-stats').innerHTML = `
      <div class="jstat"><b>${known.length}</b><span>Ausdrücke</span></div>
      <div class="jstat"><b style="color:#ffcf4d">${lemmasKnown()}</b><span>von ${lemmaTotal()} Wörtern</span></div>
      <div class="jstat"><b style="color:#4fd18b">${strong}</b><span>gefestigt</span></div>
      <div class="jstat"><b style="color:#5ab8ff">${learning}</b><span>am Lernen</span></div>
      <div class="jstat"><b style="color:#ff6b6b">${dueChunks().length}</b><span>fällig</span></div>`;

    let list = ALL.filter(c => {
      const cd = state.cards[c.id];
      if (pk !== 'all' && c.packId !== pk) return false;
      if (st === 'new') { if (cd && cd.seen > 0) return false; }
      else if (!cd || cd.seen === 0) return false;
      if (st === 'due' && !(cd.due <= now)) return false;
      if (st === 'learning' && !(cd.strength < 4)) return false;
      if (st === 'strong' && !(cd.strength >= 4)) return false;
      if (q) {
        const hay = SRS.normalize(c.de + ' ' + (c.es || '') + ' ' + (c.en || ''));
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    list = list.sort((a, b) => {
      const ca = state.cards[a.id] || { due: Infinity }, cb = state.cards[b.id] || { due: Infinity };
      return (ca.due || 0) - (cb.due || 0);
    }).slice(0, 400);

    $('journal-list').innerHTML = list.length ? list.map(c => {
      const cd = state.cards[c.id] || SRS.newCard();
      const t = state.settings.lang === 'en' ? (c.en || c.es) : (c.es || c.en);
      return `<div class="jitem">
        <span class="jspk" data-say="${esc(c.de)}">🔊</span>
        <div class="jde"><b>${esc(c.de)}</b><span>${esc(t)}</span></div>
        <div class="strength">${[0,1,2,3,4].map(i => `<i class="${cd.strength > i ? 'on' : ''}"></i>`).join('')}</div>
        <div class="jdue">${cd.seen ? SRS.dueIn(cd) : 'neu'}</div>
      </div>`;
    }).join('') : '<p style="padding:24px;text-align:center;color:#8fa3bd">Nichts gefunden.</p>';

    $('journal-list').querySelectorAll('[data-say]').forEach(el => el.onclick = () => Speech.say(el.dataset.say, { force: true }));
  }

  /* ============================================================
     World map
     ============================================================ */
  function openMap() {
    const strong = strongCount();
    $('worldmap').innerHTML = REGIONS.map(r => {
      const unlocked = state.profile.unlocked.includes(r.id);
      const packChunks = r.packs.flatMap(pid => (pack(pid) ? pack(pid).chunks : []));
      const done = packChunks.filter(c => (state.cards[c.id] || {}).strength >= 2).length;
      return `<div class="wm-node ${unlocked ? '' : 'locked'}" data-r="${r.id}">
        <span class="ico">${unlocked ? r.icon : '🔒'}</span>
        <div class="info"><b>${esc(r.name)}</b><span>${unlocked ? esc(r.desc) : `Necesitas ${r.unlockAt} expresiones dominadas (tienes ${strong})`}</span></div>
        <span class="prog">${unlocked ? done + '/' + packChunks.length : ''}</span>
      </div>`;
    }).join('');
    $('worldmap').querySelectorAll('.wm-node').forEach(el => {
      el.onclick = () => {
        if (el.classList.contains('locked')) { SFX.bad(); return; }
        enterRegion(el.dataset.r); show('screen-world');
      };
    });
    show('screen-map');
  }

  /* ============================================================
     Settings
     ============================================================ */
  function openSettings() {
    $('set-lang').value = state.settings.lang;
    $('set-tts').checked = state.settings.tts !== false;
    $('set-sfx').checked = state.settings.sfx !== false;
    $('set-rate').value = state.settings.rate || .85;
    $('set-newper').value = state.settings.newPer || 6;
    $('set-key').value = localStorage.getItem('gq_key') || '';
    $('set-model').value = state.settings.model || 'claude-opus-5';
    show('screen-settings');
  }
  function bindSettings() {
    $('set-lang').onchange = e => { state.settings.lang = e.target.value; save(); };
    $('set-tts').onchange = e => { state.settings.tts = e.target.checked; save(); };
    $('set-sfx').onchange = e => { state.settings.sfx = e.target.checked; save(); };
    $('set-rate').oninput = e => { state.settings.rate = +e.target.value; save(); };
    $('set-newper').onchange = e => { state.settings.newPer = Math.max(3, Math.min(12, +e.target.value || 6)); save(); };
    $('set-model').onchange = e => { state.settings.model = e.target.value; save(); };
    $('set-key').onchange = e => {
      const v = e.target.value.trim();
      if (v) localStorage.setItem('gq_key', v); else localStorage.removeItem('gq_key');
      toast(v ? '🔑 API key gespeichert (nur lokal).' : 'API key entfernt.');
    };
  }

  /* ============================================================
     Review session (the 🔁 button)
     ============================================================ */
  function reviewSession() {
    const due = dueChunks();
    if (due.length < 1) {
      const known = knownChunks();
      if (!known.length) { toast('Lerne zuerst etwas bei einem Lehrer.'); return; }
      const weak = known.sort((a, b) => state.cards[a.id].strength - state.cards[b.id].strength).slice(0, 10);
      Battle.start({ title: 'Freies Training', face: '🎯', chunks: weak, max: 10 });
      return;
    }
    const picked = shuffle(due).slice(0, 12);
    Meta.progress('review', picked.length);
    Battle.start({ title: 'Wiederholung', face: '🔁', chunks: picked, max: 12 });
  }

  /* ============================================================
     Boot
     ============================================================ */
  function startGame(cont) {
    state = (cont && load()) || fresh();
    checkStreak();
    applyTranslations();
    ctx = $('game').getContext('2d');
    ctx.imageSmoothingEnabled = false;
    enterRegion(state.profile.region || 'dorf');
    unlockCheck();
    show('screen-world');
    if (!running) { running = true; loop(); }
    save();

    if (!cont) {
      setTimeout(() => Dialogue.show('Die Eule', '🦉', [
        { de: 'Willkommen! Die Wörter dieser Welt sind verschwunden.', tr: '¡Bienvenido! Las palabras de este mundo han desaparecido.' },
        { de: 'Sprich mit den Leuten. Lerne ihre Sätze. Kämpfe mit dem, was du kannst.', tr: 'Habla con la gente. Aprende sus frases. Lucha con lo que sepas.' },
        { de: 'Bewege dich mit WASD oder den Pfeilen. Drück ESPACIO zum Reden.', tr: 'Muévete con WASD o las flechas. Pulsa ESPACIO para hablar.' }
      ]), 500);
    }
  }

  /* ---------------- input ---------------- */
  const KEYMAP = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right'
  };

  function bindInput() {
    addEventListener('keydown', e => {
      const inField = /input|textarea|select/i.test((e.target.tagName || ''));
      if (KEYMAP[e.code] && !inField) { keys[KEYMAP[e.code]] = true; e.preventDefault(); }

      if (e.code === 'Space' || e.code === 'Enter') {
        if (inField) return;
        e.preventDefault();
        if ($('screen-battle').classList.contains('active')) { Battle.submit(); return; }
        if ($('screen-lesson').classList.contains('active')) { lessonNext(); return; }
        if ($('screen-world').classList.contains('active') && !document.querySelector('.screen.modal.active')) interact();
        return;
      }
      if (e.code === 'Escape') {
        if (Dialogue.open) { Dialogue.close(); return; }
        const m = document.querySelector('.screen.modal.active');
        if (m) {
          if (m.id === 'screen-chat') AI.close();
          else if (m.id === 'screen-lesson') lessonClose();
          else show('screen-world');
        }
        return;
      }
      // Tab peeks at the Spanish. Deliberately not a letter: it has to work
      // while you are mid-word in the chat or an answer box.
      if (e.code === 'Tab') {
        e.preventDefault();
        // Hovering a German word? Translate just that word. Otherwise fall
        // back to showing/hiding the whole line.
        if (!Lookup.peekAtPointer()) toggleTranslations();
        return;
      }

      if (inField) return;

      // Panel shortcuts only on the overworld — otherwise J during a battle
      // would throw the journal over the question you are answering.
      const busy = Dialogue.open
        || document.querySelector('.screen.modal.active')
        || $('screen-battle').classList.contains('active')
        || !$('screen-world').classList.contains('active');
      if (busy) return;

      if (e.code === 'KeyJ') openJournal();
      if (e.code === 'KeyR') reviewSession();
      if (e.code === 'KeyM') openMap();
      if (e.code === 'KeyX') Meta.open('dex');   // NOT KeyD — that walks right
      if (e.code === 'KeyQ') Meta.open('quests');
    });

    // meta tab switching
    document.getElementById('meta-tabs').addEventListener('click', e => {
      const b = e.target.closest('button[data-tab]');
      if (!b) return;
      Meta.tab = b.dataset.tab; Meta.render(); SFX.blip();
    });
    addEventListener('keyup', e => { if (KEYMAP[e.code]) keys[KEYMAP[e.code]] = false; });
    addEventListener('blur', () => { keys.up = keys.down = keys.left = keys.right = false; });

    // touch dpad
    $('dpad').querySelectorAll('button').forEach(b => {
      const d = b.dataset.dir;
      const on = e => { e.preventDefault(); if (d === 'act') { interact(); } else keys[d] = true; };
      const off = e => { e.preventDefault(); if (d !== 'act') keys[d] = false; };
      b.addEventListener('touchstart', on, { passive: false });
      b.addEventListener('touchend', off, { passive: false });
      b.addEventListener('touchcancel', off, { passive: false });
      b.addEventListener('mousedown', on);
      b.addEventListener('mouseup', off);
      b.addEventListener('mouseleave', off);
    });

    // canvas tap → walk toward / interact
    $('game').addEventListener('click', () => { if (!Dialogue.open) interact(); });
    // Tapping the box advances it — but not when the tap landed on a control
    // inside it, or peeking at the translation would skip the line instead.
    $('dialogue').addEventListener('click', e => {
      if (e.target.closest('.dlg-choices') || e.target.closest('[data-act]')) return;
      Dialogue.advance();
    });

    document.body.addEventListener('click', e => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const a = b.dataset.act;
      const acts = {
        start: () => { if (hasSave() && !confirm('Ya hay una partida guardada. ¿Empezar de nuevo y borrarla?')) return; localStorage.removeItem(SAVE_KEY); startGame(false); },
        continue: () => { if (!hasSave()) { toast('Keine Speicherung gefunden.'); return; } startGame(true); },
        peek: toggleTranslations,
        settings: openSettings,
        journal: openJournal,
        review: reviewSession,
        map: openMap,
        dex: () => Meta.open('dex'),
        quests: () => Meta.open('quests'),
        shop: () => Meta.open('shop'),
        badges: () => Meta.open('badges'),
        'close-meta': () => show('screen-world'),
        'catch-ok': () => { $('catch-modal').classList.add('hidden'); Meta.checkBadges(); },
        title: () => { save(); show('screen-title'); refreshTitle(); },
        'close-lesson': lessonClose,
        'close-journal': () => show('screen-world'),
        'close-chat': () => AI.close(),
        'close-map': () => show('screen-world'),
        'close-settings': () => show(state ? 'screen-world' : 'screen-title'),
        'lesson-next': lessonNext,
        'lesson-prev': lessonPrev,
        'lesson-again': lessonAgain,
        'q-submit': () => Battle.submit(),
        'q-hint': () => Battle.hint(),
        'q-audio': () => Battle.playAudio(),
        'chat-send': () => AI.send(),
        'chat-mic': () => AI.mic(),
        reset: () => { if (confirm('¿Seguro? Se borrará TODO tu progreso.')) { localStorage.removeItem(SAVE_KEY); location.reload(); } },
        export: () => {
          const blob = new Blob([JSON.stringify(state)], { type: 'application/json' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob); a.download = 'sprachquest-save.json'; a.click();
        },
        import: () => {
          const i = document.createElement('input'); i.type = 'file'; i.accept = '.json';
          i.onchange = () => { const f = i.files[0]; if (!f) return; const r = new FileReader();
            r.onload = () => { try { localStorage.setItem(SAVE_KEY, r.result); location.reload(); } catch (e) { toast('Datei ungültig.'); } };
            r.readAsText(f); };
          i.click();
        }
      };
      if (acts[a]) { e.preventDefault(); acts[a](); }
    });

    $('chat-text').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); AI.send(); } });
  }

  function refreshTitle() {
    const n = ALL.length;
    const s = load();
    $('title-stats').innerHTML = s
      ? `Lv ${s.profile.level} · ${Object.values(s.cards || {}).filter(c => c.seen > 0).length} Ausdrücke gelernt · 🔥 ${s.profile.streak}`
      : `${n} Ausdrücke · ${(DATA.lemmas || []).length || 1000} Wörter warten auf dich`;
    document.querySelector('[data-act="continue"]').disabled = !s;
  }

  /* ---------------- init ---------------- */
  addEventListener('DOMContentLoaded', () => {
    state = load() || fresh();     // settings available before "start"
    bindInput(); bindSettings(); applyTranslations();
    refreshTitle();
    if (!ALL.length) {
      $('title-stats').innerHTML = '<span style="color:#ff6b6b">⚠️ data/chunks.js ist leer — führe <code>node build.js</code> aus.</span>';
    }
  });

  return {
    get state() { return state; },
    show, toast, card, allChunks, knownChunks, dueChunks, pack, chunk,
    addXp, updateHud, save, enterRegion, interact, Dialogue,
    lemmasKnown, lemmaTotal
  };
})();
