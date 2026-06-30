# ADR-0015 — Keep Pydantic AI UI streams at the host adapter seam

- **Status:** Accepted
- **Date:** 2026-06-30
- **Related:** ADR-0004, ADR-0009, ADR-0014, `CONTRACT.md` §9/§11, `VISION.md` §8/§9
- **External:** Pydantic AI UI integrations (`AG-UI`, Vercel AI Data Stream Protocol)

Pydantic AI's UI integrations are useful for agent-front-end coordination, but
they are not a Morphe rendering model. The integrations stream agent events:
messages, tool calls, state snapshots, custom events, and protocol-specific
chunks, commonly over Server-Sent Events. Morphe already has its rendering
interface: a validated `Node` tree rendered by `MorpheRoot`, plus host-owned
`store`, `actions`, `choices`, and `onEscalate` sockets.

This matters for Sokrates. Sokrates owns live operational facts, read models,
governed work, and Pydantic AI agent runs. Morphe owns the adaptive presentation
substrate. The integration point must preserve both: Sokrates data and agent
events remain typed upstream; Morphe still receives only its grammar and
delegation inputs.

## Decision

Pydantic AI UI event streams terminate in a **host adapter**. They do not enter
`src/lib/grammar`, `MorpheRoot`, dialects, compounds, or primitive renderers.

The host adapter may consume AG-UI or Vercel AI Data Stream events from a
Sokrates/Pydantic AI runtime, but it must translate them into one of Morphe's
existing interfaces before render:

| Incoming concern | Morphe-facing output |
|---|---|
| Fresh operational snapshot | deterministic presenter or `morphe_surface` compiler emits validated `Node` / `CompiledSurface` |
| Agent proposes structural adaptation | `Delta[]` checked by `applyDelta`, then `MorpheRoot.choices` |
| Agent or data source updates local field/filter state | typed write to host-owned `MorpheStore` path |
| User-visible run/progress/chatter | native host chrome, optionally styled with `--mo-*` tokens |
| User action inside a Morphe tree | `Button.action` id resolved by host `actions` map |
| Tier-2 "this view/task needs help" event | `MorpheRoot.onEscalate` record with `ContextDigest` |

The core interface remains:

```text
Sokrates live data / Pydantic AI run
  -> protocol adapter validates incoming events
  -> host state / deterministic presenter / applyDelta
  -> <MorpheRoot tree={tree} choices={choices} store={store} actions={actions} />
```

For live Sokrates data, use the narrowest adapter that fits:

1. **Plain live operational display:** prefer Sokrates read APIs, projection
   epochs, or other typed event/snapshot feeds. Compile snapshots
   deterministically to Morphe nodes. Do not involve Pydantic AI UI merely to
   move data.
2. **Agent-mediated adaptive display:** use AG-UI or the Vercel AI Data Stream
   Protocol when a Pydantic AI agent is actually producing messages, tool-call
   progress, state snapshots, or adaptation proposals. The stream is still
   consumed by the host adapter, not by the renderer.
3. **Chat, approval, and progress surfaces:** render as native host chrome around
   Morphe unless the content has first been compiled into valid Morphe `Node`
   data. A protocol event is not a primitive.

## Consequences

- No `ag_ui`, Pydantic AI UI, Vercel AI SDK stream, or SSE protocol type becomes
  part of the Morphe grammar or `MorpheRoot` public interface.
- Morphe keeps its deep module shape: a small rendering interface with a large,
  total implementation behind it. Protocol handling stays outside that
  interface.
- Sokrates can still stream real-time data and agent progress into a Morphe host
  surface, but the adapter must validate and compile before render.
- The existing `/api/adaptive/decision` and `py/morphe_agent` sidecar remain
  compatible with this decision: they already exchange typed decision requests
  and `Node` responses. A streaming variant would be an additional host adapter,
  not a renderer change.
- `morphe_surface` is the preferred deterministic path for rendering typed
  operational records or operation results. AG-UI is only justified when the
  source is an agent event stream rather than a plain data snapshot.
- Tests for any future stream adapter should assert the Morphe-facing contract:
  invalid protocol events fail closed, produced nodes pass `validate_node`,
  deltas are epoch-checked through `applyDelta`, and native progress events never
  leak into grammar nodes.

## Alternatives Rejected

- **Make AG-UI a Morphe primitive family.** Rejected: protocol events are not the
  substrate grammar. This would make the renderer shallow and couple Morphe to
  one agent transport.
- **Teach `MorpheRoot` to consume event streams.** Rejected: `MorpheRoot` is the
  render seam. ADR-0004 already keeps epochs and deltas host-side; stream
  protocol state belongs even farther out.
- **Use Pydantic AI UI for every real-time Sokrates display.** Rejected: live
  operational facts should ride typed read-model or snapshot feeds unless an
  agent run is genuinely part of the interaction.
- **Have Sokrates emit raw Morphe JSON over AG-UI custom events without a host
  gate.** Rejected: the adapter must validate, compile, and fail closed before
  any tree reaches `MorpheRoot`.
