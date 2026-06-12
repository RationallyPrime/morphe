/**
 * ContextDigest — the replayable Lemma 5 snapshot.
 *
 * A digest is a value record, never a live stream: tier-1 state plus the bounded
 * recent-event window, cloned into a JSON-round-trippable envelope.
 */

import type { EscalationEmitter, EscalationHandler, Tier1Event, Tier2Event } from "./events.js";
import type { JsonRecord } from "./json.js";
import type { MorpheStore } from "./store.svelte.js";

export const CONTEXT_DIGEST_VERSION = 1;
export type ContextDigestVersion = typeof CONTEXT_DIGEST_VERSION;

export interface ContextDigest {
	readonly digestVersion: ContextDigestVersion;
	readonly state: JsonRecord;
	readonly recentEvents: readonly Tier1Event[];
}

export function digestOf(store: MorpheStore): ContextDigest {
	return {
		digestVersion: CONTEXT_DIGEST_VERSION,
		state: jsonClone(store.snapshot()),
		recentEvents: jsonClone(store.recentEvents()),
	};
}

export function escalationWithDigest(
	store: MorpheStore,
	handler: EscalationHandler | undefined,
): EscalationEmitter | undefined {
	if (!handler) return undefined;
	return (event) => {
		handler({
			event: jsonClone(event),
			digest: digestOf(store),
		});
	};
}

function jsonClone<T extends JsonRecord | readonly Tier1Event[] | Tier2Event>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}
