# Morphe — Phase 0 Core Contract

**This is the single source of truth for everyone building on the Morphe core.**
Every non-foundation agent READS THIS FIRST. The keystone (grammar, tokens,
context algebra, compound factory, dialects, renderer) is locked. You extend it
at the edges the contract names — you do not modify the core.

The proposal (`morphe-design-system-proposal.md`, kept in the sokrates-website
repo) is the *why*; this is the *what* and the *how*. Where they disagree, this
file wins for Phase-0 implementation.

Status: scaffolded, installed, `svelte-check` clean (0 errors, 0 warnings),
13/13 core tests passing.

---

## 0. The one rule for primitive agents

> **A primitive agent edits ONLY its own
> `src/lib/morphe/primitives/<family>/<Name>.svelte` file.**

You do NOT touch: `grammar/types.ts`, `render/registry.ts`, `render/Node.svelte`,
`render/props.ts`, any file under `tokens/`, `context/`, `compounds/`, or
`dialects/`, or `index.ts`. If your primitive needs a new prop, a new token, or a
registry change, that is a **grammar/contract change** and goes through the
contract owner — not a silent edit. Your `$props()` type MUST stay exactly the
`PrimitiveProps<YourNode>` the grammar defines.

The stubs already wire structure (context descent for layout, a11y relationships
for inputs, the discrete/continuous carrier split). Keep that wiring; enrich the
markup and styling inside it.

---

## 1. Stack & house style

- **Svelte 5 runes only.** `$props`, `$state`, `$derived`, `$effect`. No legacy
  `export let`, no stores-as-reactivity, no VDOM patterns.
- **TypeScript strict** (`noUncheckedIndexedAccess`, `verbatimModuleSyntax`).
- **Vite + SvelteKit.** Vitest for tests.
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
src/lib/morphe/
  grammar/types.ts            # the Node discriminated union — LOCKED, declarative only
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
    icelandic-archive.ts      # the DEFAULT dialect
    provider.svelte.ts        # applyDialect / dialectStyle (clamps priors)
  render/
    registry.ts               # NodeKind -> primitive component map — LOCKED
    props.ts                  # PrimitiveProps<N> — the prop contract — LOCKED
    Node.svelte               # the recursive renderer — LOCKED
    MorpheRoot.svelte         # dialect-providing entry point — LOCKED
    index.ts                  # render barrel
  primitives/
    layout/   Stack Grid Cluster Frame Spacer    # AGENTS EDIT THESE
    content/  Text Number Badge Icon Media        # AGENTS EDIT THESE
    input/    Field Select Toggle Range           # AGENTS EDIT THESE
    feedback/ Progress Status InlineAlert         # AGENTS EDIT THESE
  index.ts                    # public library barrel
  core.test.ts                # law + factory + dialect tests (extend, don't gut)
```

Meta primitives (`Slot`, `ParamRef`, `Vary`) have **no .svelte file** — they are
structural and handled by `render/Node.svelte` + `compounds/factory.ts`.

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
type IntentRef      = CoreIntent | (string & {});                   // dialect intents widen
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
Field   { kind:"field";  a11y:InputA11y; inputType?:"text"|"email"|"password"|"number"|"search"|"tel"|"url"; placeholder?:string; bind?:string; hint?:string; error?:string }
Select  { kind:"select"; a11y:InputA11y; options:{value:string;label:string;disabled?:boolean}[]; bind?:string; hint?:string; error?:string }
Toggle  { kind:"toggle"; a11y:InputA11y; bind?:string; hint?:string }
Range   { kind:"range";  a11y:InputA11y; min:number; max:number; step?:number; bind?:string; hint?:string }
```

### Feedback (functional color never the only signal)

```ts
Progress    { kind:"progress";     value?:number; label:string; intent?:IntentRef }   // label required
Status      { kind:"status";       tone:"success"|"caution"|"info"|"neutral"; signal:StatusSignal }
InlineAlert { kind:"inline-alert"; tone:"success"|"caution"|"info"; title:string; detail?:string; live?:"polite"|"assertive" }
```

### Meta (no .svelte files — structural)

```ts
Slot     { kind:"slot";      name:string; fallback?:Node[] }
ParamRef { kind:"param-ref"; param:string }
Vary     { kind:"vary";      id:string; options:Node[]; default?:number; objective?:"salience"|"density"|"compactness" }
```

### Compound reference

```ts
CompoundRef { kind:"compound"; name:string; args:Record<string,unknown>; slots?:Record<string,Node[]> }
```

`type Node = Layout | Content | Input | Feedback | Meta | CompoundRef`, discriminated by `kind`.
`assertNever(x)` is the exhaustiveness helper for `switch` defaults.

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

registry.register(def): { ok:true; name } | { ok:false; name; errors:string[] }   // never throws
registry.expand(ref:CompoundRef): Node                                            // hygienic expansion
registry.has(name) / registry.get(name) / registry.names
childrenOf(node): readonly Node[]    // the single source of truth for a node's children
```

**Registration gate** (a failing compound is NOT added — render stays total):
1. expand with schema-default args,
2. type-check the expansion against the grammar (every leaf a known kind, no
   leaked `ParamRef`),
3. acyclicity of compound references (DFS),
4. depth bound (`MAX_EXPANSION_DEPTH = 16`).

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
  `--mo-type-1..8`, `--mo-radius-0..full`, `--mo-elev-0..4`, neutral
  `--mo-neutral-0..11`, chromatic `--mo-amber-* / --mo-blue-* / --mo-green-* /
  --mo-red-*`, fonts `--mo-font-display / -body / -mono`. **No vertical
  vocabulary here** — this is the legacy's fatal mistake, not repeated.
- **intents.ts** — `intentVar(intent, channel)` → `--mo-intent-<intent>-<channel>`;
  channels are `surface | on | hover | border | ring`. `CORE_INTENTS` is the
  iterable list. `SURFACE_VARS` names the non-intent surface vars.
- **intents.css** — the DEFAULT dialect: core intents mapped onto scales under
  `:root, [data-mo-dialect="icelandic-archive"]`. A dialect re-theme is a remap
  of this block scoped by `[data-mo-dialect="…"]`.
- **slots.ts** — `slot(intent, channel, fallback?)` returns a `var(--…)` string;
  `SLOTS.field.*`, `SLOTS.action.*`, `SLOTS.feedback.*` are named bindings;
  `toneIntent(tone)` maps a feedback tone to its intent.

**Core intents** (vertical-neutral): `primary-action` (the amber beacon, used
sparingly), `neutral`, `provenance` (lineage/citation blue), `evidence` (the
document register), `accession` (the catalog accent), `caution`, `success`,
`info`. A dialect EXTENDS this set with vertical discourse roles; it never
renames the core set.

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
  `Badge` may add a shape `icon`; `Progress` requires a `label`.
- Keep focus-visible rings on interactive primitives.

---

## 8. Dialects (Lemma 4)

```ts
interface Dialect {
  id:string; label:string; persona?:{vertical:string; role?:string};
  intents: Record<string, Partial<Record<IntentChannel,string>>>;  // values MUST be var(--mo-…scale…), never hex
  priors: { rootDensity?:Density; rootScaleTier?:ScaleTier; rootBudget?:number };
  compounds: string[];                                             // Phase 1 wires the registry
}
applyDialect(d): { attr, rootContext, vars }   // clamps priors; builds CSS var overrides
dialectStyle(applied): string                  // inline style for the overrides
```

`MorpheRoot.svelte` is the τ_frame injection point: it `applyDialect`s, sets the
`data-mo-dialect` attribute (selecting the intent block), spreads any intent
overrides as CSS vars, seeds the root context, and renders the tree via `<Node>`.
The default is `icelandic-archive`. Priors are clamped (budget 1..6, scaleTier
2..4) so Lemma 2's laws survive any dialect.

---

## 9. The renderer (Definition 1)

`render/Node.svelte` is the recursive total function. It: switches on `kind`;
expands `CompoundRef` via the registry then recurses; renders `Vary`'s default
option; renders a bare `Slot`'s fallback; defensively renders a stray
`ParamRef`; and for every primitive kind looks up the component in
`render/registry.ts` and hands it `{ node, ctx }`. Layout primitives own their
own descent and recurse into `<Node>` with the child ctx.

`render/registry.ts` is an EXHAUSTIVE `Record<PrimitiveKind, Component>` — a
missing entry is a compile error. Adding a primitive = grammar change + registry
entry (contract owner only).

---

## 10. Build / verify

```bash
pnpm install
pnpm check     # svelte-kit sync && svelte-check  — must be 0 errors, 0 warnings
pnpm test      # vitest — the law/factory/dialect tests
pnpm dev       # smoke page at / renders a hand-authored tree (the dignity test)
```

Before claiming a primitive done: `pnpm check` clean, `pnpm test` green, and your
primitive renders in the smoke page (or a story you add). Extend `core.test.ts`
with property tests for any law your work touches — the lemmas ARE the test plan.
