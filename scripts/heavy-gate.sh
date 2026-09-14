#!/usr/bin/env bash
# Machine-wide heavy-gate wrapper for `just gates`.
#
# Contract (docs/operations/heavy-gate.md):
#   MORPHE_HEAVY_GATE=off  bypass (CI runners / dedicated boxes)
#   _MORPHE_GATE_HELD=1    re-enter without taking the flock again
#   flock waits up to 7200s on /tmp/machine-heavy-gate.lock
#   systemd-run --user --scope when available; otherwise nice -n 10
set -euo pipefail

inner="${1:?heavy-gate.sh requires an inner just recipe}"
runner="${HEAVY_GATE_RUNNER:-just}"
lock="${HEAVY_GATE_LOCK:-/tmp/machine-heavy-gate.lock}"
timeout_s="${HEAVY_GATE_TIMEOUT_S:-7200}"

if [ "${_MORPHE_GATE_HELD:-}" = "1" ] || [ "${MORPHE_HEAVY_GATE:-on}" = "off" ]; then
	exec "$runner" "$inner"
fi

wrap=(nice -n 10)
if command -v systemd-run >/dev/null 2>&1 && systemd-run --user --scope true >/dev/null 2>&1; then
	wrap=(systemd-run --user --scope --quiet -p MemoryHigh=24G -p CPUWeight=50 --)
fi
if [ "${HEAVY_GATE_FORCE_NICE:-}" = "1" ]; then
	wrap=(nice -n 10)
fi

echo "[heavy-gate] waiting for the machine-wide slot (${lock})…" >&2
exec flock -w "$timeout_s" "$lock" \
	env _MORPHE_GATE_HELD=1 "${wrap[@]}" "$runner" "$inner"
