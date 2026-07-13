from __future__ import annotations

from pathlib import Path

import pytest

from morphe_grammar import (
    VISIBLE_LABEL_PATTERN,
    has_visible_label_text,
    normalize_visible_label_text,
)
from morphe_grammar.labels import labels_typescript_document

LABELS_TYPESCRIPT_PATH = Path("src/lib/grammar/labels.ts")

# Hard-coded contract probes prevent the generated range table from silently dropping one of
# the hostile/default-ignorable families this boundary promises to reject.
REQUIRED_INVISIBLE_CODE_POINTS = (
    0x0000,
    0x0009,
    0x001F,
    0x0020,
    0x007F,
    0x0085,
    0x009F,
    0x00A0,
    0x00AD,
    0x034F,
    0x0600,
    0x0605,
    0x061C,
    0x06DD,
    0x070F,
    0x0890,
    0x0891,
    0x08E2,
    0x115F,
    0x1160,
    0x17B4,
    0x17B5,
    0x180B,
    0x180F,
    0x2000,
    0x200B,
    0x200F,
    0x2028,
    0x202F,
    0x205F,
    0x206F,
    0x2800,
    0x3000,
    0x3164,
    0xFE00,
    0xFE0F,
    0xFEFF,
    0xFFA0,
    0xFFF9,
    0xFFFB,
)


@pytest.mark.parametrize("code_point", REQUIRED_INVISIBLE_CODE_POINTS)
def test_visible_label_predicate_rejects_required_invisible_code_points(code_point: int) -> None:
    assert not has_visible_label_text(chr(code_point))


def test_visible_label_predicate_rejects_mixed_invisible_families() -> None:
    label = "".join(chr(code_point) for code_point in REQUIRED_INVISIBLE_CODE_POINTS)

    assert not has_visible_label_text(label)
    assert normalize_visible_label_text(label, fallback="Details") == "Details"


@pytest.mark.parametrize("label", ["Ísland", "東京", "©", "😀", "❤️"])
def test_visible_label_predicate_allows_unicode_letters_symbols_and_emoji(label: str) -> None:
    assert has_visible_label_text(label)
    assert normalize_visible_label_text(f"  {label}  ", fallback="Details") == label


def test_visible_label_normalizer_requires_a_visible_fallback() -> None:
    with pytest.raises(ValueError, match="fallback must contain"):
        normalize_visible_label_text("\u200b", fallback="\ufeff")


def test_visible_label_pattern_uses_only_explicit_engine_stable_ranges() -> None:
    assert r"\s" not in VISIBLE_LABEL_PATTERN
    assert r"\u0085" not in VISIBLE_LABEL_PATTERN  # covered by the explicit U+007F-U+00A0 range
    assert r"\u007F-\u00A0" in VISIBLE_LABEL_PATTERN
    assert r"\u2000-\u200F" in VISIBLE_LABEL_PATTERN
    assert r"\uFEFF" in VISIBLE_LABEL_PATTERN


def test_committed_typescript_label_helper_is_generated_from_python() -> None:
    assert LABELS_TYPESCRIPT_PATH.read_text(encoding="utf-8") == labels_typescript_document()
