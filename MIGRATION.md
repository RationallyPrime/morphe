# MIGRATION — Morphe → sokrates monorepo (Projection M)

## Why this repo is standalone
Velocity sandbox for agent-collaborative development: build fast outside the
monorepo's heavy CI guards, migrate in once close to complete. The guards are a
velocity tax during exploration, **not** the quality bar — we hold the bar here
ourselves (no `any`, a11y structural, tests green, lint clean) so migration day
is a lift, not a CI reckoning.

## What migrates (and what stays)
- **Migrates:** `src/lib/morphe/` — the extractable core:
  `grammar/ tokens/ context/ compounds/ dialects/ render/ primitives/`. The library.
- **Stays behind:** `src/routes/` — the SvelteKit demo + dignity-test harness. Throwaway scaffold.

## Landing zone (per the dependency lattice)
Morphe is **Projection M of Eidos** — the *perceivable* projection, beside
Projection A (relational / lakehouse) and Projection B (executable / runtime).
It lands at the **domain** layer, depending **downward only**:
- may depend on: `eidos` (the form it projects), `hyle` (matter), `logos`/`dynamis` (runtime), `sokrates_core` (foundation)
- depended on by: `nous_app`, `sokrates_ctl` (composition)
- must NOT import upward — enforced by the monorepo's layer guards on arrival.

## The Eidos-projection lift (the one real code change)
Today `grammar/types.ts` is a TS-first, pure declarative discriminated union — a
faithful *shadow* of Eidos. On migration:
1. The grammar's source of truth becomes a Python **Projection M** in/near the
   `eidos` package (Pydantic → JSON Schema).
2. `grammar/types.ts` becomes **generated** from that schema — "one schema, three
   jobs": Pydantic validator + TS types + constrained-decode mask.
3. `render/ context/ compounds/ tokens/ primitives/` are unchanged — they
   *consume* the grammar, they don't define it.
Because the shadow is logic-free, this is mechanical, not a rewrite.

## Frontend / Python split
- Python Projection-M (grammar/schema) → domain layer near `eidos`.
- Svelte renderer → a frontend artifact consuming generated types; the appliance
  serves it. The browser was always the codegen consumer (the producer is
  Python / pydantic-ai), so this split is structural, not a compromise.

## Toolchain on arrival
- **bun** (matches the monorepo JS standard). `bun install`, `bun run check|test|build`.
- Pick a concrete SvelteKit **adapter** at deploy (adapter-auto detects nothing locally).
- **Self-host fonts.** The dignity demo pulls Newsreader / Hanken Grotesk / IBM
  Plex Mono + Material Symbols from a CDN. The appliance is on-prem (Sovereign
  SKU = no outbound), so **fonts must be self-hosted before migration** or the
  on-prem render breaks.

## Pre-migration close list (Phase-1 edges)
Owner's bar: **not just two colour dialects — structural divergence first.**
- [ ] Compound dialects + `dialect.compounds[]` enforced at render (registry
      gated by active dialect; today a global singleton). Dialects must differ in
      *structure*, not just palette.
- [ ] `Vary` mid-loop / objective optimizer (currently renders default only).
- [ ] Input `bind` wired to an external store (currently tier-0 local only).
- [ ] Public barrel `index.ts` re-exports `getDialect` / `DIALECTS` / second dialect.
- [ ] Self-host fonts (see above).
- [ ] Choose a SvelteKit adapter.

## Verify (local)
`bun run check` (→ 0/0) · `bun run test` (→ 56/56) · `bun run build` (client+SSR)
· `bun run dev` → http://localhost:5173/ (dignity test; toggle the dialect for
the on-screen Lemma-3 fixed point).
