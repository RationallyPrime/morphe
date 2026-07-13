# ADR-0018 — `Within` Targets One Explicit Subtree

- **Status:** Accepted
- **Date:** 2026-07-13
- **Supersedes:** ADR-0017 and ADR-0014 D5/D9's context-free marker wording
- **Restores:** ADR-0004's typed density, emphasis, and collapse effects with explicit ownership

## Context

`Within` already carried a bounded variation id and resolved numeric choices into typed density,
emphasis, or collapse values. The original context-free leaf could not say what those values
affected. Inferring a neighboring node would violate locality, make generic traversal incomplete,
and let emphasis bypass the only parent that can enforce the sibling budget.

The missing contract is ownership, not another renderer-wide adaptation mechanism.

## Decision

`Within` gains one optional `target: Node`. When present, that target is the complete and only
region the variation point may affect:

- `density` replaces the target's incoming density while preserving every other context field;
- `emphasis` is a claim presented to the wrapper's parent, normalized with sibling claims, and
  forwarded to the target as the resulting grant;
- `collapse` renders the target through native `details` / `summary`; `true` means collapsed, and
  a visibly non-blank `summary` is required for the targeted form.

The target participates in the ordinary structural traversal used by compound validation, depth
and cycle checks, live variation discovery, and Delta validation. Choice changes remain host-side
numbers until the renderer resolves them into these existing typed inputs. Epochs and handlers do
not enter the tree.

`target` remains optional for wire compatibility. A targetless `Within` is inert: it renders
nothing, owns no sibling by implication, and claims no emphasis budget. `summary` is valid only on
a targeted collapse.

The schema-to-surface compiler emits a targeted collapse directly around the compiled section,
instead of emitting a marker beside the section.

## Consequences

- Both variation forms are render-real without expanding the renderer's authority.
- Adaptation stays local and structurally discoverable.
- The parent remains the sole authority over emphasis grants.
- Collapse inherits native keyboard, state, and accessibility semantics.
- Existing targetless trees remain valid and total but gain no new implicit behavior.
- Completing the operational mid loop remains host work; this decision completes the package's
  bounded target semantics, not a deployment topology.
