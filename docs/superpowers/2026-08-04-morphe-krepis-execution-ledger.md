# Morphe -> Krepis execution ledger

> Operational evidence for the bounded 2026-08-04 harness run. This is not Morphe package doctrine
> or a Sokrates ownership decision. Facts below are updated only from inspected refs and commands.

## Authority boundary

- Writable repositories: Morphe and Krepis only.
- Authorized delivery: branch, commit, push, non-draft pull request, and current-head CI repair.
- Not authorized: merge, tag, publish, deploy, default-branch changes, or changes to Sokrates/Hive.
- Morphe establishes the contract first; Krepis compatibility follows against an exact Morphe SHA.

## Refreshed baselines

| Repository | Default | Refreshed base | Worktree | Branch | Existing user state |
|---|---|---|---|---|---|
| Morphe | `master` | `759357f4e66ca061267cfa665bbbbec2de59499d` | `/Users/hakonfreyrgunnarsson/Documents/Codex/2026-08-04/morphe-deterministic-integration` | `codex/deterministic-control-plane-integration` | Original checkout retains the untracked control-plane plan. |
| Krepis | `main` | `e13edd1a1fcc251dc8e8252914671bf0ba8e1fdc` | `/Users/hakonfreyrgunnarsson/Documents/Codex/2026-08-04/krepis-profile-integration` | `codex/profile-morphe-integration` | Original checkout retains untracked `packages/zygos/frontend/package-lock.json`. |

Both repositories had zero open pull requests when refreshed. The user-owned checkouts have not
been cleaned, reset, switched, staged, or otherwise repurposed.

## Model-routing experiment

| Wave | Role | Requested route | Actual route | Scope | State |
|---|---|---|---|---|---|
| 0 | Orchestrator | GPT-5.6 Sol max | GPT-5.6 Sol max | Contracts, worktrees, adjudication, integration, delivery | active |
| 1A | Implementer/auditor | GPT-5.6 Luna max | GPT-5.6 Terra max | Morphe deterministic mid-loop audit and core | complete; worker `d6e3621`, Sol accepted as `8ea5c00` |
| 1B | Implementer/auditor | GPT-5.6 Luna max | GPT-5.6 Terra max | Morphe compound/CMS/package audit | complete; staging corpus handed off |
| 1C | Implementer/auditor | GPT-5.6 Luna max | GPT-5.6 Terra max | Morphe neutral browser-proof audit | complete; worker `2e89748`, Sol accepted as `06e4f1c` |
| 1D | Implementer/writer | GPT-5.6 Luna max | GPT-5.6 Terra max | Deterministic mid-loop doctrine | complete; worker `575ca55`, Sol accepted as `a96ecf7` |
| 1E | Implementer/verifier | GPT-5.6 Luna max | GPT-5.6 Terra max | Sealed six-kernel source-v1 corpus | complete; worker `7572503`, Sol accepted as `49f11f7` |

Luna is not exposed by this harness. Terra substitutions are explicit and must not be reported as a
Luna trial. Token and billing measurements are unavailable unless the runtime later exposes them.

## Initial Morphe evidence

### Already proved at the refreshed base

- `ContextDigest` is versioned and snapshots store state plus the bounded tier-1 event window.
- `applyDelta` returns the exact same envelope object for stale epochs, dead ids, and out-of-range
  choices; accepted deltas clone the envelope and choice map while retaining the tree object.
- Property tests cover adversarial deltas, re-emission invalidation, targeted `Within`, reversed
  ranges, and call-site compound args/slots.
- `MorpheRoot` receives choices only; epochs remain host-side.
- The gold and compound-mint fixtures, CMS gate subset, and package catalog tests are green at the
  base in targeted runs.

### Confirmed gaps requiring adjudication or implementation

| Requirement | Current evidence | Status |
|---|---|---|
| Deterministic objective policy | Only `createDevStaticChoiceMidLoop` exists; it ignores the digest and proposes one configured choice for every id. | missing |
| Complete host circuit | `/substrate` writes choice maps directly from native controls; it does not run delegate proposals through `applyDelta`. | missing |
| Proposal outcome ledger | No typed proposed/accepted/rejected/superseded replay record exists. | missing |
| Policy enforcement | `applyDelta` checks epoch/id/bounds but has no concept of an explicit objective policy or user override. | missing above the Delta gate |
| Malformed delegate output | The delegate interface is typed, but no runtime host-circuit guard proves hostile or cast output fails closed. | missing |
| Compound-template variation discovery | Delegation walks primitive children and compound call-site args/slots but deliberately does not expand compound templates. CMS preview inspection does expand registered compounds. | contract mismatch |
| Tier-2 live producer | The typed provider exists, but ADR-0022 deliberately forbids inventing an in-tree producer merely to fill the evidence matrix. | deferred unless a real producer is identified |

### Sol architecture adjudication

- Keep the existing versioned `ContextDigest`. Versioning is an accepted ADR-0003 decision, is
  exported and replay-tested, and crosses both mid-loop and tier-2 evidence seams. It is not a new
  speculative wrapper.
- Keep the renderer choices-only. The operational circuit remains pure host-side code and does not
  add epoch, digest, policy, delegate, or ledger props to `MorpheRoot`.
- Resolve the real compound mismatch through an explicitly injected `CompoundResolver`. Admission
  must expand exactly the compounds visible to the matching dialect/lifecycle view; a global
  registry shortcut would authorize sockets the renderer may hide.
- Preserve the public IDs-only `MidLoopDelegate` signature. Bind richer live-variation descriptors
  into a concrete deterministic delegate at construction rather than widening every delegate call.
- Define one thin objective-policy seam: declared state paths, declared tier-1 event kinds, explicit
  target ids/objectives/choices, and a pure choice function that receives only the projected digest.
  No predicate registry, generic rule language, click inference, or model inference is authorized.
- User overrides use canonical Delta admission, supersede the accepted choice, and lock that id
  against delegate changes for the remainder of the current epoch. A new emission epoch clears the
  lock.
- Runtime-malformed delegate output is handled at the host circuit ingress, not by weakening the
  typed two-argument `applyDelta` API into an unbounded parser.
- Keep `/p/demo` as the immutable publication-pointer proof. The live circuit belongs on the
  neutral `/substrate` host, where actions, state, policy, and Delta application are owned.
- Keep every requested compound/browser/accessibility obligation. Shared properties are proved by
  existing automated catalog, package, SSR, dialect, contrast, and browser gates; manual inspection
  is reserved for gaps those gates do not encode.
- Keep the Morphe -> Krepis run continuous, with independent PR/checkpoint boundaries and a single
  evidence-led audit-and-rewrite pass per kernel pair to avoid duplicated profile work.

## Baseline commands

| Time (UTC) | Repository | Command | Result |
|---|---|---|---|
| 2026-08-04T13:56 | Morphe | `bun install --frozen-lockfile` | pass; 231 packages installed |
| 2026-08-04T13:56 | Morphe | `uv sync --extra service` | pass; local `morphe-grammar==0.12.0` installed |
| 2026-08-04T13:56 | Morphe | targeted delegation/state/substrate/mint/preview Vitest run | 8 files, 30 tests passed; pre-sync tsconfig warning recorded |
| 2026-08-04T13:57 | Morphe | targeted ActionSummary/compound/CMS/dialect pytest run | 87 tests passed |
| 2026-08-04T14:02 | Morphe | mid-loop audit: delegation/state/preview Vitest | 6 files, 56 tests passed |
| 2026-08-04T14:02 | Morphe | mid-loop audit: targeted Within DOM Vitest | 1 file, 7 tests passed |
| 2026-08-04T14:08 | Morphe | proof audit: compound/presenter/substrate/delegation Vitest | 7 files, 70 tests passed |
| 2026-08-04T14:08 | Morphe | proof audit: compound/CMS/dialect pytest | 62 tests passed |
| 2026-08-04T14:08 | Morphe | proof audit: `bun run test:contrast` | 46 Chromium/Firefox tests passed in 15.9s |
| 2026-08-04T14:24 | Krepis | `uv sync --all-packages` in fresh integration worktree | pass; supported `py-v0.12.0` resolved to `f119d0e`; no tracked drift |
| 2026-08-04T14:25 | Krepis | focused `krepis-conformance` agent-profile tests | 28 passed; one upstream Pydantic deprecation warning |
| 2026-08-04T14:26 | Krepis | baseline `just conformance` on current `main` | 155 passed, 1 declared Obolos sequence-pin abstention; six profile sections reached and passed |
| 2026-08-04T14:27 | Krepis | baseline `just openapi-check` | pass for all six kernels; package and Sokrates-bundle mirrors current |

## Audit findings accepted for implementation

1. No non-test host currently joins digest, policy, delegate, Delta admission, choices, render, and
   outcome evidence.
2. `liveVaryIds` and the renderer disagree for template-contained variations: the renderer expands
   a visible compound while registry-free admission cannot see its template.
3. No deterministic proposed/accepted/rejected/superseded outcome record exists.
4. Current `/substrate` sliders are direct choice writes, not replayable user overrides.
5. The CMS preview inspector expands compounds but omits targeted `Within` sockets.
6. Runtime-malformed delegate output can throw before the typed Delta gate; an operational ingress
   must fail closed.
7. The tier-2 provider remains deliberately producer-less; no fake primitive will be added.
8. The compound/CMS/package chain has no reproducible product defect. Its strongest installed
   Clinical-schema falsifier passed ad hoc but is not yet retained by `pack:verify`; that evidence
   gap is being closed.
9. `AGENTS.md` still describes Clinical's retired one-compound policy, and the historical CMS
   design spec names superseded register-intent keys without an as-built correction.
10. The old registry-free `liveVaryIds` indexes targetless legacy `Within` leaves even though
    CONTEXT.md and ADR-0018 make them inert compatibility data with no authority. The new index
    excludes them while retaining targeted `Within` admission.

The mandatory stale-epoch invariant already passes at the base: replaying an older delta returns
the exact current envelope, tree reference, choices object, and choice contents unchanged. It stays
in the new circuit regression suite because it is the smallest exploit probe for epoch authority.

## Active implementation worktrees

| Packet | Worktree | Branch | Writable boundary | State |
|---|---|---|---|---|
| Deterministic mid-loop core | `/Users/hakonfreyrgunnarsson/Documents/Codex/2026-08-04/morphe-midloop-core` | `codex/deterministic-midloop-core` | `src/lib/delegation/**`, associated tests, public exports | complete; worker `d6e3621`, Sol accepted as `8ea5c00` |
| Durable browser proof | `/Users/hakonfreyrgunnarsson/Documents/Codex/2026-08-04/morphe-browser-proof` | `codex/deterministic-browser-proof` | `e2e/contrast-a11y.e2e.ts` | complete; worker `1d69143`, Sol accepted as `46e6594` |
| Installed mask evidence | `/Users/hakonfreyrgunnarsson/Documents/Codex/2026-08-04/morphe-pack-evidence` | `codex/installed-mask-evidence` | `scripts/pack-verify.ts` plus two bounded documentation corrections | complete; worker `2bd1605`, Sol accepted as `837a66d` |
| Deterministic mid-loop doctrine | `/Users/hakonfreyrgunnarsson/Documents/Codex/2026-08-04/morphe-midloop-core` | `codex/deterministic-midloop-core` | ADR-0024 plus current contract/vision/status/reconstruction/agent guidance | complete; worker `575ca55`, Sol accepted as `a96ecf7` |
| Neutral live circuit | `/Users/hakonfreyrgunnarsson/Documents/Codex/2026-08-04/morphe-live-proof` | `codex/deterministic-live-proof` | `/substrate`, resolver-matched CMS preview inspection, and associated tests | complete; worker `2e89748`, Sol accepted as `06e4f1c` |
| Six-kernel proof corpus | `/Users/hakonfreyrgunnarsson/Documents/Codex/2026-08-04/morphe-kernel-proof` | `codex/six-kernel-proof-corpus` | `fixtures/krepis-proof/**` plus pure loader and focused test | complete; worker `7572503`, Sol accepted as `49f11f7` |

## Compound, CMS, and package audit

No implementation repair was found in the authoritative chain. The following all passed at the
refreshed base:

- targeted Python catalog, gold, CMS, and dialect-mask tests: 24 passed in 0.24s;
- targeted TypeScript compound/mint/presenter/compiled-preview tests: 24 passed;
- DOM CMS render smoke: 1 passed;
- `just schema-check`;
- `bun run pack:verify` in 6.55s;
- `just py-pack-verify` in 0.15s;
- isolated Chromium ADR-0023 proof: 2 passed in 4.9s;
- isolated Firefox ADR-0023 proof: 2 passed in 4.0s;
- an installed-tarball Draft 2020-12 falsifier: all 17 complete promoted references accepted by
  the installed Clinical schema and `UnknownCompound` rejected.

One concurrent Chromium run lost its execution context while the shared Vite worktree observed a
new Markdown file. The isolated Chromium rerun and Firefox run both passed, so this is retained as
a shared-worktree/HMR test risk, not misreported as a product defect.

The durable browser follow-up changed one file and passed Biome, 4 targeted Chromium/Firefox
regressions, and the complete 48-test contrast packet. Sol inspected the exact diff before
cherry-picking it. It now pins Clinical at 390px across the complete mint and gold host controls,
and proves every global dialect leaves the explicit nested `night` root unchanged.

The installed-mask follow-up changed three authorized files and passed a fresh `pack:verify` in
5.90s, `just schema-check` in 3.40s, Biome, and diff checks. The package consumer now runs the
installed Clinical JSON Schema itself against all catalog-derived complete references and rejects
an unknown compound. Its Svelte/Vite/plugin/TypeScript compiler lane is pinned to the repository's
lock-resolved versions and explicitly bundles Morphe during SSR. A separate fresh-consumer probe
showed Svelte 5.56.8 with Vite 5.4.21/plugin 4.0.4 rejects the packaged rune module; no latest-minor
compatibility claim is made from the locked verification lane.

## Deterministic mid-loop core acceptance

The Terra implementer completed the bounded core packet in commit `d6e3621` at 14:36 UTC. It adds
resolver-aware live-variation evidence, a declared-input deterministic objective policy, a pure
host runtime, immutable outcome records, fail-closed ingress, user locks, and strictly monotonic
epoch re-emission without adding state or policy to the grammar or renderer. Targetless legacy
`Within` leaves are now consistently inert in both render behavior and Delta authority.

Sol inspected the exact committed diff before accepting it as integration commit `8ea5c00`. Three
orchestrator-found corrections were required before acceptance:

1. recent events are projected only when both their kind and store path are declared;
2. authored range tuples are copied and frozen rather than retained by reference; and
3. only a strictly higher safe-integer epoch clears a user lock; same, lower, fractional, and
   non-finite re-emissions produce deterministic host rejection evidence while preserving the exact
   active envelope, choices, and locks.

The worker's exact-commit gates passed: `bun run check` reported zero errors and warnings, and
`bun run test` passed 68 TypeScript files / 895 tests plus 4 DOM files / 13 tests. Sol's integration
rerun independently passed `bun run check` and the complete 68-file / 895-test TypeScript phase. A
subsequent misuse of the aggregate test script with file selectors reached its DOM phase with no
matching files and exited 1; that selector invocation is not a product failure and will not be used
as final gate evidence.

The explicit runtime-generative follow-up landed as worker `d4fc7df` and Sol accepted it as
integration commit `5aca9c2`. Across 200 deterministic seeds it shuffles malformed, stale, dead-id,
out-of-range, structurally live but unowned, and policy-disallowed proposals; it proves the runtime
never throws or accepts, preserves exact envelope/tree/choice identity for an all-rejected packet,
records every expected reason, and produces byte-stable records and final state for equal inputs.
The worker's focused property suite passed 36/36 plus a clean type check; Sol inspected the exact
one-file diff and independently reran the 36-test property file successfully.

Sol then extended the installed-tarball consumer in integration commit `0efc476`. The Vite-built
SSR consumer imports the new public policy/runtime seams from the packed package, runs a declared
digest through a deterministic policy, proves the accepted choice and proposal/acceptance records,
proves undeclared state/events are absent from policy evidence, then replays an older epoch and
checks exact envelope/tree/choice identity is retained. `bun run pack:verify` passed from a fresh
throwaway consumer, and Biome plus diff checks were clean.

The bounded doctrine packet landed as worker `575ca55` and Sol accepted it as integration commit
`a96ecf7` after exact-diff review. ADR-0024 records the resolver-specific authority proof, targetless
`Within` inertness, duplicate-id bound intersection, declared path-plus-kind projection, canonical
runtime admission, immutable evidence, user locks, and strictly monotonic safe-integer re-emission.
It keeps the renderer choices-only, preserves `/p/demo` as a publication route outside the live
mid-loop, and explicitly excludes a tier-2/model producer and six-kernel curation from package
doctrine. The same facts now agree across `CONTRACT.md`, `VISION.md`, `STATUS.md`, the reconstruction
plan, and agent guidance. The worker's diff checks passed; Sol found no doctrinal contradiction.

## Neutral live-circuit acceptance

The Terra proof worker completed the host circuit as commit `2e89748`; Sol inspected the exact
13-file diff and accepted it as integration commit `06e4f1c`. `/substrate` now joins one stable
authored `Vary`/targeted-`Within` tree to the exact dialect-restricted resolver, a declared host
policy, the canonical Delta runtime, choices-only rendering, user locks, strict epoch re-emission,
and a bounded immutable evidence ledger. Native controls retain the host-owned policy, digest,
epoch, replay comparison, receipts, and explicit escalation callback; no tier-2/model producer was
fabricated and `/p/demo` remains outside the mid-loop.

Before acceptance, Sol required four proof-quality corrections: replay comparison may append only
the one actually applied run; CMS preview controls may never enumerate an arbitrary `Within` range;
fractional, reversed, duplicate, and empty ranges must be reduced to their canonical integer
intersection; and the DOM circuit proof must live in the canonical DOM test phase. The presenter
contract was also separated from the route-owned policy so authored UI has no host-policy
dependency. The CMS inspector now derives both actions and variation authority through the same
resolver used by rendering, so unknown, dialect-invisible, and invalid compounds grant nothing.

The worker passed Svelte checking, 69 standard files / 902 tests, and 5 DOM files / 14 tests, plus a
390px browser probe with no overflow or console failure. After cherry-pick, Sol independently ran
Svelte checking, Biome, 69 standard files / 903 tests, and 5 DOM files / 14 tests; all passed.

## Six-kernel fixture boundary audit

A read-only Terra audit of current Krepis `origin/main` found that Morphe's existing generic source
corpus is not a six-kernel proof: its Taxis and Obolos examples are historical/generated pilots,
and the four `krates-*` cases are compiler vectors rather than current kernel outputs. The accepted
architecture is one-way: each kernel owns its real presenter/route story and disclosure invariant;
Krepis conformance may aggregate the family census; Morphe receives only fixed public signed source
documents plus provenance/checksum metadata and must not copy kernel domain models or private
fixture seeds. The representative current routes are Taxis roster, Misthos run summary, Chreos
obligations, Obolos finality, Apotheke expiry, and Zygos transaction. Static browser transport may
serve those bytes but must not become a kernel simulator.

The real-route fixture probe reached all six representative producers. Taxis roster, Misthos run
summary, Chreos obligations, Obolos finality, Apotheke expiry, and Zygos transaction each returned
current signed source-v1 testimony through its actual FastAPI route and existing public test story.
The shared staging control freezes only `SourceSigner.produced_at`; case-specific existing test
seams separately pin Obolos storage/read clocks, Apotheke fixture UUID sequence and storage clock,
and Zygos book identity and storage clock. Those controls prove deterministic public-fixture export,
not production entropy equivalence. No private signing material may enter the Morphe corpus.

The Terra corpus worker committed the sealed handoff as `7572503`; Sol inspected all 24 changed
paths and accepted it as integration commit `49f11f7`. The committed boundary contains exactly 22
fixture files (README, manifest, validation/source-generation receipts, and six source/spec/node
triples) plus a pure six-case loader and focused test. The 18 evidence documents and both retained
root receipts compare byte-for-byte with staging; per-case generation receipts, exporter/compiler
scripts, kernel code, logs, and private test material remain outside Morphe.

At acceptance, the focused test independently verified every recorded byte size and SHA-256,
Ed25519 admission against the matching public key, exact source identity/revision/seals, two exact
compiler replays, SurfaceSpec/Node equality, grammar validity, deterministic SSR under all nine
dialects, the exact file allowlist, broad secret/PII tripwires, and source-only absence of the five
kernel-specific forbidden keys. The worker and Sol each passed the two-test corpus file plus clean
type/style checks. Sol's first presenter integration test used a non-contiguous rendered text marker
and failed once; changing only that assertion to the actual heading text made the four focused files
pass 15/15 before the separate runtime exhibit integration began.

## Neutral proof integration acceptance

Sol wired the accepted corpus into the existing neutral workbench in commit `365b1ae`, without
wrapping or rewriting any fixed tree. One native case selector chooses among the six immutable
artifacts; the proof rail exposes issuer, operation, surface, revision, testimony, and tree receipt.
The renderer still owns only the tree/dialect, and every domain/signing claim remains with the
source producer.

The first two-engine run failed before interaction because SvelteKit's Vite filesystem allowlist
excluded the repository-level sealed fixture directory. A narrowly enumerated read-only fixture
root repaired that real integration boundary. The next run exposed two independent issues: the
test used programmatic rather than keyboard focus to evaluate `:focus-visible`, and Firefox let the
Zygos 64-character signed event hash widen the page by 262px. The test now moves focus by keyboard;
the substrate's generic `Text` leaf now permits emergency wrapping of unbroken evidence tokens.
The third focused run passed all four Chromium/Firefox cases, including all six Clinical fixtures
at 390px. The complete contrast/accessibility matrix then passed 52/52 in 17.5 seconds.

A separate hydrated Chromium inspection at 390px recorded meaningful content, 11 native buttons,
zero Vite overlays, zero console/page errors, and `clientWidth === scrollWidth === 390`, then saved
and visually inspected the complete Zygos page. The integrated web suite passed 70 server files /
906 tests plus 5 DOM files / 14 tests, and the production Vercel build succeeded.

The unchanged full `just gates` boundary then passed from integration head: compiler identity,
Biome, root and viewer strict checks, 906 server tests, 14 hydrated DOM tests, both production
builds, the installed npm consumer, 20 viewer edge-browser cases, 52 contrast/integration browser
cases, 562 Python tests, Ruff, ty, grammar/surface/CMS drift checks, and isolated wheel/sdist
verification. An initial local rerun exposed a macOS `hidden` filesystem flag on the disposable
`.venv` that made Python 3.13 skip editable `.pth` files in child interpreters. Clearing that local
metadata made the focused subprocess falsifier and the unmodified aggregate gate pass; no source or
test was weakened.

## Dependency and release boundary

Krepis currently pins the single family source to Morphe `py-v0.12.0`. That tag predates Morphe
PRs #88 and #89. The supported-tag lane must keep the committed pin unchanged. The exact-head lane
may use a reversible exact-SHA substitution only in an isolated verification environment. No tag or
publication is authorized.

## Pending evidence

- Morphe PR/current-head CI.
- Six-profile Krepis audit and evidence matrix.
- Supported-tag and exact-head compatibility lanes.
- Krepis PR/current-head CI.
- Final model-routing efficacy assessment and requirement-by-requirement completion audit.
