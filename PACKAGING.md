# Morphe Packaging

Morphe publishes the reusable adaptive-UI substrate as the private GitHub Packages
npm package `@rationallyprime/morphe`. This repository remains the development
playground: the Sókrates marketing app imports the same package-facing seams a
consumer app imports, while app-specific site/compose/server code stays outside
the package root.

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

**APP-ONLY**

- `src/routes/` — SvelteKit app routes and API endpoints.
- `src/app/site/` — Sókrates marketing presenters, intent engine, onboarding UI, site chrome.
- `src/app/compose/` — composer corpus, ranking, embeddings, generated API models.
- `src/app/server/` — Postmark, ntfy, magic-link, receipt helpers.
- `scripts/`, `data/`, `py/`, `scratch/` — repo tooling, evidence data, Python schema seed, scratch.

## Inversions

- App-only imports no longer live under `src/lib`; routes use `$site`, `$compose`, and
  `$serverlib` for playground code.
- The playground imports Morphe through `$lib` and `$lib/components`, matching the
  package exports instead of deep paths.
- Library dev/prod conditionals use `esm-env`, not SvelteKit or Vite app globals.
- Token CSS is explicit: apps import `@rationallyprime/morphe/styles.css`. The engine
  entry has no global CSS side effect, so type-only/server consumers do not paint a page.
- Static corpus data, generated Orval clients, email/env access, and route handlers stay
  app-side. A future consumer supplies those through its own host configuration.

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

For local development against the private GitHub Packages registry:

```toml
[install.scopes]
"@rationallyprime" = { url = "https://npm.pkg.github.com", token = "$GITHUB_PACKAGES_TOKEN" }
```

Set `GITHUB_PACKAGES_TOKEN` to a classic PAT with `read:packages`. On Vercel, set the same
environment variable in the project settings before install/build.

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

The `Publish package` workflow runs on `v*` tags with `packages: write`, rebuilds the
package with `svelte-package`, and publishes to `https://npm.pkg.github.com` using the
workflow `GITHUB_TOKEN`. Pull requests touching `package.json`, `bun.lock`, `src/lib/**`,
the verifier, or the workflow run the same gates and a publish dry-run.

No changesets yet. Until Morphe has multiple consumers, cut releases by bumping
`package.json`, tagging `vX.Y.Z`, and letting CI publish.
