# ADR-0007 — Package Morphe as a Svelte library; keep the site as playground

- **Status:** Accepted
- **Date:** 2026-06-12
- **Deciders:** packaging extraction for the Business-Distributed consumer
- **Related:** `CONTEXT.md`, `CONTRACT.md`, `VISION.md`, `PACKAGING.md`, ADR-0003, ADR-0004

## Context

Business-Distributed needs to build a separate SvelteKit app by composing through
Morphe's adaptation tower: envelopes, variation points, store/digest state, dialects,
and the primitive design system. The old repo layout kept reusable substrate code under
`src/lib/morphe`, while Sókrates app code (`site`, `compose`, `server`) also lived under
`src/lib`. That is convenient for a SvelteKit app, but wrong for a package: `src/lib` is
the package source for `@sveltejs/package`.

The boundary has to preserve the contract vocabulary: epoch and envelope stay
delegation-time, epochs never reach the renderer, bindings remain flat store paths, and
native control surfaces remain app-owned.

## Decision

1. **`src/lib` is the package root.** It contains engine code and design-system code only:
   grammar, context, compounds, dialects, delegation, state, render internals, tokens, and
   primitives.
2. **The Sókrates playground moves to `src/app`.** Routes import app-only code through
   `$site`, `$compose`, and `$serverlib`. Routes import Morphe through `$lib` and
   `$lib/components`, the same shape a package consumer sees.
3. **The public export map is narrow.** Root `.` is the engine seam; `./components` is the
   Svelte component seam; `./tokens` is the token-helper seam; `./styles.css` is the
   explicit global CSS seam. No consumer deep-path imports into implementation folders.
4. **Global token CSS is not a root side effect.** Consumers opt into
   `@rationallyprime/morphe/styles.css`. Type-only and server tooling can import engine
   types without painting a page.
5. **No schema export yet.** The current implementation is still TS-first. The Pydantic
   schema seed remains repo tooling until the Eidos lift makes generated schemas the
   canonical source.

## Consequences

**Positive**

- `svelte-package` can package `src/lib -> dist` without copying `site`, `compose`, route
  endpoints, server env code, or generated app data into the tarball.
- The playground is a real consumer of the package seams, so broken export maps surface in
  normal app work.
- Business-Distributed can depend on the engine and components without inheriting the
  Sókrates marketing corpus or email/rerank endpoints.
- Explicit CSS import keeps the engine usable from tests, SSR utilities, and schema/codegen
  tools without accidental global style side effects.

**Negative / costs**

- App aliases are now split (`$site`, `$compose`, `$serverlib`) instead of everything
  riding `$lib`.
- Historical docs and plans that mention old `src/lib/morphe` or `src/lib/site` paths need
  opportunistic cleanup as they are touched.
- The CSS seam is one extra import for every consumer app.

## Alternatives rejected

- **Package only `src/lib/morphe` and leave app code under `src/lib`.** This avoids moves,
  but it fights SvelteKit's library convention and keeps the app layout misleading.
- **Publish all of `src/lib` and rely on `exports` to hide app code.** The package tarball
  would still carry app-only data and server helpers. Boundary integrity beats convenience.
- **Import token CSS from the root entry.** Easier for demos, but bad for server/type-only
  consumers and surprising for host apps that want explicit style ownership.
- **Export schemas immediately.** Premature: `VISION.md` says one schema/three jobs is the
  end-state, not the present. Publishing a non-canonical schema seam now would be harder to
  retract later.
