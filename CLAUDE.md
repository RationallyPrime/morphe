# CLAUDE.md

Guidance for Claude Code (and any agent) working in this repo. These instructions override default behavior. Read this **before** asking how the system works — it is built to answer that: the formal contract lives in `CONTRACT.md`, and the vision it is Phase 0 of (the stratified adaptive tower — why `Vary`, `action` ids, and `bind` paths are typed sockets, not unfinished features) lives in `VISION.md`. Those sockets are coming online: `action` ids wire at `MorpheRoot.actions`, `bind` paths wire to the client store, and `Vary` choices wire through `MorpheRoot.choices` and the Delta machinery — keep them declarative.

## What this repo is

**Morphe** is a stratified adaptive-UI substrate: UI is authored as **data** (a typed `Node` tree), rendered through a fixed grammar + a context algebra + a three-layer token system, and re-themed by swapping a **dialect** without touching the authored tree. This repo owns the substrate package, the local CMS/tooling surface, the adaptive sidecar contract, and a neutral playground that demonstrates the substrate. The Sókrates marketing site is a consumer in the separate `sokrates-website` / `sokrates-ai` repo and imports Morphe as `@rationallyprime/morphe`.

The **design system is the Morphe substrate itself** — the grammar, the context algebra, the three token strata, and the dialect mechanism. `gallery` is its **default theme** (ADR-0005; one fixed point in dialect-space), NOT the design system, and no dialect is sacred (rewrite/replace them freely; the *substrate* is the locked part — the amber-on-charcoal `icelandic-archive` identity was itself retired as default and survives only as a registered dialect). The playground's committed assets are deliberately neutral demo assets; consumer-specific brand/product assets belong in the consumer repo.

## Stack & commands

- **SvelteKit + Svelte 5 (runes)**, Vite, **TypeScript strict** (`noUncheckedIndexedAccess`, `verbatimModuleSyntax`), **bun** (never npm/pnpm/yarn), **Biome** (tabs, double quotes, semicolons, 100 cols), **Vitest**, `@sveltejs/adapter-vercel` (pinned, `runtime: "nodejs22.x"`).
- `bun run dev` · `bun run build` · `bun run check` (svelte-check) · `bun run test` (vitest).
- **Imports:** library code under `src/lib/**` uses **`.js` extensions** on relative imports and `import type` for types (verbatimModuleSyntax). `src/lib` is the package root: playground/routes import Morphe from `$lib` and `$lib/components`, never deep paths. Consumer apps import the published seams (`@rationallyprime/morphe`, `@rationallyprime/morphe/components`, `@rationallyprime/morphe/styles.css`) and keep their app-specific code outside this repo.

## The algebra (how UI is built here)

Four lemmas, all enforced in code. The single source of truth for the grammar is `src/lib/grammar/types.ts`.

1. **Grammar (Lemma 1).** A discriminated `Node` union: Layout (`frame`/`stack`/`grid`/`cluster`/`spacer`), Content (`text`/`number`/`badge`/`icon`/`media`), Input (`field`/`select`/`toggle`/`range` — **a11y is a required typed field**, an unlabelled input is unrepresentable), Feedback (`progress`/`status`/`inline-alert` — functional color is never the only signal; a paired text/shape is required), Action (`button` = does something / `link` = goes somewhere; a clickable `<div>` is forbidden), Overlay (`dialog`/`popover`/`disclosure` — platform top layer), Meta (`slot`/`param-ref`/`vary`/`within`), and `compound`.
2. **Context algebra (Lemma 2).** Containers carry a compositional **role** (`page`/`section`/`panel`/`toolbar`/`list`/`form`/`field-group`/`inline`); the child context is `f(parent ctx, role)`. Authored trees emit **roles, priorities, intents** — never geometry (no px, no scale names, no hex). `Frame` is the only context reset (re-roots depth/scale, re-grants the emphasis budget `B`, changes surface).
3. **Tokens (3 layers).** Neutral **scales** (`--mo-neutral-*`, `--mo-bone-*`, `--mo-cobalt-*`, `--mo-amber-*`, …) → semantic **intents** → **slots**. Authored trees reference **intents only**.
4. **Dialects (Lemma 4) + the fixed point (Lemma 3).** A dialect remaps the intent layer (and bounded priors) and nothing else, so the **same tree re-themes** under any dialect. Core intents (vertical-neutral, never renamed/dropped): `primary-action` (the beacon — electric cobalt under the default `gallery`, used sparingly), `neutral`, `provenance`, `evidence`, `accession`, `caution`, `success`, `info`. Every shipped dialect also carries the register extensions `folio`/`marginalia`/`seal`. `CONTRACT.md §8` fixes the intent-keyset across all shipped dialects — adding a dialect must preserve it (`dialects.test.ts`, which also pins the static `intents.css` blocks to the dialect data).

Nine dialects ship (`src/lib/dialects/registry.ts`): `gallery` (**default**, light paper ground), `night`, `icelandic-archive` (the retired amber-on-charcoal identity), `clinical`, `reykjavik-registry`, `timaeus`, and the three register expansions `ledger`, `estate`, `foundry`. Dialects are **global**: `activeDialect` (`dialects/active.svelte.ts`) is the rune store; `MorpheRoot` follows it when no `dialect` prop is passed, and an explicit `dialect` prop pins a subtree boundary. The neutral playground toggle lives on `/substrate`; the shell persists explicit choices in `localStorage` (`mo-dialect.v2`) and accepts `?dialect=` through `dialects/arrival.ts`. **Tokens are trivial because of this — never hardcode a color; pick the right intent.**

## Compounds (the open vocabulary) — and the constraint that bites

A **compound** is `createCompoundComponent` lifted from code to **data**: a `CompoundDef` = params schema + a template `Node` with `ParamRef`/`Slot` leaves. Registered through the factory **gate** (`registry.register`), which expands-with-defaults, type-checks the grammar, checks acyclicity, and bounds depth. Registration is **idempotent-guarded** (`if (reg.has(name)) continue`) so HMR/repeat imports are safe; a failing def is never added (render stays total). See `src/lib/compounds/factory.ts`, the neutral playground example in `src/routes/_demo/tree.ts`, and CMS-generated trees under the Python `py/morphe_cms/**` surface.

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
- Static demo assets live under `static/images/demo/`. Consumer brand assets, marketing pages, contact/onboarding endpoints, and corpus/rerank pipelines live in the consumer repo.
- Fonts are self-hosted (`src/app-fonts.css`, fontsource + material-symbols packages) — never reintroduce CDN font links; the box viewer ships to air-gapped appliances.

## The box viewer (`viewer/`, KRA-648 / MO-D3)

A second, STRIPPED SvelteKit app sharing the same `$lib` (`kit.files.lib = "../src/lib"`): exactly one route (`/surfaces/[artifactId]`, SSR-fetches a compiled artifact from `MORPHE_ARTIFACT_BASE_URL/{id}` — the topos read route) plus `/healthz` (reports the supported `grammar_version`). It exists because the playground app ships an unauthenticated outbound-capable `/api/adaptive/decision` and is therefore not appliance-shippable. Fail-closed grammar gate: an artifact stamped with an unsupported `grammar_version` renders a 409 diagnostic naming both versions (`GRAMMAR_VERSION` in `src/lib/grammar/version.ts` mirrors `py/morphe_surface/compile.py`; a vitest pins parity). Adapter is env-switched in `viewer/svelte.config.js` (`MORPHE_VIEWER_ADAPTER=node` → adapter-node for the distroless image, `viewer/Dockerfile`, built from repo root). Never give the viewer more routes; host-level controls stay out.

## Adding things (the right way)

- **A compound:** add a `CompoundDef` (node params + slots only), register it through the gate via the module's idempotent `register*Compounds()`, build it in the presenter with `text(...)` nodes for register control.
- **A dialect:** remap intents + set bounded priors only; preserve the `CONTRACT.md §8` keyset (all eight core intents × seven channels + folio/marginalia/seal + a surface stack — partial coverage falls through to the static defaults and yields a partial re-theme); extend `dialects.test.ts` to the new dialect.
- **A page:** add a route that renders Morphe trees via `MorpheRoot`, with native controls in route chrome. Consumer pages belong in the consumer repo; this repo's routes are playground/CMS proof surfaces only.
- **A playground behavior:** keep live behavior at the host boundary: `MorpheRoot.actions`, `store`, `choices`, and `onEscalate`. The authored tree stays data.

## Deploy

Package publication goes through GitHub Packages as `@rationallyprime/morphe`; see `PACKAGING.md`. The neutral demo host can deploy to Vercel project `sokrates-spunagreind/morphe` (`adapter-vercel`, `nodejs22.x`) when needed. The Sókrates website deploys from the separate website repo/project, not from this repository. Pushing to the repo is the user's call — never `git push` without an explicit request.

## Agent skills

### Issue tracker

Issues + PRDs live in **Linear** (team `Krates-ehf`, project `Morphe`, keys `KRA-###`) via the `linear` MCP — **not** GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical triage roles map onto existing Linear labels: `needs-triage`→`needs human review`, `needs-info`→`needs-grill`, `ready-for-agent`→`ready-for-agent`, `ready-for-human`→`ready-for-human`, `wontfix`→`deferred-post-v1`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context. The formal corpus is `CONTEXT.md` (the domain glossary — canonical term meanings; it wins on vocabulary conflicts) + `VISION.md` (the stratified-adaptive tower — the why) + `CONTRACT.md` (the substrate contract — the what/how; §11 reserved strata seams, §12 known gaps) + `PRODUCT.md` + `DESIGN.md`, with `docs/reconstruction-plan.md` (code→vision alignment) and `MIGRATION.md` (the Eidos lift) as the forward plans. `STATUS.md` is the rolling verified snapshot. ADRs live in `docs/adr/`. See `docs/agents/domain.md`.
