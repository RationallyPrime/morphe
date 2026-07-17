# Morphe task runner. `just --list` shows everything.
#
# bun owns the web stack and uv owns py/ — just exists to compose them:
# `just gates` is the one command that runs exactly what CI runs, across
# both stacks. `env -u PYTHONPATH` guards the leading-colon footgun
# (= CWD on sys.path), which gives ty phantom unresolved-import errors.

# list available recipes
default:
	@just --list

# --- web (bun) ---------------------------------------------------------

# dev server
dev:
	bun run dev

# svelte-check (0 errors / 0 warnings is the bar)
check:
	bun run check

# vitest, single run
test:
	bun run test

# production build (adapter-vercel)
build:
	bun run build

# regenerate the committed responsive Timaeus plate derivatives
plates:
	bun run plates

# --- viewer (the stripped box-viewer app, KRA-648) ----------------------

# viewer dev server
viewer-dev:
	bun run viewer:dev

# svelte-check over the viewer app (same 0/0 bar)
viewer-check:
	bun run viewer:check

# viewer production build (adapter-vercel default)
viewer-build:
	bun run viewer:build

# viewer appliance build (adapter-node, what the image ships)
viewer-build-node:
	bun run viewer:build:node

# real-browser source trust -> compiler -> renderer contract (Chromium + Firefox)
edge-e2e:
	bun run test:edge-e2e

# one-time local install for the browser contract engines
edge-e2e-install:
	bun run test:edge-e2e:install

# build the distroless box-viewer image (from repo root context)
viewer-image:
	docker build -f viewer/Dockerfile -t morphe-viewer .

# biome lint + format check
lint:
	bunx biome check .

# biome, writing safe fixes
format:
	bunx biome check --write .

# --- python (uv) -------------------------------------------------------

# pytest over py/
py-test:
	env -u PYTHONPATH uv run --extra service pytest

# ruff (the uv.lock-pinned one — the arbiter, never uvx)
py-lint:
	env -u PYTHONPATH uv run --extra service ruff check

# ty (pinned, same rule as ruff)
py-types:
	env -u PYTHONPATH uv run --extra service ty check

# build wheel + sdist and prove installed decoder-mask resources load in isolation
py-pack-verify:
	env -u PYTHONPATH uv run --extra service python scripts/verify-python-package.py

# committed schema artifacts must equal a fresh emission (Python -> JSON Schema + TS + masks)
schema-check:
	env -u PYTHONPATH uv run --extra service python -m morphe_grammar.artifacts --check
	env -u PYTHONPATH uv run --extra service python -m morphe_surface.artifacts --check

# compiler receipt identity must equal its exact committed runtime closure
compiler-id-check:
	bun run compiler-id:check

# regenerate committed contract artifacts (after a py/ grammar/wire change)
schema-write:
	env -u PYTHONPATH uv run --extra service python -m morphe_grammar.artifacts --write
	env -u PYTHONPATH uv run --extra service python -m morphe_surface.artifacts --write

# regenerate committed CMS contract schemas (after a py/morphe_cms contract change)
cms-schema-write:
	env -u PYTHONPATH uv run --extra service python -m morphe_cms.schema --write

# committed CMS schemas must equal a fresh emission
cms-schema-check:
	env -u PYTHONPATH uv run --extra service python -m morphe_cms.schema --check

# --- composed ----------------------------------------------------------

# Machine-wide heavy gate, shared with every repo's task runner on this box via
# one lock file (32 GB RAM: N concurrent whole-machine suites OOM the machine,
# and agent sessions routinely fan out swarms that all reach for `just gates`).
# One holder runs inside a systemd user scope (MemoryHigh=24G, CPUWeight=50 —
# headroom and interactive priority stay with the human; costs nothing on an
# idle box) or plain `nice` where scopes are unavailable; everyone else queues
# on the flock (up to 2 h). MORPHE_HEAVY_GATE=off bypasses (dedicated CI
# runners); _MORPHE_GATE_HELD makes nested gated recipes reentrant.
_gated inner:
	#!/usr/bin/env bash
	set -euo pipefail
	if [ "${_MORPHE_GATE_HELD:-}" = "1" ] || [ "${MORPHE_HEAVY_GATE:-on}" = "off" ]; then
		exec just {{ inner }}
	fi
	wrap=(nice -n 10)
	if command -v systemd-run >/dev/null 2>&1 && systemd-run --user --scope true >/dev/null 2>&1; then
		wrap=(systemd-run --user --scope --quiet -p MemoryHigh=24G -p CPUWeight=50 --)
	fi
	echo "[heavy-gate] waiting for the machine-wide slot (/tmp/machine-heavy-gate.lock)…" >&2
	exec flock -w 7200 /tmp/machine-heavy-gate.lock \
		env _MORPHE_GATE_HELD=1 "${wrap[@]}" just {{ inner }}

# every gate CI runs, both stacks — green here means CI goes green.
# Whole-machine run: serialized machine-wide by the heavy gate.
gates: (_gated "_gates")

_gates: compiler-id-check lint check test build viewer-check viewer-build-node edge-e2e py-test py-lint py-types schema-check cms-schema-check py-pack-verify

# install the prek git hooks (once per checkout)
hooks:
	prek install
