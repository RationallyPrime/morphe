# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring
the codebase. **Layout: single-context** (one project, no `CONTEXT-MAP.md`).

## Before exploring, read these

- **`CONTEXT.md`** at the repo root — the populated canonical domain glossary. It
  exists and is the term-of-record on vocabulary conflicts; `/grill-with-docs`
  keeps it updated as new terms get resolved.
- **`docs/adr/`** — read ADRs that touch the area you're about to work in.
- This repo also carries a **formal design corpus** that functions as domain doctrine —
  read whichever is relevant before design/architecture work:
  - **`VISION.md`** — the proposal (v0.7, repo-canonical): the stratified adaptive tower
    (seven lemmas, the theorem, the strata table), open problems, and the §15 status
    ledger mapping every mechanism to its implementation state. Read this before
    proposing architecture — it explains why "idle" grammar fields are reserved seams.
  - **`CONTRACT.md`** — the formal substrate contract (the grammar, context algebra, the
    three token strata, the dialect fixed point; §8 fixes the intent-keyset across
    dialects; §11 the reserved strata sockets; §12 the known, scheduled gaps).
  - **`DESIGN.md`** — Morphe's substrate-level visual, interaction, dialect, and
    operational-surface doctrine. Consumer identities live in consumer repos.
  - **`PACKAGING.md`** — the independent-package boundary and release topology.
  - **`CLAUDE.md`** — the working contract for agents in this repo (overrides defaults).
  - **`docs/reconstruction-plan.md`** — the living reconstruction/completion ledger,
    reconciled with the independent-package decision and remaining work.

Product integration details belong in their owning tracker or the active task context, not in
this repository's doctrine.

If `docs/adr/` doesn't exist, **proceed silently.** Don't flag its absence or suggest
creating it upfront — the producer skill (`/grill-with-docs`) creates ADRs lazily when
decisions actually get resolved.

## Use the established vocabulary

When your output names a domain concept (an issue title, a refactor proposal, a hypothesis,
a test name), use the term as defined in the corpus above — grammar lemmas, the context
algebra, intents, dialects, compounds, the emphasis subalgebra, the native-control-surface
idiom. Don't drift to synonyms the contract explicitly avoids (e.g. don't say "color/scale"
where an **intent** is meant; don't call a clickable `<div>` a button — that's unrepresentable
on purpose).

If the concept you need isn't in the corpus yet, that's a signal — either you're inventing
language the project doesn't use (reconsider) or there's a real gap (note it for
`/grill-with-docs`).

## Flag contract / ADR conflicts

If your output contradicts `CONTRACT.md` or an existing ADR, surface it explicitly rather
than silently overriding:

> _Contradicts CONTRACT.md §8 (intent-keyset fixed point) — but worth reopening because…_
