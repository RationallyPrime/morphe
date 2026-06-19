# Morphe

**UI as data.** A user interface here is not a pile of components — it is a
typed tree, authored the way you would author a document, rendered through a
fixed grammar, and re-themed by swapping a single layer without touching a
node. Morphe is the substrate that makes that sentence true, and the Sókrates
marketing site (`src/routes/`) is the first thing standing on it.

## The idea in one breath

Authored trees emit **roles, priorities, and intents** — never geometry. No
pixel values, no scale names, no hex. The renderer is a total function from
tree to DOM; the context algebra decides what "a heading inside a panel inside
a section" means; the token strata decide what `primary-action` looks like
*today, in this dialect, for this visitor*. Swap the dialect and every surface
re-themes; the tree never knew.

Four lemmas carry the weight, all enforced in code rather than convention:

| Lemma | Claim | Where it lives |
|---|---|---|
| **1 — Grammar** | UI is a discriminated `Node` union; an unlabelled input or a clickable `<div>` is *unrepresentable* | `src/lib/grammar/types.ts` |
| **2 — Context algebra** | A child's rendering context is a pure function of (parent context, role); `Frame` is the only reset | `src/lib/context/` |
| **3 — Fixed point** | The same authored tree is byte-identical under every dialect | `dialects.test.ts` |
| **4 — Dialects** | A dialect remaps the intent layer and bounded priors — and nothing else | `src/lib/dialects/` |

On top of those, the substrate already carries the **Lemma 5/6 seams**: a
client store with typed event tiers and a replayable `ContextDigest`, and
bounded delegation — variation points (`Vary`/`Within`) that a future mid-loop
model may move *within slow-loop-authorized ranges*, validated by a pure
`applyDelta` that rejects stale epochs before anything renders. The renderer
never sees an epoch. That is the point. The home page's intent engine is the
first production consumer of that machinery: a visitor-stated interest becomes
a hand-authored Delta through the same gate.

The grammar is canonical in Pydantic (`py/morphe_grammar`) and emits the
committed contract artifacts: JSON Schema, TypeScript grammar types, wire
schemas, and decoder masks. `just schema-check` is the drift gate; `just
schema-write` regenerates the artifacts after a grammar or wire-model change.

## Quick start

```bash
bun install
just gates     # every gate CI runs, both stacks — green here means CI goes green
just dev       # http://localhost:5173/
just hooks     # install the prek git hooks (once per checkout)
```

Stack: SvelteKit + Svelte 5 (runes) · TypeScript strict · bun · Biome ·
Vitest · uv + ruff + ty on the Python side · prek hooks · GitHub Actions.

## Adaptive sidecar

`py/morphe_agent` is the optional live decision sidecar for the substrate lab.
It serves `POST /v1/morphe/decision` and always returns a schema-valid `Node`:
without live credentials it uses the deterministic fallback, and with live
credentials it routes through Pydantic AI Gateway.

```bash
MORPHE_AGENT_LIVE=1 \
MORPHE_AGENT_MODEL=gpt-5.2 \
PYDANTIC_AI_GATEWAY_API_KEY=... \
uv run uvicorn morphe_agent.app:app --host 127.0.0.1 --port 8042

MORPHE_AGENT_BASE_URL=http://127.0.0.1:8042 just dev
```

`MORPHE_AGENT_GATEWAY_BASE_URL` can override the default OpenAI-compatible
Pydantic Gateway proxy. CI and local gates never require a live model call.

## Reading order

| Document | What it answers |
|---|---|
| [`VISION.md`](VISION.md) | *Why* — the stratified adaptive tower this is Phase 0 of |
| [`CONTRACT.md`](CONTRACT.md) | *What, precisely* — the substrate contract, gates, reserved seams |
| [`PRODUCT.md`](PRODUCT.md) / [`DESIGN.md`](DESIGN.md) | The Sókrates strategy and the visual canon |
| [`STATUS.md`](STATUS.md) | The rolling verified snapshot |
| [`docs/adr/`](docs/adr/) | The decisions, with their reasons attached |

## The site

`/` is the stage home: the composer, then an intent engine (a chip row and a
Cmd/Ctrl+K palette) whose morphs reshape the page in place through the
substrate's own gates; `/substrate` is the dignity demo where the six-way
dialect toggle lives; `/how-it-works`, `/architecture`, and `/onboarding` are
authored as Morphe trees. The default ground is the plate-derived `gallery`
dialect (light paper, ink-navy, one cobalt beacon); "Flip the lights" swaps it
for `night`. Deployed on Vercel. Interactive controls are native elements
styled by the same tokens — the tree carries content and intent, the page owns
the wires.
