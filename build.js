#!/usr/bin/env node
/* ============================================================
   build.js — merge data/pack_*.json → data/chunks.js
   Run:  node build.js
   ------------------------------------------------------------
   Emits a plain <script> file (not JSON) so the game works when
   opened straight from the filesystem, with no server and no CORS.
   ============================================================ */

const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, 'data');
const OUT = path.join(DIR, 'chunks.js');

const PACK_ORDER = [
  'greetings_social', 'core_grammar',
  'food_drink', 'shopping_money',
  'home_routine', 'people_family',
  'city_travel', 'work_school',
  'health_body', 'weather_leisure',
  'core_connect'
];

/* a minimal starter set so the game is playable before the
   generated packs land */
const SEED = [{
  packId: 'greetings_social', title: 'Begrüßung & Small Talk', titleDe: 'Hallo!',
  desc: 'Saludar, presentarte y sobrevivir a los primeros 30 segundos.',
  chunks: [
    { id: 'seed_001', de: 'Hallo, wie geht es dir?', es: 'Hola, ¿cómo estás?', en: 'Hi, how are you?', gloss: 'hola, cómo va ello a-ti', lemmas: ['hallo','wie','gehen','es','du'], level: 1, type: 'question', note: 'En el día a día se dice "Wie geht\'s?".' },
    { id: 'seed_002', de: 'Mir geht es gut, danke.', es: 'Estoy bien, gracias.', en: "I'm fine, thanks.", gloss: 'a-mí va ello bien, gracias', lemmas: ['ich','gehen','gut','danke'], level: 1, type: 'answer', note: 'Se dice "mir", no "ich".' },
    { id: 'seed_003', de: 'Ich heiße ___.', es: 'Me llamo ___.', en: 'My name is ___.', gloss: 'yo me-llamo ___', lemmas: ['ich','heißen'], level: 1, type: 'frame', note: '', fillers: [{ de: 'Remy', es: 'Remy' }, { de: 'Anna', es: 'Anna' }, { de: 'Max', es: 'Max' }] },
    { id: 'seed_004', de: 'Woher kommst du?', es: '¿De dónde eres?', en: 'Where are you from?', gloss: 'de-dónde vienes tú', lemmas: ['woher','kommen','du'], level: 1, type: 'question', note: '' },
    { id: 'seed_005', de: 'Ich komme aus Spanien.', es: 'Soy de España.', en: "I'm from Spain.", gloss: 'yo vengo de España', lemmas: ['ich','kommen','aus'], level: 1, type: 'sentence', note: '"kommen aus" = ser de.' },
    { id: 'seed_006', de: 'Bis später!', es: '¡Hasta luego!', en: 'See you later!', gloss: 'hasta más-tarde', lemmas: ['bis','spät'], level: 1, type: 'phrase', note: '' },
    { id: 'seed_007', de: 'Entschuldigung, ich verstehe das nicht.', es: 'Perdón, no entiendo eso.', en: "Sorry, I don't understand that.", gloss: 'perdón, yo entiendo eso no', lemmas: ['Entschuldigung','ich','verstehen','das','nicht'], level: 2, type: 'sentence', note: '"nicht" va al final.' },
    { id: 'seed_008', de: 'Kannst du das bitte wiederholen?', es: '¿Puedes repetirlo, por favor?', en: 'Can you repeat that please?', gloss: 'puedes tú eso por-favor repetir', lemmas: ['können','du','das','bitte','wiederholen'], level: 2, type: 'question', note: 'El verbo principal va al final.' }
  ]
}];

function read() {
  if (!fs.existsSync(DIR)) return [];
  return fs.readdirSync(DIR)
    .filter(f => /^pack_.*\.json$/.test(f))
    .map(f => {
      const p = path.join(DIR, f);
      try {
        const j = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (!j || !Array.isArray(j.chunks)) throw new Error('no chunks[]');
        return j;
      } catch (e) {
        console.error(`  ✗ ${f}: ${e.message}`);
        return null;
      }
    })
    .filter(Boolean);
}

function clean(packs) {
  const seenId = new Set();
  const seenDe = new Set();
  let dropped = 0;

  packs.forEach(p => {
    p.chunks = p.chunks.filter(c => {
      if (!c || typeof c.de !== 'string' || !c.de.trim()) { dropped++; return false; }
      if (!c.es && !c.en) { dropped++; return false; }
      const dk = c.de.trim().toLowerCase();
      if (seenDe.has(dk)) { dropped++; return false; }
      seenDe.add(dk);
      if (!c.id || seenId.has(c.id)) c.id = p.packId + '_' + Math.random().toString(36).slice(2, 9);
      seenId.add(c.id);
      c.level = Math.max(1, Math.min(5, +c.level || 1));
      c.type = c.type || 'phrase';
      c.gloss = c.gloss || '';
      c.note = c.note || '';
      c.lemmas = Array.isArray(c.lemmas) ? c.lemmas.map(String) : [];
      if (c.type === 'frame' && !/_/.test(c.de)) c.type = 'sentence';
      if (c.fillers && !Array.isArray(c.fillers)) delete c.fillers;
      return true;
    });
    // Teaching order. Not simply "shortest first" — a bare one-word item
    // like "Okay!" is a terrible thing to meet first. Inside a level we
    // favour real multi-word chunks of ~3 words, and push isolated words
    // and near-identical cognates to the back.
    const score = c => {
      const wc = c.de.trim().split(/\s+/).length;
      let s = Math.abs(wc - 3);                       // 3-word chunks first
      if (c.type === 'word' || wc === 1) s += 40;     // isolated words last
      if (c.type === 'frame') s -= 1;                 // frames are high value
      const de = c.de.toLowerCase().replace(/[^a-zäöüß]/g, '');
      const es = String(c.es || '').toLowerCase().replace(/[^a-záéíóúñ]/g, '');
      if (de && de === es) s += 25;                   // "Okay" teaches nothing
      return s;
    };
    p.chunks.sort((a, b) => (a.level - b.level) || (score(a) - score(b)) || (a.de.length - b.de.length));
  });

  return dropped;
}

/* ============================================================
   Coverage: which of the canonical high-frequency lemmas does
   each chunk actually teach?
   ------------------------------------------------------------
   Matching German by string equality badly undercounts — "gehen"
   shows up as geht/ging/gegangen, "das Haus" as Häuser. So each
   lemma expands into a form set (declared irregulars + plural)
   plus a stem for prefix matching, and every chunk stores the
   indices it covers. The word meter then counts real coverage
   instead of guessing.
   ============================================================ */
const AUX = new Set(['ist', 'hat', 'sind', 'haben', 'sein', 'war', 'wird', 'sich', 'trennbar', 'er', 'sie', 'es']);

const norm = s => String(s || '').toLowerCase()
  .replace(/ß/g, 'ss').replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u')
  .replace(/[^a-z]/g, '');

const EXTRA_FORMS = {
  sein: ['bin', 'bist', 'ist', 'sind', 'seid', 'war', 'waren', 'gewesen', 'ware'],
  haben: ['habe', 'hast', 'hat', 'habt', 'hatte', 'hatten', 'gehabt', 'hatte'],
  werden: ['werde', 'wirst', 'wird', 'werdet', 'wurde', 'wurden', 'geworden'],
  ich: ['mich', 'mir'], du: ['dich', 'dir'], wir: ['uns'], ihr: ['euch'],
  der: ['die', 'das', 'den', 'dem', 'des'], ein: ['eine', 'einen', 'einem', 'einer', 'eines'],
  mein: ['meine', 'meinen', 'meinem', 'meiner'], nicht: ['nichts']
};

function buildCoverage(packs, lemmas) {
  const exact = new Map();   // normalised form → Set(lemma index)
  const stems = new Map();   // stem (>=4 chars) → Set(lemma index)
  const add = (m, k, i) => { if (!k) return; if (!m.has(k)) m.set(k, new Set()); m.get(k).add(i); };

  lemmas.forEach((L, i) => {
    const lemma = String(L.lemma || '');
    const key = norm(lemma);
    if (!key) return;
    add(exact, key, i);

    (EXTRA_FORMS[lemma.toLowerCase()] || []).forEach(f => add(exact, norm(f), i));

    // forms declared by the frequency pass: "geht / ist gegangen"
    String(L.irregular || '').split(/[\s/(),]+/).forEach(tok => {
      const t = norm(tok);
      if (t.length >= 2 && !AUX.has(t)) add(exact, t, i);
    });
    String(L.plural || '').split(/[\s/(),]+/).forEach(tok => {
      const t = norm(tok);
      if (t.length >= 3 && !['der', 'die', 'das'].includes(t)) add(exact, t, i);
    });

    // stem for inflected matches — 4+ chars only, or "sei" would swallow "Seite"
    const stem = key.replace(/(en|n|e)$/, '');
    if (stem.length >= 4) add(stems, stem, i);
  });

  let covered = new Set();
  packs.forEach(p => p.chunks.forEach(c => {
    const hits = new Set();

    (c.lemmas || []).forEach(l => {
      const k = norm(l);
      if (exact.has(k)) exact.get(k).forEach(i => hits.add(i));
      const st = k.replace(/(en|n|e)$/, '');
      if (st.length >= 4 && stems.has(st)) stems.get(st).forEach(i => hits.add(i));
    });

    const words = String(c.de).split(/[\s'’]+/).map(norm).filter(Boolean);
    words.forEach(w => {
      if (exact.has(w)) exact.get(w).forEach(i => hits.add(i));
      for (let L = 4; L <= w.length; L++) {
        const s = w.slice(0, L);
        if (stems.has(s)) stems.get(s).forEach(i => hits.add(i));
      }
    });

    c.cov = Array.from(hits).sort((a, b) => a - b);
    c.cov.forEach(i => covered.add(i));
  }));

  return covered.size;
}

function main() {
  let packs = read();
  if (!packs.length) {
    console.log('⚠️  No pack_*.json found — writing the starter set instead.');
    packs = SEED;
  }

  const dropped = clean(packs);
  packs.sort((a, b) => {
    const i = PACK_ORDER.indexOf(a.packId), j = PACK_ORDER.indexOf(b.packId);
    return (i < 0 ? 99 : i) - (j < 0 ? 99 : j);
  });

  let total = 0;
  packs.forEach(p => { total += p.chunks.length; });

  // canonical high-frequency list (from the frequency pass)
  let lemmas = [];
  const lp = path.join(DIR, 'lemmas.json');
  if (fs.existsSync(lp)) {
    try { lemmas = JSON.parse(fs.readFileSync(lp, 'utf8')); } catch (e) { console.error('  ✗ lemmas.json: ' + e.message); }
  }
  if (!Array.isArray(lemmas)) lemmas = [];

  const coveredCount = lemmas.length ? buildCoverage(packs, lemmas) : 0;

  const data = {
    version: 2,
    builtAt: new Date().toISOString(),
    lemmas: lemmas.map(l => ({ w: l.lemma, a: l.article || '', es: l.es || '', en: l.en || '', p: l.pos || '', r: l.rank || 0 })),
    packs
  };

  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(OUT, 'window.GQ_DATA = ' + JSON.stringify(data) + ';\n');

  const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
  console.log(`✓ ${OUT}`);
  console.log(`  packs   : ${packs.length}`);
  console.log(`  chunks  : ${total}${dropped ? `  (${dropped} dropped as invalid/duplicate)` : ''}`);
  console.log(`  lemmas  : ${lemmas.length} canonical · ${coveredCount} covered by chunks (${lemmas.length ? Math.round(coveredCount / lemmas.length * 100) : 0}%)`);
  console.log(`  size    : ${kb} KB`);
  packs.forEach(p => console.log(`    · ${p.packId.padEnd(18)} ${String(p.chunks.length).padStart(4)} chunks`));
}

main();
