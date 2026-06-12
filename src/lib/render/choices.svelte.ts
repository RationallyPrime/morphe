import { getContext, hasContext, setContext } from "svelte";
import type { ChoiceMap } from "../delegation/envelope.js";

export interface ChoicesRef {
	readonly current: ChoiceMap | undefined;
}

const KEY = Symbol("morphe.choices");

/** Provide the root's variation choice map ref (called by MorpheRoot at init). */
export function provideChoices(ref: ChoicesRef): void {
	setContext(KEY, ref);
}

/** Read the nearest variation choice map ref (undefined outside a MorpheRoot). */
export function useChoices(): ChoicesRef | undefined {
	if (!hasContext(KEY)) return undefined;
	return getContext<ChoicesRef>(KEY);
}
