/**
 * Morphe declarative action binding — the R1.4 wire for in-tree Buttons.
 *
 * The grammar carries `Button.action` as an opaque id. MorpheRoot owns the live
 * host map, and Button only resolves the id at click time through this context.
 */

import { DEV } from "esm-env";
import { getContext, hasContext, setContext } from "svelte";

export type ActionHandler = () => void;
export type ActionMap = Readonly<Record<string, ActionHandler>>;

/** A reactive handle on the root's current action map. */
export interface ActionsRef {
	readonly current: ActionMap | undefined;
}

export interface InvokeActionOptions {
	readonly dev?: boolean;
	readonly warn?: (message: string) => void;
}

const KEY = Symbol("morphe.actions");

/** Provide the action map ref (called by MorpheRoot at init). */
export function provideActions(ref: ActionsRef): void {
	setContext(KEY, ref);
}

/** Read the nearest action map ref (undefined outside a MorpheRoot). */
export function useActions(): ActionsRef | undefined {
	if (!hasContext(KEY)) return undefined;
	return getContext<ActionsRef>(KEY);
}

export function invokeAction(
	actions: ActionMap | undefined,
	id: string | undefined,
	options: InvokeActionOptions = {},
): boolean {
	if (id === undefined) return false;
	const handler = actions?.[id];
	if (handler) {
		handler();
		return true;
	}
	if (options.dev ?? DEV) {
		const warn = options.warn ?? console.warn;
		warn(`Unknown Morphe action "${id}".`);
	}
	return false;
}
