# Machine-wide heavy gate

`just gates` is a whole-machine suite. Concurrent copies OOM a 32 GB workstation when
agent sessions fan out, so the task runner serializes it.

## Contract

| Control | Behavior |
| --- | --- |
| `MORPHE_HEAVY_GATE=off` | Bypass the lock, systemd scope, and `nice`. Dedicated CI runners set this. Default is `on`. |
| `_MORPHE_GATE_HELD=1` | Re-entrancy: a gated recipe that itself calls `just gates` (or another `_gated` recipe) does not take the flock twice. The wrapper sets this for the inner run. |
| lock file | `/tmp/machine-heavy-gate.lock` (override with `HEAVY_GATE_LOCK` in tests). |
| timeout | `flock -w 7200` (two hours). Override with `HEAVY_GATE_TIMEOUT_S` in tests. |
| systemd | When `systemd-run --user --scope` works, the holder runs under `MemoryHigh=24G` and `CPUWeight=50`. |
| fallback | If systemd is unavailable, the holder runs under `nice -n 10`. Tests may force this with `HEAVY_GATE_FORCE_NICE=1`. |

CI must set `MORPHE_HEAVY_GATE=off` so jobs do not wait on a workstation lock. Nested gated
recipes rely on `_MORPHE_GATE_HELD`, not on disabling the policy.

The wrapper lives in `scripts/heavy-gate.sh`. `just gates` is the only production caller.
