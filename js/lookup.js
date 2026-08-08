/* ============================================================
   lookup.js — hover a German word, press Tab, see what it means
   ------------------------------------------------------------
   Works on ANY German text in the game without every render site
   having to opt in: it finds the word under the pointer from the
   text node itself (caretRangeFromPoint), so dialogue, battle
   prompts, the chat log, lesson cards and the journal are all
   covered by the same code path.

   Deliberately conservative: an exact dictionary hit or nothing.
   A confidently wrong gloss teaches the learner something false,
   which is worse than "no lo tengo".
   ============================================================ */

const Lookup = (() => {
  const DATA = window.GQ_DATA || {};
  const DICT = DATA.dict || {};
  const LEMMAS = DATA.lemmas || [];
  const ALT = DATA.dictAlt || {};   // words with two real readings (weiß, das, ihr)

  // Must match build.js's dnorm exactly — umlauts preserved, so schön ≠ schon.
  const dnorm = s => String(s || '').toLowerCase().replace(/[^a-zäöüß]/g, '');
  const isGermanLetter = ch => /[a-zA-ZäöüÄÖÜß]/.test(ch);

  let mouse = { x: 0, y: 0 };
  let tip = null;

  addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });

  /* ---------------- find the word under the pointer ---------------- */
  function wordAtPoint(x, y) {
    let node = null, offset = 0;
    if (document.caretRangeFromPoint) {              // Chrome / Safari
      const r = document.caretRangeFromPoint(x, y);
      if (r) { node = r.startContainer; offset = r.startOffset; }
    } else if (document.caretPositionFromPoint) {    // Firefox
      const p = document.caretPositionFromPoint(x, y);
      if (p) { node = p.offsetNode; offset = p.offset; }
    }
    if (!node || node.nodeType !== 3) return null;

    const text = node.nodeValue || '';
    if (!text.trim()) return null;

    // expand from the caret out to both word edges
    let a = Math.min(offset, text.length - 1), b = a;
    if (!isGermanLetter(text[a] || '')) {
      if (isGermanLetter(text[a - 1] || '')) a = b = a - 1;
      else return null;
    }
    while (a > 0 && isGermanLetter(text[a - 1])) a--;
    while (b < text.length - 1 && isGermanLetter(text[b + 1])) b++;

    const word = text.slice(a, b + 1);
    return word.length > 1 ? { word, node } : null;
  }

  /* ---------------- resolve it ---------------- */
  function translate(word) {
    const i = DICT[dnorm(word)];
    if (i === undefined || !LEMMAS[i]) return null;
    const l = LEMMAS[i];
    const j = ALT[dnorm(word)];
    const other = (j !== undefined && LEMMAS[j]) ? LEMMAS[j] : null;
    return {
      head: (l.a ? l.a + ' ' : '') + l.w,
      es: l.es,
      pos: l.p,
      rank: l.r,
      inflected: dnorm(word) !== dnorm(l.w),
      // German is genuinely ambiguous here — say so rather than guessing.
      alt: other ? ((other.a ? other.a + ' ' : '') + other.w + ' = ' + other.es) : null
    };
  }

  /* Only these regions hold German the learner is meant to read. Without
     this the lookup also fires on UI chrome ("Optionen", "Karte") and, worse,
     the phrase fallback wanders up the DOM and attaches whatever unrelated
     translation it finds — a confidently wrong gloss. */
  const ZONES = [
    '#dlg-text',                                  // NPC dialogue
    '.msg',                                       // AI conversation
    '.chunk-de', '.chunk-fillers',                // lesson card
    '.q-prompt', '.build', '.bank', '.q-feedback',// battle
    '.jitem'                                      // vocabulary journal
  ].join(',');

  const zoneOf = node => {
    const el = node && (node.nodeType === 3 ? node.parentElement : node);
    return el ? el.closest(ZONES) : null;
  };

  /** phrase fallback — searched INSIDE the same zone only, never up the page */
  function phraseAt(zone) {
    if (!zone) return null;
    if (zone.dataset && zone.dataset.tr) return zone.dataset.tr;
    const own = zone.querySelector(':scope > .tr, :scope .tr');
    if (own && own.textContent.trim() && own.textContent.trim() !== '—') return own.textContent.trim();
    // dialogue keeps German and Spanish as siblings inside #dlg-text
    const sib = zone.parentElement && zone.parentElement.querySelector('.tr');
    if (zone.id === 'dlg-text' && sib) return null; // already covered above
    return null;
  }

  /* ---------------- the tooltip ---------------- */
  function hide() { if (tip) { tip.remove(); tip = null; } }

  function show(x, y, html) {
    hide();
    tip = document.createElement('div');
    tip.className = 'wordtip';
    tip.innerHTML = html;
    document.body.appendChild(tip);

    // keep it on screen
    const r = tip.getBoundingClientRect();
    let left = x - r.width / 2;
    let top = y - r.height - 14;
    left = Math.max(8, Math.min(left, innerWidth - r.width - 8));
    if (top < 8) top = y + 20;
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';

    clearTimeout(show._t);
    show._t = setTimeout(hide, 4200);
  }

  const esc = s => String(s == null ? '' : s)
    .replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /**
   * Returns true when it handled the key (a word was under the pointer),
   * so the caller can fall back to toggling the whole-line translation.
   */
  function peekAtPointer() {
    const found = wordAtPoint(mouse.x, mouse.y);
    if (!found) return false;

    // Ignore anything that isn't German learning content — button labels,
    // headings, stats. Returning false lets Tab fall back to the line toggle.
    const zone = zoneOf(found.node);
    if (!zone) return false;

    const hit = translate(found.word);
    if (hit) {
      const rankNote = hit.rank ? `<i>nº ${hit.rank} de las 1000</i>` : '';
      show(mouse.x, mouse.y,
        `<b>${esc(found.word)}</b>` +
        (hit.inflected ? `<span class="wt-lem">→ ${esc(hit.head)}</span>` : '') +
        `<span class="wt-es">${esc(hit.es)}</span>` +
        `<span class="wt-meta">${esc(hit.pos)} ${rankNote}</span>` +
        (hit.alt ? `<span class="wt-alt">o también: ${esc(hit.alt)}</span>` : ''));
      if (Speech && Speech.available()) Speech.say(found.word, { force: true });
      return true;
    }

    const phrase = phraseAt(zone);
    if (phrase) {
      show(mouse.x, mouse.y,
        `<b>${esc(found.word)}</b><span class="wt-es">${esc(phrase)}</span>` +
        `<span class="wt-meta">traducción de la frase</span>`);
      return true;
    }

    show(mouse.x, mouse.y,
      `<b>${esc(found.word)}</b><span class="wt-none">no está en las 1000 palabras</span>`);
    return true;
  }

  addEventListener('scroll', hide, true);
  addEventListener('mousedown', hide);

  return { peekAtPointer, hide, translate, size: Object.keys(DICT).length };
})();
