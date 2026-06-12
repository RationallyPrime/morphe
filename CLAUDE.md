# CLAUDE.md

Guidance for Claude Code (and any agent) working in this repo. These instructions override default behavior. Read this **before** asking how the system works — it is built to answer that: the formal contract lives in `CONTRACT.md`, and the vision it is Phase 0 of (the stratified adaptive tower — why `Vary`, `action` ids, and `bind` paths are typed sockets, not unfinished features) lives in `VISION.md`. Those sockets are coming online: `action` ids wire at `MorpheRoot.actions`, `bind` paths wire to the client store, and `Vary` + the Delta machinery drives the home page's intent stage (ADR-0006) — keep them declarative.

## What this repo is

**Morphe** is a stratified adaptive-UI substrate: UI is authored as **data** (a typed `Node` tree), rendered through a fixed grammar + a context algebra + a three-layer token system, and re-themed by swapping a **dialect** without touching the authored tree. On top of that substrate lives the **Sókrates marketing site** (the composer + the marketing pages). The substrate is the product's foundation; treat it as a real design system, not a scratch app.

The **design system is the Morphe substrate itself** — the grammar, the context algebra, the three token strata, and the dialect mechanism. `gallery` is its **default theme** (ADR-0005; one fixed point in dialect-space), NOT the design system, and no dialect is sacred (rewrite/replace them freely; the *substrate* is the locked part — the amber-on-charcoal `icelandic-archive` identity was itself retired as default and survives only as a registered dialect). The committed Sókrates identity the default theme currently realizes: warm bone/plaster paper surfaces, ink-navy text from the Timaeus plates' shadows, ONE electric-cobalt beacon (no second accent, ever), **Spectral** (display) + **Hanken Grotesk** (body) + **Fragment Mono** (mono/label). The full canon is `PRODUCT.md` (strategy) + `DESIGN.md` (visual system); read them before design work.

## Stack & commands

- **SvelteKit + Svelte 5 (runes)**, Vite, **TypeScript strict** (`noUncheckedIndexedAccess`, `verbatimModuleSyntax`), **bun** (never npm/pnpm/yarn), **Biome** (tabs, double quotes, semicolons, 100 cols), **Vitest**, `@sveltejs/adapter-vercel` (pinned, `runtime: "nodejs22.x"`).
- `bun run dev` · `bun run build` · `bun run check` (svelte-check) · `bun run test` (vitest).
- **Imports:** library code under `src/lib/**` uses **`.js` extensions** on relative imports and `import type` for types (verbatimModuleSyntax). `src/lib` is the package root: app/playground code imports Morphe from `$lib` and `$lib/components`, never deep paths. Sókrates-only code lives under `src/app/**` and is imported through `$site`, `$compose`, and `$serverlib`.

## The algebra (how UI is built here)

Four lemmas, all enforced in code. The single source of truth for the grammar is `src/lib/grammar/types.ts`.

1. **Grammar (Lemma 1).** A discriminated `Node` union: Layout (`frame`/`stack`/`grid`/`cluster`/`spacer`), Content (`text`/`number`/`badge`/`icon`/`media`), Input (`field`/`select`/`toggle`/`range` — **a11y is a required typed field**, an unlabelled input is unrepresentable), Feedback (`progress`/`status`/`inline-alert` — functional color is never the only signal; a paired text/shape is required), Action (`button` = does something / `link` = goes somewhere; a clickable `<div>` is forbidden), Overlay (`dialog`/`popover`/`disclosure` — platform top layer), Meta (`slot`/`param-ref`/`vary`), and `compound`.
2. **Context algebra (Lemma 2).** Containers carry a compositional **role** (`page`/`section`/`panel`/`toolbar`/`list`/`form`/`field-group`/`inline`); the child context is `f(parent ctx, role)`. Authored trees emit **roles, priorities, intents** — never geometry (no px, no scale names, no hex). `Frame` is the only context reset (re-roots depth/scale, re-grants the emphasis budget `B`, changes surface).
3. **Tokens (3 layers).** Neutral **scales** (`--mo-neutral-*`, `--mo-bone-*`, `--mo-cobalt-*`, `--mo-amber-*`, …) → semantic **intents** → **slots**. Authored trees reference **intents only**.
4. **Dialects (Lemma 4) + the fixed point (Lemma 3).** A dialect remaps the intent layer (and bounded priors) and nothing else, so the **same tree re-themes** under any dialect. Core intents (vertical-neutral, never renamed/dropped): `primary-action` (the beacon — electric cobalt under the default `gallery`, used sparingly), `neutral`, `provenance`, `evidence`, `accession`, `caution`, `success`, `info`. Every shipped dialect also carries the register extensions `folio`/`marginalia`/`seal`. `CONTRACT.md §8` fixes the intent-keyset across all shipped dialects — adding a dialect must preserve it (`dialects.test.ts`, which also pins the static `intents.css` blocks to the dialect data).

Six dialects ship (`src/lib/dialects/registry.ts`): `gallery` (**default**, light paper ground), `night` (the plates' blue-black strata), `icelandic-archive` (the retired amber-on-charcoal identity), `clinical`, `reykjavik-registry`, `timaeus`. Dialects are **global**: `activeDialect` (`dialects/active.svelte.ts`) is the rune store; `MorpheRoot` follows it when no `dialect` prop is passed (an explicit prop pins a subtree — the *vitrine idiom* keeps plates on a `night` ground under every dialect), and `+layout.svelte` applies the active dialect's vars at the shell boundary so native chrome re-themes too. The toggle lives on `/substrate`; "Flip the lights" on `/` toggles gallery↔night. Persisted to `localStorage` (`mo-dialect`); a `?cohort=` landing param resolves arrival attribution (`dialects/arrival.ts`: valid param > persisted choice > default). **Tokens are trivial because of this — never hardcode a color; pick the right intent.**

## Compounds (the open vocabulary) — and the constraint that bites

A **compound** is `createCompoundComponent` lifted from code to **data**: a `CompoundDef` = params schema + a template `Node` with `ParamRef`/`Slot` leaves. Registered through the factory **gate** (`registry.register`), which expands-with-defaults, type-checks the grammar, checks acyclicity, and bounds depth. Registration is **idempotent-guarded** (`if (reg.has(name)) continue`) so HMR/repeat imports are safe; a failing def is never added (render stays total). See `src/lib/compounds/factory.ts`, and real examples in `src/app/compose/compounds.ts`, `src/app/site/compounds.ts`, `src/routes/_demo/tree.ts`.

**The hard constraint (this is the one that trips you up):** the factory only substitutes `ParamRef` **node children** and fills **slots**. It does **not** interpolate into a node's string fields. So you **cannot** parameterise `Disclosure.summary`, `Badge.label`, `Status.signal.text`, `Field.a11y.label.text`, `Media.src`, `Icon.name`, `Link.href/label`, `Button.label`. Anything keyed by a raw string is authored **directly** in the presenter, not smuggled through a param. Build compounds whose variability is purely **node params + slots**.

**Authoring idioms** (copy them; don't reinvent):
- Variable pieces ride as **NODE params** so the call site owns the register (`as`/`intent`/`emphasis`). A bare **STRING** param coerces to a `text` node at **body** register — heavier/larger than you usually want; pass a `text(...)` node instead.
- Variable-length children ride through **SLOTS** (`slots: { name: [...] }`), filled at the call site.
- Presenters are **pure functions returning `Node`** (see `src/app/compose/present.ts`, `src/app/site/present.ts`). No clock, no RNG, no I/O, no `window` at module scope (SSR-safe).

## The native-control-surface idiom (important)

Morphe `Button` is **declarative** (carries an `action` id, no live wire) and `Link` is an inline underlined `<a href>`. So **interactive controls and prominent conversion CTAs live OUTSIDE the Morphe tree**, as native elements styled with the same `--mo-*` tokens — exactly what the composer does (its textarea/checkboxes/submit are native; `MorpheRoot` renders the *result*). The Morphe tree carries editorial/result content; the page owns the controls. In-prose navigation between pages **does** use the Morphe `Link` primitive (correct, in-algebra). Don't try to make a Morphe `Button` navigate.

`MorpheRoot` paints `surface-base` on `.mo-root`; native section wrappers are base-bg, and "raised/sunken" looks come from Morphe `Frame`s **inside** the tree. Don't put native elements inside a Morphe frame expecting the surface to compose.

## Site structure

- `/` — home: a **stage, not a corridor** (ADR-0006). A short hero hands to the **composer (the interactive centerpiece)**, then the **intent engine**: a chip row + Cmd/Ctrl+K palette (`$site/intents.ts` is the gated, serializable vocabulary; `intent-engine.svelte.ts` executes; `morph-stage.ts` owns the `Vary`-keyed stage tree). A morph is a hand-authored Delta through `applyDelta` — rejected if malformed, never rendered broken; chips degrade to plain anchors without JS; **re-invoking an open intent closes it** (the Vary returns to its default branch; the open chip carries `aria-expanded` + a close glyph). The stage's **default branch is the standing plates tease**, so "Tell me the story" transforms it in place instead of stacking a duplicate. Then the contact close (two `primary-action` beacons total: composer submit + contact submit).
- `/how-it-works`, `/architecture` — marketing pages, authored as Morphe trees (`$site` presenters).
- `/onboarding` — the multi-step intake flow (native control surface + Morphe progress/confirmation trees), behind the stateless magic-link gate (ADR-0001; fail-open when `MAGIC_LINK_SECRET` is absent).
- `/substrate` — the dignity demo (the substrate itself; the global dialect toggle lives here, a segmented control over all six dialects, plus the night-pinned vitrine proof).
- Redirects: `/compose` → `/`, `/dignity` → `/substrate`.
- Endpoints: `/api/rerank` (Voyage reranker, server-side key), `/api/contact` + `/api/onboarding` (founder alerts: Postmark email + ntfy push via `$serverlib/notify`, graceful when env is absent), `/api/onboarding/request-link` (magic-link email to the visitor via `$serverlib/email`). Server env: `POSTMARK_SERVER_TOKEN`, `MAGIC_LINK_SECRET`, optional `SOKRATES_EMAIL_FROM`/`SOKRATES_EMAIL_TO`.
- Real brand assets in `static/images/` (`sokrates-mark.svg`, `the-box.png`, `reykjavik-arch.png`) and the nine Timaeus plate derivatives in `static/images/plates/` (`bun run plates`; public canon is B1–B9 only — `t1-*`/Trajectory material never ships, enforced by test + CI grep gate). Marketing copy is canonical in **`/home/rationallyprime/projects/sokrates-website/marketing-context.md`** (voice = "Quiet Confidence"); copy is centralised in `$site/present.ts` (EN; localise there later — the user owns the Icelandic copy).

## Adding things (the right way)

- **A compound:** add a `CompoundDef` (node params + slots only), register it through the gate via the module's idempotent `register*Compounds()`, build it in the presenter with `text(...)` nodes for register control.
- **A dialect:** remap intents + set bounded priors only; preserve the `CONTRACT.md §8` keyset (all eight core intents × seven channels + folio/marginalia/seal + a surface stack — partial coverage falls through to the static defaults and yields a partial re-theme); extend `dialects.test.ts` to the new dialect.
- **A page:** a presenter in `$site` returning `Node` trees + a route that renders them via `MorpheRoot` (wrap `MorpheRoot` in `{#key activeDialect.id}` if it must live-re-theme), with native CTAs/controls in the chrome.
- **A site intent / morph:** add a `SiteIntent` to `SITE_INTENTS` (`$site/intents.ts`) — it must carry a canonical `href` (the no-JS ground truth) and a typed action (`navigate` / `flip-dialect` / `stage-delta`); for a content morph, add a stage choice in `morph-stage.ts` and route the intent through `stage-delta`. The registration gate rejects bad defs; extend `intents.test.ts`.

## Deploy

Vercel project `sokrates-spunagreind/morphe` (`adapter-vercel`, `nodejs22.x`). `VOYAGE_API_KEY` is set on Production (server-side only; never printed/committed; `.env` is gitignored). Pushing to the repo is the user's call — never `git push` without an explicit request.

## Agent skills

### Issue tracker

Issues + PRDs live in **Linear** (team `Krates-ehf`, project `Morphe`, keys `KRA-###`) via the `linear` MCP — **not** GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical triage roles map onto existing Linear labels: `needs-triage`→`needs human review`, `needs-info`→`needs-grill`, `ready-for-agent`→`ready-for-agent`, `ready-for-human`→`ready-for-human`, `wontfix`→`deferred-post-v1`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context. The formal corpus is `CONTEXT.md` (the domain glossary — canonical term meanings; it wins on vocabulary conflicts) + `VISION.md` (the stratified-adaptive tower — the why) + `CONTRACT.md` (the substrate contract — the what/how; §11 reserved strata seams, §12 known gaps) + `PRODUCT.md` + `DESIGN.md`, with `docs/reconstruction-plan.md` (code→vision alignment) and `MIGRATION.md` (the Eidos lift) as the forward plans. `STATUS.md` is the rolling verified snapshot. ADRs live in `docs/adr/`. See `docs/agents/domain.md`.
