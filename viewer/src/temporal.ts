/**
 * Viewer temporal-policy control plumbing (KRA-767).
 *
 * The temporal policy is the viewer's per-user presentation choice for instant-typed
 * values. It rides the `?temporal=` query exactly as the dialect override rides
 * `?dialect=`: a native control writes the param, the server re-compiles the admitted
 * source under the chosen policy, and the pane re-renders. Only source-v1 panes can
 * honor it — a legacy tree carries baked display text — so the control is shown only
 * where a policy is in effect.
 */

import { DEFAULT_TEMPORAL_POLICY, type TemporalPolicy } from "$lib/surface-edge/spec.js";

/** The selectable policies, in header-control order. */
export const TEMPORAL_POLICIES: readonly TemporalPolicy[] = ["minute", "exact", "date", "relative"];

/** The `?temporal=` query key — the persistence mechanism, mirroring `?dialect=`. */
export const TEMPORAL_QUERY_KEY = "temporal";

/**
 * Resolve a raw query value to a policy, defaulting to {@link DEFAULT_TEMPORAL_POLICY}.
 * An unknown value is a no-op default (never an error), so a stale or hand-edited
 * `?temporal=` leaves the pane on the sane minute floor rather than failing to render.
 */
export function resolveTemporalPolicy(raw: string | null): TemporalPolicy {
	return raw !== null && (TEMPORAL_POLICIES as readonly string[]).includes(raw)
		? (raw as TemporalPolicy)
		: DEFAULT_TEMPORAL_POLICY;
}
