# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to
the actual **Linear** labels used in the `Krates-ehf` team. The labels already exist in
Linear — apply them, don't create duplicates. (`ready-for-human` was created for this
mapping; the rest pre-date it.)

| Canonical role    | Linear label (Krates-ehf) | Meaning in this workspace                                                              |
| ----------------- | ------------------------- | -------------------------------------------------------------------------------------- |
| `needs-triage`    | `needs human review`      | **Act on this at all?** The scope/worthiness gate — decide whether to do the thing. Not a code-review step. |
| `needs-info`      | `needs-grill`             | Blocked on an open design decision only the founder can make (resolved by grilling).   |
| `ready-for-agent` | `ready-for-agent`         | Fully specified, **AFK-ready** — an agent can pick it up cold and run unsupervised.     |
| `ready-for-human` | `ready-for-human`         | Fully specified and ready to implement, but worked **supervised/interactive — not AFK**. Sibling of `ready-for-agent`. |
| `wontfix`         | `deferred-post-v1`        | Declined for now — out of v1 scope, parked to resurrect later.                          |

## Notes on the two that get conflated

- **`needs human review` vs `needs-grill`.** `needs human review` is the *act-or-not* gate
  (is this worth doing, is it in scope) — it happens **before** any work. `needs-grill` is
  *"we're doing it, but it's blocked on a decision"* — a design choice has to land before an
  agent or human can proceed. Different moments, not synonyms.
- **`ready-for-agent` vs `ready-for-human`.** Both mean *decided, specified, go*. The only
  difference is execution mode: `ready-for-agent` is fire-and-forget AFK; `ready-for-human`
  is the same readiness but driven in a supervised/interactive session.

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the
corresponding Linear label string from the table above. Discover the live label set with
the `linear` MCP `list_issue_labels` tool (team `Krates-ehf`) rather than hardcoding.
