/**
 * Morphe client store — Lemma 5 tier-1 state ownership.
 *
 * The tree carries binding paths, never live values. A bound primitive reads its
 * initial value from this store and commits tier-1 changes back by flat opaque
 * path. No module-level singleton: MorpheRoot provides a per-root/context/prop
 * instance, and standalone tests can construct one explicitly.
 */

import { DEV } from "esm-env";
import { getContext, hasContext, setContext } from "svelte";
import type { Tier1Event, Tier1EventInput, Tier1Kind } from "./events.js";
import type { JsonRecord, JsonValue } from "./json.js";

// Re-exported for the existing import surface (the canonical home is json.ts —
// a leaf module the store and the event vocabulary share without coupling).
export type { JsonArray, JsonObject, JsonPrimitive, JsonRecord, JsonValue } from "./json.js";

export type StoreSubscriber = (value: JsonValue | undefined) => void;

/**
 * The bounded recent-event window (FIFO). Sized for the digest's "recent
 * interaction" view (R1.3), not for history — the replay log is a different
 * artifact. Bounded so the store's memory is O(1) in session length.
 */
export const TIER1_WINDOW_SIZE = 32;

export interface MorpheStore {
	get(path: string): JsonValue | undefined;
	set(path: string, value: JsonValue): void;
	snapshot(): JsonRecord;
	subscribe(path: string, subscriber: StoreSubscriber): () => void;
	/**
	 * Record a tier-1 commit in the recent-event window. The store mints the
	 * `tier: 1` discriminant and the `at` stamp (from its injected clock) —
	 * the input shape carries neither, so a caller can forge neither.
	 */
	recordEvent(input: Tier1EventInput): void;
	/** The recent-event window, oldest first (at most `TIER1_WINDOW_SIZE`). */
	recentEvents(): readonly Tier1Event[];
}

const KEY = Symbol("morphe.store");

export interface StoreOptions {
	/**
	 * The clock that stamps recorded events. INJECTED so pure code never calls
	 * `Date.now()` itself and tests/replays are deterministic. The default is
	 * the wall clock, read at CALL time inside client code — never at module
	 * scope (SSR-safe).
	 */
	readonly now?: () => number;
}

export class InMemoryMorpheStore implements MorpheStore {
	#values = $state<Record<string, JsonValue>>({});
	#subscribers = new Map<string, Set<StoreSubscriber>>();
	#events: Tier1Event[] = [];
	#now: () => number;

	constructor(initial: JsonRecord = {}, options: StoreOptions = {}) {
		const values: Record<string, JsonValue> = {};
		for (const [path, value] of Object.entries(initial)) {
			values[path] = cloneJson(value);
		}
		this.#values = values;
		this.#now = options.now ?? (() => Date.now());
	}

	get(path: string): JsonValue | undefined {
		const value = this.#values[path];
		return value === undefined ? undefined : freezeForDev(cloneJson(value));
	}

	set(path: string, value: JsonValue): void {
		this.#values = { ...this.#values, [path]: cloneJson(value) };
		this.#notify(path);
	}

	snapshot(): JsonRecord {
		return freezeForDev(cloneJsonRecord(this.#values));
	}

	subscribe(path: string, subscriber: StoreSubscriber): () => void {
		let subscribers = this.#subscribers.get(path);
		if (!subscribers) {
			subscribers = new Set();
			this.#subscribers.set(path, subscribers);
		}
		subscribers.add(subscriber);
		return () => {
			subscribers?.delete(subscriber);
			if (subscribers?.size === 0) this.#subscribers.delete(path);
		};
	}

	recordEvent(input: Tier1EventInput): void {
		this.#events.push({
			tier: 1,
			kind: input.kind,
			path: input.path,
			value: cloneJson(input.value),
			at: this.#now(),
		});
		if (this.#events.length > TIER1_WINDOW_SIZE) {
			this.#events.splice(0, this.#events.length - TIER1_WINDOW_SIZE);
		}
	}

	recentEvents(): readonly Tier1Event[] {
		const out = this.#events.map((e) => ({ ...e, value: cloneJson(e.value) }));
		if (DEV) {
			for (const e of out) {
				deepFreeze(e.value);
				Object.freeze(e);
			}
			Object.freeze(out);
		}
		return out;
	}

	#notify(path: string): void {
		const value = this.get(path);
		for (const subscriber of this.#subscribers.get(path) ?? []) {
			subscriber(value);
		}
	}
}

export function createInMemoryMorpheStore(
	initial: JsonRecord = {},
	options: StoreOptions = {},
): MorpheStore {
	return new InMemoryMorpheStore(initial, options);
}

export function provideMorpheStore(store: MorpheStore): void {
	setContext(KEY, store);
}

export function useMorpheStore(): MorpheStore | undefined {
	if (!hasContext(KEY)) return undefined;
	return getContext<MorpheStore>(KEY);
}

export function resolveMorpheStore(
	propStore: MorpheStore | undefined,
	contextStore: MorpheStore | undefined,
	fallbackStore: MorpheStore,
): MorpheStore {
	return propStore ?? contextStore ?? fallbackStore;
}

export function boundString(
	store: MorpheStore | undefined,
	path: string | undefined,
	fallback: string,
): string {
	if (!store || !path) return fallback;
	const value = store.get(path);
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	return fallback;
}

export function boundNumber(
	store: MorpheStore | undefined,
	path: string | undefined,
	fallback: number,
): number {
	if (!store || !path) return fallback;
	const value = store.get(path);
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function boundBoolean(
	store: MorpheStore | undefined,
	path: string | undefined,
	fallback: boolean,
): boolean {
	if (!store || !path) return fallback;
	const value = store.get(path);
	return typeof value === "boolean" ? value : fallback;
}

/**
 * The ONE way a bound primitive commits: write the value AND record the
 * tier-1 event, atomically from the caller's point of view. There is no
 * write-without-record helper at this surface — every tier-1 commit is
 * observable in the recent-event window by construction (the purity
 * contract's enforcement, Lemma 5). No-op without a store or a `bind` path
 * (an unbound primitive stays purely local, Corollary 1).
 */
export function commitTier1(
	store: MorpheStore | undefined,
	path: string | undefined,
	kind: Tier1Kind,
	value: JsonValue,
): void {
	if (!store || !path) return;
	store.set(path, value);
	store.recordEvent({ kind, path, value });
}

function cloneJsonRecord(value: JsonRecord): Record<string, JsonValue> {
	const out: Record<string, JsonValue> = {};
	for (const [key, child] of Object.entries(value)) out[key] = cloneJson(child);
	return out;
}

function cloneJson(value: JsonValue): JsonValue {
	if (
		value === null ||
		typeof value === "string" ||
		typeof value === "number" ||
		typeof value === "boolean"
	) {
		return value;
	}
	if (Array.isArray(value)) return value.map(cloneJson);
	const out: Record<string, JsonValue> = {};
	for (const [key, child] of Object.entries(value)) out[key] = cloneJson(child);
	return out;
}

function freezeForDev<T extends JsonValue | JsonRecord>(value: T): T {
	if (!DEV) return value;
	return deepFreeze(value);
}

function deepFreeze<T extends JsonValue | JsonRecord>(value: T): T {
	if (value && typeof value === "object") {
		for (const child of Object.values(value)) deepFreeze(child);
		Object.freeze(value);
	}
	return value;
}
