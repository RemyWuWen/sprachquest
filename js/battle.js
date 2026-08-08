/* ============================================================
   battle.js — retrieval practice engine ("Wortkampf")
   ------------------------------------------------------------
   Every question is a RETRIEVAL attempt, never a re-reading.
   The type of retrieval expands with the card's strength:

     recognize → listen → order → cloze → recall

   i.e. from "pick the meaning" up to "produce the whole chunk
   from scratch". That progression (expanding retrieval /
   desirable difficulty) is what moves a chunk into long-term
   memory instead of leaving it recognisable-but-unusable.
   ============================================================ */

const Battle = (() => {
  let S = null;

  const $ = id => document.getElementById(id);
  const TYPE_LABEL = {
    recognize: 'Bedeutung',
    listen: 'Hören',
    order: 'Satzbau',
    cloze: 'Lücke',
    recall: 'Produzieren',
    frame: 'Baukasten'
  };

  const words = de => de.replace(/_+/g, '___').split(/\s+/).filter(Boolean);

  /** Resolve a frame's ___ slot into a real example on BOTH sides, so the
      learner is never asked to guess which filler we had in mind. */
  function materialize(chunk) {
    if (!/_/.test(chunk.de)) return { de: chunk.de, tr: tr(chunk) };
    const f = (chunk.fillers && chunk.fillers.length)
      ? chunk.fillers[Math.floor(Math.random() * chunk.fillers.length)] : null;
    if (!f) return { de: chunk.de.replace(/\s*_+\s*/g, ' ').replace(/\s+([.,!?])/g, '$1').trim(), tr: tr(chunk).replace(/\s*_+\s*/g, ' ').replace(/\s+([.,!?])/g, '$1').trim() };
    const fes = Game.state.settings.lang === 'en' ? (f.en || f.es) : (f.es || f.en);
    return {
      de: chunk.de.replace(/_+/, f.de),
      tr: /_/.test(tr(chunk)) ? tr(chunk).replace(/_+/, fes) : `${tr(chunk).replace(/\s*_+\s*/g, ' ')} (${fes})`
    };
  }
  const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[b[i], b[j]] = [b[j], b[i]]; } return b; };
  const tr = c => Game.state.settings.lang === 'en' ? (c.en || c.es) : (c.es || c.en);

  /* ---------------- lifecycle ---------------- */

  function start(opts) {
    const chunks = opts.chunks.filter(Boolean);
    if (!chunks.length) { Game.toast('Nichts zu üben — sprich zuerst mit einem Lehrer!'); return; }
    const pk = Meta.perks();

    S = {
      title: opts.title || 'Wortkampf',
      face: opts.face || '👻',
      species: opts.species || null,     // wild spirits can be caught
      onWin: opts.onWin, onLose: opts.onLose,
      queue: chunks.slice(0, opts.max || 10),
      relearn: [],
      total: Math.min(chunks.length, opts.max || 10),
      done: 0, correct: 0, wrong: 0,
      foeMax: Math.min(chunks.length, opts.max || 10),
      foeHp: Math.min(chunks.length, opts.max || 10),
      q: null, answered: false, hintUsed: false, xp: 0, coins: 0,
      combo: 0, bestCombo: 0,
      perks: pk,
      freeHints: pk.hint || 0,
      shields: pk.shield || 0
    };

    $('foe-name').textContent = S.title;
    $('foe-art').textContent = S.face;
    setCombo(0);
    Game.show('screen-battle');
    next();
  }

  /* ---------------- combo ---------------- */
  const TIERS = [
    { n: 25, label: 'UNAUFHALTSAM!', mult: 3.0, color: '#ff4dd2' },
    { n: 15, label: 'IN FLAMMEN!',   mult: 2.5, color: '#ff6b6b' },
    { n: 10, label: 'STARK!',        mult: 2.0, color: '#ffcf4d' },
    { n: 5,  label: 'SERIE!',        mult: 1.5, color: '#5ab8ff' },
    { n: 0,  label: '',              mult: 1.0, color: '#8fa3bd' }
  ];
  const tier = n => TIERS.find(t => n >= t.n);

  function setCombo(n) {
    if (!S) return;
    const prev = S.combo;
    S.combo = n;
    S.bestCombo = Math.max(S.bestCombo, n);
    const el = $('combo');
    const t = tier(n);
    $('combo-n').textContent = n;
    $('combo-bar').style.background = t.color;
    el.style.setProperty('--c', t.color);
    el.classList.toggle('on', n >= 2);
    if (n >= 2) FX.pop('#combo');
    // announce each new tier exactly once
    if (n > prev && t.n > 0 && prev < t.n) {
      FX.banner(t.label, `${n}× Serie · ${t.mult}× XP`, 'gold');
      FX.confetti(t.n >= 15 ? 40 : 18);
      FX.shake(t.n >= 15 ? 10 : 6);
    }
    if (n > 0 && n % 5 === 0) Meta.progress('combo', n);
  }

  function next() {
    if (!S) return;
    S.answered = false; S.hintUsed = false;
    const fb = $('q-feedback');
    fb.classList.add('hidden'); fb.innerHTML = '';
    $('q-submit').textContent = 'Prüfen';

    
    if (S.foeHp <= 0) return finish(true);
    // Safety valve. HP already ends a bad run, but relearning re-queues
    // every miss, so cap the absolute number of questions too — comparing
    // against S.total would never fire, since a miss increments both.
    if (S.done >= S.foeMax * 4 + 12) return finish(false);

    // Pull a missed card back in once a couple of questions have passed.
    // If the main queue is empty we take the earliest pending one anyway —
    // otherwise you could "win" with items still unlearned.
    let chunk = null;
    const ready = S.relearn.find(r => r.at <= S.done);
    if (ready) { S.relearn.splice(S.relearn.indexOf(ready), 1); chunk = ready.chunk; }
    else if (S.queue.length) chunk = S.queue.shift();
    else if (S.relearn.length) chunk = S.relearn.shift().chunk;

    if (!chunk) return finish(true);

    const card = Game.card(chunk.id);
    let type = SRS.questionType(card, chunk);
    // order/cloze need enough words to be meaningful
    const n = words(chunk.de).length;
    if ((type === 'order') && n < 3) type = 'cloze';
    if ((type === 'cloze') && n < 2) type = 'recall';

    S.q = { chunk, card, type, correctIdx: -1, built: [], answer: '' };
    renderQuestion();
    updateBars();
  }

  function finish(won) {
    const s = S; S = null;
    if (!s) return;
    const acc = s.done ? s.correct / s.done : 0;
    const accPct = Math.round(acc * 100);
    const p = Game.state.profile;
    p.bestCombo = Math.max(p.bestCombo || 0, s.bestCombo);

    if (won) {
      const perfect = s.wrong === 0;
      const bonus = 15 + (perfect ? 40 : 0);
      const coins = Math.round((s.coins + 10 + (perfect ? 15 : 0)) * (1 + (s.perks.coin || 0)));

      SFX.win();
      FX.confetti(perfect ? 70 : 34);
      FX.banner(perfect ? 'MAKELLOS!' : 'GEWONNEN!', `${s.correct}/${s.done} · ${accPct}%`, 'gold');
      Game.addXp(s.xp + bonus);
      Meta.addCoins(coins);
      if (s.perks.heal) p.hp = Math.min(p.maxHp, p.hp + s.perks.heal);

      Meta.progress('win', 1);
      if (perfect) Meta.progress('perfect', 1);
      Game.toast(`${s.correct}/${s.done} richtig (${accPct}%) · +${s.xp + bonus} XP · +${coins} 🪙`);

      // a wild spirit can be caught — but only if you actually earned it
      if (s.species) {
        const r = Meta.tryCatch(s.species, acc);
        if (r.ok) { Meta.progress('catch', 1); setTimeout(() => showCatch(s.species, r), 700); }
        else setTimeout(() => Game.toast(`${s.species.face} ${s.species.name} ist entkommen! Du brauchst ${Math.round(r.need * 100)}% Treffer, du hattest ${accPct}%.`, 4200), 700);
      }
      if (s.onWin) s.onWin(s);
    } else {
      SFX.bad();
      FX.wash('rgba(120,0,0,.45)');
      Game.addXp(Math.floor(s.xp * .5));
      Game.toast(`${s.correct}/${s.done} richtig. Die schwierigen kommen wieder.`);
      if (s.onLose) s.onLose(s);
    }
    Meta.checkBadges();
    Game.save();
    Game.show('screen-world');
  }

  /** the catch reveal — the payoff moment of a wild encounter */
  function showCatch(sp, r) {
    const R = Meta.RARITY[sp.rarity];
    $('catch-face').textContent = sp.face;
    $('catch-name').textContent = (r.shiny ? '✨ ' : '') + sp.name + (r.shiny ? ' ✨' : '');
    $('catch-rar').textContent = R.label + (r.isNew ? ' · NEU!' : '');
    $('catch-rar').style.color = R.color;
    $('catch-flavor').textContent = sp.flavor;
    $('catch-perk').textContent = ({ xp: `+${Math.round(sp.perk.v * 100)}% XP`, coin: `+${Math.round(sp.perk.v * 100)}% Münzen`, crit: `+${Math.round(sp.perk.v * 100)}% Krit`, hint: `${sp.perk.v} Gratis-Tipp pro Kampf`, shield: `${sp.perk.v}× Schild pro Kampf`, heal: `+${sp.perk.v} HP nach dem Kampf` }[sp.perk.t]) + (r.shiny ? '  (×2 shiny!)' : '');
    const m = $('catch-modal');
    m.classList.remove('hidden');
    m.classList.toggle('shiny', !!r.shiny);
    SFX.levelup();
    FX.confetti(r.shiny ? 90 : 45);
    if (r.shiny) FX.banner('SHINY!!', 'Uno entre 32', 'gold');
  }

  function updateBars() {
    if (!S) return;
    $('foe-hp').style.width = Math.max(0, S.foeHp / S.foeMax * 100) + '%';
    const p = Game.state.profile;
    $('battle-hp').style.width = Math.max(0, p.hp / p.maxHp * 100) + '%';
    $('q-count').textContent = `${Math.min(S.done + 1, S.total)} / ${S.total}`;
  }

  /* ---------------- distractors ----------------
     A distractor must be wrong for the RIGHT reason. If the correct
     option is visibly the only short one, the learner picks it on
     shape alone and retrieves nothing. So candidates are ranked by
     same-pack (semantically close) and similar length, then sampled. */
  function distractors(chunk, n) {
    const wc = s => String(s || '').trim().split(/\s+/).length;
    const target = wc(tr(chunk));
    const seen = new Set([SRS.normalize(tr(chunk))]);

    const scored = Game.allChunks()
      .filter(c => c.id !== chunk.id && tr(c))
      .filter(c => {
        const k = SRS.normalize(tr(c));
        if (seen.has(k)) return false;
        seen.add(k); return true;
      })
      .map(c => ({
        c,
        score: (c.packId === chunk.packId ? 0 : 6) + Math.abs(wc(tr(c)) - target) * 2
      }))
      .sort((a, b) => a.score - b.score);

    // sample from the closest 30 so it is not the same four every time
    return shuffle(scored.slice(0, Math.max(n * 6, 30))).slice(0, n).map(x => x.c);
  }

  /* ---------------- rendering ---------------- */
  function renderQuestion() {
    const { chunk, type } = S.q;
    const body = $('q-body');
    body.innerHTML = '';
    $('q-type').textContent = TYPE_LABEL[type] || type;
    $('q-sub').textContent = '';

    if (type === 'recognize' || type === 'listen') {
      const opts = shuffle([chunk].concat(distractors(chunk, 3)));
      S.q.correctIdx = opts.findIndex(o => o.id === chunk.id);

      if (type === 'listen') {
        $('q-prompt').innerHTML = '<span style="font-size:44px">🔊</span>';
        $('q-sub').textContent = 'Hör zu. Was bedeutet es?';
        Speech.say(chunk.de);
      } else {
        $('q-prompt').textContent = chunk.de.replace(/_+/g, '___');
        $('q-sub').textContent = '¿Qué significa?';
        Speech.say(chunk.de);
      }

      const wrap = document.createElement('div');
      wrap.className = 'opts';
      opts.forEach((o, i) => {
        const b = document.createElement('button');
        b.textContent = tr(o);
        b.onclick = () => {
          if (S.answered) return;
          wrap.querySelectorAll('button').forEach(x => x.classList.remove('sel'));
          b.classList.add('sel'); S.q.answer = i; SFX.blip();
        };
        wrap.appendChild(b);
      });
      body.appendChild(wrap);

    } else if (type === 'order') {
      const m = materialize(chunk);
      S.q.expected = m.de;
      $('q-prompt').textContent = m.tr;
      $('q-sub').textContent = 'Bau den deutschen Satz.';
      const target = words(m.de);
      const build = document.createElement('div');
      build.className = 'build';
      build.innerHTML = '<span class="ph">Tippe die Wörter in der richtigen Reihenfolge…</span>';
      const bank = document.createElement('div');
      bank.className = 'bank';

      const redraw = () => {
        build.innerHTML = '';
        if (!S.q.built.length) build.innerHTML = '<span class="ph">Tippe die Wörter in der richtigen Reihenfolge…</span>';
        S.q.built.forEach((w, i) => {
          const b = document.createElement('button');
          b.textContent = w.t;
          b.onclick = () => {
            if (S.answered) return;
            S.q.built.splice(i, 1);
            bank.querySelectorAll('button')[w.k].classList.remove('used');
            redraw(); SFX.blip();
          };
          build.appendChild(b);
        });
        S.q.answer = S.q.built.map(w => w.t).join(' ');
      };

      shuffle(target.map((t, k) => ({ t, k }))).forEach((it, idx) => {
        const b = document.createElement('button');
        b.textContent = it.t;
        b.dataset.k = idx;
        b.onclick = () => {
          if (S.answered) return;
          b.classList.add('used');
          S.q.built.push({ t: it.t, k: idx });
          redraw(); SFX.blip();
        };
        bank.appendChild(b);
      });
      body.appendChild(build); body.appendChild(bank);

    } else if (type === 'cloze') {
      const m = materialize(chunk);
      const ws = words(m.de);
      // blank a content word when possible (longest word ≈ most informative)
      let bi = 0, bl = 0;
      ws.forEach((w, i) => { const L = w.replace(/[^\wäöüß]/gi, '').length; if (L > bl) { bl = L; bi = i; } });
      S.q.blankIdx = bi;
      S.q.expected = ws[bi].replace(/[.,!?;:]$/, '');
      S.q.full = m.de;
      $('q-prompt').innerHTML = ws.map((w, i) => i === bi ? '<span style="color:#ffcf4d">_____</span>' : esc(w)).join(' ');
      $('q-sub').textContent = m.tr;
      const inp = mkInput('Das fehlende Wort…');
      body.appendChild(inp);

    } else if (type === 'frame') {
      const f = (chunk.fillers && chunk.fillers.length) ? chunk.fillers[Math.floor(Math.random() * chunk.fillers.length)] : null;
      if (!f) { S.q.type = 'recall'; return renderQuestion(); }
      S.q.filler = f;
      S.q.expected = chunk.de.replace(/_+/, f.de);
      $('q-prompt').textContent = chunk.de.replace(/_+/g, '____');
      $('q-sub').textContent = `Sag: „${Game.state.settings.lang === 'en' ? (f.en || f.es) : f.es}"  →  füll die Lücke und schreib den ganzen Satz.`;
      const inp = mkInput('Ganzer Satz auf Deutsch…');
      body.appendChild(inp);

    } else { // recall
      const m = materialize(chunk);
      $('q-prompt').textContent = m.tr;
      $('q-sub').textContent = 'Schreib es auf Deutsch.';
      S.q.expected = m.de;
      const inp = mkInput('Auf Deutsch…');
      body.appendChild(inp);
    }
  }

  function mkInput(ph) {
    const i = document.createElement('input');
    i.className = 'answer-in'; i.id = 'q-input'; i.placeholder = ph;
    i.autocomplete = 'off'; i.autocapitalize = 'off'; i.spellcheck = false;
    i.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } };
    setTimeout(() => i.focus(), 60);
    return i;
  }

  /* ---------------- grading ---------------- */
  function submit() {
    if (!S) return;
    if (S.answered) return next();   // "Weiter" — S.done was counted at grading time

    const { chunk, type } = S.q;
    let res, shown = chunk.de;

    if (type === 'recognize' || type === 'listen') {
      if (S.q.answer === '' || S.q.answer === undefined || S.q.answer < 0) { Game.toast('Wähl eine Antwort.'); return; }
      const ok = S.q.answer === S.q.correctIdx;
      // MEANING = picked the wrong sense. Distinct from a grammar slip,
      // and worth logging separately in the learner's error profile.
      res = { ok, grade: ok ? 2 : 0, kind: ok ? 'EXACT' : 'MEANING',
              rule: ok ? '' : 'Esa no era la idea. Vuelve a mirar la frase entera.' };
      const btns = $('q-body').querySelectorAll('.opts button');
      btns.forEach((b, i) => { if (i === S.q.correctIdx) b.classList.add('good'); else if (i === S.q.answer && !ok) b.classList.add('bad'); });
    } else if (type === 'cloze') {
      const v = ($('q-input') || {}).value || '';
      if (!v.trim()) { Game.toast('Escribe algo primero.'); return; }
      res = SRS.check(v, S.q.expected);
      shown = S.q.full || S.q.expected;   // show the whole chunk, not the bare word
    } else if (type === 'order') {
      res = SRS.check(S.q.answer || '', S.q.expected || chunk.de);
      shown = S.q.expected || chunk.de;
    } else {
      const v = ($('q-input') || {}).value || '';
      if (!v.trim()) { Game.toast('Escribe algo primero.'); return; }
      res = SRS.check(v, S.q.expected);
      shown = S.q.expected;
    }

    if (S.hintUsed && res.ok && res.grade > 1) res.grade = 1;

    S.answered = true;
    S.done++;
    const card = Game.card(chunk.id);
    // "Produced" means: generated the German from scratch, unaided. Picking
    // it out of four options is recognition and must never count as this.
    if (res.ok && !S.hintUsed && (type === 'recall' || type === 'cloze' || type === 'frame')) {
      card.produced = true;
    }
    SRS.review(card, res.grade);
    Game.state.cards[chunk.id] = card;

    const fb = $('q-feedback');
    fb.classList.remove('hidden', 'good', 'bad');

    if (res.ok) {
      S.correct++;
      setCombo(S.combo + 1);

      const base = (type === 'recall' || type === 'frame') ? 12 : type === 'cloze' ? 9 : 6;
      const critChance = .05 + (S.perks.crit || 0) + Math.min(.20, S.combo * .01);
      const crit = res.kind === 'EXACT' && Math.random() < critChance;
      const mult = tier(S.combo).mult * (crit ? 2 : 1);
      const gain = Math.round(base * mult * (1 + (S.perks.xp || 0)));

      S.xp += gain;
      S.coins += crit ? 4 : 2;
      S.foeHp -= crit ? 2 : 1;

      // juice
      FX.pop('#foe-art', 'fx-hurt');
      FX.float((crit ? 'KRITISCH! ' : '') + '+' + gain + ' XP', '#foe-art', crit ? 'crit' : 'good');
      FX.burst('#foe-art', crit ? ['#fff', '#ffcf4d', '#ff6b6b'] : ['#4fd18b', '#fff'], crit ? 26 : 12);
      FX.hitstop(crit ? 110 : 60);
      if (crit) { FX.shake(11); FX.wash('rgba(255,207,77,.35)'); SFX.great(); } else { FX.shake(4); SFX.good(); }

      fb.classList.add('good');
      fb.innerHTML = (res.kind === 'TYPO' || res.kind === 'CAPITAL')
        ? `Fast — ${res.kind === 'CAPITAL' ? 'mayúsculas' : 'un dedazo'}.<span class="fix">${esc(shown)}</span>` +
          (res.rule ? `<span class="why">${esc(res.rule)}</span>` : '')
        : `${crit ? 'PERFEKT! ⚡' : 'Richtig! ✅'}<span class="fix">${esc(chunk.de)}</span><span class="gl">${esc(chunk.gloss || '')}</span>`;
      const inp = $('q-input'); if (inp) inp.classList.add('good');

    } else {
      S.wrong++;
      setCombo(0);
      Game.noteError(res.kind);

      // No HP, no damage, no fainting. Ending a session on the very thing
      // learning requires — being wrong — is backwards, and it turned every
      // error into a currency sink instead of a lesson.
      FX.shake(4);
      FX.pop('.hero-art', 'fx-hurt');

      // Elaborated feedback: name the error type, then show the fix.
      // Right/wrong alone is d=0.05; saying *why* is d=0.49.
      const label = {
        CASE: '⚠️ Caso', GENDER: '⚠️ Género', WORD_ORDER: '⚠️ Orden de palabras',
        VERB_FORM: '⚠️ Forma verbal', UMLAUT: '⚠️ Umlaut / ß', CAPITAL: '⚠️ Mayúsculas',
        LEXIS: 'Otra palabra', MISSING: 'Falta algo', EXTRA: 'Sobra algo',
        MEANING: '⚠️ Significado'
      }[res.kind] || 'Noch nicht';

      fb.classList.add('bad');
      fb.innerHTML = `${label}` +
        (res.diff ? `<span class="diff"><s>${esc(res.diff[0])}</s> → <b>${esc(res.diff[1])}</b></span>` : '') +
        `<span class="fix">${esc(shown)}</span>` +
        (res.rule ? `<span class="why">${esc(res.rule)}</span>` : '') +
        `<span class="gl">${esc(chunk.gloss || '')}</span>` +
        `<span style="display:block;margin-top:5px;color:#cfe">${esc(tr(chunk))}</span>` +
        (chunk.note ? `<span style="display:block;margin-top:5px;color:#9fb6d1;font-size:12.5px">💡 ${esc(chunk.note)}</span>` : '');
      SFX.bad();
      const inp = $('q-input'); if (inp) inp.classList.add('bad');
      // successive relearning: meet it again 2–3 questions later
      S.relearn.push({ chunk, at: S.done + 2 + Math.floor(Math.random() * 2) });
      S.total++;
    }

    Speech.say(shown);
    Game.updateHud();
    updateBars();
    Game.save();   // persist per answer — a closed tab used to lose the run
    $('q-submit').textContent = 'Weiter ▶';
    setTimeout(() => { const b = $('q-submit'); if (b) b.focus(); }, 40);
  }

  function hint() {
    if (!S || S.answered || S.hintUsed) return;   // one hint per question
    // party perks and shop tokens give you hints that don't cost you the grade
    if (S.freeHints > 0) { S.freeHints--; Game.toast(`💡 Gratis-Tipp (noch ${S.freeHints})`); }
    else if (Meta.has('tipp')) { Meta.inv().tipp--; Game.toast('💡 Tipp-Marke benutzt'); Game.save(); }
    else S.hintUsed = true;
    const { type, chunk } = S.q;
    if (type === 'recognize' || type === 'listen') {
      const btns = Array.from($('q-body').querySelectorAll('.opts button'));
      const wrong = btns.map((b, i) => i).filter(i => i !== S.q.correctIdx);
      shuffle(wrong).slice(0, 2).forEach(i => { btns[i].style.opacity = .25; btns[i].style.pointerEvents = 'none'; });
    } else {
      const exp = S.q.expected || chunk.de;
      const inp = $('q-input');
      // Show the shape of the answer as a PLACEHOLDER — never touch what the
      // player has typed. Writing into the box (and wiping it on a timer)
      // meant the hint either submitted itself or deleted your answer.
      if (inp) { inp.placeholder = exp.split(' ').map(w => w[0] + '·'.repeat(Math.max(0, w.length - 1))).join(' '); }
      else Game.toast(exp.split(' ').map(w => w[0] + '…').join(' '));
    }
    SFX.blip();
  }

  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function playAudio() {
    if (!S) return;
    // On production questions, replaying the German before the answer IS the
    // answer. Only speak it once the attempt is in.
    const producing = ['recall', 'cloze', 'frame', 'order'].includes(S.q.type);
    if (producing && !S.answered) { Game.toast('🔊 Primero inténtalo — luego lo escuchas.'); return; }
    Speech.say(S.answered ? (S.q.expected || S.q.chunk.de) : S.q.chunk.de, { force: true });
  }

  function abort() { S = null; Game.show('screen-world'); }

  return { start, submit, hint, playAudio, abort, get active() { return !!S; } };
})();
