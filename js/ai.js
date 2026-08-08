/* ============================================================
   ai.js — "Gespräch": pushed output with corrective recasts
   ------------------------------------------------------------
   Why this exists:
   • Comprehensible input only takes you so far. Swain's output
     hypothesis: you only notice the gaps in your German when you
     are forced to PRODUCE it. So every boss is a conversation.
   • Input is capped at i+1: the AI may only use chunks you have
     already met, plus at most one new item per message, glossed.
   • Errors get RECAST (reformulated naturally), never lectured at
     — recasts are the feedback type that survives in real
     conversation without killing the flow.
   ============================================================ */

const AI = (() => {
  // Opus 5 by default — the recasts and the i+1 vocabulary ceiling are the
  // hard part of this prompt, and it handles them best. Switchable in Optionen
  // for anyone who'd rather trade some quality for a cheaper bill.
  const MODELS = {
    'claude-opus-5':   { label: 'Claude Opus 5 (mejor)',    in: 5, out: 25 },
    'claude-sonnet-5': { label: 'Claude Sonnet 5 (barato)', in: 3, out: 15 }
  };
  const model = () => {
    const m = (Game.state && Game.state.settings.model) || 'claude-opus-5';
    return MODELS[m] ? m : 'claude-opus-5';
  };
  const ENDPOINT = 'https://api.anthropic.com/v1/messages';

  let S = null;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const key = () => (localStorage.getItem('gq_key') || '').trim();
  const hasKey = () => /^sk-ant-/.test(key());

  /* ---------------- start ---------------- */
  function start(opts) {
    const known = Game.knownChunks();
    const pack = Game.pack(opts.packId);

    // A conversation target has to be something you can actually SAY to
    // someone: 2-7 words, not a one-word interjection, not a letter
    // sign-off. Otherwise the goal list is trivial or unusable.
    const speakable = c => {
      const wc = c.de.trim().split(/\s+/).length;
      if (wc < 2 || wc > 7) return false;
      if (c.type === 'word') return false;
      if (/^(liebe|sehr geehrte|mit freundlichen|viele grüße|liebe grüße)/i.test(c.de)) return false;
      return true;
    };

    const seen = (pack ? pack.chunks : []).filter(c => Game.card(c.id).seen > 0);
    let pool = seen.filter(speakable);
    if (pool.length < (opts.targetCount || 4)) pool = known.filter(speakable);
    if (pool.length < (opts.targetCount || 4)) pool = seen.length ? seen : known;
    const targets = shuffle(pool).slice(0, opts.targetCount || 4);

    S = {
      npc: opts.npc,
      packId: opts.packId,
      targets,
      hit: new Set(),
      history: [],
      turns: 0,
      onWin: opts.onWin,
      final: !!opts.final,
      busy: false
    };

    $('chat-title').textContent = opts.npc.name;
    $('chat-tag').textContent = opts.final ? 'Endprüfung' : 'Gespräch';
    $('chat-log').innerHTML = '';
    $('chat-text').value = '';
    renderGoal();
    $('chat-help').innerHTML = hasKey()
      ? 'Escribe en alemán. <kbd>Enter</kbd> para enviar · 🎤 para hablar · toca una frase para oírla.'
      : '⚠️ Modo offline (sin API key). Las respuestas son limitadas — añade tu key en Optionen para conversar de verdad.';

    Game.show('screen-chat');
    push('ai', opts.npc.greet || 'Hallo! Wie geht es dir?', null, null);
    setTimeout(() => $('chat-text').focus(), 100);
  }

  function shuffle(a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[b[i], b[j]] = [b[j], b[i]]; } return b; }

  function renderGoal() {
    if (!S) return;
    const list = S.targets.map(c => {
      const done = S.hit.has(c.id);
      return `<span style="opacity:${done ? 1 : .55};text-decoration:${done ? 'none' : 'none'}">${done ? '✅' : '⬜'} <b>${esc(c.de)}</b></span>`;
    }).join(' &nbsp; ');
    $('chat-goal').innerHTML = `Usa estas expresiones en la conversación (${S.hit.size}/${S.targets.length}):<br>${list}`;
  }

  /* ---------------- messages ---------------- */
  function push(who, de, translation, recast) {
    const log = $('chat-log');
    const d = document.createElement('div');
    d.className = 'msg ' + (who === 'ai' ? 'ai' : 'me');
    d.innerHTML = esc(de) + (who === 'ai' ? '<span class="spk">🔊</span>' : '') +
      (translation ? `<span class="tr">${esc(translation)}</span>` : '') +
      (recast ? `<span class="recast">✏️ Besser: <b>${esc(recast)}</b></span>` : '');
    d.onclick = () => { if (who === 'ai') Speech.say(de, { force: true }); };
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    if (who === 'ai') Speech.say(de);
    return d;
  }

  function typing() {
    const log = $('chat-log');
    const d = document.createElement('div');
    d.className = 'msg ai typing'; d.textContent = '…';
    log.appendChild(d); log.scrollTop = log.scrollHeight;
    return d;
  }

  /* ---------------- send ---------------- */
  async function send() {
    if (!S || S.busy) return;
    const inp = $('chat-text');
    const text = inp.value.trim();
    if (!text) return;
    inp.value = '';
    push('me', text, null, null);
    S.history.push({ role: 'user', content: text });
    S.turns++;

    // did they use any target chunk?
    scoreTargets(text);

    S.busy = true;
    const t = typing();
    try {
      const reply = hasKey() ? await callApi() : offlineReply(text);
      t.remove();
      push('ai', reply.de, reply.es, reply.fix);
      S.history.push({ role: 'assistant', content: reply.raw || reply.de });
    } catch (e) {
      t.remove();
      push('ai', 'Entschuldigung, ich kann gerade nicht antworten.', 'Error: ' + (e.message || e), null);
    }
    S.busy = false;

    if (S.hit.size >= S.targets.length) setTimeout(win, 900);
  }

  function scoreTargets(text) {
    const n = SRS.normalize(text);
    let newHit = false;
    S.targets.forEach(c => {
      if (S.hit.has(c.id)) return;
      const base = SRS.normalize(c.de.replace(/_+/g, ''));
      const core = base.split(' ').filter(w => w.length > 2);
      // a chunk counts as "used" when most of its content words show up
      const need = Math.max(1, Math.ceil(core.length * 0.7));
      const got = core.filter(w => n.includes(w)).length;
      if (core.length && got >= need) {
        S.hit.add(c.id);
        newHit = true;
        const card = Game.card(c.id);
        SRS.review(card, 2);           // real communicative use is the strongest rep there is
        card.strength = Math.min(5, card.strength + 1);
        Game.state.cards[c.id] = card;
        Game.addXp(20);
        Meta.progress('speak', 1);
      }
    });
    if (newHit) {
      SFX.good();
      FX.burst('.chat-goal', ['#4fd18b', '#ffcf4d'], 14);
      FX.float('+20 XP', '.chat-goal', 'good');
      renderGoal(); Game.save();
    }
  }

  function win() {
    if (!S) return;
    SFX.win();
    Game.addXp(60);
    const npc = S.npc;
    Game.toast(`🏆 ${npc.name} besiegt! +60 XP`);
    if (S.onWin) S.onWin();
    Game.save();
  }

  /* ---------------- Anthropic call ---------------- */
  function systemPrompt() {
    const known = Game.knownChunks().slice(-160).map(c => c.de);
    const targets = S.targets.map(c => `"${c.de}" (${c.es})`);
    return `Du bist "${S.npc.name}", eine Figur in einem Lernspiel für Deutsch. Der Lernende ist Anfänger (A1–A2), Muttersprache Spanisch.

DEINE REGELN (streng befolgen):
1. Antworte NUR auf Deutsch, in maximal 2 kurzen Sätzen.
2. Benutze fast ausschließlich Wörter aus dieser Liste bekannter Ausdrücke:
${known.join(' | ')}
3. Du darfst pro Nachricht HÖCHSTENS EIN neues Wort einführen. Das ist "i+1".
4. Stelle in JEDER Nachricht genau eine einfache Frage, damit der Lernende weiterredet.
5. Wenn der Lernende einen Fehler macht, korrigiere ihn NICHT direkt und erkläre keine Grammatik. Schreibe stattdessen die korrigierte Version in die FIX-Zeile (ein "Recast").
6. Bleib in deiner Rolle: ${S.npc.greet || ''}
7. Lenke das Gespräch sanft so, dass der Lernende diese Ausdrücke benutzen will: ${targets.join(', ')}
8. Sei warm, kurz und ermutigend. Keine Emojis in der DE-Zeile.

ANTWORTFORMAT — genau diese Zeilen, nichts anderes:
DE: <deine Antwort auf Deutsch>
ES: <traducción al español de tu respuesta>
FIX: <la frase del alumno reescrita correctamente en alemán — omite esta línea entera si no hubo error>`;
  }

  async function callApi() {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key(),
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: model(),
        max_tokens: 300,
        system: systemPrompt(),
        messages: S.history.slice(-14)
      })
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(res.status + ' ' + txt.slice(0, 160));
    }
    const data = await res.json();
    const raw = (data.content || []).map(b => b.text || '').join('\n').trim();
    return parse(raw);
  }

  function parse(raw) {
    const out = { raw, de: '', es: '', fix: '' };
    raw.split('\n').forEach(line => {
      const m = line.match(/^\s*(DE|ES|FIX)\s*:\s*(.*)$/i);
      if (!m) return;
      const v = m[2].trim();
      if (/^de$/i.test(m[1])) out.de = v;
      else if (/^es$/i.test(m[1])) out.es = v;
      else if (v && !/^-*$/.test(v)) out.fix = v;
    });
    if (!out.de) out.de = raw.split('\n')[0] || '…';
    return out;
  }

  /* ---------------- offline fallback ---------------- */
  function offlineReply(userText) {
    const pack = Game.pack(S.packId);
    const pool = (pack ? pack.chunks : Game.allChunks());
    const qs = pool.filter(c => /\?$/.test(c.de) && Game.card(c.id).seen > 0);
    const notYet = S.targets.filter(c => !S.hit.has(c.id));

    let de, es;
    if (notYet.length) {
      const t = notYet[0];
      const hints = [
        `Und du? Sag mal: „${t.de}"?`,
        `Interessant. Kannst du „${t.de}" sagen?`,
        `Aha! Und wie sagt man „${t.es}" auf Deutsch?`
      ];
      de = hints[S.turns % hints.length];
      es = 'Intenta usar la expresión que falta.';
    } else if (qs.length) {
      const q = qs[Math.floor(Math.random() * qs.length)];
      de = 'Gut! ' + q.de; es = q.es;
    } else {
      de = 'Sehr gut! Erzähl mir mehr.'; es = '¡Muy bien! Cuéntame más.';
    }
    return { de, es, fix: '', raw: de };
  }

  /* ---------------- speech input ---------------- */
  let rec = null;
  function mic() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const btn = document.querySelector('[data-act="chat-mic"]');
    if (!SR) { Game.toast('Tu navegador no soporta reconocimiento de voz (usa Chrome).'); return; }
    if (rec) { rec.stop(); rec = null; btn.classList.remove('on'); return; }
    rec = new SR();
    rec.lang = 'de-DE'; rec.interimResults = false; rec.maxAlternatives = 1;
    btn.classList.add('on');
    rec.onresult = e => {
      const t = e.results[0][0].transcript;
      $('chat-text').value = t;
      setTimeout(send, 200);
    };
    rec.onerror = () => Game.toast('No te he oído. Inténtalo otra vez.');
    rec.onend = () => { rec = null; btn.classList.remove('on'); };
    rec.start();
  }

  function close() { S = null; if (rec) { try { rec.stop(); } catch (e) {} rec = null; } Game.show('screen-world'); }

  return { start, send, mic, close, hasKey, get active() { return !!S; } };
})();
