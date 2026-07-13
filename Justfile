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

# every gate CI runs, both stacks — green here means CI goes green
gates: lint check test build viewer-check viewer-build-node py-test py-lint py-types schema-check cms-schema-check py-pack-verify

# install the prek git hooks (once per checkout)
hooks:
	prek install
