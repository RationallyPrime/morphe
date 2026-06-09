# Morphe — A Design System for Stratified Adaptive UI

*Proposal v0.6 — June 2026. Repo-canonical.*

> **Provenance.** v0.3 (the seven-lemma tower) is the draft the implementation
> followed; v0.5 (a five-lemma recentering on closure and the context algebra)
> sharpened several statements but cut the persona stratum and venue lemma to
> stand company-independent. This v0.6 reconciles them: the full tower of v0.3 —
> whose lemma numbering the code and `CONTRACT.md` already use — with v0.5's
> algebraic formulations folded in, plus a status ledger (§15) tying every
> mechanism to its implementation state. This file is the **why**; `CONTRACT.md`
> is the **what and how** for the shipped Phase-0 substrate. Where they disagree
> on implementation detail, `CONTRACT.md` wins; where the question is "what is
> Morphe ultimately for," this file wins.

---

## 0. Introduction

A frontier agent emitting typed component trees is the given in this
architecture. The question is whether a server-driven rendering substrate can
support context-aware adaptation — adaptation, ultimately, to *who is looking*:
a hospitality CFO and a pharmaceutical CTO should receive different interfaces
from the same system. The answer, established below, is yes at every timescale
from frame rate to account lifetime, provided the system is built as a tower of
typed envelopes.

The result, informally: **adaptation authority is stratified by timescale, and
each stratum's output is the next stratum's constraint envelope.** The rest of
this document is the working-out of that sentence, in theorem-paper form. The
form is load-bearing, not a costume: it imposes the dependency discipline that
nothing is used before it is defined, every assumption is explicit and scoped,
and the main result is assembled rather than asserted. The proofs are
engineering proofs — arguments whose obligations compile to property tests and
are discharged continuously in CI (§13).

A second reading of the same document, for the algebraically minded: a
component system is an algebra. Its generators are a finite set of primitive
component types shipped as code; its one operation is composition. Everything a
design system does on top of that is either extending the operation's reach
without adding generators (**closure**, Lemma 1), or constraining how the
operation behaves so composition is well-mannered rather than arbitrary
(**calm**, Lemma 2). Given closure and calm, an agent that emits typed trees
yields a context-aware adaptive UI in which every adaptation is either a term
in the algebra or a bounded movement within an authorized subterm — never an
escape from it.

**Nomenclature.** *Morphe* (μορφή) — Aristotle's form-as-shape, the correlate
of *hyle* in hylomorphism. Hyle compiles matter; Eidos holds the intelligible
structure; Morphe is structure made perceivable — form in matter, which is what
a rendered UI is. The Plato/Aristotle split even maps: Eidos the transcendent
form (the graph), Morphe the immanent one (the screen). In the monorepo's
dependency lattice Morphe is **Projection M of Eidos** — the perceivable
projection, beside Projection A (relational) and Projection B (executable); see
`MIGRATION.md`. Icelandic alternative under consideration: *Mót* (mold/form).

---

## 1. Definitions

**Definition 1 (Substrate).** A *server-driven UI substrate* is a pair
(P, render): a finite set P of primitive component types shipped as frontend
code, and a total function render from valid trees to views.

**Definition 2 (Grammar; tree).** A *grammar* G over P assigns each primitive a
typed schema and a composition rule (which children it admits, recursively).
Tree(G) is the set of schema-valid trees. For now G is *flat*: its vocabulary
is exactly P. (Lemma 1 extends this.)

**Definition 3 (Adaptation; context).** The *context* κ is the typed tuple
(persona, task state, interaction state, data shape), where *persona* is the
pair (vertical, role) of the person at the screen — hospitality CFO,
pharmaceutical CTO. An *adaptation* is a view change conditioned on κ; a system
is *context-aware* iff its displayed view is a function of κ rather than of a
fixed route table.

**Definition 4 (Timescale strata).** Adaptations are classified by the latency
bound the experience demands of them — and dually, by how long their effects
should persist. Volatility decreases monotonically up the table; the top
stratum is deliberately the most hysteretic:

| Stratum | Bound / persistence | Adaptation class |
|---|---|---|
| τ_frame | session–lifetime | which dialect governs the account: vocabulary, discourse, priors |
| τ_slow | ≥ 1 s | which view should exist at all |
| τ_mid | 50–300 ms | recomposition, salience shifts, anticipation |
| τ_fast | < 16 ms | local reactivity, structural flex during interaction |

**Definition 5 (Authority; envelope).** The *authority* of an actor is the set
of view transitions it can cause. An *envelope* is a typed object emitted by
one actor that delimits the authority of another. Envelopes will form a chain
ordered by stratum.

**Definition 6 (Purity).** The decision actor is *pure* iff its emission is a
function of a single typed input — no interleaved interaction, no hidden state.
Purity is what makes a model-driven loop replayable, testable, and cacheable.

---

## 2. Assumptions

**A1 (Agent).** A frontier agent exists that emits Tree(G) as structured output
(pydantic-ai). Its judgment quality is not at issue in this document; its
outputs are.

**A2 (Agent latency floor).** Agent emission latency lies in τ_slow. This is
economics and physics jointly: the agent is not in a frame loop and never will
be.

**A3 (Code boundary).** P changes only by shipping frontend code. Primitives
are where browser capability lives; this boundary is real.

**A4 (Constrained decoding).** Any model emitting into the system can have its
decoder masked by a JSON Schema, so emissions are well-formed against that
schema by construction, not by retry. Note the generality: *any* schema — the
full grammar's or a restriction of it. Lemma 4 uses this.

**A5 (Deployment — scoped).** The inference appliance sits on the customer's
LAN at 1–5 ms, and the appliance is joined to the customer's identity
infrastructure (directory/SSO). Sókrates ships as a box in the building; this
assumption is our product shape. Latency is used only in Lemma 7; identity only
in Lemma 4. Every other result is deployment-independent.

---

## 3. The Two Obstructions

**Obstruction O1 (Closed catalog).** Under A3 with a flat grammar, the
vocabulary equals P; any reusable pattern not in P requires shipping code.
"Adaptive" is then bounded by enumeration — the catalog is the ceiling. (Watch
this obstruction: it recurs at a higher stratum, and the same move kills it
both times.)

**Obstruction O2 (Stratum starvation).** Under A2, any adaptation routed
through the agent has latency ≥ τ_slow. If the agent is the only adaptive actor
— the classical SDUI architecture, where every change is a server round-trip —
then no adaptation class in τ_fast or τ_mid is served, and nothing at all
serves τ_frame, which is not a latency class the agent can even perceive:
persona does not change between requests. Three of the four strata starve.

**Roadmap.** In the spirit of obstruction theory: seven lemmas, each killing an
obstruction class or populating a starved stratum, after which the theorem
assembles. The build order is bottom-up — structure (L1), layout (L2),
appearance (L3), identity (L4), dynamics (L5), delegation (L6), deployment
(L7) — while the authority chain reads top-down: the dialect of Lemma 4 is
constructed midway but sits outermost. Nothing forward-references.

---

## 4. Lemma 1 (Generativity) — the two-level grammar

*Local definitions.* A *compound* is a definition over primitives, expressed as
data:

```python
class CompoundDef(BaseModel):
    name: str
    version: SemVer
    params: JsonSchemaObject        # the compound's own props schema
    template: Node                  # tree of primitives; ParamRef/Slot leaves
    grammar_version: SemVer

class CompoundRef(BaseModel):
    kind: Literal["compound"] = "compound"
    name: str
    args: dict[str, Any]            # validated against CompoundDef.params
    slots: dict[str, list[Node]] = {}
```

*Expansion* is hygienic macro expansion: ParamRef resolves only against the
compound's own params; Slot fills from the call site. *Registration-time
validation*: expand the template with schema-default args, type-check the
result against G, check acyclicity of compound references, enforce a depth
bound.

**Lemma 1 (Generativity / closure under composition).** Let G⁺ extend G with
compounds-as-data. Then (i) expansion is total and terminating on G⁺, landing
in Tree(G), so render remains total; (ii) compounds compose — a template may
reference other compounds — so the set of definable compounds is closed under
composition; (iii) the expressible vocabulary is unbounded over finite, fixed P.

*Proof sketch.* Acyclicity plus the depth bound make expansion well-founded,
hence terminating; each step substitutes admissible children, preserving
schema-validity, so the normal form lies in Tree(G) and render — total there —
stays total. Closure under composition is immediate from (i). Unboundedness:
composition has no fixed point short of the depth bound, and the bound is a
parameter, not a ceiling on distinct terms. ∎

Algebraically: primitives are the generators and composition the operation;
compounds are *derived operators*, definable as terms over the generators, and
Lemma 1 says the carrier Tree(G) is closed under those derived operators —
adding them buys vocabulary, not capability. This dissolves O1 by *scoping* it:
capability stays closed at P — correctly, that is where the browser lives —
while composition opens. It is my `createCompoundComponent` factory lifted from
code level to data level: a compound was a function there; here it is a
validated datum, mintable at runtime with no shipped code.

I considered the two weaker constructions first: the enumerative catalog (a) is
O1 itself; a flat compositional grammar (b) moves the ceiling but forces every
reusable pattern to be re-derived per emission, bloating agent output and
inviting drift between instances of what should be one thing. (c), compounds as
validated data, is the choice.

Three producers mint compounds through one pipeline: the design team (curated
core), the agent (proposing a compound when it notices itself re-emitting the
same subtree; proposals land as `candidate` until promoted), and application
code. All three pass the same validation gate.

*Primitives.* Twenty-two shipped kinds, factored by compositional role, not
widget taxonomy: **Layout** (`Stack`, `Grid`, `Cluster`, `Frame`, `Spacer` —
pure positioning, the carriers of composition context, with `Frame` as a
context reset, the analogue of a new stacking context); **Content** (`Text`,
`Number`, `Badge`, `Icon`, `Media`); **Input** (`Field`, `Select`, `Toggle`,
`Range` — the stateful providers of Lemma 5); **Feedback** (`Progress`,
`Status`, `InlineAlert`); **Action** (`Button`, `Link` — real `<button>`/`<a>`,
because the affordance's keyboard/focus/activation/navigation semantics *are*
platform capability; a clickable `<div>` is forbidden, and Button *does*
something while Link *goes* somewhere — neither polymorphic into the other);
**Overlay** (`Dialog`, `Popover`, `Disclosure` — the platform top layer: native
`<dialog>`+`showModal()`, the Popover API + CSS Anchor Positioning, and
`<details>`/`<summary>`, so the genuine capability lives in the platform rather
than in portal-and-z-index surgery); **Meta** (`Slot`, `ParamRef`, `Vary` — the
last defined in Lemma 6). The three input primitives also carry *mode
extensions* — capabilities of the same primitive, not new kinds, so every tree
authored before they existed stays valid: `Field.multiline` (a `<textarea>`
substrate), `Toggle.variant:"checkbox"` (with the indeterminate tri-state),
`Select.variant:"radiogroup"` (a roving fieldset of radios). Every primitive
carries its accessibility semantics as required fields — an `Input` without a
label relationship is not a valid instance, so an inaccessible tree is
unrepresentable rather than discouraged.

**Remark (one schema, three jobs).** The grammar's JSON Schema is simultaneously
the runtime validator (Pydantic), the TypeScript codegen source (the
matched-interfaces property maintained mechanically rather than by hand), and —
via A4 — the constrained-decoding mask for every model in the system. One
artifact, three consumers: the Hyle move applied to UI. *(Status: the Phase-0
implementation is TS-first — one schema, one consumer — with the Pydantic lift
designed to be mechanical; see §15 and `MIGRATION.md`.)*

---

## 5. Lemma 2 (Calm) — the context algebra

*Local definitions.* A *context* is a small record propagated down the tree,

```
C = (depth, density ∈ {compact, regular, spacious}, scale_tier, emphasis_budget B, surface)
```

and the *algebra* is a family of transforms C_child = f(C_parent, role_child),
one per layout role. The transforms belong to the design system, are versioned
with it, and are identical whether a human or a model authored the tree. The
agent never specifies pixels; it emits roles and priorities, and the algebra
compiles intent into space.

Context resolution is a *downward accumulation* over the composition tree: the
root context is given, and each node's context is f(parent context, own role).
The four laws are properties of that accumulation.

**Lemma 2.** The algebra satisfies four laws, by construction of the transform
family and enforced as properties:

- **Locality** — a node's resolved context is a function of (C_parent, own
  role) only; equivalently, context resolution *is* a downward accumulation,
  with no horizontal (sibling) dependence.
- **Stability** — inserting a sibling changes a node's resolved tiers only if
  an enumerated threshold rule fires; the resolution map is piecewise-constant
  in the discrete tiers, with discontinuities enumerated.
- **Monotone depth** — scale_tier is non-increasing along any root-to-leaf path
  until a `Frame` resets context; the transform family is monotone in that
  component, and `Frame` is the accumulation's reset element.
- **Budget conservation** — at each node, child emphasis *claims* are projected
  onto a capped simplex of total ≤ B before rendering; rendered emphasis sums
  to ≤ B regardless of claims.

Consequently agent emissions are geometry-free and re-emission-stable
(re-emissions cannot thrash layout they never specified), and structural
adaptation executes inside τ_fast.

*Proof of the latency claim, by construction.* I considered three propagation
mechanisms. Pure CSS custom properties: the cascade is a free, frame-rate
context engine, but CSS cannot express the discrete decisions (tier demotion on
a child-count threshold needs counting and branching). Pure framework context:
fully expressive, but every structural flex pays a JS render. The hybrid is the
only candidate meeting both requirements, and is the choice: framework context
carries *only* the discrete tier decisions, which are rare and structural; each
decision sets CSS custom properties at its boundary (`--mo-ctx-space`,
`--mo-ctx-type`, `--mo-ctx-surface`); all continuous values resolve in CSS;
container queries handle the flexes the browser can see for itself (a `Stack`
with `direction: auto` flips axis with no JS in the loop). Discrete in
framework context, continuous in the cascade, browser-visible in container
queries — that is a genuinely 60fps loop. ∎

**Remark (the emphasis budget).** Budget conservation is the defensive
invariant that makes model-emitted UI calm. Children *claim* priority; the
algebra *renders* emphasis by normalizing claims against B, with a hard cap on
simultaneous top-tier emphasis. An agent that marks everything `priority: high`
gets a renormalized, legible view — not a wall of bold. The model expresses
preference; the design system enforces taste. Unmarked content rides free at
the `normal` baseline: the law exists to cap loud claims, never to quiet plain
prose below the contrast floor, and a long list of unmarked children must not
starve a real claim.

**Remark (what this formalizes).** Monotone depth and budget conservation
together make precise the rule from my earlier design system that spacing
derives hierarchically from a component's position in the atomic hierarchy:
position (depth and role) determines context, context determines space, and the
node never names a pixel. Composition context is then not a convenience layer
but the carrier of the entire τ_fast structural story.

---

## 6. Lemma 3 (Invariance) — intent tokens

*Local definitions.* Three token layers: **scales** (raw ramps: space, type,
color, radius, elevation — referenced by no one directly); **intents**
(domain-semantic names mapped onto scales per theme — in my earlier
legal-domain system: judicial-crimson, citation-blue, amendment-gold); **slots**
(component-facing assignments, e.g. `field.border.error → intent.caution`). The
agent's vocabulary touches the intent layer only. A small **core intent set**
(caution, success, primary-action, …) is universal; Lemma 4 extends it per
vertical.

**Lemma 3.** Agent emissions are fixed points under retheming: dark mode, a
client's brand, a density preference are remappings of the intent layer, under
which nothing the agent ever emitted changes. ∎

The model's vocabulary and the design's evolution are decoupled by
construction. (Corollary 2 cashes this in: the training corpus cannot go stale
for cosmetic reasons.)

---

## 7. Lemma 4 (Dialects) — the persona stratum

This is the lemma the system exists for: the mechanism by which a hospitality
CFO and a pharmaceutical CTO receive different interfaces from the same
grammar, the same agent, the same appliance.

*Local definitions.* A **persona** is the typed pair (vertical, role), refined
along the scope lattice vertical ⊒ organization ⊒ role ⊒ individual. A
**dialect** D is a typed, validated artifact with three parts:

- a **compound dialect** — a subset of the registry plus dialect-specific
  compounds (a CFO's dialect favors revenue waterfalls and comp-set
  comparisons; a pharma CTO's favors pipeline stage boards and batch
  genealogy);
- an **intent dialect** — an extension of the core intent set with the
  vertical's discourse roles (season-peak, comp-set vs. compliance-hold,
  batch-release, adverse-event), each mapped onto the same scales;
- **algebra priors** — a root context and bounded adjustments to the transform
  family's parameters (a CFO prior: numbers-dense, comparison-forward; a CTO
  prior: exception-forward, status-led).

*Refinement* down the scope lattice may only narrow the compound dialect,
extend intents, and adjust priors within the design system's bounds — never
escape the parent dialect.

**Lemma 4.** For any valid dialect D, the restricted grammar G|D is itself a
valid grammar: render stays total (D's compounds passed Lemma 1's gate; its
primitives are P), and Lemma 2's laws are preserved (priors are bounded by
construction). Masking the agent's decoder with G|D's schema — A4 in its
general form — confines agent emissions to the dialect *by construction*.
Monotone refinement keeps the envelope chain a chain. ∎

**Remark (closure under restriction).** Lemma 4 is Lemma 1's algebraic
companion: the grammar is closed under composition *and* under restriction.
Any validated sub-grammar G|D is itself a valid grammar — the same gate, the
same renderer, the same laws. The two closures together are why the whole
tower is one mechanism, not a stack of features.

**Remark (O1 recurs, and dies the same death).** The naive implementation of
persona-adaptive UI is N verticals × M roles of hand-built frontends — the
enumerative catalog, one stratum up. Dialects-as-data is the identical
dissolution to Lemma 1: capability closed (one grammar, one renderer),
composition open (a new vertical is a new data artifact, eventually a derived
one). The system is self-similar across strata, and that self-similarity is not
decorative — it means the validation machinery, the registry, and the
decoder-masking mechanism are each built once and used twice.

**Remark (cold start is product shape).** How does the system know the persona?
For us this is given, not inferred: the appliance's deployment fixes the
organization and hence the vertical (a box installed at a pharma distributor is
in pharma), and the customer's directory — which the appliance is already
joined to (A5) — supplies the role. Inference is needed only for *refinement*,
never for bootstrap.

**Remark (the marketing instantiation).** The Sókrates site instantiates the
frame stratum today, for visitor cohorts rather than directory-supplied roles:
ad-click attribution (campaign taxonomy, geo, device — deterministic URL
parameters, consent-clean) selects the dialect at the `MorpheRoot` boundary,
and the same authored marketing tree re-poses itself per cohort. Palette
differentiation is shipped (three dialects pulled apart at the beacon), and so
is the `?cohort=` arrival wiring (a valid landing param selects the dialect
once, on arrival; an explicit toggle always wins afterward). Per-cohort copy is
the remaining named next step (`DESIGN.md` §9).

**Remark (stability is a feature at this stratum).** The frame loop is
deliberately the most hysteretic actor in the system. A CFO whose dashboard
rearranges itself nightly will not thank us. Durable changes ride an escalation
of permanence: the mid loop demotes an ignored panel *within an epoch* (Lemma
6); only when that demotion recurs across sessions does an offline batch
process bake it into the dialect's priors — same signal, increasing permanence
by stratum, with the slowest stratum changing rarest and most deliberately.

**Remark (scope of Lemma 3).** Invariance is per-dialect: rebranding within a
vertical changes nothing the agent emitted. Changing dialect is *supposed* to
change emissions — that is the point.

---

## 8. Lemma 5 (Purity) — state ownership and the escalation contract

*Local definitions.* Components fully own local state — the end-state of my
original system, here promoted to the wire contract. The tree carries
`Binding(store_path, initial, tier)`, never live values. Events are stratified:

| Tier | Examples | Destination |
|---|---|---|
| **0** | hover, focus, keystroke, scroll, drag | never leaves the component |
| **1** | selection, filter edit, expand/collapse, sort | client store; may wake the mid loop |
| **2** | submit, task transition, explicit "this view isn't working" affordance | escalates to the agent as a typed event |

The *digest* is a typed snapshot of tier-1 state plus a short recent-event
window — not a live stream.

**Lemma 5.** With component-owned state and tiered escalation, the decision
actor is pure (Def. 6): its emission is a function of the typed triple
(task_state, tier-2 event, ContextDigest) — evaluated, by Lemma 4, under the
account's dialect. Moreover tier-0 ownership serves the reactive half of τ_fast
— Lemma 2 served the structural half, so between them the fast stratum is fully
populated with no model in any frame loop. ∎

*Dividends of purity*, immediate: deterministic replay for debugging; snapshot
tests of agent emissions against recorded digests (slotting directly into our
near-1:1 test discipline); and response caching, which Corollary 3 develops
into speculative prefetch. Typed in, typed out: the whole decision loop is
schema end to end.

---

## 9. Lemma 6 (Bounded delegation) — variation points

*Local definitions.* The slow loop authorizes the mid loop through typed
variation points embedded in its emission:

```python
class Vary(BaseModel):
    kind: Literal["vary"] = "vary"
    id: VaryId
    options: list[Node]            # alternatives, slow-loop authored
    default: int = 0
    objective: SalienceHint | None = None   # what the mid loop optimizes

class Within(BaseModel):           # continuous analogue, e.g. density nudges
    kind: Literal["within"] = "within"
    id: VaryId
    dimension: Literal["density", "emphasis", "collapse"]
    range: tuple[int, int]
    default: int
```

Each slow-loop tree carries an *epoch*; a mid-loop *delta* is a (VaryId,
choice) pair tagged with the epoch it was computed against.

**Lemma 6.** Mid-loop authority is contained in the slow-loop-authorized
variation space: a delta addressing no live VaryId, or carrying a stale epoch,
is rejected at the type level; a re-emission cleanly invalidates in-flight
mid-loop work. With A4, mid-loop emissions are additionally well-formed by
construction. ∎

The envelope of Definition 5 is here made concrete and machine-checked:
frontier decides, edge adjusts, components react — and the type system is the
enforcement, not a convention. Note the validity/quality separation A4 buys:
the constraint guarantees well-formedness from day one, so the mid loop can
ship before any fine-tuning exists; tuning then improves only quality.

*What the mid loop concretely does:* selects within variation points; salience
re-ranking against the tier-1 digest within emphasis budgets (a panel the user
keeps ignoring gets density-demoted — and, per Lemma 4, demotions that recur
across sessions graduate into dialect priors); speculative prefetch (predicts
the next tier-2 event and warms the slow loop's cache); input assistance —
prefill and inline error explanation, the natural sweet spot of nano-class
models.

---

## 10. Lemma 7 (Feasibility) — venue

**Lemma 7.** Under A5, the mid loop meets its τ_mid bound for every client
device, including thin ones, with zero distribution cost.

*Proof sketch.* 1–5 ms of LAN to a co-resident grammar-tuned small model — or a
LoRA fast path on the resident model — leaves the entire 50–300 ms window for
inference; one place to update the model; nothing shipped to browsers. ∎

This is the only lemma that touches A5's latency clause, and the product shape
settles what would otherwise be a hard call. I considered three venues. **(a)
Chrome built-in AI:** the open question — third-party LoRA adapters on Gemini
Nano — remains open as of this writing. The substrate has matured in the right
direction (LiteRT-LM is architected for shared-foundation-model-plus-LoRA;
Android's AICore lets app developers train adapters), but the Chrome *web
platform* path for our own adapter is still gated on Google's roadmap; the
Prompt API with schema-constrained output works today, custom specialization
does not. **(b) In-browser model under our control** (0.5–2B over WebGPU,
LoRA-tunable, A4-constrained): fully ours, but costs a substantial download,
device-performance variance, and an engineering surface we don't otherwise
need. **(c) Appliance-resident is primary**; (a) then (b) become progressive
enhancements for off-LAN users; with neither available, the system degrades to
slow loop plus fast loop and remains fully functional (Corollary 1).

---

## 11. Theorem (Stratified Adaptive Sufficiency)

**Theorem.** Under A1–A4 (and A5 for the persona bootstrap and the mid
stratum), the system serves every adaptation class in its native stratum —
including adaptation to the persona of the viewer — dissolves O1 at both strata
where it arises and O2 at all three starved strata, and maintains the typed
authority chain

> Grammar ⊇ dialect ⊇ agent emission space ⊇ epoch's variation space ⊇ mid-loop deltas,

with component reactivity precompiled inside the innermost envelope, and the
frontier agent pure.

*Proof.* O1 falls to Lemma 1 at the view stratum and to Lemma 4 at the persona
stratum. The frame stratum is populated by Lemma 4 (deployment and directory
bootstrap the dialect; offline refinement evolves it); the fast stratum
structurally by Lemma 2 and reactively by Lemma 5's tier-0 ownership; the mid
stratum has its mechanism from Lemma 6 and its feasibility from Lemma 7; the
slow stratum is A1 made well-defined by Lemma 5's purity. The chain's
inclusions are each enforced: Grammar ⊇ dialect by Lemma 4's validity gate;
dialect ⊇ agent emissions by A4 masking the agent's decoder with G|D; the
variation inclusion by Lemma 6's VaryId addressing and epochs; the innermost by
construction, since the design system precompiles what components may do
(Lemmas 2 and 5). Authority flows down as progressively tighter envelopes;
information flows up as progressively coarser tiers — and, across sessions,
accumulates into the dialect (Lemma 4). No stratum can exceed its envelope,
which is what makes the system safe to let models drive. ∎

Read back informally, the theorem is the opening sentence: adaptation authority
is stratified by timescale, and each stratum's output is the next stratum's
constraint envelope. The classical SDUI architecture routes everything through
one row; Morphe gives each kind of adaptation its native stratum:

| Loop | Stratum | Authority | Mechanism | Transport |
|---|---|---|---|---|
| **Frame** | τ_frame | which dialect governs: vocabulary, discourse, priors | deployment + directory bootstrap; offline refinement from logs | out-of-band |
| **Decision** | τ_slow | which view exists; variation envelopes | frontier agent → typed tree (pydantic-ai), masked by G\|D | server round-trip |
| **Recomposition** | τ_mid | choice within variation points; salience; prefetch | grammar-constrained small model | LAN to appliance / in-browser enhancement |
| **Interaction** | τ_fast | local reactivity; structural flex | context algebra + component-owned state | none — precompiled |

---

## 12. Corollaries

**Corollary 1 (Monotone degradation).** Deleting strata from the top preserves
function. No frame loop: a single default dialect, and the three lower strata
stand unchanged. No mid loop: slow plus fast remains a complete adaptive
system. No agent: hand-authored trees render through the same grammar, algebra,
and tokens — Morphe must stand as a good design system before any model touches
it, and a human authoring trees by hand should find it pleasant.
Machine-speakability is a property it has because it is typed data, not its
excuse for existing. (This is Phase 0's exit criterion — the dignity test.)

**Corollary 2 (The corpus bootstraps itself).** By Lemma 5's purity, operation
logs are exactly (ContextDigest → tree) pairs from the slow loop and (digest,
vary-state → chosen delta) pairs from the mid loop — a training set as a
byproduct of running the system, not a labeling project. The same logs,
aggregated per account, are the evidence stream for dialect refinement (Lemma
4). By Lemma 3's invariance, none of it goes cosmetically stale.

**Corollary 3 (Zero perceived latency on the common path).** Purity makes
slow-loop responses cacheable (L5); variation points make the prediction target
well-defined (L6); the mid loop exists to predict it (L7). Composing the three:
the mid loop pre-asks the slow loop for the likely next view, and the
common-path tier-2 transition lands instantly. The strata don't just coexist;
they compound.

---

## 13. Construction Notes

**Renderer, and FastUI's place.** FastUI's load-bearing idea — matched Pydantic
models and TypeScript interfaces, validated at build time by TypeScript and
pyright/mypy and at runtime by Pydantic — is the pattern Morphe keeps. The
project itself is prior art, not a dependency: it remains on hold, used
internally for Logfire's admin interface, bugfix-only. Its author's two stated
pain points are answered structurally here: the fast loop removes the pressure
that made him want SSR, and compounds-as-data replace the generic-union
gymnastics that slowed arbitrary components. So: a fresh renderer, small by
design — discriminated-union decoder, primitive switch, compound expander,
context engine — with the TS types eventually *generated* from the grammar
schema rather than hand-matched.

**Verification — the lemmas are the test plan.** Every proof obligation above
compiles to a property: Lemma 1 — golden expansion snapshots per compound;
fuzzing that any schema-valid tree renders. Lemma 2 — the four laws as property
tests over fuzzed trees. Lemma 4 — fuzzed dialects preserve render totality and
the algebra laws; refinement monotonicity checked at registration. Lemma 5 —
recorded-digest replay with snapshot trees. Lemma 6 — adversarially fuzzed
deltas type-rejected unless addressing a live VaryId in the current epoch.
Architecture tests close the loop: primitives import nothing above them; the
compound registry is acyclic; no component reads the client store outside its
bindings. The document's logical structure *is* the verification plan,
discharged continuously. Cross-lemma obligations count too: the Lemma-2 laws
must *commute with* Lemma-1 expansion (renormalization invariant under wrapping
a child in a single-node compound) — see open problem 8.

**Phasing — construction order follows lemma dependency.** Each phase ships
something usable; Corollary 1 guarantees graceful degradation throughout.
**Phase 0** (Definitions + L1's primitives + L2 + L3 + dialect v0): the
primitives, context algebra v1, three-layer tokens, renderer skeleton, two-plus
hand-authored dialects, intents-and-priors only. Exit criterion: the dignity
test. **Shipped — see §15.** **Phase 1** (L1's compounds at runtime + L5):
minting pipeline, registry with candidate/promoted lifecycle, compound
dialects, escalation tiers, client store, ContextDigest, snapshot/replay
harness. **Phase 2** (L6 + L7): variation points live, grammar-constrained
decoding against the resident model — no LoRA yet; A4 alone suffices for
well-formedness — speculative prefetch, salience re-ranking. **Phase 3**
(quality): LoRA fine-tune from accumulated logs (Corollary 2), dialect
refinement from per-account evidence, Chrome built-in AI path for off-LAN users
where available, agent-proposed compounds promoted into the curated set.

---

## 14. Conjectures and Open Problems

1. **Compound versioning across grammar evolution** — the registry pins
   `grammar_version`; is expansion pinned-forever or migrated? Leaning: pinned
   with explicit migration tooling, mirroring how Hyle treats schema versions.
2. **Delta semantics under concurrent re-emission** — epochs settle validity;
   the conflict *policy* when a tier-2 event fires mid-prefetch (discard vs.
   merge speculative work) needs a decision after Phase 2 telemetry exists.
3. **Digest shape** — snapshot plus recent-event window is the lean default;
   whether any view class needs event-sourced digests is an empirical question.
4. **Corpus curation** — logs give pairs; the quality filter (which slow-loop
   emissions are exemplary enough to train on) needs a rubric, probably tied to
   tier-2 "this view isn't working" signals as negative labels.
5. **Variation-point authoring ergonomics** — does the agent place `Vary` nodes
   well unprompted, or does the system prompt need a budget ("authorize 2–4
   variation points per view")? A Phase 2 question.
6. **Dialect refinement policy** — what evidence threshold promotes a recurring
   per-account signal into a durable prior, and how far down the scope lattice
   to go: individual-scope dialects trade adaptation against the consistency a
   daily user relies on, and may warrant explicit acknowledgment ("your
   overview now leads with exceptions — keep?") rather than silent drift.
7. **Expressive completeness of the context algebra** — Lemma 1 makes the
   *vocabulary* unbounded; this asks whether the *context algebra* is
   expressively complete: is there a layout intent that arises in practice but
   that no local, stable, depth-monotone, budget-conserving downward
   accumulation can produce? If one exists, what is the minimal extension — a
   new context component, a fifth law — that restores it without breaking Calm?
8. **Claim hygiene across compound boundaries — resolved in Phase 0** — the
   budget law runs over a container's *immediate* children, so Lemma 2's law 4
   must commute with Lemma 1's expansion. The shipped fix is hygienic: the call
   site claims on behalf of the expansion (`CompoundRef.emphasis`), template
   roots are rejected if they carry their own claim, and `Vary` inherits the
   clamped default option's claim until Lemma 6's live deltas land.

---

## 15. Status Ledger (what is real today)

The implementation is TS-first (SvelteKit + Svelte 5 runes), standalone for
velocity, with the monorepo/Eidos lift planned (`MIGRATION.md`). Legend:
**✔ shipped** (in code, tested) · **◐ partial** (mechanism exists, scope
incomplete) · **○ reserved** (typed socket in the grammar, no live loop) ·
**✗ future** (not yet in the grammar).

| Mechanism | Lemma | Where | Status |
|---|---|---|---|
| Grammar (22 primitive kinds + meta + compound) | L1 | `grammar/types.ts` | ✔ |
| A11y-required typing (unrepresentable inaccessibility) | L1 | `grammar/types.ts` | ✔ |
| Compound factory: hygienic expansion + validation gate | L1 | `compounds/factory.ts` | ✔ |
| Candidate/promoted compound lifecycle | L1 | — | ✗ (Phase 1) |
| Context algebra: four laws + property tests | L2 | `context/algebra.ts`, `lemmas.property.test.ts` | ✔ |
| Emphasis renormalization wired into render path | L2 | layout primitives | ✔ |
| Law-4 × expansion commutation (claim hygiene) | L1×L2 | `grammar/types.ts`, `context/algebra.ts`, `lemmas.property.test.ts` | ✔ |
| Three token strata, intents-only authoring | L3 | `tokens/` | ✔ |
| Dialects: intent remap + bounded priors, global flip | L4 | `dialects/` | ✔ |
| Intent-keyset fixed point across dialects (tested) | L4 | `dialects.test.ts` | ✔ |
| Intent-ref apply-time validation + neutral dialect values | L4 | `MorpheRoot.svelte`, `dialects/provider.svelte.ts`, `dialects.test.ts` | ✔ |
| Compound dialects (`dialect.compounds[]` render-gated) | L4 | typed, not gated | ○ (Phase 1) |
| G\|D decoder masks (dialect-restricted emission) | L4 | — | ✗ (Phase 2) |
| Cohort/attribution → dialect at `MorpheRoot` | L4 | `dialects/arrival.ts`, `+layout.svelte` | ✔ (`?cohort=` arrival wiring; per-cohort copy still open) |
| `bind` store-paths on inputs/overlays | L5 | client store + bound primitives | ✔ |
| Tier-0 local state in input primitives | L5 | input primitives | ✔ |
| Tier-1/2 event escalation + ContextDigest | L5 | client store exists; event tiers/digest pending | ✗ (Phase 1) |
| `Vary` nodes (render default option) | L6 | grammar + `Node.svelte` | ○ (Phase 2 wires deltas) |
| `Within`, epochs, VaryId/delta typing | L6 | — | ✗ (Phase 2) |
| Mid-loop model (appliance-resident, A4-constrained) | L7 | — | ✗ (Phase 2) |
| One schema, three jobs (Pydantic source + TS codegen + mask) | L1 | TS-first today | ✗ (the Eidos lift, `MIGRATION.md`) |
| Slow loop (agent emitting trees) | A1 | hand-authored presenters today | ✗ (post-lift) |
| Dignity test (Corollary 1 exit criterion) | C1 | the Sókrates site itself | ✔ |

The site (`src/routes/`, `src/lib/site/`, `src/lib/compose/`) is Phase 0's
proving ground: every page is hand-authored trees through the full pipeline,
which is exactly Corollary 1's "no agent" degradation — the system standing as
a good design system before any model touches it.
