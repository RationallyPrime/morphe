# Morphe Agent-Native CMS PRD / Design Spec

**Status:** Proposal  
**Audience:** Morphe / Codex / implementation agents  
**Format:** Markdown spec  
**Primary decision:** Pydantic contracts are the source of truth for CMS content artifacts.

---

## 1. Summary

Morphe should have an agent-native CMS, but not in the traditional “human visual editor” sense.

The system should be a **content compiler**:

> Agents author typed semantic content artifacts through fixed-size Pydantic contracts. Morphe validates those artifacts, compiles them through deterministic presenters into valid `Node` trees, gates them through grammar/compound/dialect/a11y validation, and publishes immutable revisions by pointer.

The core design move is to keep agents away from arbitrary page construction. They should not emit DOM, Svelte, CSS, raw colors, arbitrary layout geometry, or freeform page blobs. They should call tools whose parameters contain:

1. new content, such as title, claim, sections, proof points, CTAs, assets, examples; and
2. Morphe-native controls, such as `intent`, `dialect`, `surface`, `emphasis`, `compound` slots, and bounded `Vary` options.

Different pages are expressed through different typed content contracts, block variants, slot fills, intents, dialects, and presenters — not through unconstrained visual editing.

The CMS does not let agents build pages. It lets agents submit typed meaning, and Morphe makes the page.

---

## 2. Product framing

Normal CMS:

```txt
human editor → content blobs → frontend renders blobs
```

Normal page builder:

```txt
human editor → manipulates surface/layout → frontend stores page shape
```

Morphe CMS:

```txt
agent → Pydantic content artifact → presenter → Morphe Node tree → validation gate → published revision
```

This should be described internally as:

> Morphe CMS is an agent-native content compiler.

A slightly fuller definition:

> Morphe CMS is an agent-native content compiler where Pydantic models define the authored content contracts, JSON Schema exposes those contracts to agents, deterministic presenters compile validated artifacts into Morphe `Node` trees, and publishing is immutable pointer movement after grammar, compound, dialect, and accessibility validation.

---

## 3. Goals

The CMS should:

- let agents create, revise, validate, preview, and publish Morphe-backed content;
- use **Pydantic as the authored source of truth** for content contracts;
- emit JSON Schema from Pydantic for tool schemas / constrained agent output;
- keep TypeScript as a consumer artifact, not the CMS contract authority;
- keep tool schemas fixed-size and predictable;
- expose content fields plus Morphe-native controls;
- compile semantic artifacts into Morphe `Node` trees through deterministic presenters;
- validate every publishable artifact through a hard gate;
- store versioned artifacts and compiled trees append-only;
- make rollback simple pointer movement;
- leave human-facing UI as an optional later layer.

---

## 4. Non-goals

This proposal does **not** attempt to build:

- a Sanity Studio clone;
- a Nuxt Studio clone;
- a rich visual page editor;
- a drag/drop layout builder;
- collaborative human editorial workflows;
- WYSIWYG arbitrary DOM editing;
- arbitrary raw `Node` authoring as the default surface;
- new Morphe primitives;
- a full database-backed editorial product in v0.

Human UI is deliberately out of scope for the first slice. If a human needs to inspect the system, JSON + preview routes + diagnostics are enough.

---

## 5. Core principle

Agents should author **semantic content artifacts**, not pages.

The agent-facing contract should look like this:

```python
class CapabilityPageDraft(BaseModel):
    slug: Slug
    audience: Audience
    hero: HeroBlock
    sections: list[CapabilitySection]
    cta: CTA
    morphe: MorpheControls
```

Not this:

```python
class StackNode(BaseModel):
    direction: str
    gap: str
    children: list[Node]
```

Raw `Node` contracts can exist for validation, tests, migrations, advanced escape hatches, and candidate compound proposals. But they should not be the primary CMS authoring surface.

The default pipeline should be:

```txt
Pydantic content model
  → JSON Schema tool contract
  → agent constrained output
  → Pydantic runtime validation
  → deterministic presenter
  → Morphe Node tree
  → grammar + compound + dialect + a11y validation
  → compiled tree artifact
  → published revision pointer
```

---

## 6. Why Pydantic should be the contract source

Pydantic is the right source of truth for this CMS because the primary contract is runtime-agent-facing, not editor-ergonomics-facing.

The central question is:

> Can an agent emit this object safely?

Pydantic is well suited to that because it gives the system:

- runtime validation;
- repairable validation errors;
- JSON Schema export for tool definitions;
- discriminated unions for content block variants;
- strict `extra="forbid"` models;
- validators for cross-field policy;
- Python-native ergonomics for agent/tool systems;
- a clean path to generated TypeScript if/when needed.

The rule should be:

> Pydantic is the authored contract. JSON Schema is the exported wire/tool contract. TypeScript is generated consumer typing, not the authority.

This does **not** require migrating Morphe’s core grammar immediately. In v0, Pydantic owns CMS content contracts. The existing Morphe grammar still validates compiled `Node` trees.

End-state can be:

```txt
Pydantic source
  → JSON Schema
  → TypeScript generated types
  → decoder masks / constrained generation
  → runtime validation
```

But v0 should stay narrower:

```txt
Pydantic CMS contracts
  → JSON Schema tools
  → validated semantic artifact
  → presenter emits existing Morphe Node
```

---

## 7. Artifact model

### 7.1 ContentArtifact

The source of truth. This is what agents author.

```python
from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field


class ArtifactProvenance(BaseModel):
    model_config = ConfigDict(extra="forbid")

    created_by: Literal["agent", "human", "migration"]
    prompt_id: str | None = None
    source_ids: list[str] = Field(default_factory=list)
    created_at: str


class ArtifactEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    type: Literal[
        "landingPage",
        "capabilityPage",
        "caseStudy",
        "comparisonPage",
        "article",
        "campaignPage",
    ]
    schema_version: str
    presenter_version: str
    status: Literal["draft", "validated", "published", "archived"]
    data: dict[str, Any]
    provenance: ArtifactProvenance
```

The `data` field is validated by the specific Pydantic model for the artifact type.

In implementation, the system should not treat `data` as an untyped blob. The envelope is generic; the payload is strongly typed.

---

### 7.2 CompiledTree

The generated build artifact. This is produced by Morphe, not hand-authored.

```python
class CompiledTree(BaseModel):
    model_config = ConfigDict(extra="forbid")

    artifact_id: str
    revision_id: str
    grammar_version: str
    presenter_version: str
    tree: dict[str, Any]
    diagnostics: list[dict[str, Any]] = Field(default_factory=list)
    compiled_at: str
```

Compiled trees are useful for:

- preview;
- snapshot tests;
- debugging;
- deterministic rebuilds;
- render smoke tests.

They should not become the editorial source of truth.

---

### 7.3 Publication

A public pointer to an immutable artifact revision.

```python
class Publication(BaseModel):
    model_config = ConfigDict(extra="forbid")

    slug: str
    artifact_id: str
    revision_id: str
    channel: Literal["site", "preview", "campaign"]
    published_at: str
    published_by: Literal["agent", "human", "system"]
```

Publishing should be pointer movement, not mutation.

Rollback should be:

```txt
publication.slug = /p/workflow-automation
publication.revision_id = rev_003
```

No content mutation required.

---

## 8. Content contract: v0 CapabilityPage

The first implementation should support exactly one content type:

```txt
CapabilityPageDraft
```

That is enough to prove the architecture without accidentally building a general CMS product.

### 8.1 Shared types

```python
from typing import Annotated, Literal, Union
from pydantic import BaseModel, ConfigDict, Field, HttpUrl, model_validator


Slug = Annotated[str, Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")]

IntentRef = Literal[
    "neutral",
    "evidence",
    "accession",
    "caution",
    "success",
    "info",
    "action",
]

DialectName = Literal[
    "gallery",
    "night",
    "icelandic-archive",
    "clinical",
    "reykjavik-registry",
    "timaeus",
]

Audience = Literal[
    "founder",
    "operator",
    "cto",
    "cfo",
    "operations_lead",
    "developer",
    "buyer",
]

EmphasisLevel = Literal["low", "normal", "high"]

SurfaceRef = Literal[
    "default",
    "raised",
    "sunken",
    "inset",
    "scrim",
]
```

---

### 8.2 Morphe controls

```python
class MorpheControls(BaseModel):
    model_config = ConfigDict(extra="forbid")

    dialect: DialectName = "gallery"
    primary_intent: IntentRef = "evidence"
    surface: SurfaceRef = "default"
    emphasis: EmphasisLevel = "normal"
```

These fields are Morphe-native controls. They are allowed because they remain inside the algebra.

They are not styling escape hatches.

Forbidden examples:

```json
{
  "color": "#0047ff",
  "css": ".hero { margin-top: 13px }",
  "className": "text-blue-500"
}
```

---

### 8.3 Core blocks

```python
class HeroBlock(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kicker: Annotated[str | None, Field(max_length=48)] = None
    title: Annotated[str, Field(min_length=4, max_length=96)]
    thesis: Annotated[str, Field(min_length=20, max_length=320)]
    supporting_claim: Annotated[str | None, Field(max_length=220)] = None


class ProofPoint(BaseModel):
    model_config = ConfigDict(extra="forbid")

    label: Annotated[str, Field(min_length=2, max_length=64)]
    claim: Annotated[str, Field(min_length=8, max_length=240)]
    evidence: Annotated[str | None, Field(max_length=240)] = None
    intent: IntentRef | None = None


class CTA(BaseModel):
    model_config = ConfigDict(extra="forbid")

    label: Annotated[str, Field(min_length=2, max_length=48)]
    action_id: Annotated[str | None, Field(pattern=r"^[a-z][a-z0-9_]*$")] = None
    href: HttpUrl | None = None
    intent: IntentRef = "action"

    @model_validator(mode="after")
    def require_action_or_href(self):
        if not self.action_id and not self.href:
            raise ValueError("CTA requires either action_id or href")
        return self
```

---

### 8.4 Section variants

```python
class ProblemFrameSection(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["problemFrame"]
    id: Slug | None = None
    title: Annotated[str, Field(min_length=4, max_length=96)]
    claim: Annotated[str, Field(min_length=12, max_length=280)]
    evidence: list[Annotated[str, Field(min_length=4, max_length=220)]] = Field(
        default_factory=list,
        max_length=5,
    )
    intent: IntentRef | None = None


class WorkflowStep(BaseModel):
    model_config = ConfigDict(extra="forbid")

    label: Annotated[str, Field(min_length=2, max_length=64)]
    description: Annotated[str, Field(min_length=8, max_length=220)]
    evidence: Annotated[str | None, Field(max_length=220)] = None


class WorkflowMapSection(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["workflowMap"]
    id: Slug | None = None
    title: Annotated[str, Field(min_length=4, max_length=96)]
    steps: Annotated[list[WorkflowStep], Field(min_length=2, max_length=7)]
    intent: IntentRef | None = None


class Metric(BaseModel):
    model_config = ConfigDict(extra="forbid")

    label: Annotated[str, Field(min_length=2, max_length=64)]
    value: Annotated[str, Field(min_length=1, max_length=32)]
    explanation: Annotated[str | None, Field(max_length=160)] = None


class CaseProofSection(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["caseProof"]
    id: Slug | None = None
    title: Annotated[str, Field(min_length=4, max_length=96)]
    company_shape: Annotated[str | None, Field(max_length=120)] = None
    before: Annotated[str, Field(min_length=8, max_length=240)]
    after: Annotated[str, Field(min_length=8, max_length=240)]
    metrics: list[Metric] = Field(default_factory=list, max_length=4)
    intent: IntentRef | None = None


class FAQItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question: Annotated[str, Field(min_length=8, max_length=140)]
    answer: Annotated[str, Field(min_length=12, max_length=420)]


class FAQSection(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["faq"]
    id: Slug | None = None
    title: Annotated[str, Field(min_length=4, max_length=96)]
    items: Annotated[list[FAQItem], Field(min_length=2, max_length=8)]
    intent: IntentRef | None = None


CapabilitySection = Annotated[
    Union[
        ProblemFrameSection,
        WorkflowMapSection,
        CaseProofSection,
        FAQSection,
    ],
    Field(discriminator="kind"),
]
```

---

### 8.5 Variation envelope

Agents can author bounded variation, but not arbitrary rewrite loops.

```python
class HeroVariant(BaseModel):
    model_config = ConfigDict(extra="forbid")

    angle: Literal["governance", "speed", "cost", "trust", "technical"]
    title: Annotated[str, Field(min_length=4, max_length=96)]
    thesis: Annotated[str, Field(min_length=20, max_length=320)]


class HeroVariation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    objective: Literal["salience", "density", "compactness"] = "salience"
    variants: Annotated[list[HeroVariant], Field(min_length=2, max_length=5)]
```

The presenter compiles this into a Morphe `Vary` node.

The artifact defines the envelope. The adaptive layer chooses inside the envelope.

---

### 8.6 Full v0 contract

```python
class CapabilityPageDraft(BaseModel):
    model_config = ConfigDict(extra="forbid")

    slug: Slug
    audience: Audience
    morphe: MorpheControls = Field(default_factory=MorpheControls)
    hero: HeroBlock
    hero_variation: HeroVariation | None = None
    proof_points: list[ProofPoint] = Field(default_factory=list, max_length=6)
    sections: Annotated[list[CapabilitySection], Field(min_length=1, max_length=8)]
    cta: CTA
    source_ids: list[str] = Field(default_factory=list, max_length=12)
```

Tool schema export:

```python
schema = CapabilityPageDraft.model_json_schema()
```

Runtime validation:

```python
draft = CapabilityPageDraft.model_validate(payload)
```

Compile:

```python
tree = present_capability_page(draft)
```

---

## 9. Agent-facing tools

The first tool surface should be small.

### 9.1 `createCapabilityPage`

Creates a draft artifact from a validated `CapabilityPageDraft` payload.

```python
class CreateCapabilityPageInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    draft: CapabilityPageDraft
    rationale: Annotated[str | None, Field(max_length=800)] = None
```

Returns:

```python
class CreateCapabilityPageResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ok: bool
    artifact_id: str | None = None
    revision_id: str | None = None
    diagnostics: list[dict] = Field(default_factory=list)
```

---

### 9.2 `reviseContentArtifact`

Applies a semantic patch to an existing artifact.

The patch language should operate on content fields, not compiled tree paths.

Good patch operations:

```txt
replaceHero
replaceCTA
addSection
replaceSection
moveSection
removeSection
addProofPoint
setMorpheControls
replaceHeroVariation
```

Bad patch operations:

```txt
replace tree.children[3].children[1].props.text
set css
set className
set colorHex
```

Suggested input:

```python
class ReviseContentArtifactInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    artifact_id: str
    expected_revision_id: str
    patch: dict
    rationale: Annotated[str, Field(min_length=4, max_length=800)]
```

v0 can keep the `patch` dictionary simple, then harden it into a discriminated union once the first few operations settle.

---

### 9.3 `validateContentArtifact`

Runs validation without publishing.

```python
class ValidateContentArtifactInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    artifact_id: str
    revision_id: str | None = None
    strict: bool = True
```

Returns:

```python
class ValidateContentArtifactResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ok: bool
    compiled_tree_id: str | None = None
    diagnostics: list[dict] = Field(default_factory=list)
```

---

### 9.4 `renderPreview`

Renders the draft or compiled tree through the real Morphe renderer.

```python
class RenderPreviewInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    artifact_id: str
    revision_id: str | None = None
    viewport: Literal["mobile", "desktop"] = "desktop"
    dialect: DialectName | None = None
```

Returns a preview URL or preview artifact reference.

---

### 9.5 `publishContentArtifact`

Publishes a validated artifact revision.

```python
class PublishContentArtifactInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    artifact_id: str
    revision_id: str
    slug: Slug
    channel: Literal["site", "preview", "campaign"] = "site"
```

This must fail unless the exact revision passed validation.

---

### 9.6 `proposeCompound`

Optional, lower-trust tool. Lets an agent propose a reusable compound, but only through the candidate lifecycle.

```python
class ProposeCompoundInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Slug
    params_schema: dict
    template: dict
    examples: list[dict] = Field(default_factory=list, max_length=5)
    rationale: Annotated[str, Field(min_length=12, max_length=1000)]
```

The compound lands as `candidate`, not `promoted`.

Promotion requires the existing compound gate plus review policy.

---

## 10. Tool design rule

Every agent-facing CMS tool should satisfy this rule:

> New content is a subset of the parameters. The remaining parameters are Morphe-native controls.

Allowed parameter classes:

```txt
content text
content structure
asset refs
source refs
intent refs
dialect refs
surface refs
emphasis levels
compound names from allowlist
compound args matching schema
slot fills matching schema
bounded variation options
semantic patch operations
```

Forbidden parameter classes:

```txt
raw CSS
raw hex color
Tailwind class
Svelte component path
DOM tag name
pixel geometry
arbitrary JavaScript
unknown intent
unknown dialect
unknown compound
unbounded raw Node tree in default authoring path
```

This makes the agent powerful without making it visually sovereign.

---

## 11. Presenter/compiler layer

Each content type gets a deterministic presenter.

```python
def present_capability_page(draft: CapabilityPageDraft) -> dict:
    ...
```

Conceptual mapping:

```txt
CapabilityPageDraft
  → Page frame
  → Hero compound
  → optional Hero Vary node
  → Proof strip compound
  → Section stack
  → ProblemFrame compound
  → WorkflowMap compound
  → CaseProof compound
  → FAQ compound
  → CTA band
```

The presenter decides:

- which Morphe primitives to use;
- which compounds to call;
- how slots are filled;
- where section roles attach;
- how default intents cascade;
- how dialect/surface/emphasis influence the tree;
- where `Vary` nodes are inserted;
- how source/provenance metadata is attached if needed.

The agent decides:

- what the page means;
- what audience it serves;
- what claims and proof points it contains;
- which allowed Morphe-native controls are selected.

This preserves the architecture:

```txt
agent authors meaning
presenter authors Morphe expression
renderer authors final surface
```

---

## 12. Validation pipeline

Every publishable artifact must pass the same hard gate.

```txt
agent tool call
  → tool schema validation
  → Pydantic content validation
  → CMS policy validation
  → presenter compile
  → Morphe grammar validation
  → compound expansion gate
  → dialect/intent validation
  → accessibility validation
  → render smoke
  → compiled tree stored
  → revision eligible for publication
```

Failures should save as draft if useful, but they should never publish.

Validation should fail closed.

---

## 13. Policy validation

Pydantic catches shape. Policy catches bad authorship.

Policy rules should reject:

- raw hex colors;
- CSS;
- class names;
- arbitrary DOM references;
- Svelte component paths;
- unknown intents;
- unknown dialects;
- unknown surfaces;
- unpublished compounds in published artifacts;
- missing asset alt text;
- unsupported asset MIME types;
- CTA without `action_id` or `href`;
- excessive section count;
- overlong headings;
- unsupported section kinds;
- invented customer names where source provenance is required;
- unsupported `Vary` objectives;
- malformed source IDs;
- raw `Node` payloads in semantic authoring tools.

Policy should return diagnostics that are easy for agents to repair.

Example:

```json
{
  "ok": false,
  "errors": [
    {
      "code": "UNKNOWN_INTENT",
      "path": "sections[2].intent",
      "message": "Intent 'urgent-blue' is not available. Use one of: neutral, evidence, accession, caution, success, info, action."
    },
    {
      "code": "CTA_TARGET_REQUIRED",
      "path": "cta",
      "message": "CTA requires either action_id or href."
    }
  ],
  "draft_saved": true
}
```

---

## 14. Asset model

Assets should be references, not blobs inside content artifacts.

```python
class AssetRef(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    role: Literal["heroImage", "inlineImage", "logo", "diagram", "thumbnail"]
    alt: Annotated[str, Field(min_length=4, max_length=220)]
    focal_point: Literal["center", "top", "bottom", "left", "right"] = "center"
    rights: Literal["owned", "licensed", "generated", "external"]
```

The presenter decides how to render assets as Morphe `Media`.

Validation enforces:

- known asset ID;
- required alt text;
- allowed MIME type;
- acceptable dimensions;
- rights metadata;
- role compatibility with the content block.

---

## 15. Storage model

v0 should use flat files.

```txt
content/
  capability-pages/
    workflow-automation/
      rev-001.json
      rev-002.json

compiled/
  capability-pages/
    workflow-automation/
      rev-001.tree.json
      rev-002.tree.json

publications.json
```

Later database tables:

```txt
content_artifacts
content_revisions
compiled_trees
publications
assets
diagnostics
agent_runs
```

Important property:

> Revision history is append-only.

No in-place mutation of published content.

---

## 16. Revision and diff model

Diff semantic artifacts first.

Good diffs:

```txt
Hero thesis changed
CTA label changed
Added proof point
Moved workflow step 2 → 4
Changed primary intent: info → evidence
```

Bad diffs:

```txt
Changed children[3].children[1].props.text
```

Compiled tree diffs are useful for tests and debugging, but not as the main authoring/review surface.

---

## 17. Publishing model

Publishing is pointer movement.

Example:

```txt
/p/workflow-automation
  → artifact_id: capability-page.workflow-automation
  → revision_id: rev-004
```

Rollback:

```txt
/p/workflow-automation
  → artifact_id: capability-page.workflow-automation
  → revision_id: rev-003
```

No mutation. No rewrite. No rebuild unless grammar/presenter migration is explicitly requested.

---

## 18. MVP scope

The MVP should prove one vertical path:

```txt
agent submits CapabilityPageDraft
  → Pydantic validates
  → artifact revision saved
  → presenter compiles to Morphe Node tree
  → Morphe validation passes
  → preview route renders
  → publish pointer is written
```

Include:

- one Pydantic content contract;
- JSON Schema export for the tool contract;
- one create tool;
- one revise tool or simple replacement operation;
- one validate tool;
- one preview route;
- one publish operation;
- one local file store;
- one deterministic presenter;
- diagnostics for validation failures;
- tests for happy path and rejection path.

Skip:

- human editor UI;
- auth/permissions beyond local/dev assumptions;
- database persistence;
- localization;
- asset upload UI;
- rich workflow approvals;
- visual diff UI;
- full raw Node editing;
- generalized content type registry;
- compound promotion UI.

---

## 19. Suggested file layout

```txt
py/morphe_cms/
  __init__.py
  contracts/
    __init__.py
    shared.py
    capability_page.py
  tools/
    __init__.py
    create_capability_page.py
    revise_content_artifact.py
    validate_content_artifact.py
    render_preview.py
    publish_content_artifact.py
  validation/
    __init__.py
    policy.py
    diagnostics.py
  store/
    __init__.py
    files.py
  schema.py

src/lib/cms/
  presenters/
    capability-page.ts
  store.ts
  validate.ts
  publish.ts

src/routes/preview/[artifactId]/[revisionId]/+page.server.ts
src/routes/p/[slug]/+page.server.ts

content/
compiled/
publications.json
```

If keeping all implementation in TS initially, still keep the Pydantic contracts in `py/` as the contract authority and generate schemas into `schema/cms/`.

Suggested generated artifacts:

```txt
schema/cms/capability-page.schema.json
schema/cms/create-capability-page.schema.json
schema/cms/revise-content-artifact.schema.json
```

---

## 20. Example tool call

```json
{
  "draft": {
    "slug": "workflow-automation",
    "audience": "operations_lead",
    "morphe": {
      "dialect": "gallery",
      "primary_intent": "evidence",
      "surface": "default",
      "emphasis": "normal"
    },
    "hero": {
      "kicker": "Capability",
      "title": "Workflow automation that stays accountable",
      "thesis": "Morphe helps teams encode operational workflows as adaptive, auditable interfaces.",
      "supporting_claim": "The interface can change register and emphasis without escaping the grammar."
    },
    "proof_points": [
      {
        "label": "Typed",
        "claim": "Every authored artifact is validated before it reaches the renderer.",
        "intent": "evidence"
      },
      {
        "label": "Adaptive",
        "claim": "Variation happens inside authorized Morphe envelopes.",
        "intent": "info"
      }
    ],
    "sections": [
      {
        "kind": "problemFrame",
        "id": "problem",
        "title": "The problem",
        "claim": "Most workflow UIs collapse when operational context changes.",
        "evidence": [
          "Different roles need different levels of detail.",
          "Operational states change faster than static frontend releases."
        ],
        "intent": "caution"
      },
      {
        "kind": "workflowMap",
        "id": "how-it-works",
        "title": "How it works",
        "steps": [
          {
            "label": "Model the operation",
            "description": "Define the domain objects, actions, and state transitions."
          },
          {
            "label": "Compile the interface",
            "description": "Render the workflow through Morphe’s grammar and dialect layer."
          },
          {
            "label": "Adapt within bounds",
            "description": "Let variation points shift emphasis without escaping the contract."
          }
        ],
        "intent": "info"
      }
    ],
    "cta": {
      "label": "See the workflow",
      "action_id": "open_composer",
      "intent": "action"
    },
    "source_ids": []
  },
  "rationale": "Create first capability page for the operations-lead audience."
}
```

---

## 21. Example presenter sketch

This is intentionally illustrative, not final implementation code.

```python
def present_capability_page(draft: CapabilityPageDraft) -> dict:
    return {
        "kind": "frame",
        "role": "page",
        "surface": draft.morphe.surface,
        "children": [
            present_hero(draft),
            present_proof_points(draft.proof_points),
            {
                "kind": "stack",
                "role": "section",
                "children": [
                    present_capability_section(section, draft.morphe)
                    for section in draft.sections
                ],
            },
            present_cta(draft.cta),
        ],
    }
```

If `hero_variation` is present, `present_hero` emits a `Vary` node whose options are hero compounds.

---

## 22. Error handling

All tools should return structured diagnostics.

The agent should be able to repair errors by reading the result.

Example diagnostic:

```python
class Diagnostic(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str
    severity: Literal["error", "warning", "info"]
    path: str
    message: str
    repair_hint: str | None = None
```

Example result:

```json
{
  "ok": false,
  "diagnostics": [
    {
      "code": "SECTION_COUNT_EXCEEDED",
      "severity": "error",
      "path": "sections",
      "message": "CapabilityPageDraft supports at most 8 sections.",
      "repair_hint": "Merge related sections or remove lower-priority sections."
    }
  ]
}
```

---

## 23. Testing strategy

### Unit tests

- `CapabilityPageDraft` accepts valid artifacts.
- `CapabilityPageDraft` rejects unknown fields.
- CTA requires `action_id` or `href`.
- Section discriminator works.
- Unknown section kind is rejected.
- Unknown intent is rejected.
- Unsupported dialect is rejected.
- Overlong title is rejected.
- Policy rejects raw CSS/class/color fields.

### Presenter tests

- Valid draft compiles to a Morphe root tree.
- Each section kind maps to expected compound or primitive structure.
- Hero variation maps to `Vary`.
- CTA maps to action/link semantics correctly.
- Presenter output is deterministic.

### Integration tests

- create → validate → compile → preview.
- create → validate → publish → published route resolves.
- invalid draft cannot publish.
- rollback repoints publication to prior revision.
- exact validated revision is required for publish.

### Snapshot tests

- canonical CapabilityPage fixture compiles to stable tree snapshot.
- presenter changes produce intentional diffs.

### Property-style tests, later

Generate valid `CapabilityPageDraft` instances and assert:

- presenter never throws;
- output validates against Morphe grammar;
- no unknown compounds are referenced;
- no unknown intents are referenced;
- render smoke does not throw.

---

## 24. Acceptance criteria for v0

The v0 slice is done when:

- Pydantic defines `CapabilityPageDraft` and related shared contracts;
- JSON Schema is emitted for the create tool;
- an agent can create a versioned `CapabilityPage` draft;
- invalid drafts return structured diagnostics;
- valid drafts compile into Morphe `Node` trees;
- compiled trees pass grammar/compound/dialect/a11y validation;
- a preview route renders the compiled tree through the real renderer;
- a publish operation points a slug to an immutable validated revision;
- rollback can repoint a slug to an earlier revision;
- no raw CSS, raw colors, DOM, class names, or Svelte component refs are accepted;
- tests cover both happy path and rejection path.

---

## 25. Risks

### Risk: agent gets too much low-level control

Giving agents raw primitive constructors as the main surface recreates page-builder entropy.

Mitigation:

- default to semantic page/block tools;
- keep raw `Node` operations behind an advanced/candidate lane;
- always validate compiled output.

### Risk: compiled trees become editorial source

Editing compiled trees directly makes semantic diffing, migration, and repair harder.

Mitigation:

- store semantic artifacts as source of truth;
- treat compiled trees as build artifacts.

### Risk: Pydantic and TS drift

If TS models are hand-maintained separately, contracts will diverge.

Mitigation:

- Pydantic owns CMS contracts;
- JSON Schema is generated;
- TS types, if needed, are generated from JSON Schema.

### Risk: presenters become messy hidden page builders

If each presenter becomes a one-off pile of layout choices, the CMS becomes hard to reason about.

Mitigation:

- keep presenters deterministic;
- build presenters from section presenters and compounds;
- snapshot compiled trees;
- prefer reusable compounds for repeated structure.

### Risk: overbuilding the CMS shell

Human UI, permissions, review workflow, localization, and asset management can consume the project.

Mitigation:

- v0 is agent-first and file-backed;
- humans inspect JSON, diagnostics, and preview routes only.

---

## 26. Open questions

These do not block v0:

1. Should the first contract be `CapabilityPageDraft`, `LandingPageDraft`, or `CaseStudyDraft`?
2. Should `reviseContentArtifact.patch` be a typed discriminated union in v0, or can it start as a constrained dictionary?
3. Should previews render from compiled tree files or compile on demand from artifact revisions?
4. Should source provenance be required for all public content or only certain artifact types?
5. Should candidate compound proposal be included in v0 or wait until after the first content contract works?

Recommended default answers:

1. Start with `CapabilityPageDraft`.
2. Start with a small typed union if time allows; otherwise constrained dictionary plus policy checks.
3. Store compiled trees after validation; preview can compile on demand during early development.
4. Allow optional `source_ids` in v0, require it later for claims-heavy content.
5. Defer `proposeCompound` until the basic content compiler loop is proven.

---

## 27. Recommended implementation sequence

### Step 1: Define contracts

- Add Pydantic models for shared types.
- Add `CapabilityPageDraft`.
- Add schema export script.
- Commit generated JSON Schema.

### Step 2: Add local store

- Save artifact revisions as JSON.
- Save compiled trees as JSON.
- Save publications as JSON.

### Step 3: Add presenter

- Implement `present_capability_page`.
- Map section variants to existing compounds/primitives.
- Keep output deterministic.

### Step 4: Add validation gate

- Pydantic validation.
- CMS policy validation.
- Morphe grammar validation.
- Compound/dialect validation.
- Render smoke.

### Step 5: Add tools

- `createCapabilityPage`.
- `validateContentArtifact`.
- `renderPreview`.
- `publishContentArtifact`.
- Minimal `reviseContentArtifact` if time remains.

### Step 6: Add preview and publish routes

- `/preview/[artifactId]/[revisionId]`.
- `/p/[slug]`.

### Step 7: Add tests

- contract tests;
- presenter tests;
- validation rejection tests;
- create/validate/publish integration test.

---

## 28. Final recommendation

Build this as a narrow agent-native content compiler first.

Do not start with human UI. Do not start with arbitrary node editing. Do not start with a general content platform.

Start with:

```txt
CapabilityPageDraft only
Pydantic contract source
JSON Schema tool export
semantic artifact storage
deterministic presenter
Morphe validation gate
preview route
publish pointer
```

That is enough to prove the core bet:

> Agents author typed content artifacts, not pages; Morphe compiles those artifacts into valid interface trees through sanctioned presenters, compounds, dialects, and bounded variation points.

Once this works, expand horizontally into more content contracts:

```txt
LandingPageDraft
CaseStudyDraft
ComparisonPageDraft
ArticleDraft
CampaignPageDraft
```

Then expand vertically into richer workflows:

```txt
semantic diffs
source provenance
asset library
compound proposal queue
human review shell
localization
approval flows
```

The architecture stays clean because the first principle stays fixed:

> Pydantic owns the content contract. Morphe owns the interface algebra. Publishing only moves validated revision pointers.
