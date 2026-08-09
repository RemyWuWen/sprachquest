/* ============================================================
   audio.js — German TTS + tiny WebAudio SFX
   ============================================================ */

const Speech = (() => {
  /* ============================================================
     Picking a German voice that actually sounds German.

     Two things were wrong. The old ranking took the first de-DE
     voice it found, which on macOS is "Anna" — the legacy
     compressed voice. And it happily accepted the character
     voices Apple ships (Grandma, Rocko, Flo…), which are
     stylised cartoons, not speech models you want to imitate.

     A learner copies whatever they hear. A bad voice does not
     just sound bad, it teaches bad pronunciation — so quality
     here is a correctness issue, not a polish one.
     ============================================================ */

  let voices = [], best = null, ranked = [];

  // Apple's novelty/character voices. Fun; not models to imitate.
  const NOVELTY = /^(eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley|bahh|boing|bubbles|cellos|jester|organ|superstar|trinoids|whisper|wobble|zarvox|bad news|good news|bells|albert|junior|kathy|ralph|fred|princess|deranged|hysterical|pipe organ|wobble)\b/i;

  function score(v) {
    const n = v.name.toLowerCase();
    if (NOVELTY.test(v.name)) return -100;          // never, unless nothing else exists
    let s = 0;
    if (/premium/.test(n)) s += 100;                // macOS/iOS downloadable, best quality
    else if (/enhanced/.test(n)) s += 90;
    else if (/neural|natural|wavenet|studio/.test(n)) s += 85;
    if (/siri/.test(n)) s += 70;
    if (/google/.test(n)) s += 60;                  // Chrome's remote German — very decent
    if (/microsoft/.test(n)) s += 40;
    if (/\b(katja|conrad|amala|killian|anna|petra|markus|yannick|helena|vicki)\b/.test(n)) s += 25;
    if (/de-de/i.test(v.lang)) s += 10;             // Germany over AT/CH for a beginner
    if (!v.localService) s += 3;                    // remote voices are usually newer
    return s;
  }

  function load() {
    if (!('speechSynthesis' in window)) return;
    voices = speechSynthesis.getVoices() || [];
    ranked = voices
      .filter(v => /^de(-|_)?/i.test(v.lang))
      .map(v => ({ v, s: score(v) }))
      .sort((a, b) => b.s - a.s)
      .map(x => x.v);

    // an explicit choice always wins
    const saved = (() => { try { return localStorage.getItem('gq_voice'); } catch (e) { return null; } })();
    best = (saved && ranked.find(v => v.name === saved)) || ranked[0] || null;
  }
  load();
  if ('speechSynthesis' in window) {
    speechSynthesis.onvoiceschanged = load;
    // Safari populates the list late and sometimes without firing the event
    setTimeout(load, 400); setTimeout(load, 1500);
  }

  /** True when the only German voices are novelty/legacy ones — worth telling
      the learner, since the fix (download a real voice) is one settings pane
      away and transforms the whole experience. */
  function qualityIsPoor() {
    if (!ranked.length) return true;
    return score(ranked[0]) < 60;
  }

  function say(text, opts) {
    opts = opts || {};
    if (!('speechSynthesis' in window)) return;
    if (!Game || !Game.state || Game.state.settings.tts === false) {
      if (opts.force !== true) return;
    }
    try {
      speechSynthesis.cancel();
      // "___" is a slot marker, not something to read out.
      const clean = String(text).replace(/_+/g, ' … ').replace(/\s{2,}/g, ' ').trim();
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = (best && best.lang) || 'de-DE';
      if (best) u.voice = best;
      u.rate = opts.rate || (Game && Game.state ? Game.state.settings.rate : 0.9) || 0.9;
      u.pitch = opts.pitch || 1;
      speechSynthesis.speak(u);
    } catch (e) { /* ignore */ }
  }

  function setVoice(name) {
    const v = ranked.find(x => x.name === name);
    if (!v) return false;
    best = v;
    try { localStorage.setItem('gq_voice', name); } catch (e) {}
    return true;
  }

  const available = () => 'speechSynthesis' in window;
  return { say, available, setVoice, load, qualityIsPoor,
           get voice() { return best; },
           get list() { return ranked.slice(); },
           score };
})();

/* ---------------- SFX ---------------- */
const SFX = (() => {
  let ctx = null;
  function ac() {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function on() { return !Game || !Game.state || Game.state.settings.sfx !== false; }

  function tone(freq, dur, type, vol, delay) {
    if (!on()) return;
    const a = ac(); if (!a) return;
    const o = a.createOscillator(), g = a.createGain();
    const t = a.currentTime + (delay || 0);
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.07, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.12));
    o.connect(g); g.connect(a.destination);
    o.start(t); o.stop(t + (dur || 0.12) + 0.02);
  }

  return {
    good()   { tone(660, .09, 'square', .06); tone(880, .13, 'square', .06, .08); },
    great()  { tone(660, .08, 'square', .06); tone(880, .08, 'square', .06, .07); tone(1174, .16, 'square', .06, .14); },
    bad()    { tone(200, .18, 'sawtooth', .05); tone(150, .22, 'sawtooth', .05, .1); },
    blip()   { tone(520, .05, 'square', .035); },
    step()   { tone(180, .03, 'triangle', .02); },
    open()   { tone(440, .06, 'triangle', .05); tone(660, .09, 'triangle', .05, .05); },
    levelup(){ [523,659,784,1046].forEach((f,i)=>tone(f,.16,'square',.06,i*.09)); },
    hit()    { tone(320, .07, 'sawtooth', .05); },
    win()    { [392,523,659,784,1046].forEach((f,i)=>tone(f,.2,'square',.055,i*.11)); },
  };
})();
