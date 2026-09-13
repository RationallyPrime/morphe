from __future__ import annotations

# ruff: noqa: INP001
import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
AGENTS_PATH = REPO_ROOT / "AGENTS.md"
CLAUDE_PATH = REPO_ROOT / "CLAUDE.md"


def claude_from_agents(agents: str) -> str:
    if not agents.startswith("# AGENTS.md\n"):
        msg = "AGENTS.md must start with '# AGENTS.md'"
        raise ValueError(msg)
    return "# CLAUDE.md\n" + agents[len("# AGENTS.md\n") :]


def write_claude() -> None:
    agents = AGENTS_PATH.read_text(encoding="utf-8")
    CLAUDE_PATH.write_text(claude_from_agents(agents), encoding="utf-8")


def check_claude() -> None:
    expected = claude_from_agents(AGENTS_PATH.read_text(encoding="utf-8"))
    actual = CLAUDE_PATH.read_text(encoding="utf-8")
    if actual != expected:
        sys.stderr.write("CLAUDE.md drifted from AGENTS.md; run `just doctrine-write`.\n")
        raise SystemExit(1)


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Generate or check CLAUDE.md from AGENTS.md.")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--write", action="store_true")
    mode.add_argument("--check", action="store_true")
    args = parser.parse_args(argv)
    if args.write:
        write_claude()
        return
    check_claude()


if __name__ == "__main__":
    main()
