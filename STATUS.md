# Morphe — Phase 0 Core — Integration & Verification Status

**Date:** 2026-06-08
**Pass:** integration + verification + documentation (ran alone, no concurrency).
**Verdict: GREEN.** Types clean, all tests pass, production build succeeds. One
real integration breakage was found and fixed (a Svelte-tokenizer caveat in two
overlay components); everything else composed correctly against `CONTRACT.md`.

---

## 1. Verification results (commands actually run, from `/home/rationallyprime/projects/morphe`)

Package manager is **bun** (the repo migrated pnpm → bun; commands are `bun run …`).

| Step | Command | Result |
|---|---|---|
| Types | `bun run check` (`svelte-kit sync && svelte-check`) | **0 errors, 0 warnings** (359 files) |
| Tests | `bun run test` (`vitest run`) | **88/88 passing** across 4 files |
| Build | `bun run build` (`vite build`) | **Success** (client + SSR bundles, ~6 s) |

The build's only console notice is `@sveltejs/adapter-auto`: "Could not detect a
supported production environment." Expected — no deploy target is configured. It
is **not** a build failure; the bundles are produced.

### Test breakdown (88 total)

- `src/lib/morphe/core.test.ts` — 13 (law + factory + dialect smoke).
- `src/lib/morphe/dialects/dialects.test.ts` — 23 (Lemma-4 fixed-point).
- `src/lib/morphe/lemmas.property.test.ts` — 20 (§13 lemmas-as-property-tests,
  in-repo seeded fuzzer, 200 cases/property).
- `src/lib/morphe/primitives.render.test.ts` — **32 (NEW this pass)** — SSR
  render totality + a11y for the Action/Overlay families and the input mode
  extensions (see §3).

---

## 2. The integration breakage that was found and fixed

`bun run check` failed out of the box with 4 errors:

```
Popover.svelte    311:9  `<script>` was left open (element_unclosed)
Disclosure.svelte 158:9  `<script>` was left open (element_unclosed)
registry.ts       47/48  Module '…/Popover.svelte' has no default export
```

The last two were downstream of the first two (a Svelte file that fails to parse
exports nothing). **Root cause:** both overlay components wrote the raw-text tag
`<style>` (and Disclosure also `<details>`/`<summary>`/`<Node>`) inside their
`<script>`-block doc comments. Svelte 5.56's tokenizer treats `<style>`/`<script>`
as raw-text element boundaries **even inside a JS comment**, loses the real
`</script>` close, and reports `element_unclosed` at the file's final line — a
misleading location far from the actual cause.

**Fix (minimal, honours CONTRACT §0 — only the primitive's own file touched):**
neutralised the offending tag tokens in the two script comments (`<style>` →
"the style block", `<details>`/`<summary>` → "details / summary"). No code, no
signature, no markup, no CSS changed. `bun run check` then went 0/0. The caveat
is now documented in `CONTRACT.md` §1 so no future primitive agent re-introduces
it.

No other integration fixes were required. No locked file (`grammar/types.ts`,
`render/*`, `tokens/*`, `context/*`, `compounds/*`, `dialects/provider`) was
modified.

---

## 3. New primitive count & coverage

**Primitive kinds with a shipped component: 22** (up from 17).

| Family | Kinds | New this phase |
|---|---|---|
| Layout | stack, grid, cluster, frame, spacer | — |
| Content | text, number, badge, icon, media | — |
| Input | field, select, toggle, range | — (3 MODE extensions, below) |
| Feedback | progress, status, inline-alert | — |
| **Action** | **button, link** | **+2** |
| **Overlay** | **dialog, popover, disclosure** | **+3** |

Plus 3 meta kinds (`slot`, `param-ref`, `vary`, no `.svelte` files) + `compound`
= the full `NodeKind` union. **5 new primitive kinds** this phase.

**3 input MODE extensions** (capabilities of existing primitives, not new kinds —
the grammar fixed-point: every pre-mode authored tree stays valid and renders in
its default mode):

- `Field.multiline` → native `<textarea>` (keeps `rows`/`resizable`); same
  `InputA11y` wiring; default arm stays single-line `<input>`.
- `Toggle.variant:"checkbox"` → native `<input type="checkbox">` with
  `indeterminate` ⇒ `aria-checked="mixed"` + dash shape; default stays
  `<button role="switch">`.
- `Select.variant:"radiogroup"` → `<fieldset>`/`role="radiogroup"` of
  `role="radio"` options with one-tab-stop roving; default stays native
  `<select>`.

### What the 32 new render tests prove

- **Render totality:** every new kind (button, link, dialog, popover,
  disclosure) resolves through `render/registry.ts` and renders via `MorpheRoot`
  → `Node` → component to real HTML, standalone and nested in a layout tree.
- **Mode extensions render AND defaults still work:** each input renders in both
  its default and its extended mode; no extended-mode markup leaks into a tree
  that didn't ask for it.
- **Grammar fixed point preserved:** a tree authored using ONLY pre-existing
  kinds/fields (no variant/multiline/indeterminate) renders **byte-identical**
  across the `icelandic-archive` and `clinical` dialects (boundary vars stripped)
  — adding the new families/modes perturbed no existing tree.
- **a11y (cheap, SSR-visible):** icon-only Button carries an `aria-label`; busy
  Button is `aria-busy` + spinner glyph; forced-external Link has
  `target=_blank` + `rel="noopener noreferrer"` + visible `open_in_new` + SR-only
  "(opens in new tab)"; Dialog is `aria-labelledby` its required title (verified
  the referenced id exists) and `aria-describedby` its description, exposes a
  labelled close affordance only when dismissable; Disclosure exposes
  collapsed/expanded state via native `<details [open]>` + chevron shape and the
  exclusive-accordion `name=`; Popover menu/listbox is `aria-labelledby` its
  anchor while a tooltip is not; Field/Toggle/Select wire
  label/`aria-required`/`aria-invalid`/`aria-describedby`, and the radiogroup has
  exactly one tab stop.

The render tests use Svelte's server `render()` — **no DOM, no jsdom, no new
dependency**; they run in the same `node` environment as the rest of the suite,
exercising the exact path the dignity demo proves at runtime.

---

## 4. Contract conformance

- `render/registry.ts` is an **exhaustive** `Record<PrimitiveKind, Component>`
  (all 22 primitive kinds mapped; meta kinds excluded, handled in `Node.svelte`).
  A missing entry is a compile error.
- No grammar signature drifted. `grammar/types.ts`, `render/props.ts`,
  `render/Node.svelte`, `render/MorpheRoot.svelte` are unchanged from the locked
  contract; the Action/Overlay kinds and the input mode fields are exactly as
  CONTRACT §3 specifies.
- `Node.svelte` was NOT changed for the overlay family — overlays carry their own
  children, recurse into `<Node>`, and render via the platform top layer
  (`<dialog>`, the Popover API, `<details>`), so they appear in place with no
  portal (the design goal held).
- House style honoured: tabs, double quotes, semicolons; Svelte 5 runes; TS
  strict (`noUncheckedIndexedAccess`, `verbatimModuleSyntax`).

---

## 5. Stubbed / incomplete / Phase-1 boundaries (honest gaps)

None block Phase 0; these are the contract's named edges.

- **Open-state effects are client-only.** Dialog/Popover reflect `open` onto the
  native element via an `$effect` (`showModal()` / `showPopover()`), which runs in
  the browser, not SSR. SSR therefore emits the CLOSED, fully-labelled markup;
  the platform lifts it on the client. This is correct for a server-driven
  primitive (no `window` read on the server) and is documented in CONTRACT §10.
- **Phase-0 declarative wiring is unchanged:** action `action` ids, overlay/input
  `bind` store-paths, and `Vary` remain declarative carriers with no live loop
  (Lemma 5 / Lemma 6 Phase-1 work). Inputs hold tier-0 local `$state` only.
- **`dialect.compounds[]` is not yet render-gated** (the singleton `registry` is
  global; "Phase 1 wires the registry").
- **`clinical` / `reykjavikRegistry` and `dialects/registry.ts` are not in the
  public barrel** `src/lib/morphe/index.ts` (only `icelandicArchive` /
  `DEFAULT_DIALECT` are). All imports resolve and tests pass; left as-is to avoid
  touching the locked barrel without a contract owner's call.
- **Pre-existing observation (NOT this phase's work, NOT a regression):** in SSR,
  `Text.svelte`'s `style="color: …"` serialises a Svelte derived getter rather
  than a resolved color string. It is byte-identical across dialects (so the
  fixed-point holds) and resolves correctly on the client. Worth a look by the
  content-primitive owner, but out of scope for the action/overlay/mode pass.
- **Fonts / icons are a CDN dependency** (Material Symbols + the three fonts), as
  the Archive spec permits. `@sveltejs/adapter-auto` has no detected deploy
  target — pick a concrete adapter at deploy time.

---

## 6. Run instructions

```bash
cd /home/rationallyprime/projects/morphe

bun install        # deps (already present locally; no network needed here)
bun run check      # svelte-kit sync && svelte-check  → 0 errors, 0 warnings
bun run test       # vitest run                       → 88/88 passing
bun run build      # vite build                       → client + SSR bundles
bun run dev        # dev server; open http://localhost:5173/  (the dignity test)
```

No remote was created and nothing was pushed. Local only, as instructed.
