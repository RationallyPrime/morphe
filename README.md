# Morphe

**Morphe is a stratified adaptive-UI substrate.** UI is authored as data: a typed
`Node` tree rendered through a fixed grammar, a context algebra, a three-layer
token system, and a swappable dialect. The authored tree says "role, priority,
intent"; it never says pixels, hex values, or framework component trivia.

This repository owns the reusable package, the local CMS/tooling surface, the
adaptive sidecar contract, a neutral playground, and the stripped appliance
viewer. The Sókrates website is a downstream consumer in a separate repository
and imports Morphe through the package seams.

## Quick Start

```bash
bun install
just gates     # every gate CI runs, across the web, viewer, and Python stacks
just dev       # neutral playground at http://localhost:5173/
just hooks     # install the prek git hooks once per checkout
```

Useful focused gates:

```bash
bun run check          # svelte-check
bun run test           # vitest + DOM vitest config
bun run build          # SvelteKit/Vercel build for the playground host
just viewer-build-node # stripped adapter-node viewer build
just py-test           # pytest over py/
just schema-check      # committed grammar artifacts equal fresh emission
```

Stack: SvelteKit + Svelte 5 runes, Vite, TypeScript strict, bun, Biome, Vitest,
uv, ruff, ty, Pydantic v2, FastAPI, and prek.

## The Package

Morphe publishes as the public npm package `@rationallyprime/morphe`
(MIT, registry.npmjs.org). The package root is `src/lib`; consumer apps import
only the public seams:

- `@rationallyprime/morphe` — grammar, context, compounds, dialects,
  delegation, state, render contracts, token helper types.
- `@rationallyprime/morphe/components` — `MorpheRoot`, `RenderNode`, and
  primitive Svelte components for harnesses and inspection.
- `@rationallyprime/morphe/tokens` — intent constants and slot helpers.
- `@rationallyprime/morphe/styles.css` — public token CSS.
- `@rationallyprime/morphe/schemas/*` — the generated JSON Schema artifacts
  (grammar, decision, delta, constrained-decode masks, CMS), pinned to the
  installed grammar version.

Typical consumer use:

```svelte
<script lang="ts">
	import "@rationallyprime/morphe/styles.css";
	import type { Node } from "@rationallyprime/morphe";
	import { MorpheRoot } from "@rationallyprime/morphe/components";

	const tree: Node = {
		kind: "frame",
		role: "section",
		children: [{ kind: "text", value: "Hello Morphe", as: "heading" }],
	};
</script>

<MorpheRoot {tree} />
```

Package publication and registry proof live in [`PACKAGING.md`](PACKAGING.md).

## The Algebra

Four foundation lemmas carry the substrate, and the code treats them as gates,
not as vibes:

| Lemma | Claim | Canonical source |
|---|---|---|
| **1 — Grammar** | UI is a discriminated `Node` union; inaccessible inputs and fake clickable divs are unrepresentable. | `src/lib/grammar/types.ts` |
| **2 — Context algebra** | Child context is a pure function of parent context and role; `Frame` is the only reset. | `src/lib/context/` |
| **3 — Fixed point** | The same authored tree survives dialect swaps unchanged. | `src/lib/dialects/dialects.test.ts` |
| **4 — Dialects** | A dialect remaps the intent layer and bounded priors, and nothing else. | `src/lib/dialects/` |

The current tower also wires the reserved sockets that make adaptation
stratified instead of ad hoc: `bind` paths flow through the client store,
`Button.action` ids resolve at `MorpheRoot.actions`, and `Vary` choices flow
through `MorpheRoot.choices` plus the Delta machinery. The renderer never sees
epochs or handlers. The tree stays declarative.

Nine dialects ship: `gallery` (default), `night`, `icelandic-archive`,
`clinical`, `reykjavik-registry`, `timaeus`, `ledger`, `estate`, and `foundry`.
Every shipped dialect preserves the contract keyset.

## Repository Map

| Path | Purpose |
|---|---|
| `src/lib/grammar` | The typed `Node` union and grammar version. |
| `src/lib/context` | Context algebra, emphasis budget, and Svelte context boundary. |
| `src/lib/compounds` | Compound definitions as data, plus the validation gate. |
| `src/lib/dialects` | Dialect data, registry, active dialect store, and arrival resolution. |
| `src/lib/delegation` | Envelope, epoch, Delta, `Vary`, and mid-loop seams. |
| `src/lib/state` | Store, tiered events, actions, digest, and escalation. |
| `src/lib/render` | Recursive renderer and package component entry points. |
| `src/lib/primitives` | Svelte implementations of the grammar primitives. |
| `src/lib/tokens` | Scales, intents, slot helpers, and public token CSS. |
| `py/morphe_grammar` | Pydantic grammar mirror, JSON Schema, TS codegen, and masks. |
| `py/morphe_cms` | Local CMS contracts, presenter, validation, store, tools, and MCP surface. |
| `py/morphe_agent` | Optional adaptive decision sidecar and deterministic fallback. |
| `py/morphe_surface` | Surface compiler contracts used by the viewer path. |
| `src/routes` | Neutral playground, CMS preview/publication routes, and adaptive API bridge. |
| `viewer` | Stripped SvelteKit viewer for appliance surfaces. |
| `schema` | Committed contract artifacts generated from the Python grammar/CMS models. |

## Demo Host

The root app is a neutral proof host, not a consumer marketing site:

- `/` — Morphe workbench index.
- `/substrate` — full playground with all dialects, actions, bind paths,
  choices, neutral assets, adaptive fallback rendering, and nested dialect proof.
- `/preview/[artifactId]/[revisionId]` — local CMS compiled-tree preview.
- `/p/[slug]` — publication pointer route.
- `/dignity` — compatibility redirect to `/substrate`.
- `/api/adaptive/decision` — bridge to `MORPHE_AGENT_BASE_URL`, with a
  deterministic schema-valid fallback when no sidecar is configured.

Static demo assets live under `static/images/demo/`. Consumer brand assets and
consumer-specific pages belong in the consumer repo.

## Adaptive Sidecar

`py/morphe_agent` serves `POST /v1/morphe/decision` and always returns a
schema-valid decision response. Without live credentials it uses the
deterministic fallback. With live settings it routes through the Pydantic AI
Gateway.

```bash
MORPHE_AGENT_LIVE=1 \
MORPHE_AGENT_MODEL=... \
PYDANTIC_AI_GATEWAY_API_KEY=... \
uv run uvicorn morphe_agent.app:app --host 127.0.0.1 --port 8042

MORPHE_AGENT_BASE_URL=http://127.0.0.1:8042 just dev
```

`MORPHE_AGENT_GATEWAY_BASE_URL` can override the default OpenAI-compatible
Pydantic Gateway proxy. CI and local gates do not require a live model call.

## Box Viewer

`viewer/` is a stripped SvelteKit app for appliance rendering. It shares the
same `src/lib` substrate, exposes `/surfaces/[artifactId]` plus `/healthz`, and
fetches compiled artifacts from `MORPHE_ARTIFACT_BASE_URL`. It exists so the
playground's outbound-capable adaptive bridge does not ship into the box image.

```bash
just viewer-build-node
docker build -f viewer/Dockerfile -t morphe-viewer .
```

## Reading Order

| Document | What it answers |
|---|---|
| [`CONTEXT.md`](CONTEXT.md) | Canonical domain vocabulary. |
| [`VISION.md`](VISION.md) | Why the stratified adaptive tower exists. |
| [`CONTRACT.md`](CONTRACT.md) | What the locked Phase 0 substrate guarantees. |
| [`DESIGN.md`](DESIGN.md) | The design-system frame and dialect craft rules. |
| [`PACKAGING.md`](PACKAGING.md) | Package boundary, exports, and publication proof. |
| [`STATUS.md`](STATUS.md) | Last verified status snapshot. |
| [`docs/adr/`](docs/adr/) | Architectural decisions and their reasons. |

## Working Rules

- Library code under `src/lib/**` uses `.js` extensions on relative imports and
  `import type` for types.
- Authored trees emit roles, priorities, and intents only. Do not hardcode
  colors, scale names, geometry, or event handlers into tree data.
- Interactive chrome and host controls live outside the Morphe tree as native
  elements styled by `--mo-*` tokens. `MorpheRoot` renders the authored/result
  tree.
- Compounds vary through node params and slots only. Raw string fields such as
  `Badge.label`, `Link.href`, `Button.label`, `Media.src`, and input labels are
  authored directly in presenters.
- App-specific presenters, routes, brand assets, outbound integrations, and
  product copy belong in consumer repositories unless they are neutral
  playground/CMS proofs.
