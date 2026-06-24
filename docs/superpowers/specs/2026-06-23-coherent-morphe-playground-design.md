# Coherent Morphe Playground — First Slice Design

**Date:** 2026-06-23
**Status:** Approved (brainstorming) — pending implementation plan
**Related:** ADR-0010, ADR-0009, `docs/superpowers/specs/2026-06-23-morphe-sokrates-decoupling-inventory.md`

This design turns the neutral demo host into a coherent Morphe playground instead of a
set of disconnected smoke surfaces. The playground is the first thing a developer,
designer, or agent should open to understand what Morphe does: authored UI as data,
dialects, context algebra, state/action sockets, variation, CMS publication, and adaptive
decision loops.

The user decision is explicit: **build one coherent playground first**. Chrome Gemini
Nano / Prompt API integration is one exhibit inside that playground, not a separate side
quest and not a dependency of `@rationallyprime/morphe`.

Sources for the browser-local AI slice:

- Chrome Prompt API docs: `LanguageModel.availability()`, `LanguageModel.create()`,
  download progress, hardware/storage requirements, and `responseConstraint` structured
  output:
  <https://developer.chrome.com/docs/ai/prompt-api>
- `Ar9av/gemini-nano-chrome`: working harness around Chrome's built-in Gemini Nano,
  including a direct browser chat and an OpenAI-compatible local server over CDP:
  <https://github.com/Ar9av/gemini-nano-chrome>

---

## 1. Product Shape

The playground is a **workbench**, not a landing page. It should open directly into a
usable surface with controls, live preview, and diagnostics. It can be beautiful, but it
must behave like a substrate lab: every visual flourish should prove a Morphe concept.

The first slice keeps the existing route spine:

| Route | Role |
|---|---|
| `/` | Workbench index: concise entry into the playground, CMS preview, and published demo |
| `/substrate` | Main playground shell with exhibit navigation and live preview |
| `/preview/[artifactId]/[revisionId]` | CMS compiled-tree preview proof |
| `/p/[slug]` | Publication pointer proof, with `/p/demo` always backed by the built-in demo |
| `/dignity` | Compatibility redirect to `/substrate` |
| `/api/adaptive/decision` | Existing server-side adaptive sidecar bridge |

No new public marketing routes are introduced. Consumer-specific pages remain in the
Sokrates website repo.

---

## 2. Playground Shell

`/substrate` becomes a single workbench shell with three persistent regions:

1. **Exhibit nav** — native segmented/list navigation over the proof surfaces.
2. **Control surface** — native form controls for the active exhibit.
3. **Morphe preview + proof rail** — `MorpheRoot` renders the resulting tree; a proof rail
   shows dialect, source, action ids, bound paths, choice map, diagnostics, and fallback
   status.

The authored tree never owns host controls. Controls are native chrome styled with
`--mo-*` tokens, matching the existing native-control-surface idiom. The preview is the
only place `MorpheRoot` renders the result.

Implementation module boundary:

```text
src/routes/substrate/+page.svelte        # route shell and exhibit selection
src/routes/_playground/
  exhibits.ts                            # closed exhibit registry
  presenters.ts                          # pure draft/control-state -> Node presenters
  local-ai.ts                            # browser-only Prompt API adapter
  validation.ts                          # zod contracts for playground drafts
  fallback.ts                            # deterministic fallback drafts/trees
```

`src/routes/_playground/**` is route-host code, not package code. It may import `$lib`,
but `src/lib/**` must not import it.

---

## 3. Exhibit Set

First-slice exhibits:

1. **Grammar Studio**
   - Shows a curated authored tree.
   - Lets the user switch between content primitives, layout primitives, feedback, inputs,
     overlay/disclosure, and media.
   - Displays a compact JSON inspector for the selected tree.

2. **Dialect Lab**
   - Switches all nine shipped dialects.
   - Shows the same tree re-themed.
   - Keeps one nested pinned-dialect preview to prove dialect boundary behavior.

3. **State + Actions**
   - Demonstrates `bind` paths, the in-memory `MorpheStore`, and declarative
     `Button.action` ids wired at `MorpheRoot.actions`.
   - Proof rail lists touched store paths and actions fired.

4. **Vary + Delta**
   - Demonstrates a `Vary` node with host-owned `choices`.
   - Lets the user apply a typed choice change and see the rendered branch change without
     mutating the authored tree.

5. **CMS Pipeline**
   - Links to `/preview/capability-page.demo/rev-001` and `/p/demo`.
   - Shows the artifact path, revision id, render hints, and publication pointer status.
   - Does not implement a human editor in this slice.

6. **Local AI Provider**
   - Progressive enhancement for Chrome's Prompt API.
   - Checks availability, handles `downloadable` / `downloading` / `available` states, and
     renders deterministic fallback elsewhere.
   - Uses Gemini Nano to create a small typed adaptive draft, not arbitrary `Node` JSON.

---

## 4. Local AI Provider Contract

The browser-local provider must not generate full Morphe trees directly. Full `Node`
generation is powerful but too large a runtime-validation surface for the first slice.
Instead, the provider emits a small semantic draft:

```ts
interface LocalAdaptiveDraft {
  readonly title: string;
  readonly summary: string;
  readonly tone: "info" | "success" | "caution";
  readonly badges: readonly string[];
  readonly nextActionLabel: string;
}
```

This draft is validated with Zod. A deterministic presenter maps it into a schema-valid
Morphe `Node` tree:

```text
Prompt API result
  -> JSON.parse
  -> localAdaptiveDraftSchema.safeParse
  -> presentLocalAdaptiveDraft(draft)
  -> MorpheRoot
```

Invalid JSON, schema-invalid drafts, unsupported browser state, aborted sessions, and model
errors all resolve to a deterministic fallback draft/tree with diagnostics. Nothing from the
model reaches `MorpheRoot` until it has passed the small draft contract and deterministic
presenter.

The prompt uses `responseConstraint` with the same small schema. The browser still needs
runtime validation because constrained generation improves the shape but is not the trust
boundary.

The OpenAI-compatible server from `Ar9av/gemini-nano-chrome` is not imported into Morphe.
It is useful as a documented dev-provider option for the existing Python sidecar because
`py/morphe_agent` already speaks OpenAI-compatible APIs through configurable base URL/model
settings. That server-side path is a separate future design; the first slice uses direct
browser feature detection.

---

## 5. Data Flow

```text
Native playground controls
  -> exhibit state
  -> deterministic presenter OR optional provider
  -> draft validation
  -> Morphe Node tree
  -> MorpheRoot preview
  -> proof rail diagnostics
```

Provider source values:

| Source | Meaning |
|---|---|
| `fallback` | deterministic presenter, no live model |
| `chrome-unavailable` | Prompt API unavailable or unsupported device/browser |
| `chrome-downloading` | model download is needed/in progress |
| `chrome-live` | draft came from Gemini Nano and passed validation |
| `sidecar` | existing `/api/adaptive/decision` server path, when configured |

The source is display-only metadata. The renderer does not trust source labels.

---

## 6. Error Handling

The playground must fail closed and visibly:

- If `LanguageModel` is missing, show "Chrome local AI unavailable" and render fallback.
- If `availability()` returns `downloadable` or `downloading`, show an explicit download
  state and keep the deterministic preview active.
- If `create()` or `prompt()` throws, show `chrome-error:<name>` and render fallback.
- If the model returns invalid JSON or a schema-invalid draft, show a diagnostic and render
  fallback.
- If the sidecar endpoint is unconfigured, keep the current `agent-not-configured` fallback.

No local AI error should break SSR, hydration, or `MorpheRoot`.

---

## 7. Testing

First-slice tests:

- **Presenter tests:** each exhibit presenter returns a tree that renders under SSR; local
  adaptive draft presenter maps every `tone` to a valid Morphe feedback primitive.
- **Validation tests:** valid local adaptive draft accepted; missing fields, unknown tone,
  overlong labels, and non-string badges rejected.
- **Provider tests:** injected Prompt API adapter covers unavailable, downloadable,
  downloading, available-valid, available-invalid-json, available-invalid-draft, and thrown
  error cases. Tests do not require Chrome.
- **Route render test:** `/substrate` SSR includes exhibit nav, proof rail labels, local AI
  controls, and deterministic fallback content.
- **Boundary scan:** no `$site`, `$compose`, `$serverlib`, Sokrates assets, or consumer
  endpoints re-enter the Morphe worktree.

Full browser automation against real Chrome Gemini Nano is out of scope for this slice. It
depends on local Chrome channel, flags/origin-trial state, device requirements, and model
download state.

---

## 8. Out Of Scope

- Production Origin Trial enrollment.
- Chrome extension distribution.
- Importing or vendoring `Ar9av/gemini-nano-chrome`.
- Freeform human JSON editor for arbitrary `Node` trees.
- Human CMS authoring UI.
- New Morphe package exports.
- Sokrates website copy, routes, endpoints, assets, or corpus.
- Replacing the existing Python adaptive sidecar.

---

## 9. Acceptance

The first slice is done when:

1. `/substrate` is a coherent workbench shell with the six exhibits above.
2. The local AI exhibit works as progressive enhancement and degrades to deterministic
   fallback outside supported Chrome contexts.
3. Model output is constrained to `LocalAdaptiveDraft`, Zod-validated, and compiled through
   a deterministic presenter before reaching `MorpheRoot`.
4. The proof rail reports source, diagnostics, active dialect, action ids, bound paths, and
   choice state.
5. `/preview/capability-page.demo/rev-001` and `/p/demo` remain linked and render the built-in
   CMS fixture.
6. The branch passes `bun run lint`, `bun run check`, `bun run test`, `bun run build`, and
   `just gates`.
7. A stale-site scan finds no Sokrates website implementation files or aliases in the
   Morphe repo.

---

## 10. Decisions Recorded

1. The playground is a coherent workbench first, not a Gemini Nano spike.
2. Gemini Nano is a host-app provider/exhibit, not a dependency of the Morphe package.
3. Browser-local AI emits a small typed draft, not arbitrary `Node` trees.
4. Deterministic presenters remain the trust boundary between model output and Morphe
   rendering.
5. Existing CMS preview/publication routes stay part of the proof surface.
6. `/substrate` remains the main playground route for now; a future naming pass can add
   `/playground` if needed without changing the first-slice architecture.
