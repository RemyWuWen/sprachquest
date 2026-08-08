/* ============================================================
   srs.js — Spaced repetition + answer grading
   ------------------------------------------------------------
   Design notes (why it works this way):

   • SM-2 with learning steps. Spacing effect: retention is far
     better when repetitions are distributed than massed.
   • "strength" (0..5) is separate from the schedule. It drives
     EXPANDING RETRIEVAL DIFFICULTY: a brand-new chunk is tested by
     recognition, a strong one by free production. Making retrieval
     harder as it gets easier is the "desirable difficulty" effect.
   • Wrong answers do not nuke a card to zero — they drop it two
     steps and push it into a within-session relearning queue, so
     you meet it again a few questions later (successive relearning).
   ============================================================ */

const SRS = (() => {
  const MIN = 60 * 1000;
  const DAY = 24 * 60 * 60 * 1000;

  // learning steps before a card graduates into day-scale intervals
  const STEPS = [1 * MIN, 10 * MIN];
  const GRAD = 1 * DAY;     // first interval after graduating
  const EASY = 4 * DAY;     // interval if graduated with "easy"

  function newCard() {
    return {
      ease: 2.5,   // SM-2 ease factor
      ivl: 0,      // current interval in ms (0 = still learning)
      due: 0,      // timestamp
      step: 0,     // index into STEPS while learning
      reps: 0,
      lapses: 0,
      strength: 0, // 0..5 — drives question difficulty
      seen: 0,     // total exposures (incl. lessons)
      last: 0
    };
  }

  /**
   * grade: 0 = again (wrong), 1 = hard (typo / slow), 2 = good, 3 = easy
   */
  function review(card, grade, now) {
    now = now || Date.now();
    card.seen++;
    card.last = now;

    if (grade === 0) {
      card.lapses++;
      card.reps = 0;
      card.step = 0;
      card.ease = Math.max(1.3, card.ease - 0.2);
      card.ivl = 0;
      card.due = now + STEPS[0];
      card.strength = Math.max(0, card.strength - 2);
      return card;
    }

    card.reps++;
    card.strength = Math.min(5, card.strength + (grade === 1 ? 0 : 1));

    if (card.ivl === 0) {
      // still in learning phase
      if (grade === 3) {
        card.ivl = EASY;
        card.due = now + EASY;
        card.step = 0;
      } else if (grade === 1) {
        card.due = now + STEPS[0];       // repeat the current step
      } else {
        card.step++;
        if (card.step >= STEPS.length) { // graduate
          card.ivl = GRAD;
          card.due = now + GRAD;
          card.step = 0;
        } else {
          card.due = now + STEPS[card.step];
        }
      }
      return card;
    }

    // review phase — classic SM-2
    if (grade === 1) {
      card.ease = Math.max(1.3, card.ease - 0.15);
      card.ivl = Math.max(DAY, card.ivl * 1.2);
    } else if (grade === 2) {
      card.ivl = card.ivl * card.ease;
    } else {
      card.ease = Math.min(2.9, card.ease + 0.1);
      card.ivl = card.ivl * card.ease * 1.25;
    }
    card.ivl = Math.min(card.ivl, 240 * DAY);
    card.due = now + card.ivl;
    return card;
  }

  const isDue = (card, now) => card && card.due <= (now || Date.now());
  const isNew = (card) => !card || card.seen === 0;

  function dueIn(card, now) {
    if (!card || !card.due) return '—';
    const d = card.due - (now || Date.now());
    if (d <= 0) return 'jetzt';
    if (d < 60 * MIN) return Math.ceil(d / MIN) + ' min';
    if (d < DAY) return Math.ceil(d / (60 * MIN)) + ' Std';
    return Math.ceil(d / DAY) + ' Tage';
  }

  /* ---------- question type from strength (expanding retrieval) ---------- */
  function questionType(card, chunk) {
    const s = card ? card.strength : 0;
    const isFrame = chunk && chunk.type === 'frame';
    if (isFrame && s >= 2) return 'frame';
    if (s <= 0) return 'recognize';   // meaning recognition, 4 options
    if (s === 1) return 'listen';     // hear it → choose meaning
    if (s === 2) return 'order';      // rebuild word order from a bank
    if (s === 3) return 'cloze';      // one word blanked, type it
    return 'recall';                  // ES/EN → produce the whole German chunk
  }

  /* ================= answer checking ================= */

  // ä→ae etc, plus punctuation/spacing tolerance
  function normalize(s) {
    return (s || '')
      .toLowerCase()
      .replace(/ß/g, 'ss')
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
      .replace(/[.,!?¿¡;:"'`´’()\-–—]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(
          prev[j] + 1,
          cur[j - 1] + 1,
          prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
      }
      prev = cur;
    }
    return prev[b.length];
  }

  /**
   * → { ok, grade, kind }
   *   kind: 'exact' | 'typo' | 'wrong'
   * A near-miss counts as correct but grades "hard", and the UI shows
   * the correct spelling. Punishing a one-letter typo kills motivation
   * and does not improve the underlying knowledge.
   */
  function check(input, expected) {
    const a = normalize(input);
    const b = normalize(expected);
    if (!a) return { ok: false, grade: 0, kind: 'wrong' };
    if (a === b) return { ok: true, grade: 2, kind: 'exact' };

    const tol = b.length > 14 ? 2 : 1;
    const d = levenshtein(a, b);
    if (d <= tol) return { ok: true, grade: 1, kind: 'typo' };

    // word-set match (order slips on short chunks)
    const aw = a.split(' ').sort().join(' ');
    const bw = b.split(' ').sort().join(' ');
    if (aw === bw) return { ok: true, grade: 1, kind: 'typo' };

    return { ok: false, grade: 0, kind: 'wrong' };
  }

  return { newCard, review, isDue, isNew, dueIn, questionType, check, normalize, levenshtein, MIN, DAY };
})();
