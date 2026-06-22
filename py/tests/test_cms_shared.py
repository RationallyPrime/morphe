from __future__ import annotations


def test_package_imports() -> None:
    import morphe_cms  # noqa: PLC0415

    assert morphe_cms.__doc__ is not None
