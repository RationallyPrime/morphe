/**
 * Visitor-input validation for the composer ("What can Sókrates do for you?").
 *
 * This is the SMALL, hand-written form schema for the one thing a visitor types:
 * a free-text pain point and the systems they run. It is NOT the orval-generated
 * zod for the dkPlus / Humanity API surfaces — those are out of scope for the
 * read-only composer. Keep it minimal, total and forgiving: a marketing surface
 * never hard-rejects a curious visitor, it falls back to sane defaults.
 *
 * Pure: no clock, no RNG, no I/O.
 */

import { z } from "zod";
import type { SystemId } from "./capability.js";
import { SYSTEMS } from "./taxonomy.js";

/** The id set we actually answer for, used to drop unknown systems on parse. */
const KNOWN_SYSTEM_IDS: ReadonlySet<SystemId> = new Set(SYSTEMS.map((s) => s.id));

/**
 * The raw form schema. `pain` is free text (trimmed); `systems` is a list of
 * system id strings. We keep the field types permissive here and do the
 * narrowing to known ids in `parseQuery` so a stray id never throws.
 */
export const composeQuerySchema = z.object({
	pain: z.string().trim().default(""),
	systems: z.array(z.string()).default([]),
});

/** The validated visitor query the matcher scores against. */
export type ComposeQuery = { pain: string; systems: SystemId[] };

/**
 * Safe-parse arbitrary input into a `ComposeQuery`, never throwing.
 *
 * Falls back to an empty pain string and no systems when the shape is wrong, and
 * always narrows `systems` to the known ids (deduped, in declaration order) so
 * downstream scoring is deterministic and can't be fed garbage.
 */
export function parseQuery(raw: unknown): ComposeQuery {
	const result = composeQuerySchema.safeParse(raw);
	const pain = result.success ? result.data.pain : "";
	const rawSystems = result.success ? result.data.systems : [];

	const seen = new Set<SystemId>();
	for (const id of rawSystems) {
		if (KNOWN_SYSTEM_IDS.has(id)) seen.add(id);
	}
	// Emit in canonical SYSTEMS order so the result is stable regardless of input order.
	const systems = SYSTEMS.filter((s) => seen.has(s.id)).map((s) => s.id);

	return { pain, systems };
}
