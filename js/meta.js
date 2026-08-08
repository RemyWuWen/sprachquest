/* ============================================================
   meta.js — Wörterdex, party perks, daily quests, shop, badges
   ------------------------------------------------------------
   The learning engine (srs/battle) is what makes the German stick.
   This file is what makes you come back tomorrow:

   • COLLECTION with variable rewards — Wortgeister are caught, not
     bought. Rarity + a shiny roll makes every wild encounter a
     lottery ticket, and an unpredictable reward schedule sustains
     engagement far better than a fixed one.
   • PARTY PERKS — the collection feeds back into play, so catching
     is not just a checklist.
   • DAILY QUESTS + STREAK — a streak's real reward is its own
     continuity; loss aversion does the rest. The freeze item exists
     so one bad day doesn't destroy months of momentum (a broken
     streak is where most people quit for good).
   • SHOP — a sink for coins so the rewards mean something.
   ============================================================ */

const Meta = (() => {
  /* The player's day, not UTC's. On UTC the day rolled over at 02:00 in Spain,
     so a late-night session counted as tomorrow and broke the streak it should
     have extended. */
  const localDay = (d) => {
    d = d || new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  };

  /* ================= Wortgeister ================= */
  // perk: xp | coin | hint | shield | heal | crit
  const SPECIES = [
    // --- dorf ---
    { id: 'wichtel',   name: 'Wortwichtel',   face: '👻', region: 'dorf',    rarity: 'common', perk: { t: 'xp',    v: .08 }, flavor: 'Roba palabras de los bolsillos. Devuelve las que ya sabes.' },
    { id: 'gruesser',  name: 'Grüßgeist',     face: '🫧', region: 'dorf',    rarity: 'common', perk: { t: 'coin',  v: .10 }, flavor: 'Saluda a todo el mundo. A todo el mundo. Todo el rato.' },
    { id: 'eulchen',   name: 'Eulchen',       face: '🦉', region: 'dorf',    rarity: 'rare',   perk: { t: 'hint',  v: 1   }, flavor: 'Sabe la respuesta. A veces la susurra.' },
    { id: 'buchdrache',name: 'Buchdrache',    face: '🐲', region: 'dorf',    rarity: 'legend', perk: { t: 'xp',    v: .25 }, flavor: 'Duerme sobre un diccionario. Ronca en dativo.' },
    // --- markt ---
    { id: 'brezelkeks',name: 'Brezelbeißer',  face: '🥨', region: 'markt',   rarity: 'common', perk: { t: 'heal',  v: 12  }, flavor: 'Se come tus errores. Literalmente.' },
    { id: 'muenzgeist',name: 'Münzgeist',     face: '🪙', region: 'markt',   rarity: 'common', perk: { t: 'coin',  v: .18 }, flavor: 'Tintinea cuando aciertas.' },
    { id: 'kaffeekobold',name:'Kaffeekobold', face: '☕', region: 'markt',   rarity: 'rare',   perk: { t: 'crit',  v: .10 }, flavor: 'No ha dormido desde 1998.' },
    { id: 'marktdrache',name:'Marktdrache',   face: '🐉', region: 'markt',   rarity: 'legend', perk: { t: 'coin',  v: .40 }, flavor: 'Regatea en seis casos gramaticales.' },
    // --- viertel ---
    { id: 'sockenmonster',name:'Sockenmonster',face:'🧦', region: 'viertel', rarity: 'common', perk: { t: 'xp',    v: .10 }, flavor: 'Vive detrás de la lavadora. Habla en plural.' },
    { id: 'staubfee',  name: 'Staubfee',      face: '🪶', region: 'viertel', rarity: 'common', perk: { t: 'heal',  v: 15  }, flavor: 'Ordena tu vocabulario mientras duermes.' },
    { id: 'omakatze',  name: 'Omakatze',      face: '🐈', region: 'viertel', rarity: 'rare',   perk: { t: 'shield',v: 1   }, flavor: 'Te perdona un fallo. Solo uno. Y te juzga.' },
    { id: 'hausgeist', name: 'Hausgeist',     face: '🏚️', region: 'viertel', rarity: 'legend', perk: { t: 'shield',v: 2   }, flavor: 'Lleva 400 años en la misma casa. Sabe todos los verbos separables.' },
    // --- stadt ---
    { id: 'bahnbiest', name: 'Bahnbiest',     face: '🚃', region: 'stadt',   rarity: 'common', perk: { t: 'xp',    v: .12 }, flavor: 'Siempre llega con seis minutos de retraso.' },
    { id: 'ampelgeist',name: 'Ampelgeist',    face: '🚦', region: 'stadt',   rarity: 'common', perk: { t: 'crit',  v: .06 }, flavor: 'Nunca cruza en rojo. Jamás.' },
    { id: 'aktenwurm', name: 'Aktenwurm',     face: '🐛', region: 'stadt',   rarity: 'rare',   perk: { t: 'coin',  v: .25 }, flavor: 'Necesita un formulario para todo. Incluso para esto.' },
    { id: 'turmfalke', name: 'Turmfalke',     face: '🦅', region: 'stadt',   rarity: 'legend', perk: { t: 'crit',  v: .18 }, flavor: 'Ve un error de caso desde 300 metros.' },
    // --- park ---
    { id: 'moosling',  name: 'Moosling',      face: '🍄', region: 'park',    rarity: 'common', perk: { t: 'heal',  v: 18  }, flavor: 'Huele a bosque después de la lluvia.' },
    { id: 'nebelhase', name: 'Nebelhase',     face: '🐇', region: 'park',    rarity: 'common', perk: { t: 'hint',  v: 1   }, flavor: 'Aparece con la niebla, desaparece con las dudas.' },
    { id: 'wetterfrosch',name:'Wetterfrosch', face: '🐸', region: 'park',    rarity: 'rare',   perk: { t: 'xp',    v: .18 }, flavor: 'Predice el tiempo. Y tus fallos.' },
    { id: 'sturmgeist',name: 'Sturmgeist',    face: '🌪️', region: 'park',    rarity: 'legend', perk: { t: 'heal',  v: 40  }, flavor: 'Grita en alemán. Es más claro de lo que esperabas.' },
    // --- turm ---
    { id: 'kommafresser',name:'Kommafresser', face: '✂️', region: 'turm',    rarity: 'common', perk: { t: 'crit',  v: .08 }, flavor: 'Se come las comas. Los alemanes lo odian.' },
    { id: 'weilwesen', name: 'Weilwesen',     face: '🔗', region: 'turm',    rarity: 'rare',   perk: { t: 'xp',    v: .20 }, flavor: 'Manda el verbo al final. Siempre.' },
    { id: 'satzschlange',name:'Satzschlange', face: '🐍', region: 'turm',    rarity: 'rare',   perk: { t: 'shield',v: 1   }, flavor: 'Su cuerpo es una sola frase subordinada.' },
    { id: 'sprachkoenigin',name:'Sprachkönigin',face:'👑',region: 'turm',    rarity: 'legend', perk: { t: 'xp',    v: .35 }, flavor: 'Habla los mil idiomas de este mundo. Empezó con mil palabras.' },
  ];

  const RARITY = {
    common: { w: 70, label: 'Häufig',   color: '#8fa3bd', catch: .55, coins: 8  },
    rare:   { w: 25, label: 'Selten',   color: '#5ab8ff', catch: .75, coins: 22 },
    legend: { w: 5,  label: 'Legendär', color: '#ffcf4d', catch: .90, coins: 60 }
  };
  const SHINY_ODDS = 1 / 32;

  const byId = id => SPECIES.find(s => s.id === id);
  const forRegion = r => SPECIES.filter(s => s.region === r);

  /** weighted pick of which spirit shows up in the grass */
  function rollWild(regionId) {
    const pool = forRegion(regionId);
    if (!pool.length) return SPECIES[0];
    const total = pool.reduce((a, s) => a + RARITY[s.rarity].w, 0);
    let r = Math.random() * total;
    for (const s of pool) { r -= RARITY[s.rarity].w; if (r <= 0) return s; }
    return pool[0];
  }

  const dex = () => (Game.state.dex = Game.state.dex || {});
  const caught = id => !!dex()[id];
  const caughtCount = () => Object.keys(dex()).length;

  /**
   * Catching is earned, not random: accuracy has to clear the bar for
   * that rarity. The *shiny* roll is the variable-ratio hook on top.
   */
  function tryCatch(species, accuracy) {
    const need = RARITY[species.rarity].catch;
    if (accuracy < need) return { ok: false, need };
    const shiny = Math.random() < SHINY_ODDS;
    const had = dex()[species.id];
    if (!had || (shiny && !had.shiny)) {
      dex()[species.id] = { shiny: shiny || (had && had.shiny) || false, at: Date.now(), n: (had ? had.n : 0) + 1 };
    } else {
      had.n++;
    }
    return { ok: true, shiny, isNew: !had };
  }

  /* ================= party ================= */
  const party = () => (Game.state.party = Game.state.party || []);
  const PARTY_MAX = 3;

  function toggleParty(id) {
    const p = party();
    const i = p.indexOf(id);
    if (i >= 0) { p.splice(i, 1); return 'removed'; }
    if (p.length >= PARTY_MAX) return 'full';
    if (!caught(id)) return 'locked';
    p.push(id);
    return 'added';
  }

  /** summed perks of the active party (shiny counts double) */
  function perks() {
    const out = { xp: 0, coin: 0, hint: 0, shield: 0, heal: 0, crit: 0 };
    party().forEach(id => {
      const s = byId(id); if (!s) return;
      const mult = (dex()[id] && dex()[id].shiny) ? 2 : 1;
      out[s.perk.t] += s.perk.v * mult;
    });
    out.hint = Math.floor(out.hint);
    out.shield = Math.floor(out.shield);
    return out;
  }

  /* ================= daily quests ================= */
  const QUEST_POOL = [
    { id: 'learn',  text: n => `Lerne ${n} neue Ausdrücke`,        target: () => 6,  coins: 25, xp: 40 },
    { id: 'win',    text: n => `Gewinne ${n} Kämpfe`,              target: () => 3,  coins: 30, xp: 50 },
    { id: 'combo',  text: n => `Erreiche eine ${n}er-Serie`,       target: () => 8,  coins: 35, xp: 60 },
    { id: 'review', text: n => `Wiederhole ${n} fällige Ausdrücke`,target: () => 15, coins: 30, xp: 50 },
    { id: 'catch',  text: n => `Fange ${n} Wortgeister`,           target: () => 2,  coins: 40, xp: 45 },
    { id: 'perfect',text: n => `Gewinne ${n} Kampf ohne Fehler`,   target: () => 1,  coins: 45, xp: 70 },
    { id: 'speak',  text: n => `Benutze ${n} Ausdrücke im Gespräch`,target: () => 3, coins: 50, xp: 80 },
  ];

  const today = () => localDay();

  function quests() {
    const s = Game.state;
    if (!s.quests || s.quests.day !== today()) {
      // deterministic per day so it doesn't reroll on refresh
      const seed = today().split('-').join('') | 0;
      const pool = QUEST_POOL.slice();
      const picked = [];
      for (let i = 0; i < 3 && pool.length; i++) {
        const idx = (seed * (i + 7) + i * 13) % pool.length;
        picked.push(pool.splice(idx, 1)[0]);
      }
      s.quests = {
        day: today(),
        list: picked.map(q => ({ id: q.id, n: 0, goal: q.target(), done: false, claimed: false })),
        chest: false
      };
    }
    return s.quests;
  }

  const questDef = id => QUEST_POOL.find(q => q.id === id);

  /** called from anywhere progress happens */
  function progress(id, amount) {
    const q = quests().list.find(x => x.id === id);
    if (!q || q.done) return;
    q.n = id === 'combo' ? Math.max(q.n, amount || 1) : q.n + (amount || 1);
    if (q.n >= q.goal) {
      q.done = true;
      const d = questDef(id);
      FX.banner('AUFGABE ERFÜLLT', d.text(q.goal), 'gold');
      SFX.levelup();
      Game.toast(`✅ ${d.text(q.goal)} — hol dir die Belohnung!`);
    }
    Game.save();
  }

  function claim(id) {
    const q = quests().list.find(x => x.id === id);
    const d = questDef(id);
    if (!q || !q.done || q.claimed) return;
    q.claimed = true;
    addCoins(d.coins);
    Game.addXp(d.xp);
    FX.confetti(24);
    SFX.win();
    Game.toast(`+${d.coins} 🪙  +${d.xp} XP`);
    // all three done → daily chest with a variable reward
    if (quests().list.every(x => x.claimed) && !quests().chest) {
      quests().chest = true;
      const roll = Math.random();
      const bonus = roll < .05 ? 200 : roll < .25 ? 100 : 50;
      addCoins(bonus);
      FX.banner('TAGESTRUHE', `+${bonus} 🪙`, 'gold');
      FX.confetti(60);
      Game.toast(`🎁 Alle Aufgaben erledigt! Bonus: +${bonus} 🪙`);
    }
    checkBadges();
    Game.save();
    render();
  }

  /* ================= coins & shop ================= */
  const coins = () => Game.state.profile.coins || 0;
  function addCoins(n) {
    const p = Game.state.profile;
    p.coins = (p.coins || 0) + Math.max(0, Math.round(n));
    Game.updateHud();
  }
  function spend(n) {
    const p = Game.state.profile;
    if ((p.coins || 0) < n) return false;
    p.coins -= n; Game.updateHud(); Game.save(); return true;
  }

  const ITEMS = [
    { id: 'trank',  name: 'Heiltrank',      face: '🧪', cost: 40,  desc: 'Restaura 50 de energía al instante.', use: 'inv' },
    { id: 'grosstrank', name: 'Großer Trank',face: '⚗️', cost: 90,  desc: 'Restaura toda la energía.',           use: 'inv' },
    { id: 'schutz', name: 'Streak-Schutz',  face: '🛡️', cost: 120, desc: 'Salva tu racha un día que no juegues.', use: 'inv' },
    { id: 'tipp',   name: 'Tipp-Marke',     face: '💡', cost: 25,  desc: 'Una pista gratis que no baja la nota.', use: 'inv' },
    { id: 'koeder', name: 'Geister-Köder',  face: '🍬', cost: 75,  desc: 'Duplica los encuentros durante 20 pasos.', use: 'inv' },
    { id: 'glueck', name: 'Glücksklee',     face: '🍀', cost: 150, desc: 'Triplica la probabilidad de shiny en 10 encuentros.', use: 'inv' },
  ];

  const inv = () => (Game.state.inv = Game.state.inv || {});
  const itemDef = id => ITEMS.find(i => i.id === id);
  const has = id => (inv()[id] || 0) > 0;

  function buy(id) {
    const it = itemDef(id);
    if (!it) return;
    if (!spend(it.cost)) { SFX.bad(); Game.toast('Nicht genug Münzen.'); return; }
    inv()[id] = (inv()[id] || 0) + 1;
    SFX.good(); FX.burst('#shop-coins', ['#ffcf4d'], 10);
    Game.toast(`${it.face} ${it.name} gekauft!`);
    Game.save(); render();
  }

  function use(id) {
    if (!has(id)) return;
    const p = Game.state.profile;
    if (id === 'trank')      { p.hp = Math.min(p.maxHp, p.hp + 50); }
    else if (id === 'grosstrank') { p.hp = p.maxHp; }
    else if (id === 'koeder') { Game.state.buff = Object.assign(Game.state.buff || {}, { lure: 20 }); }
    else if (id === 'glueck') { Game.state.buff = Object.assign(Game.state.buff || {}, { luck: 10 }); }
    else if (id === 'schutz') { Game.toast('Der Schutz wirkt automatisch, wenn du einen Tag verpasst.'); return; }
    else if (id === 'tipp')   { Game.toast('Benutz die Marke im Kampf mit 💡.'); return; }
    inv()[id]--;
    SFX.good(); Game.updateHud(); Game.save(); render();
    Game.toast(`${itemDef(id).face} benutzt!`);
  }

  /* ================= badges ================= */
  const BADGES = [
    { id: 'first',    face: '🌱', name: 'Erste Worte',      desc: 'Aprende tus primeras 10 expresiones.',  test: s => knownN() >= 10 },
    { id: 'hundert',  face: '💯', name: 'Hundert',          desc: 'Aprende 100 expresiones.',              test: s => knownN() >= 100 },
    { id: 'halb',     face: '🎯', name: 'Halbzeit',         desc: 'Descubre 500 de las 1000 palabras.',    test: s => Game.lemmasKnown() >= 500 },
    { id: 'tausend',  face: '🏆', name: 'Tausend Wörter',   desc: 'Descubre las 1000 palabras.',           test: s => Game.lemmasKnown() >= Game.lemmaTotal() },
    { id: 'woche',    face: '🔥', name: 'Eine Woche',       desc: 'Racha de 7 días.',                      test: s => s.profile.streak >= 7 },
    { id: 'monat',    face: '☄️', name: 'Ein Monat',        desc: 'Racha de 30 días.',                     test: s => s.profile.streak >= 30 },
    { id: 'combo20',  face: '⚡', name: 'Blitzserie',       desc: 'Consigue una serie de 20 aciertos.',    test: s => (s.profile.bestCombo || 0) >= 20 },
    { id: 'sammler',  face: '📕', name: 'Sammler',          desc: 'Captura 8 Wortgeister.',                test: s => caughtCount() >= 8 },
    { id: 'dexvoll',  face: '👑', name: 'Wörterdex komplett',desc: 'Captura los 24 Wortgeister.',          test: s => caughtCount() >= SPECIES.length },
    { id: 'shiny',    face: '✨', name: 'Schillernd',       desc: 'Captura un Wortgeist shiny.',           test: s => Object.values(dex()).some(d => d.shiny) },
    { id: 'redner',   face: '💬', name: 'Redner',           desc: 'Vence a tu primer jefe hablando.',      test: s => (s.profile.bosses || []).length >= 1 },
    { id: 'meister',  face: '🎓', name: 'Sprachmeister',    desc: 'Vence a los 6 jefes.',                  test: s => (s.profile.bosses || []).length >= 6 },
    { id: 'reich',    face: '💰', name: 'Reich',            desc: 'Acumula 500 monedas.',                  test: s => (s.profile.coins || 0) >= 500 },
    { id: 'gefestigt',face: '🧠', name: 'Im Langzeitgedächtnis', desc: '200 expresiones consolidadas.',    test: s => strongN() >= 200 },
  ];

  const knownN = () => Game.knownChunks().length;
  const strongN = () => Game.allChunks().filter(c => (Game.state.cards[c.id] || {}).strength >= 4).length;
  const badges = () => (Game.state.badges = Game.state.badges || {});

  function checkBadges() {
    let got = null;
    BADGES.forEach(b => {
      if (badges()[b.id]) return;
      let ok = false;
      try { ok = b.test(Game.state); } catch (e) { ok = false; }
      if (ok) { badges()[b.id] = Date.now(); got = b; }
    });
    if (got) {
      FX.banner('ABZEICHEN!', got.face + ' ' + got.name, 'gold');
      FX.confetti(40);
      SFX.levelup();
      Game.save();
    }
  }

  /* ================= streak with freeze ================= */
  function rollStreak() {
    const p = Game.state.profile;
    const t = today();
    if (p.lastDay === t) return;
    const y = localDay(new Date(Date.now() - 864e5));   // yesterday, locally
    if (p.lastDay === y || !p.lastDay) {
      p.streak = (p.lastDay ? p.streak : 0) + 1;
    } else if (has('schutz')) {
      inv().schutz--;
      p.streak++;
      Game.toast('🛡️ Streak-Schutz benutzt — deine Serie lebt weiter!', 4000);
    } else {
      if (p.streak > 2) Game.toast(`💔 Serie verloren (${p.streak} Tage). Neustart!`, 4000);
      p.streak = 1;
    }
    p.lastDay = t;
    if (p.streak > 1) {
      FX.banner('🔥 ' + p.streak, 'Tage in Folge', 'gold');
      addCoins(5 + Math.min(25, p.streak));
    }
    Game.save();
  }

  /* ================= UI ================= */
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let tab = 'dex';

  function open(which) {
    tab = which || tab;
    Game.show('screen-meta');
    render();
  }

  function render() {
    if (!$('screen-meta') || !$('screen-meta').classList.contains('active')) return;
    $('meta-coins').textContent = '🪙 ' + coins();
    document.querySelectorAll('#meta-tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    const body = $('meta-body');
    body.className = 'meta-body tab-' + tab;
    body.innerHTML = ({ dex: renderDex, quests: renderQuests, shop: renderShop, badges: renderBadges }[tab] || renderDex)();
    wire();
  }

  function renderDex() {
    const p = party();
    const pk = perks();
    const perkLine = Object.entries(pk).filter(([, v]) => v > 0)
      .map(([k, v]) => ({ xp: `+${Math.round(v * 100)}% XP`, coin: `+${Math.round(v * 100)}% 🪙`, crit: `+${Math.round(v * 100)}% Krit`, hint: `${v} Gratis-Tipp`, shield: `${v}× Schild`, heal: `+${v} HP nach dem Kampf` }[k]))
      .join(' · ') || 'Ningún efecto activo';

    return `<div class="meta-head">
        <b>${caughtCount()} / ${SPECIES.length}</b> Wortgeister gefangen
        <div class="party-line">Team (${p.length}/${PARTY_MAX}): ${perkLine}</div>
      </div>
      <div class="dex-grid">${SPECIES.map(s => {
        const c = dex()[s.id];
        const inParty = p.includes(s.id);
        const R = RARITY[s.rarity];
        if (!c) return `<div class="dexc locked"><span class="face">❔</span><b>???</b><span class="rar">${R.label}</span></div>`;
        return `<div class="dexc ${inParty ? 'inparty' : ''} ${c.shiny ? 'shiny' : ''}" data-dex="${s.id}">
          <span class="face">${s.face}</span>
          <b>${esc(s.name)}${c.shiny ? ' ✨' : ''}</b>
          <span class="rar" style="color:${R.color}">${R.label}${c.n > 1 ? ' ×' + c.n : ''}</span>
          <span class="flav">${esc(s.flavor)}</span>
          <span class="perk">${perkText(s.perk)}${c.shiny ? ' (×2)' : ''}</span>
          <em>${inParty ? '✓ im Team' : 'ins Team'}</em>
        </div>`;
      }).join('')}</div>`;
  }

  const perkText = p => ({ xp: `+${Math.round(p.v * 100)}% XP`, coin: `+${Math.round(p.v * 100)}% Münzen`, crit: `+${Math.round(p.v * 100)}% Krit-Chance`, hint: `${p.v} Gratis-Tipp pro Kampf`, shield: `${p.v}× Schild pro Kampf`, heal: `+${p.v} HP nach dem Kampf` }[p.t]);

  function renderQuests() {
    const q = quests();
    return `<div class="meta-head"><b>Tagesaufgaben</b><div class="party-line">Se renuevan cada día a medianoche. Completa las tres para la Tagestruhe.</div></div>
      <div class="quest-list">${q.list.map(x => {
        const d = questDef(x.id);
        const pct = Math.min(100, x.n / x.goal * 100);
        return `<div class="questc ${x.done ? 'done' : ''}">
          <div class="qinfo"><b>${esc(d.text(x.goal))}</b>
            <div class="qbar"><i style="width:${pct}%"></i></div>
            <span>${Math.min(x.n, x.goal)} / ${x.goal} · +${d.coins} 🪙 +${d.xp} XP</span></div>
          ${x.claimed ? '<span class="qdone">✓</span>'
            : x.done ? `<button class="btn primary sm" data-claim="${x.id}">Abholen</button>`
            : '<span class="qdone">…</span>'}
        </div>`;
      }).join('')}</div>
      <div class="chest ${q.chest ? 'open' : ''}">${q.chest ? '🎁 Tagestruhe geöffnet!' : '🎁 Tagestruhe — completa las 3 tareas'}</div>`;
  }

  function renderShop() {
    return `<div class="meta-head"><b>Laden</b><div class="party-line">Gana monedas luchando, cumpliendo tareas y manteniendo la racha.</div></div>
      <div class="shop-grid">${ITEMS.map(i => `
        <div class="shopc">
          <span class="face">${i.face}</span>
          <b>${esc(i.name)}</b>
          <span class="desc">${esc(i.desc)}</span>
          <span class="own">Tienes: ${inv()[i.id] || 0}</span>
          <div class="shop-btns">
            <button class="btn sm ${coins() < i.cost ? '' : 'primary'}" data-buy="${i.id}">${i.cost} 🪙</button>
            ${has(i.id) ? `<button class="btn ghost sm" data-use="${i.id}">Benutzen</button>` : ''}
          </div>
        </div>`).join('')}</div>`;
  }

  function renderBadges() {
    const b = badges();
    return `<div class="meta-head"><b>${Object.keys(b).length} / ${BADGES.length}</b> Abzeichen</div>
      <div class="badge-grid">${BADGES.map(x => `
        <div class="badgec ${b[x.id] ? 'got' : ''}">
          <span class="face">${b[x.id] ? x.face : '🔒'}</span>
          <b>${esc(x.name)}</b><span>${esc(x.desc)}</span>
        </div>`).join('')}</div>`;
  }

  function wire() {
    document.querySelectorAll('[data-dex]').forEach(el => el.onclick = () => {
      const r = toggleParty(el.dataset.dex);
      if (r === 'full') Game.toast(`Dein Team ist voll (${PARTY_MAX}). Nimm zuerst einen heraus.`);
      else SFX.blip();
      Game.save(); render();
    });
    document.querySelectorAll('[data-claim]').forEach(el => el.onclick = () => claim(el.dataset.claim));
    document.querySelectorAll('[data-buy]').forEach(el => el.onclick = () => buy(el.dataset.buy));
    document.querySelectorAll('[data-use]').forEach(el => el.onclick = () => use(el.dataset.use));
  }

  return {
    SPECIES, RARITY, ITEMS, BADGES, SHINY_ODDS,
    byId, forRegion, rollWild, tryCatch, caught, caughtCount, dex,
    party, perks, toggleParty,
    quests, progress, claim,
    coins, addCoins, spend, inv, has, use, itemDef,
    checkBadges, rollStreak,
    open, render, get tab() { return tab; }, set tab(v) { tab = v; }
  };
})();
