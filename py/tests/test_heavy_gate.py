from __future__ import annotations

import os
import stat
import subprocess
from pathlib import Path

SCRIPT = Path("scripts/heavy-gate.sh")
BASH = "/usr/bin/bash"


def _run(
    env: dict[str, str],
    *,
    runner: str,
    lock: Path,
    timeout_s: str = "5",
) -> subprocess.CompletedProcess[str]:
    merged = os.environ.copy()
    merged.pop("MORPHE_HEAVY_GATE", None)
    merged.pop("_MORPHE_GATE_HELD", None)
    merged.update(env)
    merged["HEAVY_GATE_RUNNER"] = runner
    merged["HEAVY_GATE_LOCK"] = str(lock)
    merged["HEAVY_GATE_TIMEOUT_S"] = timeout_s
    return subprocess.run(  # noqa: S603 - script under test
        [BASH, str(SCRIPT), "inner-recipe"],
        check=False,
        capture_output=True,
        text=True,
        env=merged,
    )


def test_heavy_gate_script_is_executable() -> None:
    assert SCRIPT.is_file()
    assert SCRIPT.stat().st_mode & stat.S_IXUSR


def test_heavy_gate_bypass_skips_the_lock(tmp_path: Path) -> None:
    runner = tmp_path / "runner"
    runner.write_text('#!/usr/bin/env bash\necho bypassed "$1"\n', encoding="utf-8")
    runner.chmod(0o755)
    result = _run({"MORPHE_HEAVY_GATE": "off"}, runner=str(runner), lock=tmp_path / "lock")
    assert result.returncode == 0
    assert result.stdout.strip() == "bypassed inner-recipe"
    assert "waiting for the machine-wide slot" not in result.stderr


def test_heavy_gate_reentrancy_skips_the_lock(tmp_path: Path) -> None:
    runner = tmp_path / "runner"
    runner.write_text('#!/usr/bin/env bash\necho reentered "$1"\n', encoding="utf-8")
    runner.chmod(0o755)
    result = _run({"_MORPHE_GATE_HELD": "1"}, runner=str(runner), lock=tmp_path / "lock")
    assert result.returncode == 0
    assert result.stdout.strip() == "reentered inner-recipe"
    assert "waiting for the machine-wide slot" not in result.stderr


def test_heavy_gate_fallback_runs_under_nice(tmp_path: Path) -> None:
    runner = tmp_path / "runner"
    runner.write_text(
        '#!/usr/bin/env bash\nps -o comm= -p "$PPID"\necho ran "$1"\n',
        encoding="utf-8",
    )
    runner.chmod(0o755)
    result = _run(
        {"HEAVY_GATE_FORCE_NICE": "1"},
        runner=str(runner),
        lock=tmp_path / "lock",
    )
    assert result.returncode == 0
    assert "ran inner-recipe" in result.stdout
    assert "waiting for the machine-wide slot" in result.stderr


def test_heavy_gate_requires_an_inner_recipe() -> None:
    result = subprocess.run(  # noqa: S603
        [BASH, str(SCRIPT)],
        check=False,
        capture_output=True,
        text=True,
    )
    assert result.returncode != 0
