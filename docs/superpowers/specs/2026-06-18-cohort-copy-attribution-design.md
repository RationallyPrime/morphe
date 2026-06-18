# Cohort copy + URL-param attribution — design

- **Date:** 2026-06-18
- **Status:** Approved (founder, 2026-06-18)
- **Related:** `CONTEXT.md` (Cohort/Dialect glossary), `VISION.md` §7 (the
  marketing instantiation remark — "per-cohort copy is the remaining named next
  step"), `DESIGN.md` §9 (Cohorts: dialects as ad-profile-targeted pitches),
  ADR-0005 (dialect pair), ADR-0006 (intent engine), `src/lib/dialects/arrival.ts`
  (shipped `?cohort=`→dialect wiring), `marketing-context.md` (voice canon)

## Context — the gap

A **cohort** is the marketing-side audience segment designed into an ad campaign.
`CONTEXT.md` fixes its meaning precisely: a cohort *selects a dialect **and** a
copy variant*; many cohorts may share one dialect. A cohort is **distinct** from a
dialect.

Today only half of that exists. The layout reads `?cohort=` and sets
`activeDialect` (`resolveArrivalDialect`, persisted to `mo-dialect.v2`) — but the
param's *value is literally a dialect id*, so "cohort" and "dialect" are
conflated, and **copy never varies by cohort**. Per-cohort copy is the explicitly
deferred next step in both `VISION.md` §7 and `DESIGN.md` §9, which waited on a
product decision (which cohorts, which pitches). That decision is now made: the
first cohort is **regulated pharma in drug development that mandates Sovereign
deployment for IP reasons**.

## Decision

1. **Cohort becomes a first-class primitive**, decoupled from dialect. A typed
   cohort registry maps `cohort id → { dialect, copy overlay }` behind a
   registration gate (same posture as the intent/compound registries). The
   `?cohort=` param now names a **cohort**, not a dialect; raw dialect selection
   moves to a new `?dialect=` param.
2. **Copy becomes base + partial overlay.** A typed `SiteCopy` captures the
   *targetable* copy slots; `BASE_COPY` holds today's canonical strings (still the
   SSR/SEO copy); a cohort supplies a `DeepPartial<SiteCopy>` overlay; the page
   renders `resolveCopy(cohort) = deepMerge(BASE_COPY, overlay)`. A cohort
   overrides only what it names and inherits the rest — "not every piece changes."
3. **Three landing params, all persisted to localStorage**, each acting once on
   arrival and never fighting a later in-session interaction.
4. **Client-only swap for v1** (matches the shipped dialect/intent arrival
   discipline exactly; fastest path). SSR-the-cohort-copy-on-arrival via a
   universal `load` is a **named follow-up**, not this slice.

## Architecture

All new code is Sókrates-site (marketing) code under `src/app/site/**`, imported
through `$site`. The packaged Morphe library (`src/lib/**`) stays free of
marketing concerns (ADR-0007). The cohort references a dialect **by id string**
(validated through `hasDialect`), so `$site` depends on `$lib` only through the
existing public surface — no new coupling into the library.

### Modules

| Module | Responsibility |
|---|---|
| `$site/copy.ts` | `SiteCopy` type, `BASE_COPY`, `DeepPartial`, `deepMerge`, `resolveCopy(overlay?)`. Pure data + one merge function. No Svelte, no I/O. |
| `$site/cohorts.ts` | `Cohort` type (`{ id, dialect, copy: DeepPartial<SiteCopy> }`), gate (`cohortGateFailure`), `CohortRegistry` (gate + idempotent register + lookup, mirrors `IntentRegistry`), the `pharma-sovereign` cohort, `cohortRegistry` default + `registerSiteCohorts()`. |
| `$site/active-cohort.svelte.ts` | `activeCohort` store — one module-level `$state<string \| null>` behind a tiny read/`setById` API, guarded by the registry (unknown id = no-op, never a reset). SSR-safe (touches no `window`/`localStorage` at module scope), mirrors `active.svelte.ts`. Exposes reactive `activeCopy` deriving `resolveCopy(cohort?.copy)`. |
| `present.ts` (edit) | Targetable presenters take the resolved copy: `homeHero(copy)`, `closingCta(copy)`, and `faqSection(copy)` (threaded through `howItWorksBody(copy)`, which calls it). FAQ refactored from a positional array to **keyed** (`Record<id, FaqEntry>` + `order: string[]`) so an overlay can override one answer and append entries. Non-targetable presenters (architecture hero/body, plate beats) are unchanged and keep their no-arg signatures. |
| `routes/+page.svelte` (edit) | Home: `heroTree`/`ctaTree` become `$derived` off `activeCopy.current`; presenters re-run when the cohort resolves. Also applies `meta` client-side (`document.title` + description `<meta>`). |
| `routes/how-it-works/+page.svelte` (edit) | Derives `activeCopy` and passes it to `howItWorksBody(copy)` so the FAQ varies by cohort there too (the FAQ is rendered on this route, not the home). |
| `+layout.svelte` (edit) | Arrival resolution + persistence for all three params (below). |

### Copy schema (the targetable surface, v1)

```ts
interface SiteCopy {
  readonly meta: { readonly title: string; readonly description: string };   // home <head>
  readonly hero: { readonly title: string; readonly lede: string };          // home hero
  readonly closingCta: { readonly heading: string; readonly sub: string };   // shared close band
  readonly faq: { readonly entries: Readonly<Record<string, FaqEntry>>; readonly order: readonly string[] };
}
interface FaqEntry { readonly q: string; readonly a: string }
```

`deepMerge` is a small, total, typed recursive merge over plain objects: overlay
scalars/strings win, nested objects merge, `faq.entries` merge by key, `faq.order`
(an array) is **replaced wholesale** when the overlay supplies one (arrays are
replaced, not concatenated — predictable, no positional ambiguity). `meta`,
`hero`, `closingCta` merge field-by-field, so an overlay may set just
`closingCta.sub` and inherit `closingCta.heading`.

`meta` is applied client-side by `+page.svelte` (`document.title` + the
description `<meta>`), since v1 is a client-only swap; SSR renders `BASE_COPY.meta`.

### Params, precedence, persistence

| Param | Selects | localStorage key | Arrival precedence (highest first) |
|---|---|---|---|
| `?cohort=<id>` | a cohort → its **copy** and its **dialect** | `mo-cohort` | valid `?cohort=` → persisted `mo-cohort` → none (base copy) |
| `?dialect=<id>` | raw dialect (no copy change) | `mo-dialect.v2` *(existing)* | valid `?dialect=` → resolved cohort's dialect → persisted `mo-dialect.v2` → `DEFAULT_DIALECT_ID` |
| `?intent=<id>` | opens a stage morph | `mo-intent` | valid `?intent=` → persisted `mo-intent` |

Resolution discipline (all client-only, in the layout/page mount `$effect`s,
`untrack`ed URL reads → runs once on mount; SSR always renders defaults):

- **Cohort** resolves first (valid param > persisted). Setting the cohort sets
  `activeCohort` (drives copy) **and** applies the cohort's dialect via
  `activeDialect.setById`.
- **Dialect**: a `?dialect=` param (or a later `/substrate` toggle) overrides the
  cohort's dialect. A cohort-derived dialect is **not** written to `mo-dialect.v2`
  — it is re-derived from the persisted cohort each visit, so a cohort's palette
  never masquerades as a standalone dialect preference. Only an *explicit* dialect
  move (`?dialect=` or the toggle) persists a dialect. `persistableDialect`'s
  "default isn't a choice" rule is reused; cohort persistence follows the same
  shape (persist only an explicit, non-null cohort; never freeze "no cohort").
- **Intent** persists (`mo-intent`) per founder decision: a returning cohort
  visitor re-lands on the campaign's morph. Any in-session chip click or close
  overrides immediately (attribution never fights the user). Persistence reuses
  the same "explicit move only" shape. Only `stage-delta` intents resolve from a
  param/persisted id (a URL must not flip the dialect or navigate — unchanged from
  `resolveArrivalIntent`).

An unknown/garbage value in any param is ignored — never an error, never a reset —
exactly as the shipped dialect arrival behaves.

## The first cohort — `pharma-sovereign`

- **id:** `pharma-sovereign`  ·  **dialect:** `clinical` (the shipped
  regulated/exception-forward GxP console register — batch release, deviation
  review, audit trail; cold steel-blue beacon). The cohort *selects* it; no new
  dialect is authored.
- **Ad URL shape:** `https://sokrates.is/?cohort=pharma-sovereign`

### Copy overlay (the full deck)

Voice: "Quiet Confidence", em-dashes, sentence case, `Sókrates` with ó, no
exclamation marks. **Bold, not hedged** (founder directive — it is a demo). Claims
follow the marketing canon: the Sovereign IP claim is **"local inference only / no
outbound inference calls"**, *not* "air-gapped" (canon §avoid-list: "air-gapped" is
imprecise; the precise and stronger claim is no-outbound-inference).

**meta** *(override)*
- `title`: `Sókrates — A sovereign AI department for drug development`
- `description`: `An on-premises AI department for regulated drug development. Local inference only, no outbound inference calls: your pipeline IP is reasoned over where it lives and never sent to a cloud model. Every act on a signed, auditable record.`

**hero** *(override)*
- `title`: `A sovereign AI department for drug development.`
- `lede`: `Sókrates runs your cross-system operational work on a Sovereign appliance on your premises, on local inference — no outbound inference calls, ever. Your compounds, assays and trial data are read and acted on where they already live, and never sent to a model in the cloud. Tell it what runs your operation, and see what it takes on.`

**closingCta** *(override `sub` only; inherits base `heading` "One conversation is usually enough." — demonstrating partial overlay)*
- `sub`: `Bring the workflow your IP constraints have kept off every cloud tool. Thirty minutes is enough to see Sókrates run it without your data leaving the building.`

**faq** *(override one entry, add two, inherit the rest; cohort `order` leads with the IP trio)*
- `data-residency` *(override)* — Q: `Can our IP — compounds, assays, trial data — stay in-house?` · A: `It never leaves. The appliance is installed inside your network and runs on local inference only — no outbound inference calls at all. A roughly 200-billion-parameter model runs on the box itself; your data is reasoned over where it already lives. No cloud model ever sees your pipeline.`
- `no-shared-model` *(new)* — Q: `Could a model trained elsewhere ever see our pipeline?` · A: `Never. The Sovereign appliance calls no externally hosted model, and nothing from your environment trains a shared one. The weights live on the box; your data stays on the box.`
- `validation-audit` *(new)* — Q: `How does it hold up to validation and an audit?` · A: `Every action is a typed act with a named owner and a signed authority record, and the full causal tree of each act is preserved as one auditable record: who did what, under whose authorization, with what data, in what order. The audit trail is the substrate itself, not a report bolted on after — built for the evidence standard your validation and QA teams already work to.`
- *inherits* `chatgpt-diff`, `what-if-wrong`, `exit`, `mid-migration` unchanged.
- cohort `order`: `["data-residency", "no-shared-model", "validation-audit", "what-if-wrong", "exit", "chatgpt-diff", "mid-migration"]`

Architecture-page copy stays base for v1 (the hero + FAQ carry the pitch); the
schema is extensible there later.

## Testing

- `copy.test.ts` — `deepMerge`/`resolveCopy`: full override, partial override
  (closingCta.sub-only inherits heading), faq per-key override + append + order
  replace, `BASE_COPY` round-trips when overlay is empty.
- `cohorts.test.ts` — gate (kebab id, unknown dialect rejected), idempotent
  re-register, `pharma-sovereign` resolves to `clinical` + a copy with the pharma
  hero/FAQ, unknown cohort id is a no-op.
- `arrival.test.ts` (update) — the cohort/dialect param split: `?cohort=` selects
  a cohort (and its dialect) not a raw dialect; `?dialect=` selects a raw dialect;
  precedence and unknown-value-ignored cases for both. New: cohort + intent
  persistence round-trips.
- `active-cohort.test.ts` — store guard (unknown id no-op), `activeCopy` reflects
  the active cohort reactively.
- Existing suites stay green: `dialects.test.ts` fixed-point (same authored tree
  re-themes under `clinical`), `intents.test.ts`, render totality.

Gate before done: `bun run check` (0/0), `bun run test`, `bun run build`, browser
smoke at `/?cohort=pharma-sovereign` (clinical ground + pharma copy) and `/` (base)
under desktop + mobile.

## Out of scope (named follow-ups)

- **SSR cohort copy on `?cohort=` arrival** (universal `load`) — kills the
  base→cohort text flash on the paid landing. Deferred per founder ("faster now").
- Per-cohort copy for the **morph stage** (`morph-stage.ts`) and the
  **architecture** page — schema is extensible to them; not in v1.
- Additional cohorts — adding one is a single `cohorts.ts` entry + overlay.
- Icelandic copy — the founder owns IS; this slice is EN, localised later from the
  same `SiteCopy` shape.

## Invariants honored

- **Cohort ≠ dialect** (`CONTEXT.md`) — now structurally true.
- **Fixed point (Lemma 3 / `CONTRACT.md §8`)** — copy varies; the authored
  *grammar* and the intent keyset do not. A cohort changes strings + selects a
  dialect; it never touches a primitive or the intent set.
- **Render totality** — bad cohort/intent ids are no-ops; copy is always a total
  `SiteCopy` (base ∪ overlay). The page never renders broken.
- **SSR-safe** — stores stay pure runes; all arrival/persistence I/O is in
  client-only `$effect`s; the server renders `BASE_COPY` + `DEFAULT_DIALECT`.
- **Library boundary (ADR-0007)** — all new code is `$site`; `$lib` untouched.
