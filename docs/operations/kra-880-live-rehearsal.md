# KRA-880 live rehearsal runbook

Status: **UNPROVEN.** Local gates and Playwright keyboard evidence do not substitute for
this live slice. No agent may send Slack, approve, mutate business state, deploy, or
reseed without explicit authorization.

KRA-880's implementation comment (2026-07-31) records that demo-exit steps 7–9 were
left unperformed. KRA-831's one-train deployment / Flow-A reseed / public-board proof
has no completion comment carrying those receipts. Both remain externally unproven.

## Preconditions (resettable)

1. Timaeus live viewer is the authorized board, currently represented at
   `https://timaeus.sokrates.is`.
2. Seed identity is the investor-demo Flow-A snapshot used by KRA-880 (dated
   frontier around 2026-07-31). Record the exact seed SHA / backup tag before
   touching anything.
3. `as_of` control is empty (current) at start. Note the six-source home:
   which domains are attention vs calm.
4. Backup: snapshot the board database / seed artifact named in the Timaeus
   deploy runbook before any mutation. Restore is the only undo.

## Exact Slack request (authorized operator only)

Send the seeded Slack command that KRA-880's live demo uses to request the
governed action (the operator-facing diagnosis that the attention card already
names). Do not paraphrase. Capture:

- Slack channel, timestamp, and raw request text
- the diagnosis the board returns
- the identity of the actor who would approve

## Human approval boundary

A human must approve the action in the live product. Agents do not click
approve, do not impersonate Hákon, and do not consume an approval token.

Capture: approver identity, approval timestamp, and the authority record the
board writes.

## Expected testimony after approval

The live surface must show, in operator language:

- **actor** — who ran the action
- **run** — the action/run id
- **authority** — the approval / mandate that licensed it
- **effective time** — the business time that took effect, coherent with `as_of`

Machine codes may appear only as evidence, never as the headline.

## Downstream state assertions

After the authorized mutation:

- the attention card that named the open decision is no longer the same
  pre-action state (or is gone)
- joined identity (Taxis employee ⇄ Misthos payslip, etc.) still retains
  exact `as_of`
- no UUID/resolver/cache key leaks onto the dated home

## Reset

Restore the backup/seed recorded above. Confirm the home returns to the
pre-action attention set. Do not leave a mutated board as the default demo.

## This ticket's bound

KRA-920 may merge the code, keyboard Playwright proofs, and this runbook.
It does **not** close KRA-880's or KRA-831's external acceptance. Those stay
visibly unproven until an authorized operator attaches before/after receipts
to the originating tickets.
