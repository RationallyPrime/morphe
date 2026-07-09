# Morphe — Phase 0 Core Contract

**This is the single source of truth for everyone building on the Morphe core.**
Every non-foundation agent READS THIS FIRST. The keystone (grammar, tokens,
context algebra, compound factory, dialects, renderer) is locked. You extend it
at the edges the contract names — you do not modify the core.

**`VISION.md` (proposal v0.6, repo-canonical) is the *why*** — the stratified
adaptive tower this substrate is Phase 0 of; this file is the *what* and the
*how*. Where they disagree on implementation detail, this file wins; on what
Morphe is ultimately for, `VISION.md` wins. **Lemma numbering here follows
`VISION.md`** (L1 Generativity, L2 Calm, L3 Invariance, L4 Dialects, L5 Purity,
L6 Bounded delegation, L7 Venue) — the same numbering the source comments use.

Status: implemented + integrated. `bun run check` clean (0 errors, 0 warnings),
329 tests passing, `bun run build` succeeds (adapter-vercel, `nodejs22.x`). The
ACTION (`Button`, `Link`) and OVERLAY (`Dialog`, `Popover`, `Disclosure`)
families and the input MODE extensions (`Field.multiline`,
`Toggle.variant:"checkbox"`, `Select.variant:"radiogroup"`) are in the grammar,
registry, tokens, and all shipped dialects, and the component bodies are FILLED
(no longer stubs) — see §11–§12 and `STATUS.md`. No grammar signature drifted
during implementation; the only integration fix was a Svelte-tokenizer caveat
(see §1).

---

## 0. The one rule for primitive agents

> **A primitive agent edits ONLY its own
> `src/lib/primitives/<family>/<Name>.svelte` file.**

You do NOT touch: `grammar/types.ts`, `render/registry.ts`, `render/Node.svelte`,
`render/props.ts`, any file under `tokens/`, `context/`, `compounds/`, or
`dialects/`, or `index.ts`. If your primitive needs a new prop, a new token, or a
registry change, that is a **grammar/contract change** and goes through the
contract owner — not a silent edit. Your `$props()` type MUST stay exactly the
`PrimitiveProps<YourNode>` the grammar defines.

Each primitive's file wires structure (context descent for layout, a11y
relationships for inputs, the discrete/continuous carrier split). Keep that
wiring; enrich the markup and styling inside it.

**History: the ACTION/OVERLAY families and the input MODE extensions were
built as 8 parallel implementation assignments (one agent per file), now
long complete — every file below is filled, not a stub:**

| File | Node kind / mode it owns |
|---|---|
| `primitives/action/Button.svelte` | `Button` (solid/outline/ghost variants, busy, icon-only a11y) |
| `primitives/action/Link.svelte` | `Link` (external-tab affordance) |
| `primitives/overlay/Dialog.svelte` | `Dialog` (native `<dialog>`+`showModal()`) |
| `primitives/overlay/Popover.svelte` | `Popover` (Popover API + CSS Anchor Positioning; roving for menu/listbox) |
| `primitives/overlay/Disclosure.svelte` | `Disclosure` (native `<details>`/`<summary>`) |
| `primitives/input/Field.svelte` | `Field` — the **multiline** (`<textarea>`) mode |
| `primitives/input/Toggle.svelte` | `Toggle` — the **checkbox** mode (incl. indeterminate) |
| `primitives/input/Select.svelte` | `Select` — the **radiogroup** mode (fieldset + roving) |

The three mode-extension files keep their pre-existing default mode working
alongside the added mode.

---

## 1. Stack & house style

- **Svelte 5 runes only.** `$props`, `$state`, `$derived`, `$effect`. No legacy
  `export let`, no stores-as-reactivity, no VDOM patterns.
- **TypeScript strict** (`noUncheckedIndexedAccess`, `verbatimModuleSyntax`).
- **Vite + SvelteKit.** Vitest for tests. Package manager is **bun** (`bun run …`).
- **TOKENIZER CAVEAT (learned the hard way — it broke `check` + `build`):** never
  write a raw-text element start tag — `<style>` or `<script>` — inside a
  `<script>`-block comment. Svelte 5's tokenizer treats those two tags as
  raw-text boundaries even inside JS comments, loses the `</script>` close, and
  fails with a misleading `element_unclosed` / "`<script>` was left open" error
  pointing at the file's last line. Refer to them in prose ("the style block",
  "the script block") or escape the angle bracket. Other tags (`<details>`,
  `<Node>`, generics like `$state<HTMLElement>`) are safe; only the two raw-text
  tags poison the comment.
- **House style:** tabs, double quotes, semicolons. (Matches Sokrates.)
- **CSS:** no runtime className synthesis (the legacy's central liability).
  Continuous values flow through CSS custom properties; discrete decisions ride
  Svelte context. No drop shadows; depth is tonal surface layering. Functional
  color is never the only signal.
- A value consumed in a component template is `$derived`; a one-time init
  side-effect (e.g. `descend()` / `setContext`) reads props directly and carries
  a `// svelte-ignore state_referenced_locally` because a server-driven tree is
  immutable per `<Node>` instance.

---

## 2. File layout

```
src/lib/
  grammar/
    types.ts                  # the Node discriminated union — LOCKED, declarative only
                               # @generated by `python -m morphe_grammar.artifacts --write`;
                               # source of truth is py/morphe_grammar/models.py (see §11)
    version.ts                # GRAMMAR_VERSION (mirrors py/morphe_surface/compile.py)
  tokens/
    scales.css                # neutral raw ramps (referenced by NO component)
    intents.ts                # intent names + channel naming convention (intentVar)
    intents.css               # core intents mapped onto scales (default dialect block)
    slots.ts                  # component-facing slot helpers (slot(), SLOTS, toneIntent)
  context/
    algebra.ts                # MorpheContext + the four laws + transforms (pure)
    Context.svelte.ts         # Svelte-context engine: descend / boundaryStyle etc.
  compounds/factory.ts        # CompoundDef/Ref, registry, hygienic expansion, gate
  dialects/
    types.ts                  # Dialect type
    registry.ts               # DIALECTS map + DEFAULT_DIALECT (gallery, ADR-0005) —
                               # the single source of dialect truth
    active.svelte.ts          # global activeDialect rune store
    arrival.ts                 # τ_frame arrival attribution (`?dialect=`)
    provider.svelte.ts        # applyDialect / dialectStyle (clamps priors)
    gallery.ts                 # the DEFAULT dialect (ADR-0005) — museum-paper light ground
    night.ts icelandic-archive.ts clinical.ts reykjavik-registry.ts timaeus.ts
    ledger.ts estate.ts foundry.ts   # the other eight shipped dialects
  render/
    registry.ts               # NodeKind -> primitive component map — LOCKED
    props.ts                  # PrimitiveProps<N> — the prop contract — LOCKED
    Node.svelte               # the recursive renderer — LOCKED
    MorpheRoot.svelte         # dialect-providing entry point — LOCKED
    resolver.svelte.ts        # Vary resolution against MorpheRoot.choices
    choices.svelte.ts          # the root choice-map context
    index.ts                  # render barrel
  primitives/
    layout/   Stack Grid Cluster Frame Spacer
    content/  Text Number Badge Icon Media
    input/    Field Select Toggle Range
    feedback/ Progress Status InlineAlert
    action/   Button Link
    overlay/  Dialog Popover Disclosure
  delegation/                 # ADR-0004: Within/VaryId envelope + applyDelta (R2)
  state/                      # ADR-0003 client store, event tiers, actions, digest
  index.ts                    # public library barrel
  core.test.ts                # law + factory + dialect tests (extend, don't gut)
```

Meta primitives (`Slot`, `ParamRef`, `Vary`, `Within`) have **no .svelte file** —
they are structural and handled by `render/Node.svelte` + `compounds/factory.ts`
+ `delegation/applyDelta.ts`.

---

## 3. The grammar — every Node kind and its exact prop signature

The discriminant is `kind`. Source: `grammar/types.ts`. All fields are
`readonly`. Children arrays are `readonly Node[]`.

### Shared vocabularies

```ts
type ContainerRole =
  "page" | "section" | "panel" | "toolbar" | "list" | "form" | "field-group" | "inline";
type Density        = "compact" | "regular" | "spacious";
type EmphasisClaim  = "muted" | "normal" | "strong" | "critical";   // a CLAIM; renormalized
type CoreIntent =
  "primary-action" | "neutral" | "provenance" | "evidence" | "accession"
  | "caution" | "success" | "info";
type RegisterIntent = "folio" | "marginalia" | "seal";
type IntentRef      = CoreIntent | RegisterIntent;                  // closed authorable keyset
```

### A11y types (REQUIRED on inputs — an inaccessible tree is unrepresentable)

```ts
type LabelRelation =
  | { mode: "visible";     text: string }
  | { mode: "aria-label";  text: string }
  | { mode: "labelledby";  id: string };

interface InputA11y {
  id: string;                 // wires label/description in the DOM
  label: LabelRelation;       // mandatory — there is no unlabelled input
  describedBy?: string;
  required?: boolean;
}

interface StatusSignal { text: string; icon?: string }  // the non-color signal (WCAG 1.4.1)
```

### Layout

```ts
Stack    { kind:"stack";   role:ContainerRole; direction?:"block"|"inline"|"auto"; emphasis?:EmphasisClaim; children:Node[] }
Grid     { kind:"grid";    role:ContainerRole; minTrack?:"narrow"|"regular"|"wide"; emphasis?:EmphasisClaim; children:Node[] }
Cluster  { kind:"cluster"; role:ContainerRole; justify?:"start"|"center"|"end"|"between"; align?:"start"|"center"|"end"|"baseline"; emphasis?:EmphasisClaim; children:Node[] }
Frame    { kind:"frame";   role:ContainerRole; surface?:"base"|"raised"|"sunken"; density?:Density; budget?:number; children:Node[] }   // context RESET
Spacer   { kind:"spacer";  size?:"xs"|"sm"|"md"|"lg"|"xl" }
```

### Content

```ts
Text       { kind:"text";   value:string; as?:"display"|"heading"|"subheading"|"body"|"caption"; emphasis?:EmphasisClaim; intent?:IntentRef; clamp?:number }
NumberNode { kind:"number"; value:number; format?:"plain"|"integer"|"currency"|"percent"|"compact"; currency?:string; emphasis?:EmphasisClaim; intent?:IntentRef }
Badge      { kind:"badge";  label:string; intent?:IntentRef; icon?:string }
Icon       { kind:"icon";   name:string; a11y:{role:"decorative"}|{role:"img";label:string}; intent?:IntentRef }
Media      { kind:"media";  src:string; alt:string; aspect?:"square"|"video"|"portrait"|"auto" }   // alt required ("" = decorative)
```

### Input (a11y REQUIRED)

```ts
Field   { kind:"field";  a11y:InputA11y; inputType?:"text"|"email"|"password"|"number"|"search"|"tel"|"url"; placeholder?:string; bind?:string; hint?:string; error?:string;
          multiline?:boolean; rows?:number; resizable?:boolean }                           // multiline MODE (textarea); single-line when absent
Select  { kind:"select"; a11y:InputA11y; options:{value:string;label:string;disabled?:boolean}[]; bind?:string; hint?:string; error?:string;
          variant?:"dropdown"|"radiogroup" }                                               // presentation MODE; "dropdown" (native <select>) by default
Toggle  { kind:"toggle"; a11y:InputA11y; bind?:string; hint?:string;
          variant?:"switch"|"checkbox"; indeterminate?:boolean }                           // semantic MODE; "switch" by default; indeterminate is checkbox-only
Range   { kind:"range";  a11y:InputA11y; min:number; max:number; step?:number; bind?:string; hint?:string }
```

**Mode extensions are OPTIONAL and DEFAULTED** (the grammar fixed-point: every
tree authored before these fields existed is still valid). A mode is NOT a new
kind — it is a capability of the same input primitive. The implementation agent
for that primitive must handle BOTH modes inside the SAME `.svelte` file:

- `Field.multiline` → native `<textarea>` (keep `rows`/`resizable`); same
  `InputA11y` wiring (label relation, `aria-describedby` for hint+error,
  `aria-invalid`); `:focus-visible` on the control itself, not a wrapper.
  `inputType` is ignored when multiline.
- `Toggle.variant:"checkbox"` → native `<input type="checkbox">`; `indeterminate`
  drives `el.indeterminate` via an `$effect` and `aria-checked="mixed"`. The
  default `"switch"` keeps the existing `<button role="switch" aria-checked>`.
- `Select.variant:"radiogroup"` → `<fieldset>`/`<legend>` group of
  `role="radio"` options with roving tabindex (one tab stop, arrows move
  selection), `aria-required`/`aria-invalid` on the fieldset, error/hint via
  `aria-describedby`. The default `"dropdown"` is a native `<select>`.

### Feedback (functional color never the only signal)

```ts
Progress    { kind:"progress";     value?:number; label:string; intent?:IntentRef }   // label required
Status      { kind:"status";       tone:"success"|"caution"|"info"|"neutral"; signal:StatusSignal }
InlineAlert { kind:"inline-alert"; tone:"success"|"caution"|"info"; title:string; detail?:string; live?:"polite"|"assertive" }
```

### Action (real `<button>`/`<a>` — genuine browser capability, NOT compounds)

The action family ships code because the affordance's keyboard / focus /
activation / navigation semantics ARE platform capability. **A clickable `<div>`
is FORBIDDEN** — a11y demands the real elements, so the grammar ships them as
kinds. The action/link split is honest: Button DOES something, Link GOES
somewhere; neither is polymorphic into the other. Phase 0 has no live wire, so an
action carries its intent DECLARATIVELY via an `action` id (exactly like `Vary`
carries an id it cannot yet resolve).

```ts
type ControlLabel =
  | { mode:"aria-label";  text:string }
  | { mode:"labelledby";  id:string };

// Button is a DISCRIMINATED UNION so "icon-only AND unlabelled" is UNREPRESENTABLE:
//   either it has visible `label` text (the accessible name) OR it carries `a11y`.
Button (kind:"button"):
  ButtonBase                                   // kind; variant?:"solid"|"outline"|"ghost"; intent?:IntentRef;
                                               //   type?:"button"|"submit"|"reset"; disabled?:boolean; busy?:boolean;
                                               //   action?:string; icon?:string
  & ( { label:string;       a11y?:ControlLabel }     // visible-text label IS the name
    | { label?:undefined;   a11y:ControlLabel } )    // icon-only ⇒ a11y name REQUIRED

Link { kind:"link"; href:string; label:string; intent?:IntentRef; external?:"auto"|"force"|"hide" }
```

- **Button variant is channel SELECTION, never a className matrix:** solid paints
  surface+on; outline paints border+on over a transparent surface; ghost paints
  on only with a hover surface. Variants are re-combinations of existing channels.
- **Button busy** sets `aria-busy` and shows a reduced-motion-aware spinner.
- **Link external** is server-decided (a server-driven primitive must not read
  `window`). When the link opens a new tab, render `target="_blank"
  rel="noopener noreferrer"`, a visible `open_in_new` indicator, AND an SR-only
  "(opens in new tab)" span. Default intent for Link is the provenance (citation)
  register, not the primary-action beacon.

### Overlay (native `<dialog>` / Popover API / `<details>` — PLATFORM TOP LAYER)

> **DECISION: overlays use the platform top layer, not absolutely-positioned divs
> in overflow containers.** Native `<dialog>`+`showModal()` gives the top layer
> (no z-index wars, no portal, no overflow clipping), a `::backdrop`, a built-in
> focus trap, Escape, and focus restoration FOR FREE. The Popover API
> (`popover` attribute) + CSS Anchor Positioning gives top-layer + light-dismiss
> + declarative flip/shift (zero JS in the position loop). `<details>`/`<summary>`
> gives collapse with zero JS. This is the keystone reason these are primitives:
> the genuine capability lives in the platform, and faking it is the legacy
> mistake three runtime libraries fought. **No portal surgery in `Node.svelte`
> was required** — overlays render in place and the platform lifts them.

```ts
Dialog     { kind:"dialog";     title:string; description?:string; open?:boolean; bind?:string; dismissable?:boolean; children:Node[] }
Popover    { kind:"popover";    anchor:string; id:string; placement?:"top"|"bottom"|"start"|"end"; role?:"tooltip"|"menu"|"listbox"; open?:boolean; bind?:string; children:Node[] }
Disclosure { kind:"disclosure"; summary:string; open?:boolean; group?:string; children:Node[] }
```

- **Dialog** `title` is REQUIRED (wired `aria-labelledby`); `description` wires
  `aria-describedby`. Open is tier-0 `$state`; an `$effect` calls
  `showModal()`/`close()` when it flips. `dismissable` (default true) gates the
  Escape/backdrop/close-affordance path. Ids are derived deterministically (a
  stable hash of the title) — never `Math.random` (SSR/replay-safe).
- **Popover** `anchor` + `id` are REQUIRED. `role` picks the keyboard contract: a
  `tooltip` needs no roving; `menu`/`listbox` use the shared roving-tabindex
  action. Light-dismiss is native to the Popover API — no hand-rolled
  outside-click listeners.
- **Disclosure** `summary` is the REQUIRED trigger label. `group` enables a native
  exclusive accordion (`name=` on the `<details>`) — no JS. The marker is a SHAPE
  cue (rotating chevron), not color alone.
- **Reduced motion** is honoured for every overlay/disclosure transition (a media
  query in `<style>`, not a JS hook).

### Meta (no .svelte files — structural)

```ts
VaryId  string (opaque, assignment-compatible branded id for variation points)
Slot     { kind:"slot";      name:string; fallback?:Node[] }
ParamRef { kind:"param-ref"; param:string }
Vary     { kind:"vary";      id:VaryId; options:Node[]; default?:number; objective?:"salience"|"density"|"compactness" }
Within   { kind:"within";    id:VaryId; dimension:"density"|"emphasis"|"collapse"; range:readonly [number,number]; default:number }
```

### Compound reference

```ts
CompoundRef { kind:"compound"; name:string; args:Record<string,unknown>; emphasis?:EmphasisClaim; slots?:Record<string,Node[]> }
```

`type Node = Layout | Content | Input | Feedback | Action | Overlay | Meta | CompoundRef`,
discriminated by `kind`. (`ActionNode = Button | Link`; `OverlayNode = Dialog |
Popover | Disclosure`.) `assertNever(x)` is the exhaustiveness helper for
`switch` defaults.

---

## 4. The context engine API (Lemma 2)

Record: `MorpheContext = { depth; density; scaleTier(0..4); emphasisBudget; surface }`.
`ROOT_CONTEXT` is the default seed. The dialect's priors override it via
`applyDialect`.

### Pure algebra (`context/algebra.ts`)

| Function | Signature | Purpose |
|---|---|---|
| `transform` | `(parent, role, {childCount?, claim?}) -> MorpheContext` | per-role child context; LOCALITY + MONOTONE-DEPTH |
| `enterFrame` | `(parent, {surface?, density?, budget?}) -> MorpheContext` | the ONLY scale-tier reset |
| `densityForCount` | `(parent, n) -> Density` | the ONLY sibling-count decision (STABILITY) |
| `renormalizeBudget` | `(B, claims[]) -> RenderedEmphasis[]` | BUDGET-CONSERVATION: claims → rendered |
| `tierToTypeStep` | `(tier) -> "var(--mo-type-N)"` | scale tier → type CSS var |
| `densityToSpaceStep` | `(density) -> "var(--mo-space-N)"` | density → space CSS var |

Constants: `THRESHOLDS = {densityCrowdAt:7, densityPackAt:13}`, `TOP_TIER_CAP = 1`.

### The four laws (how the structure enforces them)

1. **Locality** — `transform` reads only `(C_parent, role, opts)`. Deterministic.
2. **Stability** — the only count-sensitive call is `densityForCount`, whose
   steps live in the enumerated `THRESHOLDS` table. Adding a sibling that doesn't
   cross a threshold changes nothing.
3. **Monotone-depth** — non-Frame transforms only ever LOWER `scaleTier`. Only
   `enterFrame` resets it upward.
4. **Budget-conservation** — `renormalizeBudget` caps total weight at `B`
   (muted=0, normal=1, strong=2, critical=3) and top-tier count at `TOP_TIER_CAP`,
   demoting later claims first (deterministic, re-emission-stable).

### Svelte-context engine (`context/Context.svelte.ts`)

```ts
useMorpheContext(): MorpheContext           // read; returns ROOT_CONTEXT if no provider
provideMorpheContext(ctx): void             // setContext at init
descend(role, {childCount?, claim?}): MorpheContext       // compute child ctx + provide it
descendFrame({surface?, density?, budget?}): MorpheContext // Frame reset variant
boundaryVars(ctx): Record<string,string>    // continuous CSS vars for this boundary
boundaryStyle(ctx): string                  // same, as an inline style string
```

**How a layout primitive uses it** (the locked stub pattern):

```svelte
const child = descend(node.role, { childCount: node.children.length, claim: node.emphasis });
const childStyle = $derived(boundaryStyle(child));
// ...
<div style={childStyle}>{#each node.children as c (c)}<Node node={c} ctx={child} />{/each}</div>
```

`boundaryVars` emits `--mo-ctx-space`, `--mo-ctx-type`, `--mo-ctx-surface`,
`--mo-ctx-depth`. A primitive reads density/scale via these CSS vars (e.g.
`font-size: var(--mo-ctx-type)`, `gap: var(--mo-ctx-space)`); it reads discrete
decisions from the `ctx` object. A primitive may set its OWN CSS vars with
`style:--x={...}`. A `direction:"auto"` Stack flips axis with a container query
(no JS) — `Frame` and `MorpheRoot` establish `container-type: inline-size`.

---

## 5. The compound factory API (Lemma 1)

`compounds/factory.ts`. The process-wide singleton is `registry`; a dialect may
carry its own `new CompoundRegistry()` (DI).

```ts
interface ParamSpec   { type:"string"|"number"|"boolean"|"node"|"node-list"; required?:boolean; default?:unknown; description?:string }
interface ParamsSchema{ type:"object"; properties:Record<string,ParamSpec> }
interface CompoundDef { name:string; version:string; params:ParamsSchema; template:Node; grammarVersion:string }
type CompoundLifecycle = "candidate" | "promoted"        // the L1 minting lifecycle
interface CompoundResolver { names; has(name); get(name); expand(ref) }   // the render-facing protocol

registry.register(def, {lifecycle?}): { ok:true; name } | { ok:false; name; errors:string[] }  // never throws; default "promoted"
registry.expand(ref:CompoundRef): Node                                            // hygienic expansion
registry.has(name) / registry.get(name) / registry.names / registry.namesOf(lifecycle)
registry.promote(name): boolean                          // candidate -> promoted; never re-runs the gate
restrictCompounds(registry, {allow, showCandidates?}): CompoundResolver          // G|D view, never mutates
childrenOf(node): readonly Node[]    // the single source of truth for a node's children
```

**Lifecycle (L1 minting):** three producers mint through this one pipeline —
the curated core, agent proposals, application code — and ALL pass the same
gate; `lifecycle` only decides default visibility. A `candidate` renders only
where the active dialect names it in `compounds[]` (an explicit opt-in) or a
root sets the `showCandidates` dev flag; `promote(name)` moves it into the
default visible set.

**Dialect restriction (L4, G|D's compound half):** `MorpheRoot` derives
`restrictCompounds(registry, { allow: dialect.compounds })` and provides it to
every `<Node>` via context (the prop chain does not survive container
recursion). An empty `compounds[]` is unrestricted (today's shipped dialects);
a non-empty list makes out-of-dialect names read as UNKNOWN — render-nothing +
dev-warn, never a throw. The base registry is never mutated; two roots under
different dialects hold independent views over the same singleton.

**Registration gate** (a failing compound is NOT added — render stays total):
1. expand with schema-default args,
2. type-check the expansion against the grammar (every leaf a known kind, no
   leaked `ParamRef`),
3. acyclicity of compound references (DFS),
4. reject a template root that carries an emphasis claim (the call-site
   `CompoundRef.emphasis` claims on behalf of the expansion root),
5. depth bound (`MAX_EXPANSION_DEPTH = 16`).

**Hygiene:** `ParamRef` resolves ONLY against the compound's own `args` (filled
with defaults); `Slot` fills from the call site's `ref.slots[name]` (or its
`fallback`). A `ParamRef` bound to a Node is spliced; bound to a scalar it is
coerced to a `Text` node. Compounds may reference compounds.

---

## 6. Token layers (Lemma 3) — conventions and core intents

Three layers, strictly: **scales → intents → slots**. Authored/agent trees touch
the **intent layer ONLY** (via a node's `intent?` / `tone`). Components reference
**slots**; slots reference intents; intents reference scales. Nothing authored
ever names a scale or a raw value — that is what makes re-theming/re-dialecting a
fixed point.

- **scales.css** — neutral ramps, prefix `--mo-`: `--mo-space-0..9`,
  `--mo-type-1..8`, `--mo-radius-0..full`, `--mo-elev-0..5`, neutral
  `--mo-neutral-0..11`, chromatic `--mo-amber-* / --mo-blue-* / --mo-green-* /
  --mo-red-*`, fonts `--mo-font-display / -body / -mono`, plus the OVERLAY/ACTION
  additions: a neutral **layer (z-index) ramp** `--mo-layer-{base,dropdown,
  sticky,overlay,toast,tooltip}` (raw integers; the rare non-top-layer fallback —
  native showModal/popover own the platform top layer and need none) and the
  **focus-ring geometry** `--mo-ring-width` / `--mo-ring-offset` (ring COLOR stays
  per-intent; only the geometry is neutral). `--mo-elev-5` is the overlay tonal
  tier. **No vertical vocabulary here** — the legacy's fatal mistake, not repeated.
- **intents.ts** — `intentVar(intent, channel)` → `--mo-intent-<intent>-<channel>`;
  channels are `surface | on | hover | border | ring | active | disabled`.
  (`active` = pressed state, `disabled` = disabled surface; both added for the
  ACTION family per the seed's `IntentThemeEntry`.) `CORE_INTENTS`,
  `REGISTER_INTENTS`, and `INTENT_REFS` are the iterable, closed authorable
  intent vocabulary. `SURFACE_VARS` names the non-intent surface vars, now including
  `overlay` (`--mo-intent-surface-overlay`, the floating-panel tier) and `scrim`
  (`--mo-scrim`, the modal backdrop — the one overlay token that is a translucent
  fill, since no tonal-layering substitute for a backdrop exists).
- **intents.css** — the DEFAULT dialect: core intents mapped onto scales under
  `:root, [data-mo-dialect="gallery"]`. EVERY core intent now defines
  all SEVEN channels (incl. `active`/`disabled`); the block also defines
  `--mo-intent-surface-overlay`, `--mo-scrim`, and `--mo-disabled-opacity`. A
  dialect re-theme is a remap of this block scoped by `[data-mo-dialect="…"]`.
- **slots.ts** — `slot(intent, channel, fallback?)` returns a `var(--…)` string;
  named bindings are `SLOTS.field.*`, `SLOTS.action.*`
  (`surface/on/hover/border/ring/active/disabled`, each taking the chosen intent;
  variants are channel selection), `SLOTS.link.*` (`on/hover/ring`, default
  provenance), `SLOTS.overlay.*` (`surface/on/scrim/border` + `layer.{dropdown,
  overlay,toast,tooltip}`), `SLOTS.focus.*` (`ring/width/offset`), and
  `SLOTS.feedback.*`; `toneIntent(tone)` maps a feedback tone to its intent.

**Core intents** (vertical-neutral): `primary-action` (the beacon — electric
cobalt under the default `gallery` dialect, used sparingly), `neutral`,
`provenance` (lineage/citation blue), `evidence` (the
document register), `accession` (the catalog accent), `caution`, `success`,
`info`. **Register intents** (shared discourse roles): `folio`, `marginalia`,
`seal`. The authored intent namespace is closed: adding another intent tier is a
grammar/contract change, and every shipped dialect must cover it. Dialects
re-read the keyset; they do not accept arbitrary extra intent strings.

---

## 7. A11y-required rule

- Every **Input** carries `a11y: InputA11y` — a label relationship is mandatory.
  An unlabelled input is a TYPE ERROR. The stubs already wire `id`,
  `aria-label`/`aria-labelledby`, `aria-describedby` (hint + error), and
  `aria-invalid`.
- **Icon** must declare `a11y: {role:"decorative"}` (hidden from AT) or
  `{role:"img"; label}` — "meaningful but unlabelled" is unrepresentable.
- **Media** requires `alt` (empty string = explicit decorative opt-out).
- **Functional color is never the only signal.** `Status` requires a
  `StatusSignal` (text + optional icon); `InlineAlert` pairs tone with a `title`;
  `Badge` may add a shape `icon`; `Progress` requires a `label`. Button error/busy
  state is shape-bearing (spinner + `aria-busy`); Toggle/Disclosure state is shape
  (thumb/chevron position), not color alone.
- **Button** must have an accessible name. The discriminated union makes
  "icon-only AND unlabelled" a TYPE ERROR: a button with no visible `label` MUST
  carry `a11y: ControlLabel`.
- **Link** must carry the external-tab affordance when it opens a new tab:
  `rel="noopener noreferrer"` + a visible indicator + an SR-only
  "(opens in new tab)" span. Externality is server-decided (no `window` read).
- **Dialog** REQUIRES `title` (wired `aria-labelledby`); the close affordance
  carries an `aria-label`. **Disclosure** REQUIRES `summary` (the trigger label).
  **Popover** REQUIRES `anchor` + `id`; its `role` picks the keyboard contract.
- Keep focus-visible rings on interactive primitives (use `SLOTS.focus.*` for the
  shared geometry over the per-intent ring color — never hardcode px).

---

## 8. Dialects (Lemma 4)

```ts
interface Dialect {
  id:string; label:string; persona?:{vertical:string; role?:string};
  intents: Record<IntentRef, Partial<Record<IntentChannel,string>>>;  // values MUST be var(--mo-…scale…), never hex
  priors: { rootDensity?:Density; rootScaleTier?:ScaleTier; rootBudget?:number };
  compounds: string[];   // render-gated allowlist (G|D): empty = unrestricted; see §5
}
applyDialect(d): { attr, rootContext, vars }   // clamps priors; builds CSS var overrides
dialectStyle(applied): string                  // inline style for the overrides
```

`MorpheRoot.svelte` is the τ_frame injection point: it `applyDialect`s, sets the
`data-mo-dialect` attribute (selecting the intent block), spreads any intent
overrides as CSS vars, seeds the root context, and renders the tree via `<Node>`.
The default is `gallery` (ADR-0005). Priors are clamped (budget 1..6, scaleTier
2..4) so Lemma 2's laws survive any dialect.

**The intent keyset is a FIXED POINT across dialects.** All shipped dialects
define the SAME grammar-declared `IntentRef` names (`CORE_INTENTS` +
`REGISTER_INTENTS`) AND, for the core intents, the SAME channel set — all SEVEN
channels including `active`/`disabled`, plus the
`--mo-intent-surface-overlay` / `--mo-scrim` surface additions. The
`dialects.test.ts` parity tests (`INTENT_REFS` equals the default dialect
keyset, and `applyDialect().vars` keysets must be equal between dialects)
enforce this.
**When you add a channel, add it to EVERY dialect and to `intents.css`, or the
fixed-point breaks.**

The grammar, Pydantic mirror, generated JSON Schema, and generated TypeScript
types all reject unknown `intent` refs. `MorpheRoot` dev-builds still walk
external/untyped authored data against the active dialect's intent record and
warn for any unknown `intent` ref; dialect tests also require every shipped
intent/surface value to be a `var(--mo-...)`, `color-mix(...)`, or `transparent`
expression, never a raw color.

---

## 9. The renderer (Definition 1)

`render/Node.svelte` is the recursive total function. It: switches on `kind`;
expands `CompoundRef` via the registry then recurses; renders `Vary` from the
root-provided choice map, falling back to its authored default; resolves
`Within` choices into existing algebra inputs (`Density`, `EmphasisClaim`, or a
`Disclosure.open` boolean) without emitting raw CSS; renders a bare `Slot`'s fallback; defensively renders a stray
`ParamRef`; and for every primitive kind looks up the component in
`render/registry.ts` and hands it `{ node, ctx }`. Layout primitives own their
own descent and recurse into `<Node>` with the child ctx. An unknown
`CompoundRef` name renders nothing and emits a dev-mode warning; it never throws
from the renderer.

`MorpheRoot.svelte` is also the Lemma 5 store boundary. It resolves a
`MorpheStore` by `store` prop > inherited context > per-root in-memory default,
then provides that instance synchronously to children. Bound input/overlay
primitives read initial state from their declared `.bind` path and commit
tier-1 changes back to the store; unbound primitives remain purely local.

**Event tiers (Lemma 5's taxonomy, enforced structurally):** tier 0 (hover,
focus, keystroke…) has NO wire type at all — it is unrepresentable outside its
component. Tier 1 commits go through ONE helper, `commitTier1(store, path,
kind, value)` — write + record in a single call, so every commit lands in the
store's bounded recent-event window (`TIER1_WINDOW_SIZE`, FIFO, stamped by the
store's INJECTED clock — pure code never reads `Date.now()`). The
`ContextDigest` (`state/digest.ts`) is the versioned, JSON-round-trippable
snapshot of that tier-1 state plus the bounded recent-event window. Tier 2
(`submit` / `task-transition` / `view-not-working`, `state/events.ts`)
surfaces as a typed callback: `MorpheRoot` accepts `onEscalate?: (record:
Tier2Escalation) => void`, where `record = { event: Tier2Event, digest:
ContextDigest }`, and provides a root-internal event emitter via a context
DISJOINT from the store — input primitives never consume it, so a tier-1 handler
has no escalation capability in scope (architecture-scanned in `store.test.ts`).
The site's native chrome remains out of scope by the native-control-surface
idiom.

`MorpheRoot.svelte` is also the R1.4 declarative-action boundary. It accepts
`actions?: Readonly<Record<string, () => void>>`, provides that map via an
action context, and `Button.svelte` resolves `node.action` at click time:
mapped id → invoke; unmapped id → dev warning and no-op; absent id → native
button behavior only. The authored tree still carries only an opaque action id,
never a handler.

`MorpheRoot.svelte` is also the R2.3 choice boundary. It accepts exactly
`choices?: Readonly<Record<VaryId, number>>` and provides that map via render
context. It does NOT accept an envelope and never sees an epoch; epoch rejection
is already complete before render. With no choices, rendering is byte-identical
to the old `options[default]` path (Corollary 1). Out-of-range choices are
clamped defensively, but should have been rejected by `applyDelta`.

**`Node.svelte` was NOT changed for the overlay family.** Overlays carry their
own `children` and recurse into `<Node>` themselves (exactly as layout primitives
do), and because they render via the platform top layer (`<dialog showModal()>`,
the Popover API, `<details>`) they appear in place with NO portal. The renderer's
`{:else}` branch already dispatches every non-Meta kind through the registry, so
the five new kinds flow through unchanged. No portal/renderer surgery was needed
— that was a design goal, not an accident.

`render/registry.ts` is an EXHAUSTIVE `Record<PrimitiveKind, Component>` — a
missing entry is a compile error. The five new kinds (`button`, `link`, `dialog`,
`popover`, `disclosure`) are now mapped to the action/overlay components.
`PrimitiveProps<N>` is generic over the Node subtype, so each new stub
instantiates it (`PrimitiveProps<Button>`, `PrimitiveProps<Dialog>`, …) with no
change to `props.ts`. Adding a primitive = grammar change + registry entry
(contract owner only).

---

## 10. Build / verify

```bash
bun install
bun run check     # svelte-kit sync && svelte-check  — must be 0 errors, 0 warnings
bun run test      # vitest — law/factory/dialect + primitive-render suites
bun run build     # vite build — client + SSR bundles
bun run dev       # smoke page at / renders a hand-authored tree (the dignity test)
```

Before claiming a primitive done: `bun run check` clean, `bun run test` green, and
your primitive renders in the smoke page (or a story you add). Extend
`core.test.ts` (laws) or `primitives.render.test.ts` (SSR render + a11y) for any
behaviour your work touches — the lemmas ARE the test plan. Primitive render
tests use Svelte's server `render()` (no DOM/jsdom; node env) and assert on the
SSR HTML string; remember open-state `$effect`s (Dialog/Popover) are client-only,
so SSR emits the CLOSED markup — assert what SSR produces.

---

## 11. Strata seams — reserved sockets (READ THIS before "finishing" anything)

Several grammar fields look unfinished if you don't have `VISION.md` in your
head. They are not unfinished — they are **typed sockets reserved for the upper
strata** (the mid loop, the purity contract, the live event wire). The wrong
moves are: wiring them up naively, "completing" them ad hoc, or treating them
as dead weight and proposing their removal. Each has a named owner-phase:

| Seam | Field(s) | Reserved for | Phase |
|---|---|---|---|
| Declarative actions | `Button.action` (an id, no live wire in the grammar) | wired at `MorpheRoot.actions`; the grammar emits intent, not logic | ✔ |
| Binding paths | `Field/Select/Toggle/Range/Dialog/Popover .bind` (store-path strings) | wired to Lemma 5's client store: the tree carries `Binding(store_path)`, never live values | ✔ |
| Variation points | `Vary` / `Within`, keyed by `VaryId`; `Vary.objective` | Lemma 6: the mid loop selects among options or bounded dimensions within an epoch; `objective` is what it optimizes | 2 |
| Dialect compound-gating | `Dialect.compounds[]` (render-gated via `restrictCompounds`) | wired to Lemma 4's compound dialect: a non-empty list restricts expansion; empty = unrestricted | ✔ |
| Dialect personas | `Dialect.persona` | τ_frame bootstrap (deployment/directory; cohort attribution on the site) | 2 |

`src/lib/delegation/envelope.ts` owns the emission envelope
`{ epoch, tree, choices }` and `Delta { id, choice, epoch }`. The epoch is
host-side and pre-render only: `applyDelta(envelope, delta)` checks it first,
rejects stale work, rejects unknown ids and out-of-range choices, and records
accepted choices in the envelope. Rejections return the exact same envelope
object; accepted deltas clone the envelope and choice map without mutating the
tree. Epochs never enter `grammar/` and never reach `MorpheRoot`; the renderer
sees only choices. The mid-loop seam is `MidLoopDelegate.propose(digest,
liveVaryIds): Delta[]`; hosts run those proposals through `applyDelta` and then
re-render with the returned choice map. The substrate ships a dev-only static
choice delegate only to prove the plug-in path; the renderer never imports it.

**One schema, three jobs — done.** The Eidos lift landed: `py/morphe_grammar/models.py`
(Pydantic) is the source of truth; `src/lib/grammar/types.ts` is `@generated by
python -m morphe_grammar.artifacts --write` and carries a header saying so;
`GRAMMAR_VERSION` (`src/lib/grammar/version.ts` / `py/morphe_surface/compile.py`)
is pinned equal by a vitest. `just schema-check` CI-gates the generated TS
against the Pydantic models so the two can never drift silently. Nothing in
`grammar/types.ts` may acquire runtime logic, defaults, or branded-type
machinery: the file stays a pure generated declarative union, hand-edited never.

---

## 12. Known gaps (acknowledged, scheduled — not licenses, not surprises)

No known R0 substrate-integrity gaps remain.
