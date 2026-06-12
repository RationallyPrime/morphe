/**
 * Morphe ARRIVAL ATTRIBUTION — τ_frame selection from the landing URL (Lemma 4).
 *
 * The marketing instantiation of the frame stratum (VISION.md L4 remark,
 * DESIGN.md §9): a visitor arriving from an ad click carries deterministic,
 * consent-clean URL attribution (`?cohort=`), and that attribution selects the
 * dialect on arrival — the same authored marketing tree re-poses itself per
 * cohort with zero change to the authored nodes.
 *
 * This module is the PURE half of that wiring: one total function deciding
 * which dialect id (if any) an arrival should activate. The layout owns the
 * impure half (reading the page URL and localStorage, calling
 * `activeDialect.setById`) in its client-only mount effect.
 *
 * Precedence — and the discipline behind it:
 *
 *   valid `?cohort=` param  >  persisted choice  >  null (leave the default)
 *
 *   - A VALID param wins over the persisted choice because attribution is a
 *     statement about THIS arrival: the ad the visitor clicked today outranks
 *     the dialect a previous visit left behind.
 *   - The param applies ONCE, on arrival. An explicit in-session toggle (the
 *     `/substrate` switch) always wins afterward — attribution must never
 *     fight the user. That "once" is enforced by the caller (a mount-only
 *     effect), not here; this function is just the decision.
 *   - An UNKNOWN/garbage param is ignored, never an error and never a reset:
 *     the persisted choice (or the default) stands, exactly as if the param
 *     were absent. Ids are exact-match — `Clinical` is not `clinical`.
 *   - `null` means "express no preference": the caller leaves the active
 *     dialect untouched (the default, or whatever an outer effect set).
 *
 * Note the persisted value is NOT validated here — `activeDialect.setById`
 * already guards every write against the registry (an unknown id is a no-op,
 * not a reset), so a stale persisted id is harmless downstream and this
 * function stays a pure precedence rule rather than a second registry guard.
 */

/**
 * Decide which dialect id an arrival should activate.
 *
 * @param param     the raw `?cohort=` value from the landing URL (null if absent)
 * @param persisted the previously persisted dialect id (null if none)
 * @param knownIds  the registered dialect ids (exact-match, case-sensitive)
 * @returns the id to activate, or null to leave the current selection alone
 */
export function resolveArrivalDialect(
	param: string | null,
	persisted: string | null,
	knownIds: readonly string[],
): string | null {
	if (param !== null && knownIds.includes(param)) {
		return param;
	}
	return persisted ?? null;
}

/**
 * Decide whether (and what) to persist after a dialect change — the pure half
 * of the layout's write-back effect.
 *
 * THE RULE: the untouched default is not a choice. Persisting it would freeze
 * the shipped default into every visitor's storage, and a later default flip
 * (ADR-0005's gallery flip was the lesson) would never reach any returning
 * visitor — the old default would masquerade as their preference forever.
 * So:
 *
 *   - nothing stored + the id IS the default  → null (don't write; the
 *     visitor has expressed nothing)
 *   - the id equals what is already stored    → null (idempotent; no churn)
 *   - anything else                           → the id (an EXPLICIT move:
 *     away from the default, or an explicit return to it over a prior choice)
 *
 * @param id        the active dialect id after the change
 * @param stored    the currently persisted id (null if none)
 * @param defaultId the shipped default dialect id
 * @returns the value to persist, or null to leave storage untouched
 */
export function persistableDialect(
	id: string,
	stored: string | null,
	defaultId: string,
): string | null {
	if (stored === null && id === defaultId) return null;
	if (stored === id) return null;
	return id;
}
