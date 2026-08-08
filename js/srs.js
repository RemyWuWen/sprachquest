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

    /* ---- Spacing the schedule records must be spacing that happened ----
       A graduated card's interval used to grow on EVERY correct answer with
       no check on elapsed time. Because you can replay a fight or hit "Freies
       Training" at will, five correct answers inside one hour took a card
       from 1 day to ~97 days — the schedule then believed in a month of
       retention it had never observed, and the item quietly rotted.
       Answering again sooner than 60% of the interval still counts as
       practice; it just doesn't get to move the schedule. */
    if (grade > 0 && card.ivl > 0) {
      const elapsed = now - (card.last || 0);
      if (elapsed < 0.6 * card.ivl) { card.last = now; return card; }

      // and at most one scoring review per calendar day
      const day = new Date(now).toISOString().slice(0, 10);
      if (card.scoredDay === day) { card.last = now; return card; }
      card.scoredDay = day;
    }
    card.last = now;

    if (grade === 0) {
      card.lapses++;
      card.reps = 0;
      card.step = 0;
      card.ease = Math.max(1.3, card.ease - 0.2);
      /* A lapse used to reset the interval to zero, throwing away every
         previous successful repetition. Knowledge decays, it doesn't vanish:
         cut the interval hard, but keep the history. */
      card.ivl = card.ivl > 0 ? Math.max(DAY, card.ivl * 0.35) : 0;
      card.due = now + (card.ivl > 0 ? 10 * MIN : STEPS[0]);
      card.relearning = card.ivl > 0;
      card.strength = Math.max(0, card.strength - 2);
      if (card.lapses >= 8) card.leech = true;   // stop burning sessions on it
      return card;
    }

    // coming back from a lapse: restore the (reduced) schedule
    if (card.relearning) { card.relearning = false; card.due = now + card.ivl; }

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

  /* ================= answer checking =================
     A grader that can actually fail German.

     The previous version flattened ä→ae and ß→ss, forgave any word
     permutation, and allowed a 1-2 character Levenshtein slop over the
     whole string. Measured against real learner errors it accepted 8 out
     of 8 — dative for accusative, wrong gender, V2 inversion, a stranded
     separable prefix, missing umlauts. Every one came back "Fast! Kleiner
     Tippfehler" and *extended the interval*.

     Those are not typos. For a Spanish speaker they are the entire
     difficulty of German, and a grader that cannot see them makes every
     number downstream — intervals, strength, unlocks, the 1000-word
     counter — a measure of clicking rather than of German.

     So: umlauts and ß are contrasts, not noise; word order is never
     forgiven; and an error inside the closed class of grammatical words
     is always an error. What survives as a typo is what a typo actually
     is — a slip in an open-class word the learner clearly knew.
     ================================================== */

  // Punctuation and spacing only. Umlauts, ß and case all survive.
  function normalize(s) {
    return (s || '')
      .replace(/[.,!?¿¡;:"'`´’()\[\]\-–—]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  const lower = s => normalize(s).toLowerCase();

  /* The closed class: articles, pronouns, prepositions, auxiliaries and
     contractions. German grammar happens almost entirely inside this set,
     so a wrong word here is a grammar error by definition — never a typo,
     never forgiven. */
  const CLOSED = new Set(`
    der die das den dem des
    ein eine einen einem einer eines
    mein meine meinen meinem meiner meines
    dein deine deinen deinem deiner deines
    sein seine seinen seinem seiner seines
    ihr ihre ihren ihrem ihrer ihres
    kein keine keinen keinem keiner keines
    dieser diese dieses diesen diesem
    ich du er sie es wir ihr
    mir mich dir dich ihm ihn uns euch ihnen sich
    mit zu von bei nach aus seit gegenüber
    in auf an über unter vor hinter neben zwischen
    für um durch ohne gegen entlang
    bin bist ist sind seid war warst waren
    habe hast hat haben habt hatte hatten
    werde wirst wird werden werdet wurde wurden
    am im zum zur beim vom ins ans aufs fürs
    nicht kein und oder aber denn sondern dass weil wenn
  `.trim().split(/\s+/));

  // Case-marked forms: seeing one of these expected tells us it is a case slip.
  const CASE_MARKED = new Set(['den', 'dem', 'des', 'einen', 'einem', 'eines',
    'meinen', 'meinem', 'deinen', 'deinem', 'seinen', 'seinem', 'ihren', 'ihrem',
    'keinen', 'keinem', 'diesen', 'diesem',
    'mir', 'mich', 'dir', 'dich', 'ihm', 'ihn', 'uns', 'euch', 'ihnen',
    'zum', 'zur', 'im', 'am', 'beim', 'vom', 'ins', 'ans']);

  // Nominative determiners: swapping between these is a gender error.
  const GENDER_MARKED = new Set(['der', 'die', 'das', 'ein', 'eine',
    'mein', 'meine', 'dein', 'deine', 'kein', 'keine']);

  const ERROR_RULES = {
    CASE:       'Caso equivocado. En alemán el caso cambia el artículo: der → den (acusativo) → dem (dativo).',
    GENDER:     'Género equivocado. En alemán el género va con la palabra — hay que aprenderlo junto al sustantivo.',
    WORD_ORDER: 'Orden de palabras. En alemán el verbo conjugado va en segunda posición, y los prefijos separables se van al final.',
    VERB_FORM:  'Forma verbal equivocada — revisa la persona o el tiempo.',
    UMLAUT:     'Faltan los Umlaute (ä ö ü) o la ß. En alemán cambian la palabra, no son un adorno.',
    CAPITAL:    'En alemán todos los sustantivos se escriben con mayúscula.',
    LEXIS:      'Palabra distinta a la esperada.',
    MISSING:    'Falta algo de la frase.',
    EXTRA:      'Sobra algo en la frase.'
  };

  const stripDiacritics = s => s
    .replace(/ß/g, 'ss').replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u');

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
   * → { ok, grade, kind, rule, diff }
   *
   * kind is a diagnosis, not a verdict: CASE, GENDER, WORD_ORDER,
   * VERB_FORM, UMLAUT, CAPITAL, LEXIS, MISSING, EXTRA, EXACT.
   * The caller uses it to say *what went wrong* instead of just "no",
   * and to keep a running profile of the learner's weak spots.
   *
   * Only two things still pass: an exact match, and a single-character
   * slip in an open-class word. Everything German-specific fails.
   */
  function check(input, expected, opts) {
    opts = opts || {};
    const rawA = normalize(input), rawB = normalize(expected);
    if (!rawA) return { ok: false, grade: 0, kind: 'MISSING', rule: ERROR_RULES.MISSING };
    if (rawA === rawB) return { ok: true, grade: 2, kind: 'EXACT' };

    const A = rawA.split(' '), B = rawB.split(' ');
    const la = rawA.toLowerCase(), lb = rawB.toLowerCase();

    // Capitalisation only. Real, and worth naming — but it is not why a
    // sentence fails to communicate, so it still counts as correct.
    // Tightened once the learner has met the item a few times.
    if (la === lb) {
      return opts.strictCaps
        ? { ok: false, grade: 0, kind: 'CAPITAL', rule: ERROR_RULES.CAPITAL }
        : { ok: true, grade: 1, kind: 'CAPITAL', rule: ERROR_RULES.CAPITAL };
    }

    // Umlaut/ß stripped away — a real orthographic contrast in German,
    // and one a Spanish keyboard invites you to skip. Never silently OK.
    if (stripDiacritics(la) === stripDiacritics(lb)) {
      return { ok: false, grade: 0, kind: 'UMLAUT', rule: ERROR_RULES.UMLAUT };
    }

    // Right words, wrong order. This is V2 inversion and separable-verb
    // placement — i.e. German syntax itself. Never forgiven.
    const sortedA = A.map(w => w.toLowerCase()).sort().join(' ');
    const sortedB = B.map(w => w.toLowerCase()).sort().join(' ');
    if (sortedA === sortedB) {
      return { ok: false, grade: 0, kind: 'WORD_ORDER', rule: ERROR_RULES.WORD_ORDER };
    }

    // Walk to the first divergence and name it.
    const n = Math.min(A.length, B.length);
    for (let i = 0; i < n; i++) {
      const gi = A[i].toLowerCase(), ei = B[i].toLowerCase();
      if (gi === ei) continue;

      if (CASE_MARKED.has(ei) || CASE_MARKED.has(gi))
        return { ok: false, grade: 0, kind: 'CASE', rule: ERROR_RULES.CASE, diff: [A[i], B[i]] };

      if (GENDER_MARKED.has(ei) && GENDER_MARKED.has(gi))
        return { ok: false, grade: 0, kind: 'GENDER', rule: ERROR_RULES.GENDER, diff: [A[i], B[i]] };

      // Where the two words diverge decides what kind of error it is.
      // Same stem, different ENDING → inflection (geh|e vs geh|t): a real
      // grammar error. A difference INSIDE the word (Kaf|f|ee) is a slip of
      // the fingers. Distance alone cannot tell these apart — both are one
      // character — so the position is what we read.
      let p = 0;
      while (p < gi.length && p < ei.length && gi[p] === ei[p]) p++;
      const tailDiff = p >= Math.min(gi.length, ei.length) - 1;
      const sharedStem = p >= 3;

      if (sharedStem && tailDiff && !CLOSED.has(ei) && !CLOSED.has(gi))
        return { ok: false, grade: 0, kind: 'VERB_FORM', rule: ERROR_RULES.VERB_FORM, diff: [A[i], B[i]] };

      // A genuine slip: one character, inside a word that carries meaning
      // rather than grammar. This is the only surviving leniency.
      if (!CLOSED.has(ei) && !CLOSED.has(gi) && levenshtein(gi, ei) === 1 && ei.length >= 4)
        continue;

      return { ok: false, grade: 0, kind: 'LEXIS', rule: ERROR_RULES.LEXIS, diff: [A[i], B[i]] };
    }

    if (A.length !== B.length) {
      const kind = A.length < B.length ? 'MISSING' : 'EXTRA';
      return { ok: false, grade: 0, kind, rule: ERROR_RULES[kind] };
    }

    // Survived the walk on single-character slips alone.
    return { ok: true, grade: 1, kind: 'TYPO' };
  }

  return { newCard, review, isDue, isNew, dueIn, questionType, check, normalize, lower,
           levenshtein, CLOSED, ERROR_RULES, MIN, DAY };
})();
