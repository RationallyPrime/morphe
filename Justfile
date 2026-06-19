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

# biome lint + format check
lint:
	bunx biome check .

# biome, writing safe fixes
format:
	bunx biome check --write .

# regenerate the committed plate derivatives (assets/plates -> static/images/plates)
plates:
	bun run plates

# --- python (uv) -------------------------------------------------------

# pytest over py/
py-test:
	env -u PYTHONPATH uv run pytest

# ruff (the uv.lock-pinned one — the arbiter, never uvx)
py-lint:
	env -u PYTHONPATH uv run ruff check

# ty (pinned, same rule as ruff)
py-types:
	env -u PYTHONPATH uv run ty check

# committed schema artifacts must equal a fresh emission (Python -> JSON Schema + TS + masks)
schema-check:
	env -u PYTHONPATH uv run python -m morphe_grammar.artifacts --check

# regenerate committed contract artifacts (after a py/ grammar/wire change)
schema-write:
	env -u PYTHONPATH uv run python -m morphe_grammar.artifacts --write

# --- composed ----------------------------------------------------------

# every gate CI runs, both stacks — green here means CI goes green
gates: lint check test build py-test py-lint py-types schema-check

# install the prek git hooks (once per checkout)
hooks:
	prek install
