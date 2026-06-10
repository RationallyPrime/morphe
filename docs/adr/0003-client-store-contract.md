# ADR-0003 — Client store contract: layered ownership, full JSON values, flat keys

- **Status:** Accepted
- **Date:** 2026-06-09
- **Deciders:** Hákon (founder), grill session on KRA-306
- **Related:** `VISION.md` §8 (Lemma 5), `CONTRACT.md` §11 (binding paths), KRA-306, KRA-308/310 (consumers), ADR-0004

## Context

R1 makes the grammar's `bind` store-paths real: a bound primitive reads initial
state from a client store and commits tier-1 changes back to it. Three contract
questions had to be settled before implementation, because the store's shape
propagates into the event taxonomy (R1.2), the ContextDigest (R1.3) — which is
also the future training-corpus row format (VISION Corollary 2) — and every
appliance product UI later built on Morphe.

Constraints in force: the wire never carries a live value (Lemma 5); multiple
`MorpheRoot`s render per page (the home page has four); SvelteKit SSR shares
module state across concurrent requests, so a module-level singleton store
would leak one visitor's tier-1 state into another's render.

## Decision

1. **Ownership is layered: prop > context > per-root.** The store rides Svelte
   context from any ancestor (the app provides one per page/layout — created
   per request, so SSR-safe); a `MorpheRoot` prop overrides it for isolation
   (tests, demos); absent both, each root creates its own fresh in-memory
   store. This mirrors `useMorpheContext`'s graceful-degradation pattern:
   cross-tree sharing when the app opts in, dignity standalone (Corollary 1).
2. **Values are full JSON** (scalars, arrays, objects) — not the scalars-only
   subset. Every *current* bind site is a scalar, but the store is foundation
   for the appliance product UIs, where tier-1 state (a filter set, a selection)
   is structured the moment it exists. The founder explicitly chose foundation
   generality over YAGNI here; the digest carries a `digestVersion` so the
   contract can still evolve deliberately.
3. **Paths are flat opaque keys; nesting lives in the value.** A write replaces
   the whole value at its key (replace-on-write), subscribers are notified on
   set, and values are frozen in dev. There is exactly ONE way to nest — inside
   the value — so the `Binding(store_path)` wire contract stays a name, never a
   query language. A binding wanting finer granularity uses a finer key.

## Alternatives rejected

- **Module singleton** — SSR request-state leakage; disqualified outright.
- **Per-root-only stores** — fragments the digest per tree (four partial
  digests on the home page); guts the mid loop's view of tier-1 state.
- **Scalars-only values** — the recommendation on YAGNI grounds; rejected as
  optimizing the marketing site rather than the foundation.
- **Dot-path addressing into values** — two representations of every nesting
  decision, partial-mutation semantics, path parsing; rejected for one-way
  nesting.

## Consequences

- The store interface is small: `get(path)`, `set(path, value)` (replace-on-
  write), runes-reactive subscription, JSON-serializable by construction —
  `digestOf(store)` is a snapshot, not a serializer.
- Equality semantics are trivial: notify on every set; no structural diffing.
- Deep mutation of a read value is the one foot-gun full-JSON admits; dev-mode
  freezing is the guard.
- KRA-306 is no longer judgment-shaped: it flips to `ready-for-agent`.
