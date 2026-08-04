# Sol orchestrator / implementer efficacy report

> Run: Morphe -> Krepis deterministic integration and six-profile refresh
>
> Date: 2026-08-04
>
> Status: implementation and local evidence complete; remote delivery evidence is recorded below.

## Executive finding

The orchestrator/implementer pattern improved throughput and evidence breadth in the Morphe phase,
but the result is a **Sol/Terra** trial, not a Sol/Luna trial. GPT-5.6 Luna was not exposed by the
harness, so every requested Luna-max assignment used GPT-5.6 Terra at max reasoning. Sol retained
contract interpretation, non-overlapping task boundaries, exact-diff acceptance, integration,
browser adjudication, and all final claims.

The strongest observed benefit was parallel, bounded evidence construction: compound/package,
mid-loop, browser, doctrine, and six-kernel producer work progressed without shared-file conflicts.
The strongest observed cost was semantic review: green worker tests did not by themselves catch
several authority, replay, range-totality, and integration-boundary defects. Sol review materially
changed the accepted result. This supports the pattern when the orchestrator has enough time and
context to inspect every diff; it does not support treating a worker's green handoff as acceptance.

Token counts, billing, and per-model cost were not exposed. No cost-saving claim is made.

## Experimental setup

| Role | Requested | Actual | Effort | Responsibility |
|---|---|---|---|---|
| Orchestrator | GPT-5.6 Sol | GPT-5.6 Sol | max | contracts, topology, ledger, decomposition, review, integration, gates, delivery |
| Implementer | GPT-5.6 Luna | GPT-5.6 Terra | max | bounded implementation, audit, test construction, mechanical proof |

The run used dedicated worktrees and returned commits. No two active workers received overlapping
writable files. The operational source of truth is
`docs/superpowers/2026-08-04-morphe-krepis-execution-ledger.md`.

Exact worker start timestamps, token use, and billing were unavailable. The intervals below are
commit-time-to-integration-time measurements from the same machine; they show handoff/acceptance
latency only and must not be interpreted as total worker or review wall time.

## Morphe task decomposition and measured handoffs

| Packet | Terra output | First reported proof | Sol integration | Commit interval | Review/rework |
|---|---|---|---|---:|---|
| Compound/dialect browser evidence | `1d69143` | Biome; focused 4; complete 48 Chromium/Firefox | `46e6594` | 50 s | Exact diff accepted; later composed proof extended separately. |
| Installed Clinical mask evidence | `2bd1605` | `pack:verify`, schema check, Biome, diff check | `837a66d` | 72 s | Exact diff accepted; Sol added the deterministic mid-loop packed consumer in `0efc476`. |
| Deterministic mid-loop core | `d6e3621` | type check; 895 server + 13 DOM | `8ea5c00` | 132 s | One substantive Sol correction cycle before acceptance. |
| Hostile-packet generative proof | `d4fc7df` | 36 seeded property cases | `5aca9c2` | 44 s | Exact one-file diff accepted. |
| Mid-loop doctrine | `575ca55` | documentation/diff checks | `a96ecf7` | 65 s | Exact diff accepted after cross-document consistency review. |
| Neutral live circuit and CMS inspector | `2e89748` | 902 server + 14 DOM; narrow browser probe | `06e4f1c` | 162 s | One substantive Sol correction cycle before acceptance. |
| Sealed six-kernel proof corpus | `7572503` | 2 focused cases covering six producers; type/style checks | `49f11f7` | 160 s | One evidence-hardening follow-up before acceptance. |

Additional root-owned integration commits were deliberately not delegated:

- `0efc476` joined the new public mid-loop seam to the installed-tarball consumer.
- `365b1ae` joined the accepted corpus to the neutral host and added the two-browser composed proof.

Keeping those joins with Sol avoided giving a worker authority over both sides of a shared seam.

## Handoff quality

Every committed Terra handoff identified the worktree, branch, commit, changed-file boundary,
tests, assumptions, and residual risks. That made exact acceptance possible without rediscovering
basic topology. The six-kernel staging-to-corpus handoff was especially effective: the second
worker copied only signed public artifacts and receipts, while tests retained the origin, byte,
hash, signature, compiler, dialect, and disclosure evidence.

The handoffs were less reliable as semantic acceptance claims. In particular, a passing core suite
did not prove the declared digest projection or immutable authoring evidence was correct, and a
passing live-host suite initially did not prove the operational ledger represented only applied
ingress or that arbitrary ranges were totality-safe. The pattern worked because those claims were
treated as hypotheses for Sol to falsify.

## Defects found by implementers

Implementer/auditor work established these material gaps or risks:

1. No non-test host joined digest, policy, proposal, canonical Delta admission, choices, render,
   and outcome evidence.
2. Direct variation discovery disagreed with renderer compound expansion.
3. No typed proposed/accepted/rejected/superseded evidence existed.
4. Native playground sliders bypassed the Delta/user-override law.
5. CMS preview omitted targeted `Within` and did not share exact resolver authority.
6. Runtime-malformed delegate output could escape before a fail-closed operational ingress.
7. Packed-consumer verification did not retain the strongest installed Clinical-schema falsifier.
8. Current generic Morphe fixtures were not representative outputs from all six current Krepis
   producers.
9. One initial shared-worktree browser run was invalidated by concurrent HMR; isolated reruns
   correctly separated harness noise from a product defect.

## Additional defects found by Sol

Sol found or required correction of the following after worker implementation or during root
integration:

| Area | Additional defect | Correction |
|---|---|---|
| Digest projection | Declared event kind alone could expose an undeclared path. | Require both declared path and declared kind. |
| Variation evidence | Authored range tuples were retained by reference. | Copy and freeze range evidence. |
| Epoch law | A merely greater numeric epoch could clear locks even when fractional/unsafe. | Require a strictly higher safe integer. |
| Replay ledger | A comparison dry-run was recorded as applied operational ingress. | Append only the actually applied run. |
| CMS range controls | Enumerating an arbitrary `Within` interval could exhaust memory. | Use bounded numeric controls; enumerate only authored `Vary` branches. |
| Canonical range | Fractional/reversed/duplicate ranges were not reduced to the admitted integer intersection. | Derive the exact safe intersection and omit empty authority. |
| Test routing | A one-off DOM config could evade the canonical `bun run test` phase. | Move the proof into `src/test-fixtures`. |
| Layering | The pure presenter initially depended on route-owned policy code. | Split an authored contract module from host policy. |
| Corpus regression | Staging disclosure and two-fresh-generation claims were not both retained mechanically. | Add source-only forbidden-key and generation-receipt assertions. |
| Runtime fixture serving | Vite rejected repository-level sealed JSON before hydration. | Allow only the exact sealed fixture root. |
| Narrow Firefox rendering | A 64-character signed hash widened the page by 262px. | Make generic `Text` emergency-wrap unbroken evidence tokens. |
| Focus proof | Programmatic focus was incorrectly used to judge `:focus-visible`. | Move focus through a real keyboard transition. |

The first presenter integration test also expected two non-contiguous text nodes as one string; the
assertion was corrected to the actual heading without changing product behavior.

## Rework, collisions, and verification

- Worker cherry-picks: seven accepted, zero conflicts.
- Overlapping worker write boundaries: zero.
- Shared-schema collisions: zero; Sol retained integration joins.
- Substantive worker rework cycles observed in the Morphe phase: three (core, live circuit, corpus
  evidence hardening).
- Root composed-browser cycles: three. The first found fixture serving, the second separated a bad
  focus probe from a real Firefox overflow, and the third passed 4/4.
- Final focused browser matrix: 52/52 Chromium/Firefox in 17.5 seconds.
- Final local web boundary before the aggregate gate: 906 server tests, 14 DOM tests, and a
  successful production Vercel build.
- Final unchanged aggregate gate: 906 server tests, 14 DOM tests, 72 Chromium/Firefox browser
  checks, 562 Python tests, both production builds, both installed-package lanes, both strict
  type/lint stacks, and every schema/CMS drift check passed.
- A manual hydrated Chromium probe at 390px found meaningful content, no framework overlay, no
  console/page errors, and exact `scrollWidth === clientWidth === 390`.

No material context was lost between workers. The main rediscovery cost was the normal one at
integration boundaries: unit/server proof did not encode Vite's serving sandbox or Firefox's
min-content behavior. Those were cheaply falsified only in the composed browser lane.

## Throughput versus coordination cost

Delegation improved throughput when tasks were independently falsifiable and file-disjoint:

- browser/cross-dialect evidence;
- package-consumer evidence;
- pure delegation core and property tests;
- doctrine after the contract stabilized;
- real-producer staging followed by sealed-corpus verification.

Delegation increased coordination cost when the worker needed to reason about both sides of a
shared authority seam. Resolver authorization, evidence meaning, epoch law, and final host/corpus
composition benefited from Sol retaining the join. The correct response is not to avoid workers;
it is to keep packets narrower and budget orchestrator review explicitly.

## Krepis task decomposition and measured handoffs

Sol ratified one profile-evidence rubric before distributing three disjoint two-kernel audits. The
rubric ranked runtime and tests above committed OpenAPI, committed OpenAPI above prose, preserved
legitimate kernel differences, and required a semantic version change only for a material
agent-facing correction. Shared conformance code and cross-family acceptance remained root-owned.

| Packet | Terra output | Sol integration | Acceptance interval | Review/rework |
|---|---|---|---:|---|
| Taxis + Misthos profiles | `93fd081` | `ca9a8e4` | about 461 s | Both exact operation sets passed; Sol later tightened registry and replay wording in `4e7aedc`. |
| Chreos + Obolos profiles | `9dfe823` | `006dbc6` | about 255 s | Both profile gates passed; the audit exposed a dead Obolos evidence-detail link, which became a separate repair packet. |
| Apotheke + Zygos profiles | `377aaf7` | `135a484` | about 372 s | Apotheke correctly remained unchanged; Sol tightened Zygos's registry-versus-book-state boundary in `4e7aedc`. |
| Obolos signed evidence surface | `2d6fc45` | `f1d5ae0` | unavailable | Accepted only after focused source-v1 proof; Sol then added gate and typed-boundary repairs in `3ddef70` and `d6bd026`. |

The intervals are the available acceptance-latency observations, not task duration, model latency,
or billing measurements. The harness exposed none of those latter quantities.

The shared conformance hardening landed root-owned as `1dbdba2`. It checks semantic profile
versions, source/bundle identity, operation references against every committed mirror, exhaustive
temporal-versus-static surface classification, signature and representation behavior, and
same-clock plus far-separated-clock invariants. Keeping this packet with Sol avoided three workers
concurrently redefining the family rubric.

## Krepis review value and rework

The profile workers were effective at bounded reconstruction. They preserved Misthos's 2.x line,
left accurate Apotheke claims alone, retained Zygos's book scope, and found the missing Obolos
evidence-detail target. Their focused handoffs were internally green and cherry-picked without a
conflict.

Sol review and clean-environment verification still found material defects after those handoffs:

| Area | Defect found after worker handoff | Accepted correction |
|---|---|---|
| Obolos relationship typing | Payment-rail ids were emitted as local-looking raw references. | Introduce a typed external payment-rail carrier and pin it in source-v1 and compiler tests. |
| Egress audit | The no-outbound gate contradicted the deliberate in-process MCP ASGI client. | Admit exactly one app-bound `ASGITransport` and fixed internal base URL while continuing to reject socket capability. |
| Dependency audit | Lazy PostgreSQL and settings seams were real but unexplained failures. | Add narrow, documented dependency exceptions without broadening runtime authority. |
| Shared query typing | A list-invariance hole appeared only in a fresh all-package environment. | Widen the conformance query scalar union and retain strict type checking. |
| Static evidence semantics | Temporal probes could be accidentally generalized over the new static route. | Require an exhaustive temporal/static partition and prove static identity, `Vary`, signature, and clock behavior independently. |

The focused final boundaries passed:

- shared conformance: lock, formatting, lint, types, and 358 tests;
- Obolos: formatting, lint, types, architecture, hygiene, dependency and egress audits, exact OpenAPI
  drift, 558 tests with 12 declared PostgreSQL-without-DSN skips, and 92.10% coverage;
- supported `py-v0.12.0`: 160 six-kernel conformance passes and one declared Obolos sequence-pin
  abstention;
- exact Morphe `effd6b1`: the same conformance result plus 275 six-kernel source-v1 route passes and
  26 declared PostgreSQL-without-DSN skips.

A clean all-package aggregate run found the query-typing defect and subsequently cleared the shared
lint/type layers and five package suites. Once that uncertainty had been removed, the still-running
duplicate package sweep was interrupted during Zygos and is **not** counted as a pass. The focused
changed-package gates above and the remote seven-job matrix are the acceptance evidence. This is a
useful process correction: broad gates should be paid for at a real shared or release boundary, not
repeated after focused proof has already collapsed the relevant uncertainty.

## Remote review and coordination evidence

Morphe PR #90 reached a current-head green, non-draft, mergeable state at `bb90283`. External review
found two real hostile-input defects: magic-key records were not preserved by object spread, and an
unbounded proposal iterable could be consumed. The correction preserved magic keys with
`Object.fromEntries`, bounded proposal packets to 64 indexed entries without consuming hostile
iterators, and added regression tests. A third concern about Vite's fixture allowlist was falsified
against SvelteKit's merged configuration; the narrow allowlist remained because it is required for
the sealed browser fixture.

PR #90 was then merged externally as `8c7aad1`. That merge was not performed or authorized by this
orchestrator. While Sol independently repaired the same store magic-key boundary on its old branch,
another active workflow opened canonical PR #91 at `effd6b1`. Sol reconciled the collision, did not
open a duplicate PR, and treated #91 as the executable exact-head candidate. PR #91 is non-draft,
mergeable, and current-head green.

Krepis PR #43 was opened non-draft at `d6bd026` with all six profile results, the signed Obolos
boundary, focused gates, and both compatibility lanes. Its exact head passed all seven remote jobs:
the all-workspace/family-conformance gate and one real-PostgreSQL leg for each kernel. No PR in this
run was merged by Sol.

The duplicate store repair is the clearest coordination failure in the experiment. File-disjoint
worker packets avoided merge conflicts, but branch ownership alone did not prevent two independent
orchestrators from solving the same newly reported review issue. Future runs need a live
issue-to-branch reservation and an explicit handoff when an external reviewer assumes repair
ownership.

## Final recommendation

Continue the orchestrator/implementer pattern, with the following operating rules:

1. Use the implementer for bounded, independently falsifiable packets with disjoint writable files
   and an exact return contract.
2. Keep shared schemas, authority joins, compatibility interpretation, and integration composition
   with the orchestrator.
3. Treat a green worker handoff as a candidate. Require exact-diff review and the smallest
   cross-boundary falsifier before acceptance.
4. Reserve file **and issue ownership** in the live ledger; branch separation alone is insufficient
   when external review creates new work mid-flight.
5. Run focused gates while iterating. Pay for a full family/package sweep only at a genuine shared,
   release, or remote-CI boundary, and never promote an interrupted run to evidence.
6. Preserve abstentions and unavailable measurements literally. A backend without a DSN, a model
   route the harness did not expose, and billing data the runtime did not report are not passes or
   estimates.

Terra max was capable and fast enough for the bounded implementation role, and parallel packets
materially increased evidence throughput. Sol review was not ceremonial: it changed both Morphe
and Krepis correctness. The experiment therefore supports **Sol-orchestrated, Terra-implemented**
work under strict review seams. Because Luna never ran, it provides no evidence about Luna quality,
speed, or cost and must not be described as a Sol/Luna comparison. A future controlled trial should
keep these packet boundaries, acceptance probes, and repository slice constant while changing only
the implementer model.
