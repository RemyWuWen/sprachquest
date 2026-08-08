/* ============================================================
   audio.js — German TTS + tiny WebAudio SFX
   ============================================================ */

const Speech = (() => {
  let voices = [];
  let best = null;

  function load() {
    if (!('speechSynthesis' in window)) return;
    voices = speechSynthesis.getVoices() || [];
    const de = voices.filter(v => /^de(-|_)?/i.test(v.lang));
    // prefer a natural/enhanced German voice when the OS ships one
    best =
      de.find(v => /premium|enhanced|natural|neural|siri/i.test(v.name)) ||
      de.find(v => /de-DE/i.test(v.lang)) ||
      de[0] || null;
  }
  load();
  if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = load;

  function say(text, opts) {
    opts = opts || {};
    if (!('speechSynthesis' in window)) return;
    if (!Game || !Game.state || Game.state.settings.tts === false) {
      if (opts.force !== true) return;
    }
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(text).replace(/_+/g, ' … '));
      u.lang = 'de-DE';
      if (best) u.voice = best;
      u.rate = opts.rate || (Game && Game.state ? Game.state.settings.rate : 0.85) || 0.85;
      u.pitch = opts.pitch || 1;
      speechSynthesis.speak(u);
    } catch (e) { /* ignore */ }
  }

  const available = () => 'speechSynthesis' in window;
  return { say, available, get voice() { return best; } };
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
