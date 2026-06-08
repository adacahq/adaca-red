# Adaca Red — Design System (Ultra-Dark Canvas)

> The complete, implementation-ready specification for the Adaca Red visual
> language. This is the **ultra-dark editorial-canvas** aesthetic established on
> the public landing page (`adaca-website → src/pages/red/index.astro`). The app
> must look and feel like a continuation of that page: same palette, same
> typography, same grammar, same motion.
>
> **Reference implementation:** `adaca-website/src/pages/red/index.astro`.
> When this doc and the page disagree, the page wins — update this doc to match.
>
> **How to read this:** every section gives the *rule*, the *exact tokens*, and
> *paste-ready CSS*. Layout is done with Tailwind utilities; **colour is always
> applied via `var(--token)`**, never hard-coded in components (the one exception
> is the scroll-spine, explained in §11). This matches the repo convention in
> `CLAUDE.md` ("colour goes inline via `var(--token)`, layout via Tailwind").

---

## 0. TL;DR — the five things that make it _this_ design

1. **Near-black, not navy.** Background is `#080a0f`. This is deliberately
   darker than the marketing site's navy dark (`#15293e`). It is the signature.
2. **Orange is the _only_ accent.** `#f87854`. One warm colour against a cold
   near-black. Never introduce a second hue. (The name "Red" is not a colour
   instruction — see `CLAUDE.md`.)
3. **Hairlines, never boxes.** 1px borders at `rgba(255,255,255,0.09)`. No
   border-radius anywhere. No drop shadows on surfaces (glows are allowed as
   *ambient* light only).
4. **Mono for machinery, sans for prose.** Geist Mono (uppercase, letter-spaced)
   for labels, numerals, code, status, data. Geist for headings and body.
5. **Restraint, then one moment of motion.** A quiet grid; an orchestrated
   page-load; scroll-reveals; *one* interactive showpiece per view. Never busy.

---

## 1. Design principles

- **Editorial, instrument-like.** The UI reads like a precision document or a
  control surface: registration marks, zone tags, revision stamps, axis lines,
  monospaced annotations. Every screen should feel *measured*.
- **The data is the hero.** Chrome recedes (hairlines, muted labels) so numbers,
  scores, names and statuses carry the colour and weight.
- **Cold canvas, warm signal.** The near-black/grey field is neutral and calm;
  orange marks the one thing that matters in any given context (the active item,
  the score, the primary action, the graded edge).
- **Honesty over polish.** Don't invent states or claims in the UI. Empty is
  empty; "planned" is planned. (Carries the `red.md` lesson: never show a value
  the system didn't actually compute.)
- **Deterministic, always.** Colours, especially for scores/series, are derived
  from data, never random. (Directly fixes `red.md` gotcha #6 — random chart
  colours that change per render.)

---

## 2. Hard rules (do / don't)

**Do**
- Use `border-radius: 0` on everything. Pills/dots that are intentionally round
  use `border-radius: 50%` only.
- Use 1px hairlines for all separation (`var(--line)`), 1px stronger
  (`var(--line-strong)`) for emphasis.
- Use the dot-grid background on section surfaces (`.canvas-grid`).
- Reserve orange for: the single primary action, the active/selected state,
  scores, the RED/`mitigates` edge, and small accent marks.
- Use Geist Mono **uppercase + letter-spaced** for every label, tag, status,
  numeral, timestamp, key, and code token.
- Provide a visible `:focus-visible` outline (see §12) — the app is interactive.

**Don't**
- ❌ No rounded corners on cards, inputs, buttons, tags, tables.
- ❌ No box-shadows for elevation. (Ambient orange *glow* is allowed; a grey
  drop-shadow to "lift a card" is not.)
- ❌ No second accent colour. No blue, no green/red status colours *except* the
  semantic status palette in §8.7, used sparingly.
- ❌ No emojis in product UI.
- ❌ No gradients except the defined ambient bloom and the dot-grid radial.
- ❌ Don't hard-code hex in components — go through tokens.
- ❌ Don't animate everything. One showpiece per view; the rest is calm.

---

## 3. Colour system

### 3.1 Core palette (the canonical app theme)

These are the exact tokens from `.red-root`. They are the app's default theme.

| Token | Value | Role |
|---|---|---|
| `--bg` | `#080a0f` | Page background (near-black, cool) |
| `--bg-alt` | `#0e131c` | Raised surface: cards, panels, table header, inputs |
| `--bg-elev` | `#11161f` | Hover/elevated surface (cards on hover, photo bg) |
| `--bg-deep` | `#05070b` | Recessed surface: code/terminal blocks, wells |
| `--ink` | `#eef2f8` | Primary text on dark |
| `--ink-2` | `#c6d0dd` | Secondary text / lead paragraphs |
| `--muted` | `#8b97a8` | Tertiary text, descriptions |
| `--muted-2` | `#7a8595` | Quaternary: micro-labels, scale ticks, disabled |
| `--line` | `rgba(255,255,255,0.09)` | Hairline borders, dividers, grid cell gaps |
| `--line-strong` | `rgba(255,255,255,0.18)` | Emphasised borders, input underlines |
| `--accent` | `#f87854` | **The** accent (orange). Primary actions, active states |
| `--accent-hover` | `#fa8d6f` | Accent hover |
| `--orange` | `#f87854` | Alias of accent (kept for canvas-component parity) |
| `--grid-dot` | `rgba(255,255,255,0.05)` | Dot-grid texture colour |
| `--white` | `#ffffff` | Pure white — headings only, used sparingly |

> Heading colour: large headings use **`#fff`** (pure white) for maximum
> contrast; everything else uses `--ink`. Body/secondary steps down through
> `--ink-2 → --muted → --muted-2`.

### 3.2 Accent ramp (orange family)

Used for scores, the RED stack, multi-segment bars, and gradients. Light→deep so
three stacked segments stay distinguishable on near-black.

| Token | Value | Role |
|---|---|---|
| `--accent-1` | `#ffc7ad` | Lightest — first stacked segment (e.g. Relevance), data-flow highlight |
| `--accent-2` | `#f87854` | Mid / brand — second segment (Extent), default accent |
| `--accent-3` | `#cf4422` | Deep — third segment (Duration) |
| `--accent-ink` | `#1a0d08` | Near-black text placed **on** an orange fill (buttons, pills) |
| `--accent-flow` | `#ffd9c8` | Marching-ants "data flow" stroke on the graded edge |

Glow recipe (ambient only): `rgba(248,120,84, α)` with `α` ∈ `{0.5, 0.6, 0.7}`.

### 3.3 White-alpha scale (borders, scrims, fills on dark)

Use these instead of inventing new rgba values:

```
0.02  faint fill (terminal bar bg)
0.04  subtle fill (ghost button rest)
0.05  dot-grid, bar-track fill
0.06  scrim / faint surface
0.08  ghost button hover, chip-on-dark bg
0.09  --line
0.12  faint orange track (top progress bar bg uses orange 0.12)
0.14  spine track
0.18  --line-strong
0.22  terminal dot (secondary)
0.30  spine node rest border
0.32  spine numeral rest
0.40  spine reticle / dim label
0.50  muted label rest
0.55  data/done states
```

### 3.4 Semantic status palette (app only)

The marketing page has no status states; the app does (initiative/risk/incident
lifecycle). Keep these **desaturated** so orange remains the loudest colour.
Status colour appears only as a 6px dot + text, never as a filled block.

| Token | Value | Use |
|---|---|---|
| `--ok` | `#5fb88f` | done / resolved / closed (muted green) |
| `--warn` | `#e0a35c` | blocked / monitoring / at-risk (muted amber) |
| `--crit` | `#e8694e` | sev1 / open-incident / overdue (warm red, near accent) |
| `--info` | `#7d93b0` | proposed / draft / neutral (cool grey-blue) |
| `--ok-dim` / `--warn-dim` / `--crit-dim` / `--info-dim` | same hue @ `~0.14` alpha bg | optional chip background |

> Note: `--crit` sits intentionally close to the accent so "critical" reads as
> hot without clashing. Never use a pure `#ff0000`.

### 3.5 Paste-ready token block

Drop into the app's theme stylesheet. Two ways to scope it (pick one):

- **App-wide default (recommended for Red):** put it on `:root`.
- **Theming alongside the existing light canvas:** put it on `[data-theme="dark"]`
  (or a `.red-root` wrapper) and set `data-theme="dark"` on `<html>`.

```css
:root {
  /* surfaces */
  --bg: #080a0f;
  --bg-alt: #0e131c;
  --bg-elev: #11161f;
  --bg-deep: #05070b;

  /* text */
  --ink: #eef2f8;
  --ink-2: #c6d0dd;
  --muted: #8b97a8;
  --muted-2: #7a8595;
  --white: #ffffff;

  /* lines */
  --line: rgba(255, 255, 255, 0.09);
  --line-strong: rgba(255, 255, 255, 0.18);

  /* accent (orange — the only accent) */
  --accent: #f87854;
  --accent-hover: #fa8d6f;
  --orange: #f87854;
  --accent-1: #ffc7ad;
  --accent-2: #f87854;
  --accent-3: #cf4422;
  --accent-ink: #1a0d08;
  --accent-flow: #ffd9c8;

  /* canvas texture */
  --grid-dot: rgba(255, 255, 255, 0.05);

  /* semantic status (app) */
  --ok: #5fb88f;
  --warn: #e0a35c;
  --crit: #e8694e;
  --info: #7d93b0;

  /* shape + rhythm */
  --radius: 0;            /* never round surfaces */
  --hairline: 1px;
  --container: 1100px;    /* marketing; app shell may run wider — see §6.1 */
}
```

### 3.6 Tailwind v4 mapping

Mirror the website: expose tokens to Tailwind via `@theme` so utility classes
(`bg-bg`, `text-ink`, `border-line`, `text-accent`, `font-mono`) resolve to the
canvas palette, **and** keep the raw `:root` block above for component CSS.

```css
@import "tailwindcss";

@theme {
  --font-sans: "Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-mono: "Geist Mono", ui-monospace, Menlo, Monaco, monospace;

  --color-bg: #080a0f;
  --color-bg-alt: #0e131c;
  --color-bg-elev: #11161f;
  --color-ink: #eef2f8;
  --color-muted: #8b97a8;
  --color-line: rgba(255, 255, 255, 0.09);
  --color-accent: #f87854;
}

/* Flatten radius + shadow globally so any stray utility still reads canvas */
[class*="rounded-"]:not([class*="rounded-full"]) { border-radius: 0 !important; }
[class*="shadow"]:not([class*="shadow-none"]) { box-shadow: none !important; }
```

### 3.7 Light-canvas lineage (reference only)

Adaca Red descends from the Adaca One light canvas (white `#ffffff`, ink
`#15293e`, blue accent `#2074ef`, orange `#F87854`). The ultra-dark theme is its
**inversion with orange promoted from secondary to primary accent**. If you ever
need a light surface (e.g. a printable report), invert: `--bg → #ffffff`,
`--ink → #15293e`, `--line → #e5e8ee`, keep `--accent` as orange. Do not
reintroduce blue as the accent in Red.

---

## 4. Typography

### 4.1 Fonts

- **Geist** — sans, for headings and body.
- **Geist Mono** — for all labels, tags, numerals, code, status, keys, axes.

Load (already in the marketing `Layout`; replicate in the app `<head>`):

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet" />
```

Base: `font-feature-settings: 'ss01' on, 'cv11' on; -webkit-font-smoothing: antialiased; line-height: 1.5; letter-spacing: -0.005em;`

**Weights in use:** 400 (body, code), 500 (almost everything — headings, labels,
buttons), 600 (only the oversized watermark). Never 700+ in product UI.

### 4.2 Type scale (role → spec)

| Role | Family | Size | Weight | Line-height | Letter-spacing | Colour |
|---|---|---|---|---|---|---|
| Display / hero H1 | Geist | `clamp(48px, 8vw, 96px)` | 500 | 0.95 | -0.04em | `#fff` |
| Section H2 (`.h2`) | Geist | `clamp(26px, 3.4vw, 38px)` | 500 | 1.12 | -0.02em | `#fff` |
| Sub-headline | Geist | `clamp(18px, 2.4vw, 24px)` | 500 | 1.25 | -0.015em | `#fff` |
| Lead paragraph (`.lead`) | Geist | 15–16px | 400 | 1.65 | normal | `--ink-2` |
| Body | Geist | 14px | 400 | 1.6 | normal | `--muted` / `--ink` |
| Body small | Geist | 13–13.5px | 400 | 1.6 | normal | `--muted` |
| Card title | Geist | 16–19px | 500 | 1.2 | -0.01em | `#fff` |
| **Eyebrow / kicker** | Geist Mono | 10–11px | 500 | 1 | 0.12–0.14em, UPPERCASE | `--accent` |
| **Label / tag** | Geist Mono | 10px | 500 | 1 | 0.08–0.12em, UPPERCASE | `--muted-2` |
| **Micro / coord** | Geist Mono | 9–9.5px | 500 | 1 | 0.06–0.08em, UPPERCASE | `--muted-2` |
| **Big numeral** (score) | Geist Mono | `clamp(48px, 8vw, 72px)` | 500 | 0.9 | -0.03em, tabular | `#fff` |
| Numeral / data | Geist Mono | 11–15px | 500 | 1 | tabular-nums | varies |
| Code | Geist Mono | 12.5px | 400 | 1.95 | normal | `--ink` |

Constants: `font-variant-numeric: tabular-nums;` on every numeral; max prose
measure ~`56–72ch`; headings clamp to `~22ch`.

### 4.3 Mono vs sans — the rule

If it's **machine-ish** (a label, a tag, a count, a status, a date, a key, a
score, a code token, an axis tick, a section number) → **Geist Mono, uppercase,
positive letter-spacing.** If it's **language** (a heading, a sentence, a bio) →
**Geist, sentence case, negative/normal letter-spacing.** This split is the
backbone of the whole aesthetic — keep it strict.

---

## 5. Spacing & layout

### 5.1 Container

```css
.container {
  width: 100%;
  max-width: var(--container);     /* 1100px marketing */
  margin-inline: auto;
  padding-inline: 1.25rem;          /* 20px */
}
@media (min-width: 640px)  { .container { padding-inline: 2rem; } }   /* 32px */
@media (min-width: 1024px) { .container { padding-inline: 2.5rem; } } /* 40px */
```

For the **app shell** (sidebar + content) you may run wider than 1100px; keep the
same gutters and hairline rhythm. Content columns inside still cap measure at
~72ch for readability.

### 5.2 Vertical rhythm

- **Section band:** `padding-block: clamp(48px, 6vw, 76px)`, `border-top: 1px solid var(--line)`.
- **Hero:** `padding-top: clamp(64px, 10vw, 120px)`, `padding-bottom: clamp(56px, 8vw, 100px)`; `min-height: 80vh` at ≥940px.
- **Section header → content gap:** 40px (`mb-10`).
- **Card padding:** 28–30px (compact data cells 16–22px).
- **Stack gaps:** 8px (tags), 12px (buttons), 18–22px (control rows), 36–56px (major columns).

### 5.3 Grid systems

**A. Hairline-gap grid** (cells share crisp 1px separators) — use for feature
grids, team grids, metric grids:

```css
.grid-hair {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1px;                     /* the gap IS the hairline */
  background: var(--line);      /* shows through the gaps */
  border: 1px solid var(--line);
}
@media (min-width: 640px) { .grid-hair { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 920px) { .grid-hair { grid-template-columns: repeat(3, 1fr); } }
.grid-hair > * { background: var(--bg-alt); }
```

**B. Collapsed-border grid** (cells with their own borders, overlapped by -1px)
— use for 3-up cards in a single row:

```css
.card { border: 1px solid var(--line); background: var(--bg-alt); }
@media (min-width: 760px) { .card:not(:first-child) { margin-left: -1px; } }
@media (max-width: 759px) { .card:not(:first-child) { margin-top: -1px; } }
```

### 5.4 Breakpoints (the ones this design actually uses)

`640` (2-col grids, container gutter) · `760` (3-col cards) · `860/880/920/940`
(two-column splits, hero) · `900` (terminal split) · `1024` (container gutter) ·
**`1200` (scroll-spine appears / top-bar hides)**.

---

## 6. Canvas grammar (the signature furniture)

These four elements + the dot-grid are what make any screen unmistakably "Red".

### 6.1 Dot-grid background

```css
.canvas-grid {
  background-image: radial-gradient(circle, var(--grid-dot) 0.9px, transparent 1.3px);
  background-size: 28px 28px;
  background-position: -1px -1px;
}
```
Apply to section surfaces. On near-black, `--grid-dot` is `rgba(255,255,255,0.05)`.

### 6.2 Registration marks (corner crosshairs)

A 13px orange crosshair pinned to a surface corner. Place on the **top-left of the
first** item and **bottom-right of the last** item in a group, or on featured
panels (both corners).

```css
.mark { position: absolute; width: 0; height: 0; pointer-events: none; z-index: 2; }
.mark::before, .mark::after { content: ''; position: absolute; background: var(--orange); }
.mark::before { width: 13px; height: 1px; top: 0; left: -6px; }   /* horizontal */
.mark::after  { width: 1px; height: 13px; top: -6px; left: 0; }   /* vertical   */
```
Usage: `<span class="mark" style="top:0; left:0"></span>` inside a
`position: relative` surface. The parent must be relative.

### 6.3 Section header (zone tag · rule · revision stamp)

The "file header" that opens every section: `§NN  TITLE ───────── REV ...`.

```html
<div class="section-header">
  <span class="zone-tag"><span class="num">§02</span>THE RUBRIC</span>
  <div class="section-header-rule"></div>
  <span class="rev-tag">REV 2026.06 · 02.00</span>
</div>
```
```css
.section-header { display: flex; align-items: center; gap: 16px; width: 100%; }
.section-header-rule { flex: 1; height: 1px; background: var(--line); }
.section-header .zone-tag, .section-header .rev-tag {
  font-family: "Geist Mono", ui-monospace, monospace;
  font-size: 10px; font-weight: 500; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--muted-2); white-space: nowrap;
}
.section-header .zone-tag .num { color: var(--accent); margin-right: 6px; }
.section-header .rev-tag { color: var(--orange); }
```
**Conventions:**
- `§NN` is a stable zone number per section/screen. In the app, give each major
  screen a zone (e.g. `§ INITIATIVES`, `§ RISKS`, `§ RED`). Keep them consistent.
- `REV YYYY.MM · NN.MM` is a decorative "revision" stamp. In the app it can be
  real: surface the record's `current_rev` / last-updated here (it fits the
  revisions model perfectly — see `CLAUDE.md`).
- The numeral/zone uses accent; the rule and tags are muted; the rev stamp is
  orange.

### 6.4 Axis line

A plain 1px rule used to divide blocks where a full section header is too much:
`.axis { height: 1px; background: var(--line); width: 100%; }`

---

## 7. Iconography & imagery

- **Line icons** only, `stroke-width: 1.5`, currentColor, ~16–20px. No filled
  glyphs, no emoji. (The app already uses `@heroicons/react` — use the **outline**
  set at 1.5.)
- **Photography** (e.g. team headshots): duotone-ish treatment —
  `filter: grayscale(1) contrast(1.03) brightness(0.92)`, transitioning to full
  colour + `scale(1.03)` on hover. Portrait `aspect-ratio: 4 / 5`,
  `object-position: center 22%` to favour faces. Placeholder bg `--bg-elev`.
- **Logos/tech marks**: render in `--muted` / `--ink`, not full colour, unless a
  brand requires it.

---

## 8. Components

Each component: anatomy → tokens → states → code. All have `border-radius: 0`.

### 8.1 Buttons

Base is mono, uppercase, letter-spaced, 1px border, square.

```css
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  padding: 10px 16px; border-radius: 0;
  font-family: "Geist Mono", ui-monospace, monospace;
  font-size: 12px; font-weight: 500; letter-spacing: 0.04em; text-transform: uppercase;
  border: 1px solid transparent; cursor: pointer; white-space: nowrap;
  transition: background .12s ease, border-color .12s ease, color .12s ease, box-shadow .25s ease;
}
.btn svg { width: 14px; height: 14px; }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-sm { padding: 7px 12px; font-size: 11px; }
.btn-lg { padding: 12px 20px; font-size: 12.5px; }

/* Primary — orange, the single strong CTA per view */
.btn-primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.btn-primary:hover:not(:disabled) { background: var(--accent-hover); border-color: var(--accent-hover); }

/* Ghost — quiet secondary on dark */
.btn-ghost { background: rgba(255,255,255,0.04); color: var(--ink); border-color: var(--line-strong); }
.btn-ghost:hover:not(:disabled) { background: rgba(255,255,255,0.08); border-color: var(--ink); }

/* Optional ambient glow on the hero/primary CTA */
.glow-btn { box-shadow: 0 0 0 0 rgba(248,120,84,0.5); }
.glow-btn:hover { box-shadow: 0 8px 30px -8px rgba(248,120,84,0.7); }
```
Rules: **one** `.btn-primary` per view/section. Destructive actions:
`color: var(--crit); border-color: var(--crit)`, fill on hover.

### 8.2 Chips / tags

Inline mono metadata. Two flavours: plain (border) and key-value.

```css
.chip {
  font-family: "Geist Mono", ui-monospace, monospace;
  font-size: 10px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--muted); border: 1px solid var(--line); padding: 5px 9px;
  transition: border-color .2s ease, color .2s ease;
}
.chip:hover { border-color: var(--line-strong); color: var(--ink); }
```

### 8.3 Surface card

The base panel for everything boxed.

```css
.surface {
  position: relative; border: 1px solid var(--line); background: var(--bg-alt);
  padding: 30px; transition: border-color .25s ease, background .25s ease;
}
.surface:hover {                          /* interactive cards only */
  border-color: color-mix(in srgb, var(--orange) 50%, transparent);
  background: var(--bg-elev);
  z-index: 1;                              /* so the brightened border sits above neighbours */
}
```
Featured/important surfaces get the radial accent wash:
`background: radial-gradient(120% 140% at 100% 0%, rgba(248,120,84,0.08) 0%, transparent 55%), var(--bg-alt);`

### 8.4 Feature grid cell

Inside `.grid-hair`. Mono index in accent + sans title + muted desc.

```css
.feat { background: var(--bg-alt); padding: 28px; display: flex; flex-direction: column; gap: 9px; }
.feat:hover { background: var(--bg-elev); }
.feat-idx   { font-family: "Geist Mono"; font-size: 11px; font-weight: 500; letter-spacing: .08em; color: var(--orange); }
.feat-title { font-size: 16px; font-weight: 500; color: #fff; }
.feat-desc  { font-size: 13px; line-height: 1.6; color: var(--muted); }
```

### 8.5 Big-number readout (stat / score)

For dashboards and the RED score. Oversized mono numeral + unit + band tag.

```css
.readout { display: flex; align-items: baseline; gap: 10px; }
.readout-num  { font-family: "Geist Mono"; font-size: clamp(48px,8vw,72px); font-weight: 500;
                line-height: .9; letter-spacing: -.03em; color: #fff; font-variant-numeric: tabular-nums; }
.readout-unit { font-family: "Geist Mono"; font-size: 18px; color: var(--muted-2); }
.readout-band { margin-left: auto; font-family: "Geist Mono"; font-size: 12px; font-weight: 500;
                letter-spacing: .1em; text-transform: uppercase; color: var(--orange);
                border: 1px solid color-mix(in srgb, var(--orange) 40%, transparent); padding: 6px 10px; }
```

### 8.6 Terminal / code block

Recessed surface with a bar (one orange dot + two white-alpha) and a mono body.

```css
.term { border: 1px solid var(--line); background: var(--bg-deep); overflow: hidden; }
.term-bar { display: flex; align-items: center; gap: 7px; padding: 11px 15px;
            border-bottom: 1px solid var(--line); background: rgba(255,255,255,0.02); }
.term-dot { width: 9px; height: 9px; border-radius: 50%; }
.term-dot.d1 { background: var(--orange); }
.term-dot.d2 { background: rgba(255,255,255,0.22); }
.term-dot.d3 { background: rgba(255,255,255,0.12); }
.term-label { margin-left: auto; font-family: "Geist Mono"; font-size: 10.5px;
              letter-spacing: .1em; text-transform: uppercase; color: var(--muted-2); }
.term-body { margin: 0; padding: 22px; font-family: "Geist Mono"; font-size: 12.5px;
             line-height: 1.95; color: var(--ink); overflow-x: auto; white-space: pre; }
.term-body .c   { color: var(--muted-2); }   /* comment */
.term-body .p   { color: var(--orange); }     /* prompt $ */
.term-body .cmd { color: var(--ink); }        /* command  */
```

### 8.7 Status pill (app)

Semantic lifecycle states. **6px dot + mono text**, optional faint bg. Keep
desaturated so orange stays loudest.

```css
.status { display: inline-flex; align-items: center; gap: 6px;
          font-family: "Geist Mono"; font-size: 11px; font-weight: 500;
          letter-spacing: .04em; padding: 4px 9px; white-space: nowrap; }
.status .dot { width: 6px; height: 6px; border-radius: 50%; }
.status.ok   { color: var(--ok); }   .status.ok   .dot { background: var(--ok); }
.status.warn { color: var(--warn); } .status.warn .dot { background: var(--warn); }
.status.crit { color: var(--crit); } .status.crit .dot { background: var(--crit); }
.status.info { color: var(--info); } .status.info .dot { background: var(--info); }
```
Domain mapping (from the seed definitions):
- **Initiative**: proposed→`info`, active→`ok`(or accent), blocked→`warn`, done→`ok`, cancelled→`muted`.
- **Risk**: open→`crit`, mitigating→`warn`, accepted→`info`, closed→`ok`.
- **Incident severity**: sev1→`crit`, sev2→`warn`, sev3→`info`, sev4→`muted`.

### 8.8 Disclosure (FAQ / accordion)

Native `<details>`, hairline rows, orange +/− marker.

```css
.faq { border-top: 1px solid var(--line); }
.faq details { border-bottom: 1px solid var(--line); }
.faq summary { cursor: pointer; list-style: none; display: flex; align-items: center;
               justify-content: space-between; gap: 20px; padding: 22px 0;
               font-size: clamp(15px,2vw,18px); font-weight: 500; color: var(--ink); }
.faq summary::-webkit-details-marker { display: none; }
.faq summary::after { content: '+'; font-family: "Geist Mono"; font-size: 22px; color: var(--orange); line-height: 1; }
.faq details[open] summary::after { content: '–'; }
.faq summary:hover { color: #fff; }
.faq-a { margin: -4px 0 22px; font-size: 14px; line-height: 1.7; color: var(--muted); max-width: 72ch; }
```

### 8.9 Person / team card

```css
.person { background: var(--bg-alt); display: flex; flex-direction: column; }
.person-photo-wrap { overflow: hidden; aspect-ratio: 4/5; background: var(--bg-elev); }
.person-photo { width: 100%; height: 100%; object-fit: cover; object-position: center 22%;
                filter: grayscale(1) contrast(1.03) brightness(.92);
                transition: filter .5s ease, transform .6s cubic-bezier(.2,.6,.1,1); }
.person:hover .person-photo { filter: none; transform: scale(1.03); }
.person-role { font-family: "Geist Mono"; font-size: 10px; font-weight: 500; letter-spacing: .12em;
               text-transform: uppercase; color: var(--orange); }
.person-name { font-size: 17px; font-weight: 500; color: #fff; }
.person-line { font-size: 13px; line-height: 1.55; color: var(--muted); }
```

### 8.10 Data row (register / list / roadmap)

The horizontal hairline row — the workhorse for registers and lists.

```css
.row {
  display: grid; grid-template-columns: 260px 1fr auto; gap: 16px;
  align-items: center; padding: 18px 0; border-bottom: 1px solid var(--line);
  transition: padding-left .2s ease;
}
.row:first-child { border-top: 1px solid var(--line); }
.row:hover { padding-left: 8px; }                      /* subtle nudge on hover */
.row-key  { font-family: "Geist Mono"; font-size: 12px; font-weight: 500;
            letter-spacing: .06em; text-transform: uppercase; color: #fff; }
.row-note { font-size: 13.5px; line-height: 1.5; color: var(--muted); }
/* trailing slot: a .status pill or a mono tag */
@media (max-width: 760px) {
  .row { grid-template-columns: 1fr auto; grid-template-areas: 'key tag' 'note note'; }
}
```
Roadmap status tags (a variant of the trailing slot):
```css
.tag-shipped  { background: var(--orange); color: var(--accent-ink); }
.tag-progress { color: var(--orange); border: 1px solid color-mix(in srgb, var(--orange) 45%, transparent); }
.tag-planned  { color: var(--muted-2); border: 1px solid var(--line-strong); }
/* all: mono, 10px, .1em, uppercase, padding 5px 9px */
```

### 8.11 Form fields (app)

Underline inputs (no boxes), transparent bg, mono labels.

```css
.field { display: flex; flex-direction: column; gap: 5px; }
.field-label { font-family: "Geist Mono"; font-size: 10px; font-weight: 500;
               letter-spacing: .04em; text-transform: uppercase; color: var(--muted); }
.field-label .req { color: var(--accent); margin-left: 2px; }
.field-input {
  width: 100%; font-family: inherit; font-size: 14px; color: var(--ink);
  background: transparent; border: none; border-bottom: 1px solid var(--line-strong);
  border-radius: 0; padding: 10px 0; transition: border-color .15s ease;
}
.field-input::placeholder { color: var(--muted-2); }
.field-input:hover:not(:disabled) { border-bottom-color: var(--ink); }
.field-input:focus { outline: none; border-bottom-color: var(--accent); }
.field-input[aria-invalid="true"] { border-bottom-color: var(--crit); }
/* dark <select> needs a light arrow + dark option bg */
select.field-input option { background: var(--bg-alt); color: var(--ink); }
.field-error { font-size: 12.5px; color: var(--crit); }
.field-hint  { font-size: 12px; color: var(--muted); }
```
For richtext/markdown fields, render the editor chrome in the same hairline/mono
language; body text in Geist.

### 8.12 Data table (app)

Registers may use a true table. Header on `--bg-alt`, hairline rows, hover lift.

```css
.data-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 14px; }
.data-table thead th {
  text-align: left; padding: 12px 16px; font-family: "Geist Mono";
  font-size: 11px; font-weight: 500; letter-spacing: .04em; text-transform: uppercase;
  color: var(--muted); background: var(--bg-alt); border-bottom: 1px solid var(--line); white-space: nowrap;
}
.data-table tbody td { padding: 14px 16px; border-bottom: 1px solid var(--line); color: var(--ink); vertical-align: middle; }
.data-table tbody tr:hover td { background: var(--bg-alt); }
.data-table tbody tr:last-child td { border-bottom: 0; }
```

---

## 9. The RED visualisation (signature data component)

RED (Relevance · Extent · Duration, each 0–4) is the brand's core data object.
The landing page ships an **interactive scorer**; the app needs the same visual
language for `RedScore`, `RedEditor` and `RedTrend`.

### 9.1 Colour mapping (deterministic — never random)

| Dimension | Token | Hex |
|---|---|---|
| Relevance (R) | `--accent-1` | `#ffc7ad` |
| Extent (E) | `--accent-2` | `#f87854` |
| Duration (D) | `--accent-3` | `#cf4422` |

Light→deep so a **stacked** 0–12 bar stays legible. These are fixed; do not hash
or randomise. (This is the explicit fix for the origin model's random-colour bug.)

### 9.2 Composite stacked bar (0–12) — the "main" view

Three segments R/E/D side-by-side; each width = `value / 12 * 100%`; remaining
track empty. Big mono total + band tag.

```css
.bar-track { display: flex; width: 100%; height: 16px; background: rgba(255,255,255,0.05);
             border: 1px solid var(--line); overflow: hidden; }
.bar-fill  { height: 100%; transition: width .45s cubic-bezier(.2,.6,.1,1); }
.f-r { background: var(--accent-1); }
.f-e { background: var(--accent-2); }
.f-d { background: var(--accent-3); }
.bar-scale { display: flex; justify-content: space-between; margin-top: 8px;
             font-family: "Geist Mono"; font-size: 10px; color: var(--muted-2); }
```

### 9.3 Per-dimension grouped (0–4) — the "details" view

In trend/detail views, show R, E, D as **grouped** bars each on a 0–4 scale (one
group per assessment date). Y domain `[0,4]`, ticks 0–4. Reuse `--accent-1/2/3`.
This mirrors `red.md` §4 (main = stacked 0–12; details = grouped 0–4).

### 9.4 Band labels (composite 0–12)

`≤3 Weak · ≤6 Limited · ≤9 Moderate · else Strong`. (Per-dimension 0–4 bands map
1→Weak, 2→Limited, 3→Moderate, 4→Strong.) Render the band as a `.readout-band`.

### 9.5 Segmented 0–4 control (the editor input)

Five square buttons; selected = orange fill with near-black text + glow.

```css
.seg { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
.seg-btn { font-family: "Geist Mono"; font-size: 13px; font-weight: 500; color: var(--muted);
           background: transparent; border: 1px solid var(--line-strong); padding: 12px 0;
           cursor: pointer; transition: all .18s ease; }
.seg-btn:hover { border-color: var(--orange); color: var(--ink); }
.seg-btn.on { background: var(--orange); border-color: var(--orange);
              color: var(--accent-ink); box-shadow: 0 0 18px -4px rgba(248,120,84,0.7); }
```

### 9.6 Behaviour reference (from the landing page)

```js
const state = { relevance: 3, extent: 2, duration: 2 };   // each 0–4
const total = state.relevance + state.extent + state.duration;  // 0–12
const band  = total <= 3 ? 'Weak' : total <= 6 ? 'Limited' : total <= 9 ? 'Moderate' : 'Strong';
// fill widths: (value / 12) * 100% ; transitions handle the animation
```
In the app, RED edits are **revisions** (one row per re-score) — the trend is the
edge's revision history, not a new table. `assessmentDate` is a first-class field.

---

## 10. Motion system

Motion is orchestrated, not scattered: one staggered page-load, scroll-reveals as
sections enter, hover micro-interactions, and (where it explains something) a
data-driven animation. Everything degrades under `prefers-reduced-motion`.

### 10.1 Easing & duration tokens

| Token | Value | Use |
|---|---|---|
| ease-out-soft | `cubic-bezier(0.2, 0.6, 0.1, 1)` | reveals, rises, bar fills (default) |
| ease-draw | `cubic-bezier(0.4, 0, 0.2, 1)` | SVG stroke draw-on |
| t-fast | 0.12s | button/colour transitions |
| t-micro | 0.18–0.25s | hovers, label reveals |
| t-color | 0.30s | state colour changes |
| t-bar | 0.45s | score bar width |
| t-reveal | 0.60–0.70s | section reveal / load rise |
| t-draw | 0.85s | edge draw |
| ambient | 3–11s | bloom, pulses (infinite) |

### 10.2 Page-load stagger

Elements rise + fade, staggered by `animation-delay` (hero used 0.05 → 0.50s).

```css
[data-rise] { opacity: 0; animation: rise .7s cubic-bezier(.2,.6,.1,1) forwards; }
@keyframes rise { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
```

### 10.3 Scroll reveal (IntersectionObserver)

```css
[data-reveal] { opacity: 0; transform: translateY(20px);
  transition: opacity .7s cubic-bezier(.2,.6,.1,1), transform .7s cubic-bezier(.2,.6,.1,1); }
[data-reveal].in { opacity: 1; transform: none; }
```
```js
const io = new IntersectionObserver((es) => {
  es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
}, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));
```
(React/vinext: wrap as a `useReveal()` hook or a `<Reveal>` client component.)

### 10.4 Hover micro-interactions (catalogue)

- **Card:** border → `color-mix(orange 45–55%)`, bg → `--bg-elev`, raise `z-index`.
- **Data row:** `padding-left: 8px` nudge.
- **Chip / tech tag:** border → `--line-strong`/orange, text → `--ink`.
- **Photo:** grayscale → colour, `scale(1.03)`.
- **Seg button:** border → orange; selected has glow.
- **Primary CTA:** ambient orange shadow blooms.
Keep each ≤ 0.25s. Never move layout (except the deliberate row nudge).

### 10.5 Data-driven SVG (the relationship graph)

For diagrams (e.g. the initiative→risk→incident triangle, or `/graph`):
- **Nodes** fade + translateY in, staggered ~0.12s apart.
- **Edges** draw via `stroke-dasharray/offset` (`ddraw .85s ease-draw`), graded
  edge first.
- **The graded (RED) edge** carries a marching-ants overlay = "data flowing":
  `stroke: var(--accent-flow); stroke-dasharray: 2 9; animation: march .9s linear infinite;`
  (`@keyframes march { to { stroke-dashoffset: -22; } }`), plus a soft
  `drop-shadow(0 0 5px rgba(248,120,84,.5))` and a slow opacity pulse on its label.
- Plain edges: `stroke: var(--line-strong)`, no flow. **Only the graded edge gets
  the orange + flow** — visually encoding "this is the one scored relationship."

### 10.6 Ambient atmosphere

- **Bloom:** a large blurred orange radial behind hero/closer headings.
  `background: radial-gradient(circle at 50% 40%, rgba(248,120,84,.30) 0%, rgba(248,120,84,.10) 34%, transparent 66%); filter: blur(36px);` animated `bloom 11s ease-in-out infinite` (opacity 0.75↔1, slight translate+scale). Use **sparingly** — hero and one closer, not every section.
- **Grain:** an inline SVG `feTurbulence` overlay at low opacity for depth.
  `baseFrequency 0.85, numOctaves 2`, rect `opacity 0.04`, layer `opacity 0.5`, `pointer-events: none`.
- **Watermark:** oversized mono word (e.g. "RED") behind hero content, transparent
  fill + `-webkit-text-stroke: 1px rgba(255,255,255,0.045)`, desktop only,
  `user-select: none; pointer-events: none`.

### 10.7 Reduced motion (required)

```css
@media (prefers-reduced-motion: reduce) {
  [data-rise], [data-reveal] { opacity: 1 !important; transform: none !important;
    animation: none !important; transition: none !important; }
  .bloom, .pulse, .march, .reticle { animation: none !important; }
  .draw { animation: none !important; stroke-dashoffset: 0 !important; }
  .flow { display: none !important; }
}
```
Everything must be fully visible and usable with motion off.

---

## 11. The scroll companion (section spine)

A fixed left-gutter spine that travels with the scroll and **unlocks** sections
as you reach them; on narrow viewports it degrades to a slim top progress bar.
This is the one place colours are **hard-coded** (it lives outside the themed
wrapper so it can't inherit tokens, and so a page's `overflow-x: clip` can never
clip a fixed element). In the app, mount it once in the authed shell.

### 11.1 Anatomy

- `.rail` — `position: fixed; left: clamp(20px,3vw,44px); top: 50%; translateY(-50%); z-index: 40;` shown only `@media (min-width: 1200px)`.
- `.rail-track` — full-height 1px line `rgba(255,255,255,0.14)`.
- `.rail-fill` — orange line that grows top→down with scroll progress, `box-shadow: 0 0 8px rgba(248,120,84,.6)`, `transition: height .12s linear`.
- `.rail-item` per section: a 9px **node** + mono **numeral** + mono **label**.
- `.rail-bar` — `position: fixed; top: 0; height: 2px;` orange `.rail-bar-fill` (width = progress). Shown only `< 1200px` (hide the spine there).

### 11.2 Node states ("locked → unlocked → active")

- **Locked (upcoming):** node hollow, border `rgba(255,255,255,0.3)`, numeral `rgba(255,255,255,0.32)`.
- **Done (passed):** node fills `rgba(248,120,84,0.55)`, numeral `rgba(248,120,84,0.7)`.
- **Active (current):** node fills solid `--accent` with `box-shadow: 0 0 0 1px var(--accent), 0 0 12px rgba(248,120,84,0.7)`; numeral → accent; label → `#fff`; a **registration-mark reticle** (`inset:-5px; border:1px solid rgba(248,120,84,0.4)`) pings (`scale 1↔1.18, 2.4s`).
- **Labels** are hidden at rest (`opacity:0; translateX(-4px)`), revealed on
  `.rail:hover` and always shown for the active item. At rest the spine is just
  numerals — minimal, true to the canvas.
- **Click** a node → smooth-scroll to that section (`html { scroll-behavior: smooth }`
  + `section { scroll-margin-top: 84px }` to clear the sticky header).

### 11.3 Controller logic (reference)

```js
const ref = window.scrollY + window.innerHeight * 0.35;     // the "unlock" line
let active = -1;
targets.forEach((t, i) => { if (t.getBoundingClientRect().top + scrollY <= ref) active = i; });
const prog = scrollY / (document.documentElement.scrollHeight - innerHeight);  // 0..1
railFill.style.height = prog * 100 + '%';
items.forEach((it, i) => { it.classList.toggle('active', i === active); it.classList.toggle('done', i < active); });
// throttle with requestAnimationFrame; recompute on scroll + resize
```
**App adaptation:** the spine can map to either the in-page sections of a long
record (an incident report's sections) **or** the primary nav of the shell. Keep
the same visual states. Don't show it on short, dense screens (registers/tables)
— it's for long, scrollable documents.

---

## 12. Accessibility

- **Focus:** the canvas flattening removes default rings, so the app **must add**
  a visible focus style (the marketing page is mostly links; the app is forms,
  tables, editors):
  ```css
  :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 0; }
  ```
- **Contrast:** `--ink (#eef2f8)` on `--bg (#080a0f)` ≈ 16:1. `--muted (#8b97a8)`
  on `--bg` ≈ 6:1 (use for secondary text ≥13px, not tiny critical text). Don't
  drop body text below `--muted`. Orange `#f87854` on near-black ≈ 6:1 — fine for
  large text/UI; for small text on orange fills use `--accent-ink` (`#1a0d08`).
- **Decorative elements** (`.mark`, grid, bloom, grain, spine track, diagram
  flourishes) are `aria-hidden="true"`.
- **Meaningful SVGs** get `role="img"` + `aria-label`.
- **Don't encode meaning in colour alone:** status pills pair a dot **and** text;
  RED segments are labelled R/E/D; the active spine item also enlarges/labels.
- **Keyboard:** segmented controls are real `<button>`s; disclosures use native
  `<details>`; spine items are `<a href="#id">`. Tables get proper `<th scope>`.
- **Reduced motion** honoured everywhere (§10.7).
- **Tap targets** ≥ 40px in the app (the marketing seg-buttons are ~44px tall).

---

## 13. Implementing in the Red app (vinext / Next + Tailwind v4)

The app already has `src/app/globals.css` (light canvas tokens) and a
`src/components/canvas/` library. To adopt this system:

1. **Tokens.** Replace/extend the `:root` palette in `globals.css` with §3.5.
   Decide: dark-first (`:root` = dark, recommended for Red) or themed
   (`[data-theme="dark"]` + set on `<html>`). Mirror into `@theme` (§3.6).
2. **Base.** Set `body { background: var(--bg); color: var(--ink); }`, load Geist
   + Geist Mono (§4.1), add the global radius/shadow flatteners and
   `:focus-visible` (§12).
3. **Canvas furniture.** Add `.canvas-grid`, `.mark`, `.section-header`, `.axis`
   (§6) as global classes (they're already the convention).
4. **Map existing canvas components** to these tokens (they should mostly already
   read `var(--token)`): `SectionHeader`, `KeyFacts`, `HeadlineMetrics`,
   `StatBand`, `SplitCard`, `CompareTable`, `ProfilePanel`, `ZoneAxis`, etc.
   Verify each on near-black; fix any hard-coded light values.
5. **Build app components** from §8/§9: `Register`/`EntityTable` (§8.12 + 8.10),
   `EntityForm` fields (§8.11), `StatusChip` (§8.7), `RedScore`/`RedEditor`
   (§9.2/9.5), `RedTrend` (§9.3, stacked + grouped), `RiskMatrix` (hairline grid,
   §5.3A, cells tinted by `--crit`/`--warn`/`--info` density), `RevisionHistory`
   (data rows §8.10 + REV stamp §6.3).
6. **Motion.** Implement `useReveal()` (§10.3), the load-stagger, and the spine
   (§11) once in the authed layout. Charts: deterministic colours only (§9.1),
   draw-on for relationship graphs (§10.5).
7. **Density.** App screens are denser than the marketing page — keep paddings at
   the lower end (16–22px), hairlines everywhere, and let orange mark only the
   active row / primary action / score. Resist decorating data tables.

### 13.1 Quick component → spec map

| App component (from implementation-plan.md) | Spec section |
|---|---|
| AppShell / sidebar+topnav | §6.3 header, §3 tokens, §11 spine |
| Register / EntityTable | §8.12, §8.10, §8.7 |
| EntityForm / field renderers | §8.11, §12 focus |
| FilterBar | §8.2 chips, §8.11 inputs |
| RedEditor | §9.5 segmented control, §9.4 bands |
| RedScore | §8.5 readout, §9.2 bar |
| RedTrend | §9.2 (stacked 0–12), §9.3 (grouped 0–4) |
| RiskMatrix | §5.3A hairline grid, §3.4 status hues |
| StatusChip / SeverityChip | §8.7 |
| RevisionHistory | §8.10 rows, §6.3 REV stamp |
| Tree (containment) | §8.10 rows, indent + hairlines |
| Dashboard | §8.5 readouts, §8.4 feature grid, §8.10 rows |
| Relationship graph (/graph) | §10.5 SVG, §9.1 colours |

---

## 14. Cheat-sheet

```
BG        #080a0f      INK    #eef2f8     ACCENT   #f87854
BG-ALT    #0e131c      INK-2  #c6d0dd     ACC-HOV  #fa8d6f
BG-ELEV   #11161f      MUTED  #8b97a8     ACC-1/2/3 #ffc7ad / #f87854 / #cf4422
BG-DEEP   #05070b      MUTED2 #7a8595     ACC-INK  #1a0d08
LINE      rgba(255,255,255,.09)          GRID-DOT rgba(255,255,255,.05)
LINE-STR  rgba(255,255,255,.18)          WHITE    #ffffff (headings only)

FONT      Geist (prose) · Geist Mono (labels/numerals/code)
WEIGHTS   400 body · 500 everything · 600 watermark only
RADIUS    0   ·   SHADOW none (glow ok)   ·   ACCENT one only (orange)
EASE      cubic-bezier(.2,.6,.1,1)        GRID 28px dot · MARK 13px crosshair
SECTION   §NN tag · rule · REV stamp      SPINE ≥1200px, top-bar below
RED       R #ffc7ad · E #f87854 · D #cf4422  (0–4 each, 0–12 stacked)
BANDS     ≤3 Weak · ≤6 Limited · ≤9 Moderate · else Strong
```

---

*Source of truth: `adaca-website/src/pages/red/index.astro`. Keep this doc and
that page in lockstep — when one changes, update the other.*
