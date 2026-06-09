# ADR-0004 — Delegation surface: epochs never reach the renderer

- **Status:** Accepted
- **Date:** 2026-06-09
- **Deciders:** Hákon (founder), grill session on KRA-311
- **Related:** `VISION.md` §9 (Lemma 6), KRA-311/312/313, ADR-0003

## Context

Lemma 6 introduces the emission envelope (epoch + tree), variation points
(`Vary`/`Within` addressed by `VaryId`), and mid-loop deltas validated against
the live epoch. The open design question was where the envelope meets the
renderer: KRA-311 originally offered "MorpheRoot takes the envelope" vs "a
separate MorpheEnvelopeRoot." Both give the renderer epoch semantics it never
actually uses — the epoch exists only to reject stale deltas, and rejection
happens in `applyDelta`, before any render.

## Decision

**The renderer sees choices only.**

- The envelope type `{ epoch, tree, choices }` lives in `delegation/` (beside
  `applyDelta`), NOT in `grammar/` — trees stay pure data; the envelope is a
  delegation-time wrapper.
- `applyDelta(envelope, delta)` is the only place epochs exist: host-side,
  pure, total, pre-render.
- `MorpheRoot` gains exactly one optional prop — `choices?: Readonly<Record<
  VaryId, number>>` — riding context to `Node.svelte`'s `Vary`/`Within`
  resolution, with `options[default]` as the absent-choice fallback
  (Corollary 1: no mid loop plugged in ⇒ renders exactly as today).
- **Epoch minting:** whoever constructs the envelope mints the epoch —
  monotonic per surface. Any re-emission bumps it, which is precisely the
  "re-emission cleanly invalidates in-flight mid-loop work" clause.
- **`Within` dimensions resolve into existing algebra inputs, never raw CSS:**
  a density choice is a `Density` input; an emphasis choice is an
  `EmphasisClaim` that STILL renormalizes against the budget (the mid loop
  cannot bypass the budget law); a collapse choice is a `Disclosure` open
  default.

## Alternatives rejected

- **MorpheRoot accepts the envelope** — the renderer acquires epoch
  bookkeeping it never needs; the bare-tree path becomes the special case.
- **Separate `MorpheEnvelopeRoot`** — a second public root component to
  document and maintain, for no capability the optional prop doesn't provide.

## Consequences

- The renderer's contract change is one optional prop; render stays total and
  delegation-ignorant.
- The mid loop is a pure host-side concern: `propose(digest, liveVaryIds) →
  deltas → applyDelta → re-render`. Any host (a route, the appliance client)
  can run the loop; the substrate never imports it.
- The budget law's authority survives delegation by construction — a `Within`
  emphasis movement enters as a claim, not a grant.
- KRA-311's remaining work is mechanical: it flips to `ready-for-agent`.
