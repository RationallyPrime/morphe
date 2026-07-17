# Morphe edge compilation over typed kernel testimony

- **Status:** recommended design
- **Date:** 2026-07-17
- **Decision owner:** Morphe founder
- **Scope:** operational surfaces produced by the six business kernels

## Preamble: what this pass overturns

No earlier `edge-compilation-pass.md` was present in this checkout, so there is no draft text to
preserve. This pass does overturn five assumptions that are easy to carry forward from the current
implementation:

1. **A validated compiled tree is not authenticated testimony.**
   `canonical_surface_artifact_bytes()` and `surface_artifact_digest()` explicitly describe the
   current SHA-256 as content identity, not authenticity, and no ingress verifies it. The viewer's
   current trust gate is valuable structural validation—bounds, generated grammar schema,
   semantic checks, grammar version, and dialect policy—but it does not prove which kernel said
   what.
2. **A raw schema plus full `model_dump()` would widen disclosure.** Today `hidden=True` removes a
   value because only the compiled tree crosses the wire. The representative kernels rely on that:
   hidden org IDs, shift IDs, sequences, and duplicated KPI inputs do not enter the artifact. Edge
   compilation must preserve that data-minimization property before anything leaves the kernel.
3. **Moving compilation does not move projection.** Taxis and Obolos do domain joins, sorting,
   pseudonymization, authorization-aware link construction, KPI arithmetic, diagnostic placement,
   and conversion from canonical units into display-oriented values. Those operations require
   kernel-private state and remain kernel-side. Only the generic `(schema, data, diagnostics) ->
   SurfaceSpec -> Node` lowering moves.
4. **A Python compiler sidecar beside the viewer is not the target.** It would retain a deployment
   seam between emitted topology and Svelte/CSS and would leave two runtime releases to coordinate.
   The edge compiler belongs in the same TypeScript package and deployment artifact as the
   renderer.
5. **Dialect is not kernel testimony.** Dialects remain viewer-side frame policy. A kernel signs
   semantic view data and its presentation hints, not a `dialect_id`, `grammar_version`, or
   `compiler_version`.

The founding thesis survives, with a sharper placement: `Node` remains Morphe's fixed render
grammar and the authoring format for direct Morphe trees. For operational kernel surfaces, the
network testimony is a typed Pydantic projection; the edge deterministically authors the `Node`
tree from it.

## Decision

Replace kernel-emitted `CompiledSurface` as the steady-state wire format with a signed
`SourceSurfaceArtifact` containing:

- a self-contained Pydantic serialization JSON Schema, including its `x-morphe` annotations;
- the matching minimized JSON data payload;
- producer diagnostics keyed to serialized data paths;
- stable view-model and source-revision identity; and
- content seals plus an asymmetric kernel attestation.

The Morphe viewer admits that source artifact, validates its testimony and its data contract,
compiles it through a pure TypeScript two-stage compiler, validates the resulting `Node` against
the package grammar and active dialect policy, and only then renders it through `MorpheRoot`.

The final flow is:

```text
kernel-private state
  -> kernel projection and Pydantic view model
  -> minimize hidden fields + serialize + seal + sign
  -> immutable SourceSurfaceArtifact
  -> artifact delivery/read adapter
  -> viewer source trust gate
  -> TypeScript schema/data -> SurfaceSpec -> Node compiler
  -> Node grammar gate -> dialect gate
  -> MorpheRoot -> primitives/CSS
```

`Node` is an internal derived value in this path, not the producer wire contract. A compiler fix
therefore ships once in the viewer image and requires no kernel dependency, lockfile, CI, image, or
deployment change.

The stripped viewer still must not become a general authenticated kernel aggregator. The final
deployment path reads signed source artifacts through the configured artifact read seam. How a
host causes a kernel response to be placed behind that seam is host topology, not compiler logic.
Direct kernel reads may remain as a migration adapter, but they are not the target architecture.

## 1. The source wire contract

### 1.1 One self-contained artifact

Kernels ship the current compiler input pair, made explicit and trustworthy: a JSON Schema plus
its data instance. Version 1 embeds the complete schema in every artifact. It does **not** use a
schema URL or a mutable registry reference.

Embedding is deliberate:

- schema and data are one atomic testimony, with no time-of-check/time-of-use race;
- a stored artifact remains replayable after a kernel deploy;
- signature verification needs no network lookup;
- compression makes repeated `$defs` cheap on the wire; and
- the edge caches validated schema plans by `schema_sha256`, so repeated parsing is avoided.

A store may deduplicate schema bytes internally by hash, but the admitted wire value remains
self-contained. A schema-reference variant is not part of v1.

### 1.2 Pydantic-owned typed sketch

The source-of-truth models live in the thin Python authoring distribution and generate the JSON
Schema and TypeScript ingress types committed in Morphe. The following sketch fixes the wire
shape; names may be shortened in implementation, but the fields and their authority must remain.

```python
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

type JsonValue = (
    None
    | bool
    | int
    | float
    | str
    | list[JsonValue]
    | dict[str, JsonValue]
)
type JsonObject = dict[str, JsonValue]
type Sha256 = Annotated[str, Field(pattern=r"^sha256:[0-9a-f]{64}$")]


class WireModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, allow_inf_nan=False)


class ViewModelContract(WireModel):
    # Stable human/operational identity, not a Python import path.
    id: str                    # e.g. "taxis.roster"
    revision: int = Field(ge=1)
    schema_dialect: Literal["https://json-schema.org/draft/2020-12/schema"]
    hint_vocabulary: str      # independent Morphe hint semver


class SourceSeals(WireModel):
    schema_sha256: Sha256
    content_sha256: Sha256
    testimony_sha256: Sha256


class Ed25519Attestation(WireModel):
    algorithm: Literal["Ed25519"]
    key_id: str
    signature: str            # unpadded base64url


class SourceSurfaceArtifactV1(WireModel):
    kind: Literal["morphe.source-surface"]
    wire_version: Literal["1.0"]

    issuer: str               # configured kernel identity
    surface_id: str           # concrete subject/query instance, checked by the caller
    source_revision: str      # opaque kernel revision/query identity
    produced_at: datetime
    valid_until: datetime | None = None

    view_model: ViewModelContract
    schema_: JsonObject = Field(alias="schema")
    data: JsonValue
    diagnostics: tuple[Diagnostic, ...] = ()

    # Empty for all current hints. Future non-degradable features opt in here.
    required_capabilities: tuple[str, ...] = ()

    seals: SourceSeals
    attestation: Ed25519Attestation
```

The source artifact deliberately contains no:

- `tree`;
- `grammar_version`;
- `compiler_version`;
- `producer_version` coupled to a compiler;
- `dialect_id`; or
- live handlers, credentials, or kernel repository objects.

`surface_id`, `issuer`, and `source_revision` identify the testimony. `surface_id` names the
concrete subject/query instance, not merely a template such as "roster"; `view_model.id` names the
template. This prevents a valid artifact for one organization/window from being substituted for
another. The schema digest identifies the exact type shape. A class rename that preserves the same
schema does not break compilation; the stable `view_model.id` remains the operational name.

### 1.3 Exact Pydantic serialization pair

The official authoring adapter starts from a validated model instance and uses matching aliases
and serialization semantics on both halves:

```python
schema = type(model).model_json_schema(
    mode="serialization",
    by_alias=True,
    ref_template="#/$defs/{model}",
)
data = model.model_dump(
    mode="json",
    by_alias=True,
    exclude_none=False,
)
```

Using serialization mode is mandatory: the wire must be validated against what Pydantic actually
serializes, not its Python input shape. `None` remains data when the schema permits null; it is not
treated like optional envelope metadata. All numbers must be finite.

Diagnostics continue to use the established `$`, `$.field`, and `$.rows[3].field` paths. Paths are
against serialized aliases, after deterministic sorting and minimization. The authoring adapter
rejects a diagnostic that targets a pruned field; the kernel must attach it to a visible ancestor
instead of silently losing it.

JSON object member order is not part of the RFC 8785 authenticated value, but field order is a
presentation input. After hidden minimization, the authoring adapter therefore stamps every
object schema's remaining property names into a signed `x-morphe.order` array. The compiler uses
that array rather than transport insertion order. Source admission requires every object schema
to name each visible property exactly once. The lower-level compiler remains total over malformed
or partial arrays by using a deterministic known-property fallback, but such a document is not an
admissible source-v1 artifact. A proxy or store may reorder JSON members without changing the tree.

### 1.4 Hidden means absent from the source artifact

Before hashing or signing, the authoring adapter recursively applies established
`x-morphe.hidden: true` annotations to **both** schema and data:

1. remove the hidden property from the effective schema;
2. remove it from the containing schema's `required` list;
3. remove the matching value from the serialized data;
4. recurse through local `$ref`, object, array, and nullable shapes; and
5. remove unreachable `$defs` without mutating a shared definition still used by a visible path;
   and
6. reject diagnostics rooted under the removed path.

The minimized pair is what the kernel signs and what the edge validates. The edge compiler should
still understand `hidden` defensively, but the official producer never sends a hidden value.

This preserves today's disclosure boundary. It also makes the rule explicit: `hidden` is not an
authorization mechanism, and secrets do not belong in a surface view model at all. It is a
deterministic wire-minimization directive for already authorized display data.

### 1.5 Static and per-request presentation

The two representative kernels already demonstrate the correct split:

- `morphe_hint(strategy=..., label=..., intents=..., heading=..., hidden=...)` is class-level
  authoring policy. Pydantic serializes it under `x-morphe` in the JSON Schema. Per-value intent
  maps such as `_FINALITY_TONES` and `_ROSTER_STATE_TONES` are therefore signed schema data. The
  request value selects an entry; the map itself is not recomputed by the edge.
- `KpiCell` is a Pydantic payload model. A kernel may compute its `value`, `kicker`, `format`,
  `currency`, and `intent` per request. Those fields serialize as ordinary typed `data`, and the
  stable `kpi-row` hint in the schema tells the edge how to interpret them.
- Kernel-computed labels, timestamps, units, pseudonyms, links, status values, and diagnostic
  messages are also ordinary typed data.

Do not add an untyped per-request “hint overlay.” If presentation policy genuinely varies by
request, express the varying part as an established typed payload value, as `KpiCell` already
does. If the schema-level policy itself is different, use a distinct versioned Pydantic view model
contract. That keeps every choice inside one signed schema/data testimony.

## 2. The edge compilation runtime

### 2.1 One TypeScript runtime

Port the current two-stage compiler into package-owned TypeScript, colocated with the renderer:

```text
src/lib/surface-edge/
  source.ts       source envelope types, bounds, and generated-schema ingress
  attest.ts       canonical hash and Ed25519 verification
  schema.ts       JSON Schema 2020-12 validation and local-ref policy
  hints.ts        forward-open x-morphe parser
  spec.ts         internal SurfaceSpec types
  build.ts        schema + data + diagnostics -> SurfaceSpec
  emit.ts         SurfaceSpec -> Node
  compile.ts      orchestration, diagnostics, receipt, cache identities
```

The public edge interface is one pure operation over admitted data:

```ts
compileSourceSurface(
  source: TrustedSourceSurface,
): { tree: Node; diagnostics: readonly Diagnostic[]; receipt: CompilationReceipt };
```

The active dialect is intentionally absent from this function. Compilation must preserve Lemma
3: one source testimony produces one tree, and the same tree survives a dialect swap. The viewer
runs the resulting tree through the active dialect's `G|D` gate before render. A Morphe release
that makes the generic compiler emit a compound disallowed by any shipped dialect is a package
release failure, caught by the conformance suite; it is not a kernel concern.

Pydantic remains the contract authority for:

- source artifact models and generated ingress schema;
- `MorpheHint`, `KpiCell`, `Diagnostic`, and closed vocabulary types;
- the authoritative `Node` grammar and generated TypeScript/JSON Schema; and
- cross-language canonicalization fixtures.

Pydantic does not require the execution engine to remain Python. The Python compiler remains only
as a migration oracle until parity is established, then is deleted. Keeping two production
compilers would recreate the authority split this design is intended to remove.

### 2.2 Validation versus total compilation

The edge keeps two failure classes separate:

- **Trust/contract failures fail closed:** bad signature, mismatched seal, unexpected issuer or
  surface ID, unsupported wire major, hostile bounds, remote `$ref`, invalid schema, data that
  does not validate against its signed schema, or unknown required capability.
- **Representational limits remain total:** a valid signed schema construct that Morphe cannot
  project—such as an unsupported genuine union—produces a visible diagnostic node and compiler
  diagnostic, exactly as ADR-0014 D8 requires.

Use a complete JSON Schema 2020-12 validator at this ingress. Do not derive the source-data trust
gate through a lossy JSON-Schema-to-Zod conversion; the existing handwritten semantic
compensation around the Node gate demonstrates why that is not a sufficient general schema
engine.

Initial source limits should be explicit and no weaker than the current artifact gate:

- 2 MiB encoded response;
- maximum structural depth 64;
- maximum 50,000 JSON values;
- maximum 10,000 entries in any collection;
- maximum 262,144 characters in one string;
- literal local `#/$defs/...` references only (RFC 6901 `~` escapes, no URI percent encoding);
  no network or filesystem resolution; and
- bounded `$defs`, reference traversal, compiler recursion, and emitted-node count.

### 2.3 Caching

There are two safe cache levels:

1. Cache parsed schema validators and schema-derived planning by `schema_sha256`.
2. Cache a compiled tree by `(testimony_sha256, compiler_build_sha256)`.

Never key a compiled tree only by source identity or view-model name. A viewer deploy changes the
compiler build identity and therefore naturally invalidates derived trees without changing a
kernel artifact. Dialect selection is applied after the tree cache and is never part of kernel
testimony.

## 3. Trust is re-anchored on the source artifact

### 3.1 What is sealed and signed

Use RFC 8785 JSON Canonicalization Scheme bytes and SHA-256 for stable cross-language test vectors:

```text
schema_sha256  = SHA256(JCS(schema))

content_sha256 = SHA256(JCS({
  data,
  diagnostics
}))

testimony_sha256 = SHA256(JCS({
  kind,
  wire_version,
  issuer,
  surface_id,
  source_revision,
  produced_at,
  valid_until,
  view_model,
  required_capabilities,
  signing: {
    algorithm,
    key_id
  },
  schema_sha256,
  content_sha256
}))

signature = Ed25519.sign(
  kernel_private_key,
  UTF8("morphe-source-surface-v1:" + testimony_sha256)
)
```

The testimony calculation excludes only `seals.testimony_sha256` itself and the signature bytes;
it includes the chosen algorithm and key ID. Metadata timestamps use one canonical UTC RFC 3339
encoding (`YYYY-MM-DDTHH:MM:SSZ`). The context prefix provides domain separation. Hashes are
identities; only the asymmetric signature makes the claims authentic. Each kernel has its own
signing key so one compromised producer cannot forge another. The viewer's source configuration
pins public keys by the composite `(issuer, key_id)` identity; a `key_id` is never a global lookup
key across issuers. Rotation overlaps old and new public keys for a bounded interval. Public keys
are not learned from the artifact being verified.

The signature says:

> This kernel testifies that this minimized, typed data and these diagnostics constituted this
> named surface at this source revision under this exact Pydantic schema and hint vocabulary.

It does **not** say that a particular compiler or dialect rendered it correctly.

### 3.2 Trust-gate order

Every source render path runs the same ordered gate:

1. bound response bytes before JSON decoding;
2. bound generic JSON complexity before recursive schema work;
3. validate the strict outer source-envelope shape and allowed algorithm;
4. match configured `issuer` and requested `surface_id`;
5. recompute schema, content, and testimony hashes;
6. verify the Ed25519 signature against the configured public key;
7. apply host freshness/replay policy to `source_revision`, `produced_at`, and `valid_until`;
8. reject unsupported schema dialects, non-local references, and recursive local-reference cycles
   that would make the bounded compiler omit finite signed data;
9. validate `data` against the signed schema;
10. check `required_capabilities` against the edge compiler;
11. compile to `Node` with total compiler diagnostics;
12. validate the Node against the current grammar and stamp that grammar version in the receipt;
13. validate the tree against the dialect that will actually render; and
14. render only the branded result.

An artifact store may add routing metadata, but it may not override any signed field. Route/store
identity must match the signed `surface_id`; a store is a delivery adapter, not an authority over
kernel testimony.

### 3.3 The compiled result is a receipt, not testimony

The edge records a deterministic receipt:

```ts
interface CompilationReceipt {
  readonly sourceTestimonySha256: `sha256:${string}`;
  readonly compilerVersion: string;
  readonly compilerBuildSha256: `sha256:${string}`;
  readonly grammarVersion: string;
  readonly treeSha256: `sha256:${string}`;
  readonly diagnosticsSha256: `sha256:${string}`;
}

interface DeliveryReceipt extends CompilationReceipt {
  readonly dialectId: string;
  readonly dialectPolicySha256: `sha256:${string}`;
}
```

The dialect-free compilation receipt supports cache identity and exact compiler replay. The viewer
adds dialect fields only after gating the exact tree that will render, producing a delivery
receipt. Neither receipt is signed by the kernel or may be presented as though the kernel authored
the tree. Given the signed source artifact and immutable compiler build, an independent verifier
can reproduce the compilation receipt.

### 3.4 What a compromised viewer can do

No trust gate running inside a compromised renderer can stop that renderer from displaying false
pixels. The same was true when the kernel shipped a compiled tree: a compromised viewer could
ignore it or replace the DOM.

This design makes the honest boundary precise:

| Threat | Result |
|---|---|
| Store, proxy, or network modifies schema/data/diagnostics | Seal or signature failure; reject |
| Store substitutes another kernel or surface | Issuer/surface mismatch; reject |
| Hostile but signed JSON exhausts resources | Pre-validation bounds; reject |
| Data does not satisfy the kernel's signed schema | Schema failure; reject |
| Compiler emits an invalid or out-of-dialect tree | Node/dialect gate; reject |
| Compiler emits a valid but visually wrong topology | Seam conformance test and replay receipt |
| Kernel itself lies | Valid testimony from that issuer; outside Morphe's authority |
| Viewer/runtime is compromised | It can lie about display; external verification is required |

The recommended threat model trusts the deployed viewer for presentation while keeping kernel
testimony independently verifiable. If adversarial-viewer resistance is required, the verifier
must live in a separately anchored client—such as a pinned desktop/client distribution or an
independently delivered verifier—not JavaScript served by the same compromised viewer.

## 4. Version negotiation

Do not collapse independent compatibility dimensions back into one package tag:

| Dimension | Owner | Source wire | Rule |
|---|---|---|---|
| Source wire major | authoring package + edge | `wire_version` and media type | Unknown major fails closed |
| JSON Schema dialect | Pydantic authoring contract | `view_model.schema_dialect` | v1 accepts 2020-12 only |
| Hint vocabulary | authoring package | `view_model.hint_vocabulary` + `x-morphe` | Forward-open; unknown fields ignored with diagnostics |
| Required compiler features | kernel author | `required_capabilities` | Unknown capability fails closed |
| Compiler version/build | Morphe edge | receipt and `/healthz` | Never negotiated with a kernel |
| Grammar version | Morphe package | receipt and `/healthz` | Never stamped by a kernel source artifact |
| Dialect and policy | viewer | delivery/route config | Applied and gated after compilation |

### Older kernel, newer edge

- A legacy tree-emitting kernel continues through the legacy reader during migration.
- A source-v1 kernel with an older hint vocabulary continues to compile.
- Missing hint fields select the structural floor.
- Established fields retain their meaning; a compiler release may fix their implementation
  without changing the source contract.

### Newer kernel, older edge

- Unknown keys inside `x-morphe` are ignored, preserving today's `extra="ignore"` policy. Known
  keys in the same block still apply; the compiler emits an `UNKNOWN_HINT` diagnostic for
  observability rather than rejecting the artifact.
- All presentation hints are degradable by default. A hint must never carry confidentiality,
  authorization, or business-correctness semantics. Hidden values are already pruned by the
  authoring adapter, so an older edge cannot expose them by ignoring a hint.
- If a future feature cannot degrade safely, the producer lists a stable capability string in
  `required_capabilities`; an older edge returns a compatibility failure instead of rendering a
  misleading floor.
- A source wire major the edge does not know is rejected. During migration the kernel continues to
  offer the legacy representation until every relevant viewer supports source v1.

Existing hint field names are never reinterpreted. Changed semantics require a new field name.
Unknown fields remain ignorable forever; removed fields remain reserved.

## 5. Kernel and edge responsibilities

The edge owns generic presentation structure. The kernel owns every fact that requires domain
authority or private state.

| Stays kernel-side | Moves to the edge |
|---|---|
| Authentication, authorization, tenant scoping | Source envelope admission and signature verification |
| Repository reads, event folds, and query windows | JSON Schema/data validation |
| Domain joins and canonical state interpretation | Hint parsing and strategy resolution |
| PII redaction and pseudonym/label resolution | Local `$ref`, nullable, cycle, and depth handling |
| Business ordering and pagination selection | `SurfaceSpec` construction |
| KPI arithmetic and per-request `KpiCell` values/intents | Mechanical `SurfaceSpec -> Node` emission |
| Domain-specific date/unit/reference formatting | Compiler-generated representational diagnostics |
| Authorized link targets and future action IDs | Node grammar and dialect-policy validation |
| Producer diagnostics and their stable visible paths | Derived tree/receipt caching |
| Hidden-field minimization | Rendering, context algebra, compounds, dialects, and CSS |
| Source revision/provenance and asymmetric signing | Compiler build and grammar version stamping |

The edge never receives a repository, service object, callback, token, or instruction to query
kernel-private state. If a render decision needs such state, the kernel materializes the result in
the typed view model before signing.

### 5.1 The Python package after migration

Split out a small, independently versioned `morphe-authoring` Python distribution. Preserve the
established authoring calls and models:

- `morphe_hint` and the forward-open `MorpheHint` vocabulary;
- `Strategy`, `NumberFormat`, closed intent/emphasis types;
- `KpiCell` and `Diagnostic`;
- `SourceSurfaceArtifactV1` and generated wire schema;
- `prepare_source_surface()` for Pydantic serialization, alias parity, hidden minimization,
  diagnostics checks, canonical seals, and signing; and
- canonicalization/signature test vectors and an offline verifier.

It contains no:

- `Node` grammar runtime dependency in kernels;
- `SurfaceSpec`, `build_surface`, `emit_node`, or `compile_surface`;
- `CompiledSurface` steady-state response model;
- grammar or compiler version pin; or
- dialect implementation.

Morphe itself still owns the Pydantic Node grammar for generated package artifacts. The six
kernels simply stop installing it. Keep `morphe_surface` compatibility re-exports only for the
migration window, then remove the production compiler from the Python distribution. Publish the
authoring package as a normal immutable registry artifact; compiler-only fixes no longer produce
an authoring release.

## 6. Zero-flag-day migration

### 6.1 Dual envelope kinds are required

The viewer accepts both formats during migration:

```text
LegacyCompiledSurface -> current bounds/schema/grammar/dialect gate -> Node
SourceSurfaceArtifact -> source trust gate -> edge compiler -> grammar/dialect gate -> Node
```

They converge only after their respective trust gates. Do not coerce a source artifact into a fake
legacy envelope or weaken legacy validation to share code earlier.

The new format uses:

```text
Content-Type: application/vnd.morphe.source-surface+json;v=1
```

The legacy format uses its existing adapter. Because legacy bare `CompiledSurface` has no kind
discriminator, the source configuration or response media type selects the parser; the viewer
must not guess from the presence of `tree` or `schema`. New endpoints may use `Accept` negotiation
to offer source v1 while retaining the exact old response for rollback.

### 6.2 Stages

#### Stage 0 — freeze contracts and evidence

- Add the Pydantic source envelope, canonicalization rules, Ed25519 vectors, and generated TS
  ingress schema in Morphe.
- Create representative minimized artifacts from Taxis and Obolos, including hidden sentinels,
  per-value intent maps, `KpiCell` data, row diagnostics, local refs, nullable fields, and links.
- Record current Python `SurfaceSpec` and Node outputs as migration oracles.

No kernel endpoint changes.

#### Stage 1 — ship the dual viewer and TypeScript compiler

- Port `resolve/build/emit` into the viewer package.
- Admit source artifacts through the new trust gate.
- Keep current compiled-tree routes unchanged.
- Run the Python and TypeScript compilers over the same fixture corpus and require structural Node
  parity except for explicitly reviewed bug fixes.
- Deploy the viewer before any kernel returns source v1.

Reviewed Stage 1 corrections are part of the frozen conformance corpus, not silent drift:

- overlapping-union hidden analysis fails closed when any applicable branch marks a field hidden;
- source admission rejects any residual `hidden: true` marker after minimization and rejects a
  malformed disclosure marker rather than treating it as an un-hide;
- local `$ref` presentation hints inherit the target's signed property order and hidden boundary;
- source trust roots are indexed by composite `(issuer, key_id)`, preventing a compromised
  co-issuer key with the same `key_id` from authenticating another issuer's testimony;
- property-order stamping covers every schema carrying `properties`, including Draft 2020-12
  composition shapes without an explicit `type: object`;
- source references are restricted to bounded literal `#/$defs/...` chains with RFC 6901 decoding;
  URI percent encoding and nested `$id` bases are rejected so the validator and compiler cannot
  resolve different targets;
- malformed signed order falls to a deterministic sorted floor without discarding valid sibling hints,
  while malformed presentation hints retain a valid signed order;
- nullable/empty table cells lower to an aria-hidden `Spacer` so renderer CSS cannot collapse a
  cell and shift later columns; and
- explicitly scalarized JSON containers use canonical JSON rather than transport member order;
- Python float spelling, numeric intent keys, and prototype-named fields/maps are parity-locked;
- KPI diagnostics render inside the promoted card body instead of existing only in the receipt; and
- unknown hint keys remain ignored for forward compatibility but produce an informational
  compiler diagnostic.

Both compilers and the committed oracles carry the shared corrections. RFC 8785 input follows its
IEEE-754 domain: unsafe integer-form tokens are rejected before parsing, while representable
decimal/exponent doubles remain admissible and canonicalizable. Numeric presentation additionally
refuses decimal or exponent text that would round to an unsafe integral double, preserving the
signed source spelling instead of displaying a different value.

Rollback is the untouched legacy reader.

#### Stage 2 — pilot Taxis, then Obolos

Taxis is the first pilot because its representative surfaces exercise tables, numbers, status,
progress, linked refs, per-value intent maps, KPI rows, hidden values, and path-keyed diagnostics.
Obolos follows because its evidence seals, pseudonymization, exception rows, and multi-currency
decisions pressure-test testimony and minimization.

Each adds a source-v1 representation beside the existing compiled response. The viewer or artifact
delivery adapter requests source v1 for one declared surface at a time. Compare:

- admitted source identity and signature;
- minimized payload (hidden sentinels absent);
- legacy Python tree versus edge tree;
- rendered semantic content; and
- compilation receipt and latency.

Switch back to the legacy representation by configuration if any comparison fails.

#### Stage 3 — migrate the remaining four kernels independently

- Release the same authoring package to Misthos, chreos, Apotheke, and zygos.
- Add source-v1 responses without removing legacy responses.
- Switch one source/surface at a time in delivery configuration.
- Require an observation window with zero signature, schema, capability, Node, or dialect-gate
  failures before moving to the next kernel.

There is no shared cutover date and no fleet-wide feature flag.

#### Stage 4 — make source v1 authoritative

After all six kernels have run through the source path, stop producing new compiled trees for
normal requests. Retain the legacy endpoint and frozen Python compiler for one bounded rollback
window. Source artifacts are now the stored/audited testimony; edge trees are derived cache
entries.

#### Stage 5 — retire tree emission from kernels

- Remove `CompiledSurface`, `compile_surface`, `morphe_grammar`, grammar-version assertions, and
  their git pins from each kernel.
- Remove the legacy viewer reader only after its rollback window and stored legacy artifacts no
  longer require that deployment.
- Delete the Python compiler after the TypeScript conformance corpus is authoritative.

### 6.3 Cost and risk

| Stage | Kernel rebuilds | Morphe/delivery deploys | Cost | Primary risk | Required mitigation / rollback |
|---|---:|---:|---|---|---|
| 0. Contract + vectors | 0 | 0 | Medium | Cross-language canonical bytes diverge | Golden JCS/hash/signature vectors in Python and TS |
| 1. Dual viewer + TS compiler | 0 | 1+ | Very high, concentrated once | Compiler semantic or performance drift | Full Python/TS corpus parity, bounded property tests, legacy reader untouched |
| 2. Taxis then Obolos pilots | 2 additive builds | 1 delivery/config change per pilot | Medium | Hidden-data regression, bad key wiring, path drift | Hidden sentinels, pinned issuer keys, shadow tree/render comparison, config rollback |
| 3. Remaining four kernels | 4 additive builds | Incremental config changes | Medium, distributed once | Inconsistent schema aliases or uncommon hints | One-at-a-time admission, source fixtures, capability telemetry, legacy fallback |
| 4. Source authoritative | 0 | 1 policy/config deploy | Low | Premature loss of rollback confidence | Bounded dual-read observation window and receipt audit |
| 5. Remove legacy compiler | 6 cleanup builds | 1 Morphe cleanup deploy | Medium, one-time | Old stored artifacts or clients still depend on trees | Inventory consumers, retain a frozen legacy viewer image, explicit removal date |
| **Steady-state compiler fix** | **0** | **1 viewer deploy** | **Low** | Viewer regression | Edge conformance gate + immutable rollback image |

The migration does incur two one-time kernel touches—add source testimony, then remove the frozen
legacy compiler. That is preferable to hiding migration complexity in a permanent dual compiler.
After retirement, the measured six-lockfile/six-image fan-out disappears for compiler work.

## 7. The compiler-renderer seam contract

Colocation reduces release fan-out but does not by itself pin the contract. The alert-row bug was
a valid-tree bug: Python emitted a wrapper, while `Grid.svelte` applied `subgrid` only to direct
child grids. Grammar validation and artifact snapshots both allowed the broken topology.

Add one required browser suite named `edge-surface-contract.e2e.ts`. Its public test seam is the
whole operation:

```text
signed Pydantic SourceSurface fixture
  -> source trust gate
  -> edge build + emit
  -> Node + every-dialect policy gate
  -> MorpheRoot
  -> real browser layout
```

The test must not begin from a hand-authored Node fixture. That would skip the contract it exists
to pin. Python may generate/check the committed source fixture, but the browser test runs entirely
inside the shipped TypeScript viewer runtime.

### 7.1 Required fixture

One compact source fixture includes:

- a root identity;
- a `kpi-row` of numeric and textual `KpiCell`s;
- a status with a per-value intent map;
- a progress value;
- a ruled table with at least two rows and at least three columns whose content widths are
  deliberately unequal;
- one row-level diagnostic and one cell-level diagnostic;
- a linked reference;
- a nullable number; and
- a hidden field containing a unique sentinel string.

The authoring-side fixture test first asserts the hidden property name is absent from the effective
schema and its unique sentinel value is absent from source data. The browser test asserts the
sentinel never appears in the DOM.

### 7.2 Required assertions

The suite asserts all of the following:

1. source signature, seals, schema, and data pass the real admission gate;
2. the compiled tree passes the generated Node gate and all nine shipped dialect policies;
3. the same tree object is used for `gallery` and `ledger` renders;
4. expected headings, status text, diagnostics, numbers, links, and accessible semantics render;
5. the tabular parent is a `.mo-grid[data-columns]`;
6. every emitted row grid is a **direct child** of that parent;
7. a row-level `.mo-alert` is a **direct sibling** of its row grid, never a wrapper parent;
8. the browser computes the row as a subgrid;
9. header and body cell left edges align within a small subpixel tolerance at both wide and narrow
   container widths; and
10. the row alert's left and right edges span the table content box.

Run the geometry assertions in Chromium and Firefox. A Node golden snapshot remains useful, but it
is secondary: the bounding-box assertions pin the compiler topology to the CSS behavior the user
actually sees.

The suite is mandatory whenever any of these change:

- source wire or hint parsing;
- `SurfaceSpec`, build, or emit logic;
- Node grammar or promoted compounds;
- `MorpheRoot`, renderer recursion, or dialect constraints;
- layout/feedback primitive markup; or
- primitive CSS selectors that consume emitted topology.

This is the missing seam contract: a change to either producer shape or renderer CSS fails the
same test in the same release.

## 8. Acceptance criteria for the completed migration

The design is complete only when all of the following are true:

- a kernel source response contains typed minimized schema/data testimony and no `tree`;
- the hidden-field sentinel test proves edge compilation did not broaden disclosure;
- the source artifact is independently signature-verifiable without trusting the store;
- the viewer has one bounded source gate before compilation and one Node/dialect gate after it;
- the production compiler and renderer ship in the same TypeScript artifact;
- kernels no longer install `morphe_grammar` or carry a compiler/grammar pin;
- dialect selection remains viewer-side and does not alter the compiled tree;
- a compiler-only change causes one viewer build/deploy and zero kernel builds;
- legacy compiled artifacts remain renderable only for the explicitly bounded compatibility
  window; and
- the browser seam suite catches the alert-row topology regression without a bespoke regression
  test outside that suite.

## 9. Open questions requiring founder judgment

### 9.1 Is a compromised viewer an in-scope adversary?

**Recommendation:** treat the viewer as trusted presentation compute, preserve independently
verifiable signed source artifacts and receipts, and do not claim the in-viewer gate can police its
own compromised runtime. If the viewer itself is adversarial, approve a separately distributed,
pinned verifier/client as a distinct security project.

**Founder decision (2026-07-17): out of scope.** The viewer is trusted presentation compute; no
separately anchored verifier is planned. Signed source artifacts and receipts remain independently
verifiable as designed.

### 9.2 How durable is the full signed source payload?

**Recommendation:** retain the full source artifact only as long as the owning kernel's data policy
allows; retain the testimony digest, signature, issuer, source revision, and compilation receipt
for longer audit needs. Declaring every source payload permanent would turn display-oriented PII
and operational detail into a new archive. The founder must choose whether any surface class is
durable evidence rather than short-lived render testimony, because that choice controls store
retention, `valid_until`, erasure, and replay policy.

**Founder decision (2026-07-17): minimal retention — fastest path that does not break
functionality.** Source artifacts are short-lived render testimony; no durable artifact archive is
built in v1. No surface class is declared durable evidence yet; a PII-aware retention/audit policy
is deferred to a later pass.
