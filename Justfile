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

# client bundle and serialized route output must not contain bearer credentials
viewer-credentials-check:
	bun run scripts/check-viewer-client-credentials.ts

# real-browser source trust -> compiler -> renderer contract (Chromium + Firefox)
edge-e2e:
	bun run test:edge-e2e

# one-time local install for the browser contract engines
edge-e2e-install:
	bun run test:edge-e2e:install

# browser-computed WCAG 2.2 AA contrast matrix + composed-a11y gate (KRA-796):
# every dialect x base/raised/sunken, freestanding ink measured after var() and
# color-mix() resolution in Chromium + Firefox (same engines as edge-e2e-install)
contrast:
	bun run test:contrast

# build the distroless box-viewer image (from repo root context)
viewer-image:
	docker build -f viewer/Dockerfile -t morphe-viewer .

# biome lint + format check
lint:
	bunx biome check .

# biome, writing safe fixes
format:
	bunx biome check --write .

# install the produced npm tarball into a throwaway Vite + Svelte consumer and
# prove its public exports, masks, browser build, typecheck, and SSR build.
pack-verify:
	bun run pack:verify

# --- python (uv) -------------------------------------------------------

# pytest over py/
py-test:
	env -u PYTHONPATH uv run --extra service pytest

# ruff — bare binary off PATH: weave-doctrine's mise.toml is the version
# authority (one pin, every seat and runner). Wrong version = machine-setup
# bug — run `just tools` in weave-doctrine.
py-lint:
	ruff check

# ty (same rule as ruff; env guard for the leading-colon PYTHONPATH footgun)
py-types:
	env -u PYTHONPATH ty check

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
# Generate CLAUDE.md from AGENTS.md (canonical full project instruction source).
doctrine-write:
	env -u PYTHONPATH uv run --extra service python scripts/doctrine.py --write

# CLAUDE.md must equal the mechanical projection of AGENTS.md.
doctrine-check:
	env -u PYTHONPATH uv run --extra service python scripts/doctrine.py --check

_gated inner:
	#!/usr/bin/env bash
	set -euo pipefail
	exec bash scripts/heavy-gate.sh {{ inner }}

# every gate CI runs, both stacks — green here means CI goes green.
# Whole-machine run: serialized machine-wide by the heavy gate.
gates: (_gated "_gates")

_gates: compiler-id-check lint check test build pack-verify viewer-check viewer-build-node viewer-credentials-check edge-e2e contrast py-test py-lint py-types schema-check cms-schema-check py-pack-verify doctrine-check

# install the prek git hooks (once per checkout)
hooks:
	prek install
