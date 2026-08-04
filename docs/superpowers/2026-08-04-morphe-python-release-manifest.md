# Morphe Python release manifest: proposed `py-v0.13.0`

> Prepared: 2026-08-04
>
> State: evidence-complete proposal only. No version bump, tag, publication, deployment, or Krepis
> dependency change has been performed.

## Decision

Cut the next Morphe Python dependency tag as **`py-v0.13.0`**, but only after Morphe PR #91 has
been reviewed and merged and a dedicated release PR has passed current-head CI. A patch release
would understate the change: the installed promoted compound vocabulary grows additively from
eight definitions to seventeen, and the CMS/Clinical admission policy understands that expanded
package-owned vocabulary. Existing source-v1 artifacts and the six representative Krepis compiler
outputs remain compatible, so a major release is not warranted.

This is a Git dependency release for the `morphe-grammar` package used by Krepis. The repository
does not currently have a Python-registry publication workflow, and this manifest neither proposes
nor authorizes one. The npm package has its own `vX.Y.Z` release track and is outside this manifest.

## Immutable evidence inputs

| Input | Value |
|---|---|
| Current supported tag | `py-v0.12.0` |
| Current tag commit | `f119d0e03506ceacb838a267932bad62a5cc6a48` |
| Current Python package version | `0.12.0` |
| Merged deterministic-substrate result | Morphe PR #90 / `8c7aad10215e3dc96e194f7415fba3bbc66a97be` |
| Reviewed executable candidate | Morphe PR #91 / `effd6b1dab5ed16966fb0712c3316f72bb2fb756` |
| Proposed package version | `0.13.0` |
| Proposed dependency tag | `py-v0.13.0` |
| Krepis supported pin during this run | unchanged at `py-v0.12.0` |

PR #90 was merged by an external actor after reaching current-head green; this run did not perform
that merge. PR #91 remains the canonical store-boundary follow-up and is non-draft, mergeable, and
current-head green. Its SHA is evidence input, not permission to tag a feature branch. The release
commit must descend from the reviewed merged results of both PRs; its exact SHA cannot be named
until #91 and the version-only release change are merged.

## Capability delta since `py-v0.12.0`

The supported tag exposes these eight promoted compounds:

`SignalCard`, `EntityHeader`, `ProvenanceFooter`, `StatBand`, `ActionSummary`, `Breakdown`,
`TrailEntry`, and `KeyValuePanel`.

The candidate exposes those eight plus nine additive definitions:

`ContentSection`, `SignalBand`, `DefinitionRow`, `ProgressRow`, `Trail`, `OperationalPane`,
`RecordCard`, `DiagnosticGroup`, and `EmptyState`.

The Python delta also includes the fail-closed CMS gate and presenter handling for the promoted
catalog, a Clinical decoder mask derived from that exact catalog, installed mask resources, and
their retained tests. It does not change the grammar version, the source-v1 wire version, or the
six representative Krepis artifacts' compiler projection.

## Compatibility evidence

Two isolated installs were proved independently. Each environment's `direct_url.json` was checked,
so neither a local editable package nor a different Git revision could silently satisfy the proof.

| Proof | `py-v0.12.0` | Candidate `effd6b1` |
|---|---:|---:|
| Resolved commit | `f119d0e` | `effd6b1` |
| Installed package version | `0.12.0` | `0.12.0` pending the release bump |
| Shipped dialect masks passing Draft 2020-12 schema validation | 9 | 9 |
| Promoted compounds | 8 | 17 |
| Complete promoted-reference mask admissions | 72 | 153 |
| Six representative source-v1 signatures reverified | 6 | 6 |
| Representative compiled trees admitted across all nine dialects | 54 | 54 |
| Six-kernel profile/conformance outcomes | 160 pass + 1 declared abstention | 160 pass + 1 declared abstention |
| Current real source-v1 route outcomes | producer baselines | 275 pass + 26 declared PostgreSQL-without-DSN skips |

Both lanes compiled each fixed representative source document twice and obtained identical trees.
The canonical Python tree SHA-256 values were also identical across the two lanes:

| Producer case | Canonical Python tree SHA-256 |
|---|---|
| Taxis roster | `b866b12b0eac5079efc479c929457c24aab1729a68e35208705cdf7af9539d35` |
| Misthos run summary | `77b99d6c4135a359dc62e1d5b34257d5c63f8bd9bde2065f4ee50c01e2112752` |
| Chreos breached obligations | `6af230fe33be19a5f4799e791f547c9962a0ad93c012a58c929aac80b0145c74` |
| Obolos finality | `4078d94f9cf3b0b15880635e71463c67cb19ab74584f3e4dfabf18ffe609a931` |
| Apotheke expiry | `5e6c44e47452d46b6d53e14291869efad9abc6356214f7c47457289aae674fe7` |
| Zygos posted transaction | `b047c5d83475100d4b85ac7a7c260911d0bcafff1336c10161565f82521ce8c0` |

This is strong compatibility evidence for the six frozen representative artifacts and the current
real route suites. It is not a claim that every possible future source-v1 document has been
enumerated. The exact-head install still reports `0.12.0`; that is precisely why a reusable tag
must include the version bump rather than letting candidate code masquerade as the old semantic
version.

## Release commit recipe

After PR #91 is reviewed, merged, and current-head green:

1. Refresh `origin/master` and verify the intended base descends from PR #90 merge `8c7aad1` and the
   reviewed PR #91 result.
2. Create a dedicated release branch from that exact `origin/master`.
3. Change only the Python distribution version in `pyproject.toml` from `0.12.0` to `0.13.0` and
   refresh the root `uv.lock` with the repository's pinned `uv` toolchain.
4. Run focused catalog, schema, Clinical-mask, and installed-package checks while iterating. Invoke
   artifact writers only if their checks report drift; generated masks and schemas must never be
   hand-edited.
5. At the actual release boundary, run the canonical aggregate `just gates`, including wheel/sdist
   installation and installed decoder-mask verification. This is the point where the full gate's
   cost buys distinct release uncertainty.
6. Re-run the isolated exact-commit compatibility proof against the release commit and require the
   same six canonical hashes and 54 dialect admissions shown above.
7. Open and review a release PR. Do not move a tag to repair a failed release.
8. After that PR is merged and its exact head remains green, create annotated tag `py-v0.13.0` at
   the merged release commit and push only that tag.
9. Resolve a fresh isolated install by tag and verify `direct_url.json` names the tagged commit and
   package metadata reports `0.13.0`.

## Krepis adoption path

Only after the tag exists and the tag-install proof passes should Krepis move its single family
source in the root `pyproject.toml` from `py-v0.12.0` to `py-v0.13.0` and regenerate `uv.lock`.
That must be a separate reviewed change. Iterate with the focused dependency, conformance, source,
and drift checks; let current-head CI supply the all-workspace gate and all six PostgreSQL legs.
Member-level Morphe pins remain forbidden.

Until then, `py-v0.12.0` is the supported lane. Exact-SHA verification is evidence about the
candidate, not authorization to commit an untagged dependency or weaken the supported lane.

## Explicit non-actions

This run did **not** merge PR #91, bump `pyproject.toml`, update `uv.lock`, create or move a tag,
publish a Python or npm package, change the Krepis pin, deploy anything, or alter either default
branch. PR #90's external merge is recorded as observed state, not as an action by this run. Every
remaining release step above requires its own human-reviewed authority boundary.
