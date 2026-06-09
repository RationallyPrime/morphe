# Design

> The design system is the **Morphe substrate**, not a stylesheet and not a theme.
> This file documents the system, records the values the default theme currently
> realizes, and sets the craft bar that dialect implementations must clear. The
> formal, locked contract is `CONTRACT.md`; the stratified-adaptive tower the
> substrate is Phase 0 of is `VISION.md` (the why). Where this file and the
> substrate source disagree, the source wins and this file is stale — fix it.

## 1. North star

**Creative north star: the Digital Curator.** The interface should read like a
physical artifact from an Icelandic archive — heavy, intentional, quiet — not like
an always-on SaaS tool. The visitor should ask "how was this made?", never "which
AI made this?" The aesthetic *brief* (`sokrates-website/Design Sketch/DESIGN.md`)
names the mood correctly: tonal architecture, intentional asymmetry, generous
"uncomfortable" whitespace, components as functional artifacts, real photographs of
real objects. **Take the mood; reject its component recipes** — that doc recommends
glassmorphism nav, 1px ghost-border inputs, and ambient drop shadows, all of which
are banned here (§9). It is a floor to beat.

**Identity, held loosely — kept on merit, never because it's holy.** Amber
`#f2ca50` beacon on a `#121416` tonal charcoal stack; **Spectral** (display, a
humanist old-style serif in the Garamond/Plantin lineage) + **Hanken Grotesk**
(body) + **Fragment Mono** (folio / plate / label apparatus). No token is sacred.
The amber-on-charcoal palette is a real, distinctive, non-default dark identity —
kept because it is good. The display face WAS the one questionable cow and it was
killed: the prior **Newsreader** is a reflex-reject SaaS-editorial serif that put
the site squarely in the saturated editorial-typographic lane, so it was swapped
for Spectral (sturdy, scholarly, off the reject list), and the prior **IBM Plex
Mono** (also reflex-reject) for Fragment Mono. The escape from the lane is mostly
execution — asymmetry, real artifact imagery, one deliberate kicker instead of an
eyebrow on every section — which holds whatever the display face.

## 2. The system: the Morphe substrate

UI is authored as **data** (a typed `Node` tree) and rendered through a fixed
grammar, a context algebra, three token strata, and a dialect. Four lemmas, all
enforced in code (`CONTRACT.md` is canon):

- **Grammar (Lemma 1).** A discriminated `Node` union: Layout (`frame`/`stack`/
  `grid`/`cluster`/`spacer`), Content (`text`/`number`/`badge`/`icon`/`media`),
  Input (`field`/`select`/`toggle`/`range` — a11y is a *required typed field*),
  Feedback (`progress`/`status`/`inline-alert` — color never the only signal),
  Action (`button` does something / `link` goes somewhere), Overlay (`dialog`/
  `popover`/`disclosure` — platform top layer), Meta (`slot`/`param-ref`/`vary`),
  `compound`. Source of truth: `src/lib/morphe/grammar/types.ts`. **Locked.**
- **Context algebra (Lemma 2).** Containers carry a compositional `role` (`page`/
  `section`/`panel`/`toolbar`/`list`/`form`/`field-group`/`inline`); a child's
  context is `f(parent ctx, role)`. Four laws: Locality, Stability, Monotone-depth,
  Budget-conservation. Authored trees emit **roles, priorities, intents — never
  geometry** (no px, no scale names, no hex). `Frame` is the only context reset
  (re-roots depth/scale, re-grants the emphasis budget `B`, changes surface).
- **Tokens, three strata (Lemma 3).** Neutral **scales** (`--mo-neutral-*`,
  `--mo-amber-*`, type/space/radius ramps) → semantic **intents** → component
  **slots**. Authored trees reference **intents only**; components reference slots;
  slots reference intents; intents reference scales. Nothing authored ever names a
  scale or a raw value — that is what makes re-theming a fixed point.
- **Dialects + the fixed point (Lemma 4 / Lemma 3).** A dialect remaps the intent
  layer (and bounded priors) and nothing else, so the **same authored tree
  re-themes** under any dialect. The intent **keyset is fixed across all shipped
  dialects** (`CONTRACT.md §8`, enforced by `dialects.test.ts`).

The renderer (`render/Node.svelte`) is a total recursive function; the compound
factory (`compounds/factory.ts`) lifts components to data behind a validation gate.
**The craft layer is: dialects, compounds, presenters, and the native band CSS.**
The locked core (`grammar`, `render`, `context`, the `tokens` strata mechanism,
`compounds/factory`) is the system — extend at the edges the contract names, never
modify it.

The substrate is **Phase 0 of a four-stratum adaptive tower** (`VISION.md`):
τ_frame (dialects/personas) over τ_slow (an agent emitting trees) over τ_mid (a
grammar-constrained small model choosing within `Vary` envelopes) over τ_fast
(this algebra + component-owned state). The grammar fields that look idle —
`Vary`, `Button.action` ids, `bind` store-paths — are reserved sockets for the
upper strata (`CONTRACT.md` §11), not unfinished features. Design work that
touches them should preserve their declarative shape.

## 3. Color

Single dark theme. **Depth is tonal surface layering — no drop shadows, no 1px
sectioning borders, no gradients.** Boundaries are background-tone shifts only.

### Neutral scale (the `#121416`-rooted Archive stack) — `tokens/scales.css`

| Token | Hex | Role |
|---|---|---|
| `--mo-neutral-0` | `#0c0e10` | container-lowest / sunken |
| `--mo-neutral-1` | `#121416` | **surface / base** (Archive root) |
| `--mo-neutral-2` | `#1a1c1e` | container-low |
| `--mo-neutral-3` | `#1e2022` | container |
| `--mo-neutral-4` | `#282a2c` | container-high (team plate) |
| `--mo-neutral-5` | `#333537` | container-highest |
| `--mo-neutral-6` | `#37393b` | overlay / floating panel |
| `--mo-neutral-7` | `#4d4635` | outline-variant (warm) |
| `--mo-neutral-8` | `#99907c` | outline |
| `--mo-neutral-9` | `#c5c7c8` | secondary text |
| `--mo-neutral-10` | `#d0c5af` | on-surface-variant (warm) |
| `--mo-neutral-11` | `#e2e2e5` | on-surface / on-background |

Amber beacon ramp: `--mo-amber-300 #ffe088` · `-400 #e9c349` · **`-500 #f2ca50`
(the beacon)** · `-600 #d4af37` · `-700 #735c00` · on-amber `#3c2f00`. Chromatic
ramps (blue/green/red) carry **neutral names**; a dialect injects meaning. The
beacon is rare — primary actions and critical status only. *If the screen looks
yellow, the discipline is broken.*

### Intent vocabulary (the layer authored trees touch)

Core eight (vertical-neutral, never renamed/dropped): `primary-action` (the amber
beacon), `neutral`, `provenance` (citation blue), `evidence` (document register),
`accession` (catalog accent, amber-dim), `caution`, `success`, `info`. The Archive
dialect **extends** with `folio` (quietest mono label), `marginalia` (annotation
aside), `seal` (the beacon's grave amber sibling). Channels per intent: `surface ·
on · hover · border · ring · active · disabled`.

**Contrast floor (verify, don't assume):** body ≥ 4.5:1, large text ≥ 3:1 on the
charcoal stack. The warm muted on-surface (`color-mix(neutral-11 60%)`) is the
common risk — confirm it clears 4.5:1 at body size; bump toward `neutral-11` if
close. "Quiet" never means low-contrast.

## 4. Typography

Three families, wired through `--mo-font-{display,body,mono}`: **Spectral**
(display, humanist old-style serif — `--mo-font-display`, aliased by
`--mo-font-headline`), **Hanken Grotesk** (body, humanist sans), **Fragment Mono**
(folio/label — `--mo-font-mono`, aliased by `--mo-font-label`). The serif+sans+mono
pairing is on a real contrast axis. The Text primitive uses the serif for `display`
+ `heading`, and the body sans for `subheading` (a high-contrast didone goes spindly
small, and the serif-display / sans-subhead split is the type rhythm).

Type ramp (`--mo-type-1..8`, rem): `0.6875 / 0.75 / 0.875 / 1 / 1.0625 / 1.375 /
1.875 / <fluid>`. Line-height ramp: tight `1.15`, snug `1.35`, normal `1.55`.

Craft constraints:
- **`--mo-type-8` (display ceiling) is fluid: `clamp(2.75rem, 1.1rem + 4.6vw,
  4.5rem)`** — 44px on mobile up to 72px on a wide hero (was a flat 44px, which read
  undersized). The Text `display` rule adds a `vw` term to its preferred size so the
  hero actually reaches the ceiling. Still well under impeccable's 6rem cap. The
  brand's other loudness levers remain **asymmetry, whitespace, and the artifact
  photograph**, not just type size.
- Letter-spacing on display: floor at **-0.04em**; the Archive sits around -0.02em
  (wide, architectural). Never tighter than -0.04.
- Body line length capped 65–75ch (the `s-wrap` 80rem cap exists for this).
- Light-on-dark needs a line-height bump (+0.05–0.1); body runs at `1.55`.
- Mono/all-caps is for **short labels only** (≤ 4 words). No all-caps body. The
  eyebrow is a single deliberate system, not section grammar (§9).

## 5. Layout & composition

- **Width caps:** editorial/marketing `80rem` (`.s-wrap`, protects reading
  length); application surfaces — composer, onboarding — `105rem` (`.s-wrap--wide`,
  multi-column work surfaces). Pick by "do I read this top-to-bottom, or work
  inside it?"
- **Band system:** `.s-section` (fluid block padding `clamp(2.5rem,7vw,5.5rem)`),
  `.s-section--sunken` (the one tonal step used for sectioning). Recessed bands
  drop the inner `.mo-root` paint so the sunken surface shows through.
- **The craft mandate (this is the gap the current build has):**
  - **Intentional asymmetry.** Lean into off-center alignment and generous
    one-sided whitespace. A paragraph left, a single artifact photograph right.
    Centered-everything is the tell to escape.
  - **No identical card grids.** Twin symmetric 3-up card walls are an absolute
    ban. Vary panel size/weight; use asymmetric editorial splits; let one item
    dominate. Cards are the lazy answer — reach for them only when they are
    genuinely the best affordance.
  - **Vary vertical rhythm.** Generous separations between movements, tight
    groupings within. Don't apply one uniform spacer everywhere.
  - **One dominant idea per fold.** Brand permission: single-purpose viewports,
    deliberate pacing, art-direction per section if the narrative demands it.

## 6. Components & idioms

- **Site compounds** (`src/lib/site/compounds.ts`): editorial building blocks
  (hero, value-prop, pullquote, step, feature-split, cta-banner). Variability rides
  as **node params + slots** only — the factory does not interpolate string fields
  (no parameterised `Disclosure.summary`, `Badge.label`, `Link.label`, etc.); those
  are authored directly in the presenter. These are revisable; rebuild them for
  craft.
- **Native-control-surface idiom.** Morphe `Button` is declarative (no live wire)
  and `Link` is an inline underlined `<a>`. So conversion CTAs and interactive
  controls (the composer, the contact + onboarding forms) live **outside** the
  Morphe tree as native elements styled with the same `--mo-*` tokens; the tree
  carries editorial/result content. In-prose page-to-page navigation *does* use the
  Morphe `Link` primitive (correct, in-algebra).
- **Radius:** cards/sections top out at `--mo-radius-3` (0.5rem / 8px); pill
  (`--mo-radius-full`) is for tags/chips only. No 24px+ card rounding.

## 7. Motion

- Reduced motion is **not optional** — every transition needs a
  `prefers-reduced-motion: reduce` alternative (a CSS media query, never a JS hook;
  the substrate's overlays/disclosures already honor it).
- Ease-out with exponential curves; no bounce, no elastic.
- Brand permission: one ambitious, well-orchestrated first-load (hero stagger) is
  worth more than fade-on-scroll bolted onto every section. The reflex to suppress
  — one identical entrance on every section — is the tell; staggering items *within*
  one list is legitimate. Reveals must enhance an already-visible default (never
  gate content visibility on a class-triggered transition).

## 8. Imagery

Brand register **requires** committed imagery; a near-text-only page reads as
incomplete, not restrained. The aesthetic is the *physical artifact*: high-res
stone, paper, brushed metal, architectural detail, the appliance itself — grayscale
+ contrast bumps allowed, treated as part of the interface. Real assets live in
`static/images/` (`the-box.png`, `sokrates-mark.svg`, `reykjavik-arch.png`). Alt
text is part of the voice ("the matte-black appliance on a wooden desk, amber mark
etched into the lid", not "product photo"). **Never:** stock illustration, glowing
circuits, diverse-team-in-office. One decisive photo beats five mediocre ones. The
current build under-uses imagery (one mid-page box photo) — commit more.

## 9. Dialects are the craft surface — and none is holy

"Dialects make the tokens trivial." A dialect is a *specific implementation* of the
intent layer + bounded priors; it is where impeccable craft lands, and **no dialect
is sacred** — rewrite `icelandic-archive` wholesale, cut or rebuild `clinical` /
`reykjavik`, or add a new one, whenever it serves excellence. The only constraints,
which are the *system* (not cows to kill):

- Dialect channel values reference a **neutral scale var** (`var(--mo-...)`) or a
  `color-mix` of them — **never a literal hex.** Vertical meaning lives only at the
  intent layer; scales stay neutral.
- Preserve the `CONTRACT.md §8` **intent keyset fixed point** across all dialects
  (same intent names, same channel set) — `dialects.test.ts` enforces it. Add a
  channel → add it to every dialect and to `intents.css`.
- Priors are clamped (budget 1..6, scaleTier 2..4) so Lemma 2's laws survive any
  dialect.

### The three shipped dialects are pulled apart at the loudest signals

A dialect swap must be legible at a glance, and the place a viewer reads first is
the **beacon (the one amber primary action) and the surface temperature** — not the
secondary citation/record hues. So the three shipped dialects are deliberately
separated *there*:

| Dialect | Beacon (`primary-action`) | Surface | Authority mark (`seal`) |
|---|---|---|---|
| `icelandic-archive` (default) | **amber** `--mo-amber-500` | warm graphite | grave amber |
| `clinical` | **steel-blue** `--mo-blue-500` | cool slate (neutral × blue-700) | green sign-off |
| `reykjavik-registry` | **amethyst** `--mo-violet-500` | violet-cooled (neutral × violet-700) | amethyst stamp |

`violet` is a *third* neutral scale ramp added to `tokens/scales.css` for exactly
this — green/red are reserved for success/caution, and amber/blue were already
spent, so a genuinely distinct third beacon needs its own vertical-neutral ramp.
The functional/lineage intents (`provenance`, `info`, `caution`, `success`) stay
near-constant across dialects on purpose: a citation is blue, a deviation is red,
in every reading. All three dialects clear WCAG AA on muted on-surface text
(`on-surface-muted` at 74%).

### Cohorts: dialects as ad-profile-targeted pitches (direction)

The dialect mechanism is not just a substrate demo — it is the lever for
**cohort-targeted marketing**. A visitor arriving from a given ad profile is a known
customer cohort; the same authored marketing tree can re-theme (and, as a next step,
re-*copy*) into the pitch that cohort responds to, with zero change to the authored
nodes. The palette differentiation above is step one (each cohort reads as its own
brand). Step two is **shipped**: the layout reads a landing `?cohort=` param and
sets `activeDialect` on arrival (`resolveArrivalDialect` in
`src/lib/morphe/dialects/arrival.ts`; precedence: valid param > persisted choice >
default, unknown params ignored, an explicit in-session toggle always wins
afterward). The remaining step, not yet built: branch the centralized copy in
`$lib/site/present.ts` per cohort/persona so the *pitch*, not only the palette,
fits the profile. Copy-per-cohort is a product decision (which cohorts, which
pitches) and the Icelandic copy is the user's — so it waits for that input rather
than being invented here.

### Project bans (reject on sight; these are the AI/old-sketch tells)

- **Eyebrow above every section.** Tiny uppercase tracked mono label on every
  heading is AI section-grammar. One deliberate kicker *system* is voice; the
  current build puts an `eyebrow()` on nearly every section — kill it.
- **Identical 3-up card grids.** Twin symmetric value-prop / step walls. Banned.
- **Centered-everything single-column.** Escape via intentional asymmetry.
- **Glassmorphism nav** (`surface @ 80% + backdrop-blur`) — the old sketch
  recommends it; banned as default decoration.
- **1px ghost-border inputs / side-stripe borders / ambient drop shadows / gradient
  text / repeating-stripe backgrounds / sketchy SVG.** All banned.
- **SaaS jargon, logo walls, hero-metric template, pricing tiers, em dashes in
  copy.** See `marketing-context.md` §9–10 and PRODUCT.md.

## 10. Verify

`bun run check` (svelte-check, 0 errors / 0 warnings) · `bun run test` (vitest,
law/factory/dialect + render suites) · `bun run build` (vite, client + SSR) · `bun
run dev` (smoke at `/`). Before claiming a design change done: check clean, tests
green, browser-verified at desktop + mobile, and every dialect still re-themes the
same authored tree (the fixed point).
