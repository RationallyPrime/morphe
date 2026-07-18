/**
 * Forward a viewer pane's filter query onto its kernel fetch.
 *
 * The pane route drops the render-only `dialect` param and forwards the rest
 * (e.g. `?party_id=`) so a filtered link that survived `rewriteKernelLinks`
 * actually reaches the producer. The declared kernel path may already carry its
 * own query (a window, a run id); forwarded params merge onto it and win on a
 * key collision. Kept dependency-free so it unit-tests without the SvelteKit
 * virtual modules.
 */
export interface ForwardedRequest {
	/** The effective upstream path with the forwarded filter merged on. */
	readonly path: string;
	/**
	 * True when forwarding actually added to or overrode the configured path's own
	 * query — i.e. this is a DERIVED drill-through instance, not the pinned request.
	 * The gate downstream reads this to pick exact vs family surface-identity mode; it
	 * is decided here at request construction, never inferred from the response.
	 */
	readonly derived: boolean;
}

/**
 * Merge a viewer pane's forwarded filter onto its kernel path AND report whether
 * doing so changed the request. `derived` is false when nothing is forwarded, and
 * also when every forwarded param merely restates a value the declared path already
 * carries (the effective request is still the pinned instance).
 *
 * NOTE: `derived === false` (→ exact gate) is NOT a client-forced guarantee — any
 * request can append a junk param and flip itself to derived/family. That is safe by
 * design: the real boundary in family mode is family-membership + a valid signature
 * over the surface_id, not the exact/family selector. The selector only decides how
 * strict the identity comparison is; it never widens which artifacts can pass crypto.
 */
export function forwardedRequest(path: string, forward: URLSearchParams): ForwardedRequest {
	if ([...forward].length === 0) return { path, derived: false };
	const cut = path.search(/[?#]/);
	const base = cut === -1 ? path : path.slice(0, cut);
	const existing = cut === -1 ? "" : path.slice(cut + 1);
	const merged = new URLSearchParams(existing);
	// Both spellings run through the same normalization, so a forwarded param that
	// only restates a declared one leaves `after === before` (not a derived instance).
	const before = merged.toString();
	for (const [key, value] of forward) merged.set(key, value);
	const after = merged.toString();
	return {
		path: after === "" ? base : `${base}?${after}`,
		derived: after !== before,
	};
}

export function withForwardedQuery(path: string, forward: URLSearchParams): string {
	return forwardedRequest(path, forward).path;
}
