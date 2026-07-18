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
export function withForwardedQuery(path: string, forward: URLSearchParams): string {
	if ([...forward].length === 0) return path;
	const cut = path.search(/[?#]/);
	const base = cut === -1 ? path : path.slice(0, cut);
	const existing = cut === -1 ? "" : path.slice(cut + 1);
	const merged = new URLSearchParams(existing);
	for (const [key, value] of forward) merged.set(key, value);
	const query = merged.toString();
	return query === "" ? base : `${base}?${query}`;
}
