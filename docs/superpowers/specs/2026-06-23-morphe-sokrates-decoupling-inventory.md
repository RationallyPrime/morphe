# Morphe / Sokrates Decoupling Inventory

**Date:** 2026-06-23
**Status:** inventory complete, implementation plan pending
**Scope:** current worktree at `/home/rationallyprime/projects/morphe/.claude/worktrees/agent-native-cms-v0`, plus read-only destination check of `/home/rationallyprime/projects/sokrates-website` and `/home/rationallyprime/projects/sokrates`.

## Decision Frame

Morphe should be the product module: the adaptive UI substrate, its Svelte render package, the Pydantic grammar mirror, and the agent-native CMS/content compiler. The Sokrates marketing website should be a consumer of Morphe, not the implementation host for Morphe. Sokrates-specific lead flows, copy, cohorts, composer corpus, and conversion endpoints should leave this repo.

ADR-0012 pins the deployment consequence: this is not only a code move. The production
Sokrates website deployment must cut over to `sokrates-website`; Morphe may keep only a
separate Morphe playground/demo deployment.

The target dependency direction is:

```text
morphe
  -> publishes @rationallyprime/morphe
  -> owns py/morphe_grammar and py/morphe_cms
  -> may host a small playground/demo app

sokrates-website
  -> consumes @rationallyprime/morphe
  -> owns public pages, copy, native control surfaces, contact/onboarding APIs

sokrates or sokrates-ai
  -> consumes morphe_cms as a tool/service when generating or publishing content
  -> owns Sokrates-specific agent workflows and sales/lead orchestration
```

There is no `sokrates-ai` checkout under `/home/rationallyprime/projects` in this snapshot. The existing `/home/rationallyprime/projects/sokrates` repo is the current agentic platform candidate; it already has Pydantic AI packages and Morphe cold-lead references.

## Current Repo Facts

- `package.json` is already package-shaped as `@rationallyprime/morphe`, version `0.3.0`, with explicit exports for `.`, `./components`, `./tokens`, `./styles.css`, and token CSS.
- ADR-0007 and `PACKAGING.md` already establish `src/lib` as the package root and classify `src/app/site`, `src/app/compose`, `src/app/server`, and routes as app-only.
- `svelte.config.js` aliases app-only code as `$site`, `$compose`, and `$serverlib`; routes import Morphe through `$lib` and `$lib/components`.
- `src/lib` has no live import inversion into `$site`, `$compose`, `$serverlib`, or `src/app`. The package seam is mostly clean.
- `py/morphe_cms` is now implemented in this worktree, despite older packaging docs treating `py/` as repo tooling. Under the new product decision and ADR-0009, `py/morphe_cms` is Morphe core exposed through MCP/API seams, not website code.
- Decision recorded in ADR-0008: `sokrates-website` should be replaced by the Morphe/SvelteKit implementation of the same marketing website currently living in this repo. The current Next/React app is the older ancestor, not the target host framework.
- `sokrates-website` is dirty: `main...origin/main [ahead 6]`, one modified tracked file, and several untracked extraction/proposal files.

## Ownership Inventory

### Morphe Core: Stay

| Path | Current role | Destination |
|---|---|---|
| `src/lib/grammar/**` | TS `Node` grammar and public type vocabulary | Stay in Morphe package |
| `src/lib/context/**` | context algebra and Svelte context carrier | Stay in Morphe package |
| `src/lib/compounds/**` | compound factory/registry/gate | Stay in Morphe package |
| `src/lib/dialects/**` | dialect definitions, active dialect store, provider | Stay in Morphe package |
| `src/lib/delegation/**` | envelope, delta, choices, mid-loop seams | Stay in Morphe package |
| `src/lib/state/**` | client store, actions, typed events, digest, escalation | Stay in Morphe package |
| `src/lib/render/**` | `MorpheRoot`, node resolver, render internals | Stay in Morphe package |
| `src/lib/primitives/**` | primitive Svelte components | Stay in Morphe package |
| `src/lib/tokens/**` | intent vocabulary, slots, token CSS | Stay in Morphe package |
| `src/lib/index.ts` | public engine barrel | Stay in Morphe package |
| `src/lib/components.ts` | public Svelte component seam | Stay in Morphe package |
| `src/lib/styles.css` | public CSS seam | Stay in Morphe package |
| `schema/morphe-*.json`, `schema/masks/**` | grammar/schema/mask artifacts | Stay in Morphe |
| `py/morphe_grammar/**` | Pydantic mirror and artifact generation | Stay in Morphe |
| `scripts/pack-verify.ts` | package consumer proof harness | Stay in Morphe |
| `PACKAGING.md`, `CONTRACT.md`, `VISION.md`, `STATUS.md`, `MIGRATION.md` | Morphe contract and package docs | Stay, update after extraction |

Notes:

- `src/lib/dialects/arrival.ts` is package code, but the current comments/tests still speak in terms of `?cohort=`. After extraction, core should speak in terms of dialect arrival or generic attribution; cohort mapping belongs to the website.
- The package root currently contains `src/lib/cms/fixtures/capability-page.tree.json` and `src/lib/cms/render-smoke.test.ts`. The test is Morphe-owned, but the fixture path under `src/lib` may leak into `dist`; move it to a non-package fixture path or explicitly exclude it.

### Morphe CMS: Stay, But Tighten The Interface

| Path | Current role | Destination |
|---|---|---|
| `py/morphe_cms/contracts/**` | typed content artifact, controls, diagnostics, publication contracts | Stay in Morphe CMS |
| `py/morphe_cms/presenter/**` | deterministic draft to `Node` compiler | Stay in Morphe CMS |
| `py/morphe_cms/validation/**` | policy and grammar gate | Stay in Morphe CMS |
| `py/morphe_cms/store/**` | append-only file store | Stay in Morphe CMS |
| `py/morphe_cms/tools/**` | create/validate/preview/publish functions | Stay in Morphe CMS |
| `py/morphe_cms/mcp/**` | FastAPI/MCP tool host | Stay in Morphe CMS |
| `py/morphe_cms/schema.py` and `schema/cms/**` | CMS JSON schema export | Stay in Morphe CMS |
| `src/routes/preview/[artifactId]/[revisionId]/**` | Svelte render surface for compiled trees | Stay in Morphe playground or become a reusable route recipe |
| `src/routes/p/[slug]/**` | publication pointer render route | Stay in Morphe playground or become a reusable route recipe |

Notes:

- The seam is good: Python writes validated `Node` JSON, Svelte reads compiled tree files and renders `MorpheRoot`.
- ADR-0009 pins the distribution direction: consumers invoke `morphe_cms` through MCP/API seams. They do not copy Python CMS internals into the website repo.
- The current v0 content type is `CapabilityPageDraft`. It is acceptable as a first Morphe CMS archetype, but any Sokrates-only semantics should move to the website/AI layer before calling it a generic CMS surface.

### Morphe Playground / Demo: Stay, Rebrand Away From Sokrates

| Path | Current role | Destination |
|---|---|---|
| `src/routes/substrate/**` | substrate dignity/demo page | Stay in Morphe playground and become part of the full Morphe demo |
| `src/routes/_demo/**` | dignity demo component/tree | Stay in Morphe playground |
| `src/routes/api/adaptive/decision/**` | SvelteKit proxy for adaptive decision sidecar | Stay if `py/morphe_agent` stays |
| `py/morphe_agent/**` | optional live adaptive decision sidecar | Stay as Morphe lab sidecar, or move under examples if demo-only |
| `assets/plates/**`, `static/images/plates/**` | Timaeus plate derivatives used by Sokrates narrative/story | Move with `sokrates-website`; replace in Morphe with a new neutral demo asset set |
| `scripts/derive-plates.ts`, `scripts/plate-manifest.ts`, `scripts/plate-manifest.test.ts` | plate derivative pipeline and privacy guard | Move if only plate-specific; retain/genericize only if reused for Morphe's new demo assets |
| `src/app.css`, `src/app.html`, `src/routes/+layout.svelte` | app shell | Split: keep a focused Morphe playground shell, move site nav/cohort behavior |

Notes:

- ADR-0010 pins the playground as a full-featured Morphe demonstration host, not a tiny smoke-test app. It must exercise the substrate's interesting seams while carrying zero Sokrates-specific content.
- ADR-0011 moves the existing Timaeus/plate assets with the Sokrates website. Morphe gets a new neutral demo asset set chosen specifically to showcase the design system.
- The `/substrate` page currently says "Sokrates" in copy and metadata. After extraction it should become a Morphe product/demo page.
- `py/morphe_agent` is mostly generic, but its prompt and fallback copy mention the substrate lab. Treat it as a Morphe optional sidecar, not as the Sokrates website authoring runtime.

### Sokrates Website: Move Out

| Path | Current role | Destination |
|---|---|---|
| `src/app/site/**` | Sokrates marketing copy, cohorts, compounds, page presenters, intent engine, onboarding UI, contact form | Move to `sokrates-website` or a SvelteKit replacement app in that repo |
| `src/app/server/**` | Postmark, ntfy, magic-link, receipt helpers | Move to `sokrates-website` |
| `src/routes/+page.svelte` | home stage, composer, intent engine, contact close | Move to `sokrates-website` |
| `src/routes/+layout.server.ts` | SSR cohort resolution | Move to `sokrates-website` |
| `src/routes/+layout.svelte` | nav, cohort/dialect persistence, global site shell | Move to `sokrates-website`; leave only Morphe demo shell behind |
| `src/routes/how-it-works/**` | Sokrates marketing page | Move to `sokrates-website` |
| `src/routes/architecture/**` | Sokrates marketing page | Move to `sokrates-website` |
| `src/routes/onboarding/**` | Sokrates onboarding flow | Move to `sokrates-website` |
| `src/routes/compose/**` | redirect to home composer | Move/delete with website routing |
| `src/routes/dignity/**` | redirect to substrate | Keep only if Morphe wants legacy demo redirect; otherwise delete |
| `src/routes/api/contact/**` | lead capture endpoint | Move to `sokrates-website` |
| `src/routes/api/onboarding/**` | onboarding submission + magic-link email | Move to `sokrates-website` |
| `src/routes/api/rerank/**` | Voyage-backed composer rerank endpoint | Move with composer, likely `sokrates-website` first |
| `static/images/sokrates-mark.svg`, `static/sokrates-mark.svg`, `static/images/the-box.png`, `static/images/team/**`, `favicon*` | Sokrates brand/product/team assets | Move/copy to `sokrates-website`; Morphe should get its own brand assets if needed |
| `PRODUCT.md`, `DESIGN.md` | currently mix Sokrates product/visual canon with Morphe substrate framing | Split and rewrite per ADR-0013: Morphe gets substrate/CMS/playground docs; Sokrates gets the current marketing identity/copy canon |
| `docs/redesign-plan.md` | public site redesign plan | Move/archive in `sokrates-website` |
| `docs/adr/0001-*`, `0002-*`, `0006-*` | onboarding email, composer ranking, stage home/intent engine | Move or archive as Sokrates website ADRs |
| `docs/superpowers/specs/2026-06-18-cohort-copy-attribution-design.md` and matching plan | cohort/copy marketing design | Move/archive in `sokrates-website` |

Notes:

- This code already imports Morphe through `$lib`/`$lib/components`. After moving, those imports become package imports.
- `$site` imports `$compose` in `src/app/site/copy.ts` and `src/app/site/dossier.ts`; that is acceptable if both remain website-side.
- Native controls remain website-owned. Morphe trees render content/results; conversion forms and external side effects stay in the host app.

### Sokrates Composer / Corpus: Move Or Split

| Path | Current role | Destination |
|---|---|---|
| `src/app/compose/**` | public composer corpus, deterministic matching, embeddings, capability presenters, compose compounds | Move to `sokrates-website` if it remains a public interactive section; move deeper into `sokrates`/AI if it becomes a generated content workflow |
| `scripts/embed-corpus.ts` | Voyage embedding generator for composer capabilities | Move with `src/app/compose` |
| `scripts/build-evidence.ts` | builds evidence indexes from external specs | Move with composer/AI evidence workflow |
| `data/evidence/**` | composer grounding evidence | Move with composer/AI evidence workflow |
| `data/specs/**`, `data/bamboohr-public-openapi.yaml`, `data/specs-scope.md` | source specs for evidence/capability work | Move to `sokrates`/AI or `sokrates-website` depending on where composer generation lands |
| `orval.config.ts` | composer grounding codegen to `src/app/compose/generated/**` | Move with composer if still used |

Recommended split:

- Public UI shell and visitor query controls: `sokrates-website`.
- Evidence/spec ingestion, capability generation, and future agent authoring: `sokrates` or the eventual `sokrates-ai` repo.
- The host app should consume generated artifacts, not own the whole evidence build pipeline forever.
- Migration order: preserve the current live composer behavior by moving the public composer UI and current corpus runtime with `sokrates-website` first; then move/deepen evidence, spec, embedding, and agent-authoring machinery toward `sokrates`/AI once the site extraction is stable.

### Docs / ADR Split

| Path | Destination |
|---|---|
| `docs/adr/0003-client-store-contract.md` | Morphe |
| `docs/adr/0004-delegation-surface-choices-only-renderer.md` | Morphe |
| `docs/adr/0005-plate-derived-dialect-pair.md` | Supersede/archive with website move; ADR-0011 ends the plate-proof-as-Morphe-core assumption |
| `docs/adr/0007-packaged-library-boundary.md` | Morphe, update after final decoupling |
| `docs/reconstruction-plan.md` | Morphe, update R3.2 owner decision to resolved |
| `docs/agents/**` | Morphe if this repo keeps Linear/project agent flow |
| `docs/superpowers/specs/2026-06-22-morphe-agent-native-cms-design.md` | Morphe |
| `docs/superpowers/plans/2026-06-22-morphe-agent-native-cms.md` | Morphe |
| `legacy-Morphe-seed.md`, `data/seed-mining/**` | Morphe archive/reference, unless no longer useful |

ADR-0013 governs the split: Morphe keeps substrate/package/CMS/playground doctrine; Sokrates
website takes public-site product, brand, copy, route, onboarding/contact, composer/ranking,
stage-home, deployment, and plate narrative docs.

## Import Edge Findings

Good current edges:

- `src/lib/**` depends internally on Morphe modules plus Svelte/esm-env only. It does not import app modules.
- Routes and app code consume Morphe via `$lib` and `$lib/components`, which maps cleanly to `@rationallyprime/morphe` and `@rationallyprime/morphe/components`.
- `py/morphe_cms` depends on `morphe_grammar`, not on Svelte or SvelteKit.
- CMS render routes read compiled `Node` JSON and call `MorpheRoot`; they do not import Pydantic/CMS internals.

Edges to move:

- `src/routes/**` imports `$site`, `$compose`, `$serverlib`: website host edge.
- `src/routes/api/rerank/+server.ts` imports `$compose` and `VOYAGE_API_KEY`: composer host edge.
- `scripts/embed-corpus.ts` imports `src/app/compose/corpus.ts` and writes `src/app/compose/embeddings.ts`: move with composer.
- `scripts/build-evidence.ts` writes `data/evidence/**` from Sokrates integration specs: move with composer/AI evidence pipeline.
- `orval.config.ts` outputs to `src/app/compose/generated/**`: move if this codegen remains active.

Conceptual leaks to clean in Morphe:

- Core dialect arrival helpers/comments still use "cohort" wording in some places. Morphe should own dialect selection; the website should own cohort-to-dialect mapping.
- Default theme and docs currently describe the "Sokrates identity the default theme realizes." Morphe can ship `gallery`, but Sokrates brand canon should move to the website.
- `README.md` says the Sokrates marketing site is the first thing standing on Morphe. After extraction, it should describe the playground and external consumers.

## Destination Fit

### `sokrates-website`

Current facts:

- Next 16, React 19, pnpm, Tailwind, `next-intl`.
- Existing public pages/components already cover home, architecture, onboarding, contact, team, pricing-like sections, and API contact.
- Owner decision: replace this implementation with the Morphe/SvelteKit version from this repo. The two sites share ancestry and content intent; the Morphe implementation is the better/current live shape.
- Dirty state: ahead of origin and has local tracked/untracked changes.

Main risk:

- This is a repo replacement/migration, not an adapter job. Existing dirty work in `sokrates-website` must be isolated or deliberately superseded before replacing the app.

Rejected option:

- Do not grow a React/web-component adapter just to keep the old Next app. That preserves the wrong host and adds a shallow seam Morphe does not need for this migration.

Recommended path:

- Treat `sokrates-website` as the repository and deployment home. Replace the current Next/React implementation with a SvelteKit consumer of `@rationallyprime/morphe`, using the Morphe implementation from this repo as the source of truth.

### `sokrates` / `sokrates-ai`

Current facts:

- No `sokrates-ai` checkout was found.
- `/home/rationallyprime/projects/sokrates` contains the active agentic platform and Pydantic AI packages.
- Existing Sokrates docs reference Morphe cohort URLs and cold-lead workflow publishing.

Recommended path:

- Put Sokrates-specific authoring/orchestration there, not in Morphe.
- Consume Morphe CMS through a stable MCP/API service seam when authoring is in scope.
- Keep generic Morphe CMS schemas/tools in Morphe; keep Sokrates lead/email/company workflows in Sokrates.

## Required Plan Gates

The implementation plan should not start with file moves. It should first pin these gates:

1. **Replacement strategy:** how to replace the dirty Next/React app in `sokrates-website` with the Morphe/SvelteKit implementation without losing any still-valuable local work.
2. **CMS invocation shape:** the exact MCP/API command or endpoint shape host applications use when content authoring is in scope.
3. **Morphe playground content system:** exact route set, demo content, and feature coverage for the full-featured non-Sokrates playground.
4. **Demo asset replacement:** choose or generate the new neutral Morphe demo asset set that replaces the Sokrates plate material.
5. **Docs split implementation:** apply ADR-0013 file-by-file, including rewriting Morphe `PRODUCT.md`/`DESIGN.md` and copying/moving Sokrates-specific docs.
6. **Destination repo dirt handling:** isolate `sokrates-website` work before moving code into a dirty main checkout.
7. **Production cutover:** transfer the live Sokrates website deployment, domain, env vars, and smoke checks to `sokrates-website`.
8. **Package consumption:** no tarball handoff. The website consumes the real `@rationallyprime/morphe` package seam; publish Morphe if migration changes require a new package version before production cutover.
9. **Branch isolation:** execute Morphe and `sokrates-website` work in separate worktrees/branches until the migration is verified stable, then merge into each repo's mainline.

## Proposed Execution Lanes

1. **Morphe package hardening**
   - Clean `src/lib/cms` fixture placement.
   - Update README/PACKAGING/ADR-0007 to reflect Morphe as package + CMS, not website host.
   - Remove/rename core "cohort" wording where it means raw dialect arrival.
   - Preserve `pack:verify`, `schema-check`, `cms-schema-check`.

2. **Morphe playground cleanup**
   - Keep a full-featured Morphe playground, not a minimal smoke-test shell.
   - Rebrand substrate copy away from Sokrates and replace it with Morphe-native demo content.
   - Keep or demote `py/morphe_agent` and `/api/adaptive/decision` as a lab sidecar.
   - Remove production Sokrates routes once external consumer is live.

3. **Sokrates website extraction**
   - Replace the current Next/React app with the Morphe/SvelteKit site.
   - Move `$site`, `$serverlib`, route pages, APIs, and static brand assets.
   - Convert imports from `$lib` to package imports.
   - Consume `@rationallyprime/morphe` through the real package seam, not a tarball.
   - Cut over production deployment ownership to `sokrates-website`.
   - Verify public pages, contact/onboarding, env-backed APIs, and production domain.

4. **Composer / AI split**
   - Move public composer UI with the website.
   - Move evidence/spec/embedding generation to the appropriate Sokrates AI/workflow home.
   - Leave only generic Morphe CMS archetype examples in Morphe.

5. **Final cleanup**
   - Delete old Sokrates routes from Morphe.
   - Remove app-only aliases from Morphe if no longer needed.
   - Run Morphe gates and package verification.
   - Run website gates/deploy verification.
   - Confirm Morphe no longer deploys the public Sokrates production site.
   - Merge both branches only after the cross-repo migration is verified stable.

## Stable Verification Bar

The migration is stable only when all of these are true:

1. **Morphe gates:** `just gates` passes; the package builds; if the package version changed,
   the new `@rationallyprime/morphe` version is published and registry install/render proof
   passes.
2. **Website gates:** `sokrates-website` performs a clean install from the real
   `@rationallyprime/morphe` package and passes its type/check/test/build gates.
3. **Local website smoke:** `/`, `/how-it-works`, `/architecture`, `/onboarding`, composer
   interaction, and contact/onboarding API behavior work locally; missing env degrades
   gracefully where designed.
4. **Production smoke after cutover:** the public Sokrates domain returns the expected pages,
   assets, metadata, composer, and forms without depending on the Morphe repo deployment.
5. **Morphe cleanup proof:** Morphe no longer contains Sokrates production routes, content,
   or brand assets except anything intentionally archived or moved.

## Immediate Non-Code Next Step

Write the implementation plan from this inventory. The first task in that plan should be a small repo-safety task that inventories the dirty `sokrates-website` checkout and decides what gets preserved before the Morphe/SvelteKit implementation replaces the current Next app.
