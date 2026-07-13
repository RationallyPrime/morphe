# AGENTS.md

Guidance for Codex (and any agent) working in this repo. These instructions override default behavior. Read this **before** asking how the system works: `CONTEXT.md` fixes the vocabulary, `VISION.md` explains the stratified adaptive tower, and `CONTRACT.md` defines the substrate. `Vary`, `Within`, `action` ids, and `bind` paths are declarative authority sockets, not invitations to put handlers or host state in authored trees. `action` ids wire at `MorpheRoot.actions`; `bind` paths wire to the client store; and `Vary` / `Within` choices wire through `MorpheRoot.choices` and the Delta machinery. A targeted `Within` owns exactly one subtree: density changes that target's incoming context, emphasis enters the target as a parent-budgeted claim, and collapse uses a native labelled disclosure. A targetless legacy `Within` remains inert.

## What this repo is

**Morphe** is a stratified adaptive-UI substrate: UI is authored as **data** (a typed `Node` tree), rendered through a fixed grammar + a context algebra + a three-layer token system, and re-themed by swapping a **dialect** without touching the authored tree. It is an **independent, versioned package** and **Projection M of Eidos**: independence describes ownership and distribution; Projection M describes its architectural role. Projection M is not a repository-location or source-coupling claim.

This repo owns the public package, Pydantic grammar and generated artifacts, schema-to-surface compiler, local CMS/tooling surface, adaptive lab contract, neutral playground, and stripped deployment viewer. Consumer-specific domain models, presenters, actions, assets, and routes stay in consumer repos.

The **design system is the Morphe substrate itself** — the grammar, the context algebra, the three token strata, and the dialect mechanism. `gallery` is its **default theme** (ADR-0005; one fixed point in dialect-space), NOT the design system, and no dialect is sacred (rewrite/replace them freely; the *substrate* is the locked part — the amber-on-charcoal `icelandic-archive` identity was itself retired as default and survives only as a registered dialect). The playground's committed assets are deliberately neutral demo assets; consumer-specific brand/product assets belong in the consumer repo.

## Stack & commands

- **SvelteKit + Svelte 5 (runes)**, Vite, **TypeScript strict** (`noUncheckedIndexedAccess`, `verbatimModuleSyntax`), **bun** (never npm/pnpm/yarn), **Biome** (tabs, double quotes, semicolons, 100 cols), **Vitest**, `@sveltejs/adapter-vercel` (pinned, `runtime: "nodejs22.x"`).
- `bun run dev` · `bun run build` · `bun run check` (svelte-check) · `bun run test` (vitest).
- **Imports:** library code under `src/lib/**` uses **`.js` extensions** on relative imports and `import type` for types (verbatimModuleSyntax). `src/lib` is the package root: playground/routes import Morphe from `$lib` and `$lib/components`, never deep paths. Consumer apps import the published seams (`@rationallyprime/morphe`, `@rationallyprime/morphe/components`, `@rationallyprime/morphe/styles.css`) and keep their app-specific code outside this repo.

## The algebra (how UI is built here)

Four lower-tower lemmas shape the shipped substrate. The single source of truth for the grammar is `py/morphe_grammar/models.py`; `src/lib/grammar/types.ts` and the JSON Schemas are generated artifacts and must never be hand-edited.

1. **Grammar (Lemma 1).** A discriminated `Node` union: Layout (`frame`/`stack`/`grid`/`cluster`/`spacer`), Content (`text`/`number`/`badge`/`icon`/`media`), Input (`field`/`select`/`toggle`/`range` — **a11y is a required typed field**, an unlabelled input is unrepresentable), Feedback (`progress`/`status`/`inline-alert` — functional color is never the only signal; a paired text/shape is required), Action (`button` = does something / `link` = goes somewhere; a clickable `<div>` is forbidden), Overlay (`dialog`/`popover`/`disclosure` — platform top layer), Meta (`slot`/`param-ref`/`vary`/`within`), and `compound`.
2. **Context algebra (Lemma 2).** Containers carry a compositional **role** (`page`/`section`/`panel`/`toolbar`/`list`/`form`/`field-group`/`inline`); the child context is `f(parent ctx, role)`. Authored trees emit **roles, priorities, intents** — never geometry (no px, no scale names, no hex). `Frame` is the only context reset (re-roots depth/scale, re-grants the emphasis budget `B`, changes surface).
3. **Tokens (3 layers).** Neutral **scales** (`--mo-neutral-*`, `--mo-bone-*`, `--mo-cobalt-*`, `--mo-amber-*`, …) → semantic **intents** → **slots**. Authored trees reference **intents only**.
4. **Dialects (Lemma 4) + the fixed point (Lemma 3).** A dialect remaps the intent layer, supplies bounded priors, and may restrict promoted compounds, so the **same valid tree re-themes** under any dialect. Core intents (vertical-neutral, never renamed/dropped): `primary-action` (the beacon — electric cobalt under the default `gallery`, used sparingly), `neutral`, `provenance`, `evidence`, `accession`, `caution`, `success`, `info`. Every shipped dialect also carries the register extensions `folio`/`marginalia`/`seal`. `CONTRACT.md §8` fixes the intent-keyset across all shipped dialects — adding a dialect must preserve it (`dialects.test.ts`, which also pins the static `intents.css` blocks to the dialect data). `clinical` is the first structurally restricted dialect: its generated `G|D` mask permits the promoted `SignalCard`; the other shipped dialects explicitly retain unrestricted compound compatibility.

Nine dialects ship (`src/lib/dialects/registry.ts`): `gallery` (**default**, light paper ground), `night`, `icelandic-archive` (the retired amber-on-charcoal identity), `clinical`, `reykjavik-registry`, `timaeus`, and the three register expansions `ledger`, `estate`, `foundry`. Dialects are **global**: `activeDialect` (`dialects/active.svelte.ts`) is the rune store; `MorpheRoot` follows it when no `dialect` prop is passed, and an explicit `dialect` prop pins a subtree boundary. The neutral playground toggle lives on `/substrate`; the shell persists explicit choices in `localStorage` (`mo-dialect.v2`) and accepts `?dialect=` through `dialects/arrival.ts`. **Tokens are trivial because of this — never hardcode a color; pick the right intent.**

## Compounds (the open vocabulary) — and the constraint that bites

A **compound** is `createCompoundComponent` lifted from code to **data**: a `CompoundDef` = params schema + a template `Node` with `ParamRef`/`Slot` leaves. Promoted package compounds are authored once in `py/morphe_grammar/catalog.py`; generation emits `src/lib/compounds/catalog.generated.ts`, and the runtime singleton registers that catalog through the factory **gate**. The gate checks grammar-version compatibility, parameter/default consistency, reference shape, expansion, acyclicity, and depth; a failing definition is never added and an invalid call renders empty without taking down its siblings. Consumer-owned compounds may still register through the same public gate. Never hand-edit generated catalogs or masks.

**The hard constraint (this is the one that trips you up):** the factory only substitutes `ParamRef` **node children** and fills **slots**. It does **not** interpolate into a node's string fields. So you **cannot** parameterise `Disclosure.summary`, `Badge.label`, `Status.signal.text`, `Field.a11y.label.text`, `Media.src`, `Icon.name`, `Link.href/label`, `Button.label`. Anything keyed by a raw string is authored **directly** in the presenter, not smuggled through a param. Build compounds whose variability is purely **node params + slots**.

**Authoring idioms** (copy them; don't reinvent):
- Variable pieces ride as **NODE params** so the call site owns the register (`as`/`intent`/`emphasis`). A bare **STRING** param coerces to a `text` node at **body** register — heavier/larger than you usually want; pass a `text(...)` node instead.
- Variable-length children ride through **SLOTS** (`slots: { name: [...] }`), filled at the call site.
- Presenters are **pure functions returning `Node`**. No clock, no RNG, no I/O, no `window` at module scope (SSR-safe). App-specific presenters belong in consumer repos; the Morphe demo presenter data lives under `src/routes/_demo/**`.

## The native-control-surface idiom (important)

Morphe `Button` is **declarative** (carries an `action` id, no live wire) and `Link` is an inline underlined `<a href>`. Interactive chrome and host-level controls live OUTSIDE the Morphe tree as native elements styled with the same `--mo-*` tokens; `MorpheRoot` renders the authored/result tree. The page owns the controls, action map, store, variation choices, and escalation handler. In-prose navigation between pages **does** use the Morphe `Link` primitive (correct, in-algebra). Don't try to make a Morphe `Button` navigate.

`MorpheRoot` paints `surface-base` on `.mo-root`; native section wrappers are base-bg, and "raised/sunken" looks come from Morphe `Frame`s **inside** the tree. Don't put native elements inside a Morphe frame expecting the surface to compose.

## Demo host structure

- `/` — neutral Morphe workbench index linking the playground, CMS preview, and published pointer proof.
- `/substrate` — full-featured neutral playground: global dialect toggle over all shipped dialects, one authored demo tree, live `actions`, `bind` paths, `choices`, neutral assets, adaptive fallback rendering, and a pinned nested dialect proof.
- `/preview/[artifactId]/[revisionId]` — local CMS preview route. Reads compiled trees from `compiled/capability-pages/**`; the built-in `capability-page.demo/rev-001` fixture renders when no local compiled artifact exists.
- `/p/[slug]` — publication pointer route. Reads `publications.json` → compiled revision; `/p/demo` is always backed by the neutral built-in fixture if no real pointer exists.
- `/dignity` — compatibility redirect to `/substrate`.
- `/api/adaptive/decision` — adaptive sidecar bridge. Calls `MORPHE_AGENT_BASE_URL` when configured and otherwise returns a deterministic schema-valid fallback tree.
- Static demo assets live under `static/images/demo/`. Consumer-specific assets and application behavior live in consumer repos.

The separate `viewer/` app is the stripped deployment surface: exactly `/surfaces/[artifactId]` plus `/healthz`. It fetches a compiled artifact from the configured artifact read service and fails closed on unsupported `grammar_version`. Keep it stripped: no playground, CMS, adaptive outbound route, source credentials, or consumer integrations.

## Adding things (the right way)

- **A promoted package compound:** add the Pydantic-owned definition in `py/morphe_grammar/catalog.py` (node params + slots only), update dialect policies, regenerate with `python -m morphe_grammar.artifacts --write`, and run `just gates`. Consumer compounds use the public registry gate without entering the package catalog.
- **A dialect:** remap intents + set bounded priors, preserve the `CONTRACT.md §8` keyset, add its explicit compound policy in `py/morphe_grammar/dialects.py`, regenerate all masks, and extend the dialect/parity tests.
- **A page:** add a route that renders Morphe trees via `MorpheRoot`, with native controls in route chrome. Consumer pages belong in the consumer repo; this repo's routes are playground/CMS proof surfaces only.
- **A playground behavior:** keep live behavior at the host boundary: `MorpheRoot.actions`, `store`, `choices`, and `onEscalate`. The authored tree stays data.

## Deploy

Package publication goes to public npm as `@rationallyprime/morphe`; Python release artifacts are versioned independently but must pin the same grammar contract. See `PACKAGING.md`. The neutral demo host and stripped viewer are separate deployment targets; deployment ownership and private infrastructure details stay outside this repository's public doctrine. Pushing to the repo is the user's call — never `git push` without an explicit request.

## Agent skills

### Issue tracker

Issues + PRDs live in **Linear** (team `Krates-ehf`, project `Morphe`, keys `KRA-###`) via the `linear` MCP — **not** GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical triage roles map onto existing Linear labels: `needs-triage`→`needs human review`, `needs-info`→`needs-grill`, `ready-for-agent`→`ready-for-agent`, `ready-for-human`→`ready-for-human`, `wontfix`→`deferred-post-v1`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context. The active corpus is `CONTEXT.md` (canonical vocabulary; it wins on vocabulary conflicts), `VISION.md` (the stratified-adaptive tower and independent Projection-M topology), `CONTRACT.md` (the substrate contract), `DESIGN.md` (substrate visual and interaction doctrine), and `PACKAGING.md` (distribution boundary). `STATUS.md` is a dated verified snapshot; `docs/reconstruction-plan.md` is the living completion ledger. Product integration details belong in their owning tracker/context, not this repository. ADRs live in `docs/adr/`. See `docs/agents/domain.md`.
