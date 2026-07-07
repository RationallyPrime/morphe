/**
 * Grammar version — the fail-closed compatibility gate for compiled artifacts.
 *
 * Mirrors `GRAMMAR_VERSION` in `py/morphe_surface/compile.py` (the compiler
 * stamps it into every `CompiledSurface`); a vitest asserts the two never
 * drift. Consumers (the box viewer's `/surfaces/[artifactId]` route) refuse to
 * render an artifact whose stamped version differs — a diagnostic naming both
 * versions, never a silent partial render (MO-D5).
 */
export const GRAMMAR_VERSION = "0.1.0";
