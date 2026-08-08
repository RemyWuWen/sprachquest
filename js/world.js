/* ============================================================
   world.js — tilemaps, regions, NPCs, rendering
   ============================================================ */

const TS = 32;                 // tile size
const VIEW_W = 20, VIEW_H = 15; // tiles on screen

const T = {
  GRASS: 0, PATH: 1, TREE: 2, WATER: 3, WALL: 4, ROOF: 5, DOOR: 6,
  FLOWER: 7, SAND: 8, STONE: 9, FENCE: 10, BUSH: 11, SIGN: 12,
  WOOD: 13, STALL: 14, ROCK: 15, TALL: 16, ROOF2: 17, WINDOW: 18,
  CARPET: 19, RAIL: 20, SNOW: 21, LAVAROCK: 22
};

const SOLID = new Set([T.TREE, T.WATER, T.WALL, T.ROOF, T.ROOF2, T.FENCE,
                       T.SIGN, T.STALL, T.ROCK, T.WINDOW, T.RAIL]);

/* ---------------- seeded RNG ---------------- */
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ---------------- map painter ---------------- */
class Painter {
  constructor(w, h, base, seed) {
    this.w = w; this.h = h;
    this.g = Array.from({ length: h }, () => new Array(w).fill(base));
    this.rnd = mulberry32(seed);
  }
  inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  set(x, y, t) { if (this.inb(x, y)) this.g[y][x] = t; }
  get(x, y) { return this.inb(x, y) ? this.g[y][x] : T.TREE; }
  rect(x, y, w, h, t) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, t); }
  border(t, n) {
    n = n || 1;
    for (let i = 0; i < this.w; i++) for (let k = 0; k < n; k++) { this.set(i, k, t); this.set(i, this.h - 1 - k, t); }
    for (let j = 0; j < this.h; j++) for (let k = 0; k < n; k++) { this.set(k, j, t); this.set(this.w - 1 - k, j, t); }
  }
  hpath(x1, x2, y, t, w) {
    w = w || 2;
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++)
      for (let k = 0; k < w; k++) this.set(x, y + k, t || T.PATH);
  }
  vpath(y1, y2, x, t, w) {
    w = w || 2;
    for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++)
      for (let k = 0; k < w; k++) this.set(x + k, y, t || T.PATH);
  }
  /** house with roof, walls, a door and windows */
  house(x, y, w, h, roof) {
    this.rect(x, y, w, 2, roof || T.ROOF);
    this.rect(x, y + 2, w, h - 2, T.WALL);
    const dx = x + Math.floor(w / 2);
    this.set(dx, y + h - 1, T.DOOR);
    if (w >= 4) { this.set(x + 1, y + 2, T.WINDOW); this.set(x + w - 2, y + 2, T.WINDOW); }
  }
  pond(cx, cy, r) {
    for (let y = cy - r; y <= cy + r; y++)
      for (let x = cx - r - 1; x <= cx + r + 1; x++) {
        const d = Math.hypot((x - cx) * .75, y - cy);
        if (d < r) this.set(x, y, T.WATER);
        else if (d < r + 1.1) this.set(x, y, T.SAND);
      }
  }
  /* Decoration rules. Walkable props may land on any walkable ground
     (so cobbled squares get planters too); blocking props stay on open
     terrain only, or they would plug streets and doorways. */
  canPaint(x, y, t) {
    const cur = this.get(x, y);
    if (SOLID.has(cur) || cur === T.DOOR) return false;
    if (SOLID.has(t)) return cur === T.GRASS || cur === T.SAND || cur === T.SNOW || cur === T.LAVAROCK;
    return true;
  }
  scatter(t, n, avoid) {
    let tries = 0;
    while (n > 0 && tries < n * 60) {
      tries++;
      const x = 1 + Math.floor(this.rnd() * (this.w - 2));
      const y = 1 + Math.floor(this.rnd() * (this.h - 2));
      if (!this.canPaint(x, y, t)) continue;
      if (avoid && avoid(x, y)) continue;
      this.set(x, y, t); n--;
    }
  }
  patch(x, y, w, h, t, density) {
    for (let j = y; j < y + h; j++)
      for (let i = x; i < x + w; i++)
        if (this.rnd() < (density || .7) && this.canPaint(i, j, t)) this.set(i, j, t);
  }
}

/* ============================================================
   REGIONS — each maps to one or two content packs
   ============================================================ */
const REGIONS = [
  {
    id: 'dorf', name: 'Willkommensdorf', icon: '🏡',
    desc: 'Donde empieza todo: saludos y las piezas básicas del idioma.',
    packs: ['greetings_social', 'core_grammar'],
    seed: 101, spawn: { x: 22, y: 26 }, unlockAt: 0,
    build(p) {
      p.border(T.TREE, 2);
      p.patch(2, 2, 40, 8, T.TREE, .35);
      p.hpath(6, 38, 26, T.PATH, 3);
      p.vpath(10, 27, 21, T.PATH, 3);
      p.hpath(8, 22, 14, T.PATH, 2);
      p.house(7, 10, 6, 5);
      p.house(16, 9, 7, 6);
      p.house(28, 11, 6, 5);
      p.house(33, 20, 7, 6);
      p.house(6, 19, 6, 5);
      p.pond(35, 8, 4);
      p.patch(24, 28, 14, 5, T.TALL, .8);
      p.patch(4, 29, 12, 4, T.TALL, .75);
      p.set(20, 24, T.SIGN);
      p.scatter(T.TREE, 46);
      p.scatter(T.FLOWER, 40);
      p.scatter(T.BUSH, 22);
      p.scatter(T.ROCK, 8);
    },
    npcs: [
      { x: 18, y: 12, face: '👵', name: 'Oma Gerda', role: 'teacher', pack: 'greetings_social',
        greet: 'Guten Tag! Ich bin Gerda. Wollen wir ein paar Sätze lernen?' },
      { x: 30, y: 14, face: '🧙', name: 'Meister Klaus', role: 'teacher', pack: 'core_grammar',
        greet: 'Wörter sind Bausteine. Ich zeige dir, wie man sie zusammensetzt.' },
      { x: 9, y: 22, face: '🧑‍🌾', name: 'Bauer Ernst', role: 'trainer', pack: 'greetings_social',
        greet: 'Du willst üben? Dann zeig mir, was du kannst!' },
      { x: 36, y: 23, face: '🦉', name: 'Die Eule', role: 'boss', pack: 'greetings_social',
        greet: 'Hu-hu! Sprich mit mir — nur auf Deutsch.' },
      { x: 21, y: 24, face: '🚩', name: 'Schild', role: 'sign',
        greet: 'Willkommensdorf — hier beginnt deine Reise.' }
    ]
  },
  {
    id: 'markt', name: 'Der Marktplatz', icon: '🥨',
    desc: 'Comida, bebida, dinero y compras. Todo lo que dirás cada día.',
    packs: ['food_drink', 'shopping_money'],
    seed: 202, spawn: { x: 22, y: 30 }, unlockAt: 22,
    build(p) {
      p.rect(0, 0, 44, 34, T.STONE);
      p.border(T.WALL, 1);
      // cobbled square with a fountain at its heart
      p.rect(6, 5, 32, 22, T.PATH);
      p.rect(19, 13, 6, 4, T.WATER);
      p.rect(18, 12, 8, 1, T.SAND); p.rect(18, 17, 8, 1, T.SAND);
      p.rect(18, 13, 1, 4, T.SAND); p.rect(25, 13, 1, 4, T.SAND);
      // two rows of market stalls with gaps you can walk through
      for (let i = 0; i < 5; i++) {
        p.rect(8 + i * 6, 7, 4, 2, T.STALL);
        p.rect(8 + i * 6, 22, 4, 2, T.STALL);
      }
      // green grocers' stands — these are where the Wortgeister hide
      p.patch(7, 10, 4, 3, T.TALL, .9);
      p.patch(33, 10, 4, 3, T.TALL, .9);
      p.patch(7, 18, 4, 2, T.TALL, .85);
      p.patch(33, 18, 4, 2, T.TALL, .85);
      // shopfronts around the square
      p.house(2, 2, 6, 5, T.ROOF2);
      p.house(36, 2, 6, 5, T.ROOF2);
      p.house(2, 27, 7, 6, T.ROOF2);
      p.house(35, 27, 7, 6, T.ROOF2);
      p.house(19, 1, 7, 4, T.ROOF);
      p.vpath(27, 33, 21, T.PATH, 3);
      p.hpath(1, 43, 30, T.PATH, 2);
      // crates, benches, planters
      [[12, 12], [30, 15], [14, 19], [28, 11], [16, 15]].forEach(([x, y]) => p.rect(x, y, 2, 1, T.WOOD));
      p.scatter(T.BUSH, 16);
      p.scatter(T.FLOWER, 22);
    },
    npcs: [
      { x: 12, y: 11, face: '👨‍🍳', name: 'Bäcker Bruno', role: 'teacher', pack: 'food_drink',
        greet: 'Frische Brötchen! Willst du bestellen lernen?' },
      { x: 31, y: 21, face: '👩‍💼', name: 'Frau Meier', role: 'teacher', pack: 'shopping_money',
        greet: 'Zahlen Sie bar oder mit Karte? Das üben wir jetzt.' },
      { x: 16, y: 21, face: '🧑‍🍳', name: 'Koch Timo', role: 'trainer', pack: 'food_drink',
        greet: 'Schnell! Die Küche wartet. Antworte zügig!' },
      { x: 22, y: 8, face: '🐉', name: 'Der Marktdrache', role: 'boss', pack: 'shopping_money',
        greet: 'Kauf etwas bei mir — aber nur auf Deutsch!' }
    ]
  },
  {
    id: 'viertel', name: 'Das Wohnviertel', icon: '🏘️',
    desc: 'Tu casa, tu rutina, tu familia: el vocabulario de cada mañana.',
    packs: ['home_routine', 'people_family'],
    seed: 303, spawn: { x: 21, y: 31 }, unlockAt: 46,
    build(p) {
      p.border(T.TREE, 2);
      p.hpath(4, 40, 12, T.PATH, 3);
      p.hpath(4, 40, 24, T.PATH, 3);
      p.vpath(12, 26, 21, T.PATH, 3);
      p.vpath(31, 24, 21, T.PATH, 3);
      for (let i = 0; i < 4; i++) p.house(5 + i * 9, 5, 7, 6);
      for (let i = 0; i < 4; i++) p.house(5 + i * 9, 17, 7, 6);
      p.rect(4, 27, 36, 4, T.GRASS);
      p.patch(5, 27, 34, 4, T.TALL, .55);
      p.scatter(T.TREE, 30); p.scatter(T.FLOWER, 34); p.scatter(T.BUSH, 18);
    },
    npcs: [
      { x: 9, y: 14, face: '👨‍👩‍👧', name: 'Familie Wolf', role: 'teacher', pack: 'people_family',
        greet: 'Wir sind eine große Familie. Komm rein!' },
      { x: 31, y: 14, face: '🧹', name: 'Herr Ordnung', role: 'teacher', pack: 'home_routine',
        greet: 'Erst aufräumen, dann lernen. Oder beides gleichzeitig!' },
      { x: 21, y: 20, face: '🐕', name: 'Hund Bello', role: 'trainer', pack: 'home_routine',
        greet: 'Wuff! (Er will offensichtlich üben.)' },
      { x: 36, y: 28, face: '🧛', name: 'Nachbar Nachts', role: 'boss', pack: 'people_family',
        greet: 'Erzähl mir von deiner Familie… ich habe Zeit. Viel Zeit.' }
    ]
  },
  {
    id: 'stadt', name: 'Die Stadt', icon: '🏙️',
    desc: 'Transporte, direcciones, trabajo y estudios.',
    packs: ['city_travel', 'work_school'],
    seed: 404, spawn: { x: 21, y: 31 }, unlockAt: 74,
    build(p) {
      p.rect(0, 0, 44, 34, T.STONE);
      p.border(T.WALL, 1);
      for (let i = 0; i < 4; i++) p.hpath(2, 41, 5 + i * 8, T.PATH, 3);
      for (let i = 0; i < 5; i++) p.vpath(2, 32, 4 + i * 9, T.PATH, 3);
      p.house(8, 9, 8, 6, T.ROOF2);
      p.house(24, 9, 9, 6, T.ROOF2);
      p.house(8, 25, 8, 6, T.ROOF2);
      p.house(26, 25, 9, 6, T.ROOF2);
      p.rect(15, 16, 16, 6, T.WOOD);       // Bahnhof platform
      p.rect(15, 19, 16, 1, T.RAIL);
      p.set(20, 15, T.SIGN);
      p.set(26, 15, T.SIGN);
      // little city parks — the only cover in town
      p.patch(2, 12, 5, 4, T.TALL, .8);
      p.patch(37, 12, 5, 4, T.TALL, .8);
      p.patch(19, 29, 8, 3, T.TALL, .7);
      [[6, 7], [18, 7], [34, 7], [12, 23], [30, 23], [6, 31], [37, 31]]
        .forEach(([x, y]) => { p.set(x, y, T.BUSH); p.set(x + 1, y, T.FLOWER); });
      p.scatter(T.BUSH, 16);
      p.scatter(T.FLOWER, 14);
    },
    npcs: [
      { x: 20, y: 22, face: '🚉', name: 'Schaffner Ali', role: 'teacher', pack: 'city_travel',
        greet: 'Einmal nach Berlin, bitte! So fragt man richtig.' },
      { x: 12, y: 16, face: '👩‍🏫', name: 'Frau Doktor Lang', role: 'teacher', pack: 'work_school',
        greet: 'Arbeit, Schule, Termine — die Sprache des Alltags.' },
      { x: 30, y: 16, face: '🚕', name: 'Taxi-Tom', role: 'trainer', pack: 'city_travel',
        greet: 'Wohin soll es gehen? Schnell, der Zähler läuft!' },
      { x: 30, y: 31, face: '🤖', name: 'Der Automat', role: 'boss', pack: 'work_school',
        greet: 'SYSTEM BEREIT. SPRECHEN SIE DEUTSCH.' }
    ]
  },
  {
    id: 'park', name: 'Park & Klinik', icon: '🌳',
    desc: 'El cuerpo, la salud, los sentimientos, el tiempo y el ocio.',
    packs: ['health_body', 'weather_leisure'],
    seed: 505, spawn: { x: 21, y: 31 }, unlockAt: 104,
    build(p) {
      p.border(T.TREE, 2);
      p.pond(14, 12, 6);
      p.hpath(4, 40, 20, T.PATH, 3);
      p.vpath(6, 31, 21, T.PATH, 3);
      p.house(30, 6, 10, 8, T.ROOF2);      // Klinik
      p.rect(33, 4, 4, 2, T.WALL);
      p.patch(4, 24, 34, 6, T.TALL, .6);
      p.patch(24, 6, 6, 10, T.TALL, .5);
      p.scatter(T.TREE, 55); p.scatter(T.FLOWER, 50); p.scatter(T.BUSH, 26); p.scatter(T.ROCK, 10);
    },
    npcs: [
      { x: 34, y: 15, face: '👨‍⚕️', name: 'Doktor Sanft', role: 'teacher', pack: 'health_body',
        greet: 'Wo tut es weh? Keine Sorge — wir lernen es zusammen.' },
      { x: 10, y: 22, face: '🧘', name: 'Yoga-Yuki', role: 'teacher', pack: 'weather_leisure',
        greet: 'Atme ein… und erzähl mir von deinem Wochenende.' },
      { x: 24, y: 22, face: '⚽', name: 'Trainer Toni', role: 'trainer', pack: 'weather_leisure',
        greet: 'Aufwärmen! Fünf Runden Vokabeln!' },
      { x: 8, y: 8, face: '🌪️', name: 'Der Sturmgeist', role: 'boss', pack: 'health_body',
        greet: 'Wie geht es dir WIRKLICH? Antworte, oder ich blase dich weg!' }
    ]
  },
  {
    id: 'turm', name: 'Der Sprachturm', icon: '🗼',
    desc: 'Conectores, partículas y la prueba final: hablar de verdad.',
    packs: ['core_connect'],
    seed: 606, spawn: { x: 21, y: 31 }, unlockAt: 140,
    build(p) {
      p.rect(0, 0, 44, 34, T.LAVAROCK);
      p.border(T.ROCK, 2);
      p.rect(11, 3, 22, 26, T.STONE);      // tower floor
      p.rect(13, 5, 18, 22, T.CARPET);     // the long red carpet up to the throne
      p.rect(17, 6, 10, 7, T.WOOD);        // dais
      p.vpath(27, 33, 21, T.STONE, 3);
      // braziers and pillars flanking the aisle
      for (let i = 0; i < 5; i++) {
        p.set(14, 8 + i * 4, T.ROCK); p.set(29, 8 + i * 4, T.ROCK);
      }
      // creeping vines — the last Wortgeister make their stand here
      p.patch(3, 6, 6, 20, T.TALL, .55);
      p.patch(35, 6, 6, 20, T.TALL, .55);
      p.patch(15, 24, 14, 3, T.TALL, .4);
      p.scatter(T.ROCK, 30);
    },
    npcs: [
      { x: 21, y: 16, face: '📜', name: 'Der Schreiber', role: 'teacher', pack: 'core_connect',
        greet: 'Weil, obwohl, deshalb… Damit klebst du Sätze zusammen.' },
      { x: 16, y: 22, face: '⚔️', name: 'Wächter Wolf', role: 'trainer', pack: 'core_connect',
        greet: 'Niemand geht nach oben, ohne mich zu schlagen.' },
      { x: 21, y: 9, face: '👑', name: 'Die Sprachkönigin', role: 'boss', pack: 'core_connect', final: true,
        greet: 'Du bist weit gekommen. Jetzt reden wir — richtig.' }
    ]
  }
];

/* ============================================================
   World runtime
   ============================================================ */
const World = (() => {
  let region = null, grid = null, npcs = [];

  /** flood fill of everything the player can actually walk to */
  function reachableFrom(g, sx, sy) {
    const seen = Array.from({ length: 34 }, () => new Array(44).fill(false));
    if (SOLID.has(g[sy][sx])) g[sy][sx] = T.PATH;
    const q = [[sx, sy]];
    seen[sy][sx] = true;
    while (q.length) {
      const [x, y] = q.pop();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= 44 || ny >= 34) continue;
        if (seen[ny][nx] || SOLID.has(g[ny][nx])) continue;
        seen[ny][nx] = true;
        q.push([nx, ny]);
      }
    }
    return seen;
  }

  /** nearest tile the player can stand next to, spiralling out from (x,y).
      Prefers open ground so an NPC never plugs a one-tile corridor. */
  function nearestReachable(g, seen, taken, x, y) {
    let fallback = null;
    for (let r = 0; r < 24; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 1 || ny < 1 || nx >= 43 || ny >= 33) continue;
          if (!seen[ny][nx] || taken.has(nx + ',' + ny)) continue;
          const open = [[1, 0], [-1, 0], [0, 1], [0, -1]]
            .filter(([ax, ay]) => !SOLID.has(g[ny + ay][nx + ax])).length;
          if (open >= 3) return [nx, ny];
          if (!fallback) fallback = [nx, ny];
        }
      }
    }
    return fallback || [x, y];
  }

  function load(regionId) {
    const def = REGIONS.find(r => r.id === regionId) || REGIONS[0];
    const p = new Painter(44, 34, T.GRASS, def.seed);
    def.build(p);
    p.set(def.spawn.x, def.spawn.y, T.PATH);

    // Buildings stay solid; instead we MOVE any NPC that ended up walled in
    // to the nearest tile the player can actually reach.
    const seen = reachableFrom(p.g, def.spawn.x, def.spawn.y);
    const taken = new Set([def.spawn.x + ',' + def.spawn.y]);
    npcs = def.npcs.map(n => {
      let [x, y] = [n.x, n.y];
      if (!seen[y][x] || taken.has(x + ',' + y)) [x, y] = nearestReachable(p.g, seen, taken, x, y);
      taken.add(x + ',' + y);
      return { ...n, x, y, bob: Math.random() * 6.28 };
    });

    region = def; grid = p.g;
    return def;
  }

  const tileAt = (tx, ty) => (grid && grid[ty] ? (grid[ty][tx] ?? T.TREE) : T.TREE);
  const solidAt = (tx, ty) => SOLID.has(tileAt(tx, ty));

  function npcAt(tx, ty) { return npcs.find(n => n.x === tx && n.y === ty); }

  /* ---------------- drawing ---------------- */
  const COL = {
    [T.GRASS]:  ['#3d8548', '#3a7f45'],
    [T.PATH]:   ['#b59468', '#b08e62'],
    [T.TREE]:   ['#1f5a2e', '#17482a'],
    [T.WATER]:  ['#2f6fb5', '#2a63a3'],
    [T.WALL]:   ['#c9b39a', '#bda688'],
    [T.ROOF]:   ['#a8443a', '#8e372f'],
    [T.ROOF2]:  ['#5a5f7a', '#4a4e66'],
    [T.DOOR]:   ['#6b4423', '#5a3a1d'],
    [T.FLOWER]: ['#3d8548', '#3a7f45'],
    [T.SAND]:   ['#ddc98d', '#d0bc80'],
    [T.STONE]:  ['#8d8f96', '#7f8188'],
    [T.FENCE]:  ['#8a6b45', '#7a5d3b'],
    [T.BUSH]:   ['#3d8548', '#3a7f45'],
    [T.SIGN]:   ['#b99a6b', '#8a6b45'],
    [T.WOOD]:   ['#9c7b52', '#8d6f49'],
    [T.STALL]:  ['#c25b4a', '#a94b3d'],
    [T.ROCK]:   ['#7d7d85', '#6b6b73'],
    [T.TALL]:   ['#2f7a3c', '#286b34'],
    [T.WINDOW]: ['#6fb6d8', '#5aa2c6'],
    [T.CARPET]: ['#6d3f7a', '#5d3468'],
    [T.RAIL]:   ['#5a5a60', '#4a4a50'],
    [T.SNOW]:   ['#e8f0f7', '#dae4ee'],
    [T.LAVAROCK]:['#3a2b34', '#332630'],
  };

  function drawTile(ctx, t, px, py, tx, ty) {
    const c = COL[t] || COL[T.GRASS];
    ctx.fillStyle = ((tx + ty) & 1) ? c[0] : c[1];
    ctx.fillRect(px, py, TS, TS);

    switch (t) {
      case T.TREE:
        ctx.fillStyle = '#4a2f1c'; ctx.fillRect(px + 13, py + 20, 6, 11);
        ctx.fillStyle = '#2c7a3d'; ctx.beginPath(); ctx.arc(px + 16, py + 15, 13, 0, 6.3); ctx.fill();
        ctx.fillStyle = '#37945071'; ctx.beginPath(); ctx.arc(px + 12, py + 11, 7, 0, 6.3); ctx.fill();
        break;
      case T.FLOWER:
        ctx.fillStyle = ['#ffd34d','#ff7ba6','#ffffff','#c48bff'][(tx * 7 + ty * 3) % 4];
        ctx.fillRect(px + 12, py + 13, 4, 4); ctx.fillRect(px + 19, py + 20, 4, 4);
        break;
      case T.BUSH:
        ctx.fillStyle = '#2c6f38'; ctx.beginPath(); ctx.arc(px + 16, py + 19, 11, 0, 6.3); ctx.fill();
        break;
      case T.TALL:
        ctx.fillStyle = '#256b31';
        for (let i = 0; i < 5; i++) { const gx = px + 3 + i * 6; ctx.fillRect(gx, py + 14 + ((i + tx) % 3) * 2, 3, 16); }
        break;
      case T.WATER: {
        ctx.fillStyle = 'rgba(255,255,255,.14)';
        const w = Math.sin((Date.now() / 420) + tx * .8 + ty * .5) * 4;
        ctx.fillRect(px + 5 + w, py + 10, 12, 2); ctx.fillRect(px + 13 - w, py + 21, 10, 2);
        break;
      }
      case T.DOOR:
        ctx.fillStyle = '#4a2f1c'; ctx.fillRect(px + 5, py + 4, 22, 28);
        ctx.fillStyle = '#ffd34d'; ctx.fillRect(px + 21, py + 18, 3, 3);
        break;
      case T.WINDOW:
        ctx.fillStyle = '#c9b39a'; ctx.fillRect(px, py, TS, TS);
        ctx.fillStyle = '#6fb6d8'; ctx.fillRect(px + 6, py + 7, 20, 18);
        ctx.fillStyle = '#8dcbe6'; ctx.fillRect(px + 6, py + 7, 20, 8);
        ctx.strokeStyle = '#7a5d3b'; ctx.lineWidth = 2; ctx.strokeRect(px + 6, py + 7, 20, 18);
        break;
      case T.ROOF: case T.ROOF2:
        ctx.fillStyle = 'rgba(0,0,0,.18)';
        for (let i = 0; i < 32; i += 8) ctx.fillRect(px, py + i, TS, 2);
        break;
      case T.STALL:
        ctx.fillStyle = '#f2f2f2';
        for (let i = 0; i < 32; i += 10) ctx.fillRect(px + i, py, 5, TS);
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(px, py + 24, TS, 8);
        break;
      case T.ROCK:
        ctx.fillStyle = '#9a9aa2'; ctx.beginPath(); ctx.arc(px + 16, py + 20, 10, 0, 6.3); ctx.fill();
        ctx.fillStyle = '#b6b6be'; ctx.beginPath(); ctx.arc(px + 13, py + 17, 5, 0, 6.3); ctx.fill();
        break;
      case T.SIGN:
        ctx.fillStyle = '#6b4423'; ctx.fillRect(px + 14, py + 16, 4, 14);
        ctx.fillStyle = '#c9a06b'; ctx.fillRect(px + 4, py + 6, 24, 13);
        ctx.fillStyle = '#6b4423'; ctx.fillRect(px + 7, py + 10, 18, 2); ctx.fillRect(px + 7, py + 14, 12, 2);
        break;
      case T.FENCE:
        ctx.fillStyle = '#8a6b45'; ctx.fillRect(px + 2, py + 10, 4, 20); ctx.fillRect(px + 24, py + 10, 4, 20);
        ctx.fillRect(px, py + 14, TS, 4);
        break;
      case T.RAIL:
        ctx.fillStyle = '#3a3a40'; ctx.fillRect(px, py + 8, TS, 4); ctx.fillRect(px, py + 20, TS, 4);
        ctx.fillStyle = '#6b5b45'; for (let i = 0; i < 32; i += 10) ctx.fillRect(px + i, py + 6, 4, 20);
        break;
      case T.PATH:
        ctx.fillStyle = 'rgba(0,0,0,.05)';
        if ((tx * 3 + ty * 5) % 7 === 0) ctx.fillRect(px + 8, py + 12, 6, 4);
        break;
    }
  }

  function drawChar(ctx, px, py, dir, walk, body, hair, face) {
    const bob = walk ? Math.sin(Date.now() / 90) * 1.6 : 0;
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.beginPath(); ctx.ellipse(px + 16, py + 29, 10, 4, 0, 0, 6.3); ctx.fill();
    // body
    ctx.fillStyle = body; ctx.fillRect(px + 9, py + 15 + bob, 14, 13);
    // head
    ctx.fillStyle = '#f3c9a0'; ctx.fillRect(px + 8, py + 4 + bob, 16, 13);
    // hair
    ctx.fillStyle = hair; ctx.fillRect(px + 7, py + 2 + bob, 18, 6);
    if (dir === 'left') ctx.fillRect(px + 7, py + 2 + bob, 5, 12);
    if (dir === 'right') ctx.fillRect(px + 20, py + 2 + bob, 5, 12);
    // eyes (not when facing away)
    if (dir !== 'up') {
      ctx.fillStyle = '#20232a';
      const ox = dir === 'left' ? -2 : dir === 'right' ? 2 : 0;
      ctx.fillRect(px + 11 + ox, py + 10 + bob, 3, 3);
      ctx.fillRect(px + 18 + ox, py + 10 + bob, 3, 3);
    }
    // legs
    ctx.fillStyle = '#2c3446';
    const l = walk ? Math.sin(Date.now() / 90) * 3 : 0;
    ctx.fillRect(px + 10, py + 27 + bob, 5, 5 + l);
    ctx.fillRect(px + 17, py + 27 + bob, 5, 5 - l);
  }

  function drawNpc(ctx, n, px, py) {
    const bob = Math.sin(Date.now() / 380 + n.bob) * 2;
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath(); ctx.ellipse(px + 16, py + 29, 10, 4, 0, 0, 6.3); ctx.fill();
    ctx.font = '26px system-ui, "Apple Color Emoji", "Segoe UI Emoji"';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(n.face, px + 16, py + 15 + bob);
    if (n.role === 'teacher' || n.role === 'boss' || n.role === 'trainer') {
      const mark = n.role === 'boss' ? '!' : '?';
      ctx.font = 'bold 15px system-ui';
      ctx.fillStyle = n.role === 'boss' ? '#ff6b6b' : '#ffcf4d';
      ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
      const my = py - 6 + Math.sin(Date.now() / 260 + n.bob) * 3;
      ctx.strokeText(mark, px + 16, my); ctx.fillText(mark, px + 16, my);
    }
    ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
  }

  function render(ctx, cam, player) {
    const x0 = Math.floor(cam.x / TS), y0 = Math.floor(cam.y / TS);
    const ox = -(cam.x % TS), oy = -(cam.y % TS);

    for (let j = -1; j <= VIEW_H + 1; j++) {
      for (let i = -1; i <= VIEW_W + 1; i++) {
        const tx = x0 + i, ty = y0 + j;
        const px = ox + i * TS, py = oy + j * TS;
        if (tx < 0 || ty < 0 || tx >= 44 || ty >= 34) { ctx.fillStyle = '#12331c'; ctx.fillRect(px, py, TS, TS); continue; }
        drawTile(ctx, tileAt(tx, ty), px, py, tx, ty);
      }
    }

    // entities sorted by y so things overlap correctly
    const ents = npcs.map(n => ({ y: n.y * TS, draw: () => drawNpc(ctx, n, n.x * TS - cam.x, n.y * TS - cam.y) }));
    ents.push({ y: player.py, draw: () => drawChar(ctx, player.px - cam.x, player.py - cam.y, player.dir, player.moving, '#4a7bd4', '#3a2a1c') });
    ents.sort((a, b) => a.y - b.y).forEach(e => e.draw());

    // vignette
    const g = ctx.createRadialGradient(320, 240, 180, 320, 240, 430);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.30)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 640, 480);
  }

  return {
    load, render, tileAt, solidAt, npcAt,
    get region() { return region; },
    get npcs() { return npcs; },
    W: 44, H: 34
  };
})();
