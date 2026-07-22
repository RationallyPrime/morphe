import { getContext, hasContext, setContext } from "svelte";

/** Reactive pane-level state read by every Gloss disclosure below a MorpheRoot. */
export interface GlossRevealRef {
	readonly current: boolean;
}

const GLOSS_REVEAL_KEY = Symbol("morphe.gloss-reveal");

export function provideGlossReveal(ref: GlossRevealRef): void {
	setContext(GLOSS_REVEAL_KEY, ref);
}

export function useGlossReveal(): GlossRevealRef | undefined {
	return hasContext(GLOSS_REVEAL_KEY) ? getContext<GlossRevealRef>(GLOSS_REVEAL_KEY) : undefined;
}
