# CLAUDE.md

Guidance for Claude Code (and any agent) working in this repo. These instructions override default behavior. Read this **before** asking how the system works — it is built to answer that: the formal contract lives in `CONTRACT.md`, and the vision it is Phase 0 of (the stratified adaptive tower — why `Vary`, `action` ids, and `bind` paths exist but are inert) lives in `VISION.md`.

## What this repo is

**Morphe** is a stratified adaptive-UI substrate: UI is authored as **data** (a typed `Node` tree), rendered through a fixed grammar + a context algebra + a three-layer token system, and re-themed by swapping a **dialect** without touching the authored tree. On top of that substrate lives the **Sókrates marketing site** (the composer + the marketing pages). The substrate is the product's foundation; treat it as a real design system, not a scratch app.

The **design system is the Morphe substrate itself** — the grammar, the context algebra, the three token strata, and the dialect mechanism. `icelandic-archive` is its **default theme** (one fixed point in dialect-space), NOT the design system, and no dialect is sacred (rewrite/replace them freely; the *substrate* is the locked part). The committed Sókrates identity the default theme currently realizes: amber `#f2ca50` beacon on a `#121416` tonal surface stack, **Spectral** (display) + **Hanken Grotesk** (body) + **Fragment Mono** (mono/label). The full canon is `PRODUCT.md` (strategy) + `DESIGN.md` (visual system); read them before design work.

## Stack & commands

- **SvelteKit + Svelte 5 (runes)**, Vite, **TypeScript strict** (`noUncheckedIndexedAccess`, `verbatimModuleSyntax`), **bun** (never npm/pnpm/yarn), **Biome** (tabs, double quotes, semicolons, 100 cols), **Vitest**, `@sveltejs/adapter-vercel` (pinned, `runtime: "nodejs22.x"`).
- `bun run dev` · `bun run build` · `bun run check` (svelte-check) · `bun run test` (vitest).
- **Imports:** library code under `src/lib/**` uses **`.js` extensions** on relative imports and `import type` for types (verbatimModuleSyntax). Route/app code uses the **`$morphe`** alias (→ `src/lib/morphe`) and **`$lib`** (→ `src/lib`, SvelteKit built-in). Import the public API from the barrels (`$morphe`, `$lib/compose`, `$lib/site`), not deep paths.

## The algebra (how UI is built here)

Four lemmas, all enforced in code. The single source of truth for the grammar is `src/lib/morphe/grammar/types.ts`.

1. **Grammar (Lemma 1).** A discriminated `Node` union: Layout (`frame`/`stack`/`grid`/`cluster`/`spacer`), Content (`text`/`number`/`badge`/`icon`/`media`), Input (`field`/`select`/`toggle`/`range` — **a11y is a required typed field**, an unlabelled input is unrepresentable), Feedback (`progress`/`status`/`inline-alert` — functional color is never the only signal; a paired text/shape is required), Action (`button` = does something / `link` = goes somewhere; a clickable `<div>` is forbidden), Overlay (`dialog`/`popover`/`disclosure` — platform top layer), Meta (`slot`/`param-ref`/`vary`), and `compound`.
2. **Context algebra (Lemma 2).** Containers carry a compositional **role** (`page`/`section`/`panel`/`toolbar`/`list`/`form`/`field-group`/`inline`); the child context is `f(parent ctx, role)`. Authored trees emit **roles, priorities, intents** — never geometry (no px, no scale names, no hex). `Frame` is the only context reset (re-roots depth/scale, re-grants the emphasis budget `B`, changes surface).
3. **Tokens (3 layers).** Neutral **scales** (`--mo-neutral-*`, `--mo-amber-*`, …) → semantic **intents** → **slots**. Authored trees reference **intents only**.
4. **Dialects (Lemma 4) + the fixed point (Lemma 3).** A dialect remaps the intent layer (and bounded priors) and nothing else, so the **same tree re-themes** under any dialect. Core intents (vertical-neutral, never renamed/dropped): `primary-action` (the amber beacon, used sparingly), `neutral`, `provenance`, `evidence`, `accession`, `caution`, `success`, `info`. The Archive dialect **extends** the set with `folio`/`marginalia`/`seal`. `CONTRACT.md §8` fixes the intent-keyset across all shipped dialects — adding a dialect must preserve it (`dialects.test.ts`).

Dialects are **global**: `activeDialect` (`src/lib/morphe/dialects/active.svelte.ts`) is the rune store; `MorpheRoot` follows it when no `dialect` prop is passed, so a flip re-themes every surface. The toggle lives on `/substrate`. Persisted to `localStorage` in `+layout.svelte`. **Tokens are trivial because of this — never hardcode a color; pick the right intent.**

## Compounds (the open vocabulary) — and the constraint that bites

A **compound** is `createCompoundComponent` lifted from code to **data**: a `CompoundDef` = params schema + a template `Node` with `ParamRef`/`Slot` leaves. Registered through the factory **gate** (`registry.register`), which expands-with-defaults, type-checks the grammar, checks acyclicity, and bounds depth. Registration is **idempotent-guarded** (`if (reg.has(name)) continue`) so HMR/repeat imports are safe; a failing def is never added (render stays total). See `src/lib/morphe/compounds/factory.ts`, and real examples in `src/lib/compose/compounds.ts`, `src/lib/site/compounds.ts`, `src/routes/_demo/tree.ts`.

**The hard constraint (this is the one that trips you up):** the factory only substitutes `ParamRef` **node children** and fills **slots**. It does **not** interpolate into a node's string fields. So you **cannot** parameterise `Disclosure.summary`, `Badge.label`, `Status.signal.text`, `Field.a11y.label.text`, `Media.src`, `Icon.name`, `Link.href/label`, `Button.label`. Anything keyed by a raw string is authored **directly** in the presenter, not smuggled through a param. Build compounds whose variability is purely **node params + slots**.

**Authoring idioms** (copy them; don't reinvent):
- Variable pieces ride as **NODE params** so the call site owns the register (`as`/`intent`/`emphasis`). A bare **STRING** param coerces to a `text` node at **body** register — heavier/larger than you usually want; pass a `text(...)` node instead.
- Variable-length children ride through **SLOTS** (`slots: { name: [...] }`), filled at the call site.
- Presenters are **pure functions returning `Node`** (see `src/lib/compose/present.ts`, `src/lib/site/present.ts`). No clock, no RNG, no I/O, no `window` at module scope (SSR-safe).

## The native-control-surface idiom (important)

Morphe `Button` is **declarative** (carries an `action` id, no live wire) and `Link` is an inline underlined `<a href>`. So **interactive controls and prominent conversion CTAs live OUTSIDE the Morphe tree**, as native elements styled with the same `--mo-*` tokens — exactly what the composer does (its textarea/checkboxes/submit are native; `MorpheRoot` renders the *result*). The Morphe tree carries editorial/result content; the page owns the controls. In-prose navigation between pages **does** use the Morphe `Link` primitive (correct, in-algebra). Don't try to make a Morphe `Button` navigate.

`MorpheRoot` paints `surface-base` on `.mo-root`; native section wrappers are base-bg, and "raised/sunken" looks come from Morphe `Frame`s **inside** the tree. Don't put native elements inside a Morphe frame expecting the surface to compose.

## Site structure

- `/` — home: the marketing landing with the **composer as the interactive centerpiece**.
- `/how-it-works`, `/architecture` — marketing pages, authored as Morphe trees (`$lib/site` presenters).
- `/onboarding` — the multi-step intake flow (native control surface + Morphe progress/confirmation trees).
- `/substrate` — the dignity demo (the substrate itself; the dialect toggle lives here).
- Redirects: `/compose` → `/`, `/dignity` → `/substrate`.
- Endpoints: `/api/rerank` (Voyage reranker, server-side key), `/api/contact` + `/api/onboarding` (ntfy-to-founder forward, graceful when env is absent).
- Real brand assets in `static/images/` (`sokrates-mark.svg`, `the-box.png`, `reykjavik-arch.png`). Marketing copy is canonical in **`/home/rationallyprime/projects/sokrates-website/marketing-context.md`** (voice = "Quiet Confidence"); copy is centralised in `$lib/site/present.ts` (EN; localise there later — the user owns the Icelandic copy).

## Adding things (the right way)

- **A compound:** add a `CompoundDef` (node params + slots only), register it through the gate via the module's idempotent `register*Compounds()`, build it in the presenter with `text(...)` nodes for register control.
- **A dialect:** remap intents + set bounded priors only; preserve the `CONTRACT.md §8` keyset; extend `dialects.test.ts` to the new dialect.
- **A page:** a presenter in `$lib/site` returning `Node` trees + a route that renders them via `MorpheRoot` (wrap `MorpheRoot` in `{#key activeDialect.id}` if it must live-re-theme), with native CTAs/controls in the chrome.

## Deploy

Vercel project `sokrates-spunagreind/morphe` (`adapter-vercel`, `nodejs22.x`). `VOYAGE_API_KEY` is set on Production (server-side only; never printed/committed; `.env` is gitignored). Pushing to the repo is the user's call — never `git push` without an explicit request.

## Agent skills

### Issue tracker

Issues + PRDs live in **Linear** (team `Krates-ehf`, project `Morphe`, keys `KRA-###`) via the `linear` MCP — **not** GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical triage roles map onto existing Linear labels: `needs-triage`→`needs human review`, `needs-info`→`needs-grill`, `ready-for-agent`→`ready-for-agent`, `ready-for-human`→`ready-for-human`, `wontfix`→`deferred-post-v1`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context. No `CONTEXT.md` yet (proceed silently); the formal corpus is `VISION.md` (the stratified-adaptive tower — the why) + `CONTRACT.md` (the substrate contract — the what/how; §11 reserved strata seams, §12 known gaps) + `PRODUCT.md` + `DESIGN.md`, with `docs/reconstruction-plan.md` (code→vision alignment) and `MIGRATION.md` (the Eidos lift) as the forward plans. ADRs live in `docs/adr/`. See `docs/agents/domain.md`.
