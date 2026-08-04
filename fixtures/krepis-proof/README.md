# Six-kernel source-v1 proof corpus

This repository-relative fixture directory preserves the sealed staging evidence. Its source
documents were generated from Krepis commit `e13edd1a1fcc251dc8e8252914671bf0ba8e1fdc`; the
compiler code that admitted and compiled them is Morphe commit
`5aca9c20d7a62d8264702dc61a8f84e4ffade200`. The worktree head at the latest validation was
`a96ecf7d72c422dc6078bdac36c36c1fed70e8d2`.

A later exact-green-PR run of `src/routes/_playground/kernel-proof.test.ts` is a compatibility
proof against that validation code. It does not replace the recorded compiler-code base or claim
that the eventual corpus commit was its own validation head. This corpus is an evidence fixture,
not an extension of Morphe's generic conformance corpus.

The corpus contains one real production-route source-v1 case for each kernel:

| Case | Real source operation | Exact request |
| --- | --- | --- |
| `taxis-roster` | `get_surface_roster` | `GET /surfaces/roster?as_of=2026-07-20` |
| `misthos-run-summary` | `get_surface_run_summary` | `GET /surfaces/run-summary?run_id=8fc48217-03b7-5132-b493-6cdb0081b237` |
| `chreos-breached-obligations` | `get_surface_obligations` | `GET /surfaces/obligations?as_of=2026-09-01` |
| `obolos-finality` | `get_surface_finality` | `GET /surfaces/finality` |
| `apotheke-expiry` | `get_surface_expiry` | `GET /surfaces/expiry?as_of=2026-07-20&as_of_sequence=5&horizon_days=90` |
| `zygos-posted-transaction` | `get_surface_transaction` | `GET /books/01927f3b-1234-7000-a000-0000000000aa/surfaces/transactions/01927f3b-1234-7000-a000-000000000010` |

For every case, `artifacts/<case>/` holds these three evidence documents:

- `<case>.source.json` — the compact, actual signed source-v1 response wire.
- `<case>.surface-spec.json` — the compiler-code base's compiled intermediate surface spec.
- `<case>.node.json` — the compiler-code base's grammar-validated Node tree.

`manifest.json` is the primary handoff: it preserves the operation, request,
identity, public key/key id, source version, source revision, signature, seals,
SHA-256 values for every written evidence document, fixture-story identifier, and
the two-run results. `validation.json` is the compact all-green receipt.

## Verify in this repository

From the repository root, run:

```sh
bun x vitest run src/routes/_playground/kernel-proof.test.ts
```

This corpus contains no exporter, compiler, per-case source-generation receipt, or kernel code.
Regeneration remains in the owning Krepis environment. The focused test reads the committed signed
wire as raw text, admits it only through the committed manifest's public keys, and proves
compatibility against the named validation code without recreating domain models or business logic.

## Determinism boundary

The sole shared cross-kernel control is `SourceSigner.author(..., produced_at=...)`,
fixed to whole-second UTC `2026-08-04T12:00:00Z`. Each source case is created twice
from a fresh fixture story; their signed response bytes must be identical before the
file is written. Morphe then compiles the admitted source twice with a fixed
presentation instant and requires byte-identical SurfaceSpec and Node documents.

Three fixture stories have additional, explicitly recorded controls because their
real route output signs runtime-derived values:

- Obolos uses its existing integration read/storage clock controls.
- Apotheke uses a deterministic UUID sequence only while the existing `_seed` story
  runs, plus its in-memory storage clock for signed compiled-at testimony.
- Zygos uses a deterministic book-id factory only at the fixture boundary, plus its
  in-memory storage clock for signed transaction `system_time` and `event_hash`.

Those controls are not claims about production entropy equivalence. They prove a
deterministic export of public test fixture state through the real current code path.
Their precise scopes appear under each `producer.controls` entry in `manifest.json`.

## Safety and verification

No private key, signing seed, credential, or fixture secret is written to this
directory. Regeneration reaches test signing material only through existing test
helpers; only public keys and public key ids are placed in the manifest. The exporter
also asserts each case's current route-specific PII/hidden-field minimization
invariant before writing its signed source response.

The compiler-code base's admission verifies the expected issuer, exact surface id, pinned
public key/key id, source seals, Ed25519 signature, source schema, and freshness. It
then verifies the expected view-model id, validates the compiled Node grammar, and
admits the node against all nine current dialect constraints:
`icelandic-archive`, `clinical`, `reykjavik-registry`, `timaeus`, `gallery`, `night`,
`ledger`, `estate`, and `foundry`.
