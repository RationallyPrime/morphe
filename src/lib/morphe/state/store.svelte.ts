/**
 * Morphe client store — Lemma 5 tier-1 state ownership.
 *
 * The tree carries binding paths, never live values. A bound primitive reads its
 * initial value from this store and commits tier-1 changes back by flat opaque
 * path. No module-level singleton: MorpheRoot provides a per-root/context/prop
 * instance, and standalone tests can construct one explicitly.
 */

import { getContext, hasContext, setContext } from "svelte";

export type JsonPrimitive = string | number | boolean | null;
export type JsonArray = readonly JsonValue[];
export type JsonObject = { readonly [key: string]: JsonValue };
export type JsonValue = JsonPrimitive | JsonArray | JsonObject;
export type JsonRecord = Readonly<Record<string, JsonValue>>;

export type StoreSubscriber = (value: JsonValue | undefined) => void;

export interface MorpheStore {
	get(path: string): JsonValue | undefined;
	set(path: string, value: JsonValue): void;
	snapshot(): JsonRecord;
	subscribe(path: string, subscriber: StoreSubscriber): () => void;
}

const KEY = Symbol("morphe.store");

export class InMemoryMorpheStore implements MorpheStore {
	#values = $state<Record<string, JsonValue>>({});
	#subscribers = new Map<string, Set<StoreSubscriber>>();

	constructor(initial: JsonRecord = {}) {
		const values: Record<string, JsonValue> = {};
		for (const [path, value] of Object.entries(initial)) {
			values[path] = cloneJson(value);
		}
		this.#values = values;
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

	#notify(path: string): void {
		const value = this.get(path);
		for (const subscriber of this.#subscribers.get(path) ?? []) {
			subscriber(value);
		}
	}
}

export function createInMemoryMorpheStore(initial: JsonRecord = {}): MorpheStore {
	return new InMemoryMorpheStore(initial);
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

export function commitBinding(
	store: MorpheStore | undefined,
	path: string | undefined,
	value: JsonValue,
): void {
	if (!store || !path) return;
	store.set(path, value);
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
	if (!import.meta.env.DEV) return value;
	return deepFreeze(value);
}

function deepFreeze<T extends JsonValue | JsonRecord>(value: T): T {
	if (value && typeof value === "object") {
		for (const child of Object.values(value)) deepFreeze(child);
		Object.freeze(value);
	}
	return value;
}
