# Sprachquest 🗡️🇩🇪

Un RPG top-down (estilo Pokémon/Zelda) para aprender alemán de verdad: explorar, hablar con NPCs, y combatir con lo que sabes decir.

```bash
cd german-quest && python3 -m http.server 8777
```

Y abre **http://localhost:8777**.

> Se puede abrir el `index.html` directamente con doble clic, pero el chat con IA necesita el servidor local (CORS).

---

## Cómo se juega

| Acción | Teclado | Móvil |
|---|---|---|
| Moverse | `WASD` / flechas | D-pad |
| Hablar / continuar / responder | `ESPACIO` o `Enter` | botón `●` |
| Wortschatz (tu diccionario) | `J` | 📖 |
| Repasar lo que toca hoy | `R` | 🔁 |
| Mapa y viaje rápido | `M` | 🗺️ |
| Wörterdex | `D` | 👾 |
| Tagesaufgaben | `Q` | 📋 |
| Cerrar / atrás | `Esc` | ✕ |

**El bucle:** hablas con un **Lehrer** (👵🧙) → te enseña 6 chunks nuevos con audio, traducción y glosa literal → te examina al instante → los **Wortgeister** de la hierba alta y los **Trainer** te los devuelven días después → el **jefe** de cada región solo cae si mantienes una conversación real en alemán.

Cada región se desbloquea al dominar suficientes expresiones. No hay forma de saltárselo.

---

## Lo que te hace volver

Aprender funciona si vuelves mañana. Estos sistemas están copiados de los juegos que mejor retienen:

**👾 Wörterdex — 24 Wortgeister que capturar.** Cada uno vive en una región y tiene rareza (häufig / selten / legendär). No se compran: se capturan, y solo si tu precisión en el combate supera su umbral (55% / 75% / 90%). Un legendario exige casi la perfección.

**✨ Shiny (1 entre 32).** La recompensa variable. Cada encuentro es un billete de lotería, y una recompensa impredecible engancha mucho más que una fija. Un shiny duplica su efecto.

**🎒 Equipo de 3.** Los Wortgeister capturados no son cromos muertos: equipa tres y sus efectos se suman — más XP, más monedas, pistas gratis, escudos que te perdonan un fallo, curación al terminar. La colección alimenta el juego.

**⚡ Series y críticos.** Aciertos seguidos suben el multiplicador: 5 → `SERIE!` ×1.5, 10 → `STARK!` ×2, 15 → `IN FLAMMEN!` ×2.5, 25 → `UNAUFHALTSAM!` ×3. Un fallo lo rompe. Los críticos hacen doble daño con pantalla temblando.

**📋 Tres aufgaben diarias + Tagestruhe.** Se renuevan a medianoche. Completa las tres y la cofre suelta entre 50 y 200 monedas (variable, claro).

**🔥 Racha con escudo.** La racha se cuenta sola. El **Streak-Schutz** de la tienda te salva un día que no juegues — porque romper una racha larga es donde la mayoría de la gente abandona para siempre.

**🏅 14 Abzeichen** desde "Erste Worte" (10 expresiones) hasta "Tausend Wörter" y el Wörterdex completo.

**🛒 Laden.** Las monedas se gastan en pociones, Streak-Schutz, Tipp-Marken, Geister-Köder (dobla los encuentros) y Glücksklee (triplica la probabilidad de shiny).

**Y el "juice":** screen shake, hit-stop de 60-110 ms, números flotantes, partículas, squash & stretch, confeti, banners a pantalla completa. Las mismas mecánicas sin esta capa se sienten como un formulario; con ella, como un juego.

---

## Por qué está diseñado así

No es gamificación por encima de una lista de vocabulario. Cada mecánica sale de un hallazgo concreto de la investigación en adquisición de segundas lenguas:

**1. Se aprenden trozos, no palabras.**
La unidad es el *chunk*: `Wie geht's dir?`, `Ich hätte gern einen Kaffee`, `Das macht nichts`. Los trozos llevan la gramática dentro y se recuperan de memoria como una sola pieza, así que hablas antes y con menos errores. Aprender `wie` + `gehen` + `du` por separado no te deja decir nada.

**2. Repetición espaciada (SM-2).**
Cada expresión tiene su propio calendario: 1 min → 10 min → 1 día → y creciendo según lo bien que la recuerdes. El *spacing effect* es de los resultados más replicados de la psicología cognitiva: repasar distribuido retiene mucho más que repasar todo seguido.

**3. Recuperación, no relectura.**
Nunca "vuelve a mirar la lista". Cada pregunta te obliga a sacarlo de la cabeza, que es el acto que consolida la memoria.

**4. Dificultad expansiva.**
El tipo de pregunta sube con tu fuerza en esa expresión:

`reconocer → escuchar → ordenar → rellenar hueco → producir de cero`

Reconocer es fácil y engaña: te hace *creer* que lo sabes. Producir es lo que se transfiere a hablar. Por eso la dificultad sube justo cuando algo se vuelve cómodo (*desirable difficulty*).

**5. Reaprendizaje sucesivo.**
Si fallas, la expresión no desaparece: vuelve 2-3 preguntas después, dentro del mismo combate. Fallar y acertar poco después es más potente que acertar a la primera.

**6. Producción forzada (output).**
Los jefes son conversaciones, no exámenes. Solo notas los huecos de tu alemán cuando intentas producirlo. Cada jefe te pide usar N expresiones concretas hablando, y se detectan automáticamente.

**7. Corrección por reformulación (recast).**
La IA nunca te da una clase de gramática: reescribe bien lo que dijiste y sigue la conversación. Es el tipo de corrección que sobrevive a una conversación real sin cortarla.

**8. Input comprensible al 95-98%.**
La IA solo puede usar expresiones que ya has visto, más **un** elemento nuevo por mensaje. Suficientemente conocido para entenderlo, suficientemente nuevo para aprender (*i+1*).

**9. Tolerancia a erratas.**
Una letra de más cuenta como acierto (con la forma correcta a la vista) pero puntúa "difícil". Castigar una errata no enseña alemán, solo desanima.

---

## Las 1000 palabras

| | |
|---|---|
| Palabras de la lista de frecuencia | **1000** |
| Cubiertas por el contenido | **1000 (100%)** |
| Chunks totales | **3369** |
| Chunks por palabra | mínimo 2 · mediana 7 |
| Frames productivos | 297 |
| Con glosa palabra por palabra | 3369 (todos) |

La lista de frecuencia es de alemán **cotidiano** — corpus de subtítulos y habla, más las Wortlisten del Goethe-Institut — no de prensa ni de lenguaje académico. El contador `x / 1000 Wörter` del HUD es real: cada chunk lleva precalculado qué palabras de la lista enseña, contando formas flexionadas (`geht` → `gehen`, `Häuser` → `Haus`, `ist gegangen` → `gehen`).

Ninguna palabra aparece en menos de **2 chunks distintos**: encontrarse una palabra en varios contextos es lo que la fija, mucho más que repetir la misma frase.

Todo el contenido pasó por dos filtros: generación por tema y luego una revisión estricta de profesor nativo de DaF — gramática, caso, género, orden de palabras, si un alemán de verdad lo diría hoy, traducciones, glosas y niveles — aplicada directamente sobre cada fichero.

---

## Hablar con la IA

Opcional. Sin key el juego funciona entero; los jefes usan diálogos guionizados más limitados.

**Optionen → Anthropic API key** (`sk-ant-…`). Se guarda **solo** en el `localStorage` de tu navegador, no se sube a ningún sitio.

También hay 🎤 (reconocimiento de voz, `de-DE`) y audio TTS en alemán en todas las pantallas — pincha cualquier frase para oírla.

---

## Estructura

```
german-quest/
├── index.html          pantallas y layout
├── css/style.css
├── js/
│   ├── srs.js          repetición espaciada + corrección de respuestas
│   ├── audio.js        TTS alemán + efectos
│   ├── world.js        mapas, regiones, NPCs, render del canvas
│   ├── battle.js       motor de recuperación (los 6 tipos de pregunta)
│   ├── ai.js           conversación, recasts, detección de objetivos
│   └── game.js         estado, bucle, lecciones, progresión
├── data/
│   ├── lemmas.json     lista canónica de frecuencia
│   ├── pack_*.json     contenido por tema (editable a mano)
│   └── chunks.js       ← generado, es lo que carga el juego
└── build.js            data/pack_*.json → data/chunks.js
```

**Para añadir o corregir contenido:** edita el `data/pack_*.json` que toque y ejecuta:

```bash
node build.js
```

`build.js` valida, quita duplicados, ordena por valor pedagógico (los chunks de ~3 palabras primero, las palabras sueltas al final) y recalcula la cobertura de las 1000 palabras.

La partida se guarda sola en `localStorage`. En **Optionen** puedes exportarla o importarla como fichero.
