# Morphe Packaging

Morphe publishes the reusable adaptive-UI substrate as the public npm package
`@rationallyprime/morphe` (MIT, registry.npmjs.org). This repository owns the package source,
local CMS/tooling, adaptive sidecar contract, and a neutral development
playground. Consumer applications, including the Sókrates website, import the
package-facing seams from their own repositories.

## Boundary

The package root is `src/lib`. It contains the reusable core only.

**ENGINE**

- `grammar/` — the typed `Node` union and glossary-bound vocabulary.
- `context/` — context algebra, emphasis budget, and Svelte context boundary.
- `compounds/` — compound factory, registry, resolver, and validation gate.
- `dialects/` — dialect data, active dialect store, arrival resolution, and provider.
- `delegation/` — envelope, epoch/delta machinery, variation resolution, and mid-loop seam.
- `state/` — client store, tier-1 commit path, tier-2 events, actions, digest, escalation.
- `render/` — render contracts and registry internals; mounted through `./components`.

**DESIGN SYSTEM**

- `primitives/` — Svelte primitive components.
- `tokens/` — intent vocabulary, slot helpers, and token CSS.
- `styles.css` — public CSS import for scales + intents.

**DEMO HOST**

- `src/routes/` — neutral SvelteKit playground, CMS preview/publication routes, and adaptive API bridge.
- `static/images/demo/` — neutral demo assets. Consumer brand assets live in the consumer repo.

**TOOLING**

- `py/morphe_grammar/` — Pydantic grammar models, schema emission, TS codegen, and masks.
- `py/morphe_cms/` — local CMS contracts, validation, presenter, store, tools, and MCP surface.
- `py/morphe_agent/` — adaptive sidecar contract and deterministic fallback.
- `scripts/pack-verify.ts` — package tarball/registry consumer proof.
- `scratch/` — local scratch only, never part of the package.

## Inversions

- Consumer app imports no longer live in this repo; app-specific presenters, ranking,
  generated clients, email/env access, and route handlers stay in the consumer app.
- The neutral playground imports Morphe through `$lib` and `$lib/components`, matching
  the package exports instead of deep paths.
- Library dev/prod conditionals use `esm-env`, not SvelteKit or Vite app globals.
- Token CSS is explicit: apps import `@rationallyprime/morphe/styles.css`. The engine
  entry has no global CSS side effect, so type-only/server consumers do not paint a page.
- Local CMS and adaptive routes consume the package surface the same way a downstream
  app does: validated `Node` data crosses the boundary, then `MorpheRoot` renders it.

## Exports

`package.json` exposes deliberate seams only:

- `@rationallyprime/morphe` — engine: grammar, context, compounds, dialects, delegation,
  state, render contracts, token helper types.
- `@rationallyprime/morphe/components` — `MorpheRoot`, `RenderNode`, and primitive Svelte
  components for harnesses and downstream inspection.
- `@rationallyprime/morphe/tokens` — intent constants and slot helper functions.
- `@rationallyprime/morphe/styles.css` — global token CSS (`scales.css` + `intents.css`).
- `@rationallyprime/morphe/tokens/scales.css` and
  `@rationallyprime/morphe/tokens/intents.css` — explicit lower-level CSS assets.

There is no `./schemas` export yet. The current package is TS-first; the Pydantic/schema
seed remains repo tooling until the Eidos lift makes schema generation canonical.

## Consumer Install

The package is public on npmjs — no registry configuration, tokens, or `.npmrc`
required anywhere (local, CI, or Vercel):

```bash
bun add @rationallyprime/morphe
```

Versions published to GitHub Packages before the npm cutover (≤ 0.3.2) remain
installable there with the old scoped-registry + PAT configuration, but all new
versions publish to npmjs only.

Typical use in a SvelteKit consumer:

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

## Local Verification

Run the app gates:

```bash
bun run lint
bun run check
bun run test
bun run build
```

Run the package gates:

```bash
bun run package
bun run pack:verify
```

`pack:verify` runs `bun pm pack`, installs the tarball into a throwaway Vite + Svelte 5
consumer under `/tmp`, imports the public seams, builds the client mount, builds an SSR
entry, and asserts that the rendered surface contains the expected Morphe output.

After a version is published, the same verifier can install from npmjs instead
of the local tarball:

```bash
bun run registry:verify
```

`registry:verify` reads `package.json`'s current version by default. Set
`MORPHE_VERIFY_PACKAGE=0.4.0` to verify a specific published version. No token is
needed — the package is public. The `Verify published package` workflow runs the
same registry proof.

## Publishing

Publishing is manual and boring:

```bash
bun install --frozen-lockfile
bun run lint
bun run check
bun run test
bun run build
bun run pack:verify
git tag v0.1.0
git push origin v0.1.0
```

The `Publish package` workflow runs on `v*` tags, rebuilds the package with
`svelte-package`, and publishes to npmjs via **trusted publishing** (OIDC): npmjs is
configured to trust this repo's `publish.yml`, so CI holds no token or secret at all,
and provenance attestation comes with it. The exchange needs npm ≥ 11.5.1 (the workflow
upgrades npm in the publish step) and the `id-token: write` permission, which is set.
If the tagged version is already on the registry (e.g. published manually), the workflow
skips the publish and stays green. Pull requests touching `package.json`, `bun.lock`,
`src/lib/**`, the verifier, or the workflow run the same gates and a publish dry-run.

Run the manual `Verify published package` workflow after the tag publish to prove that
the package can be installed from npmjs in the throwaway consumer scaffold.

No changesets yet. Until Morphe has multiple consumers, cut releases by bumping
`package.json`, tagging `vX.Y.Z`, and letting CI publish.
