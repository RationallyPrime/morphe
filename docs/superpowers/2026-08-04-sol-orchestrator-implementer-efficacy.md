# Sol orchestrator / implementer efficacy report

> Run: Morphe -> Krepis deterministic integration and six-profile refresh
>
> Date: 2026-08-04
>
> Status: Morphe local phase complete; remote Morphe CI and the Krepis phase remain to be appended.

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

## Preliminary recommendation

Continue the pattern for the Krepis phase with three constraints:

1. Ratify one common profile-evidence rubric before distributing profile pairs.
2. Keep shared conformance tooling in its own non-overlapping packet.
3. Treat each worker's green result as a candidate; require Sol to inspect the exact diff and run
   the smallest cross-family falsifier before acceptance.

Terra max was capable and fast enough for the bounded implementation role. Because Luna never ran,
this experiment cannot compare Luna quality, latency, or cost with Terra. A future trial should
preserve the same packet boundaries and evidence rubric while changing only the implementer model.

## Pending final update

This report will be completed with Morphe remote-CI evidence, the three Krepis two-profile audits,
shared conformance/compatibility work, supported-tag and exact-Morphe-head lanes, Krepis remote CI,
and the final cross-repository recommendation. Until then, the conclusion is Morphe-phase evidence,
not a completed multi-repository experiment.
