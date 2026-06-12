import { DEV } from "esm-env";
import type { VaryId } from "../grammar/types.js";
import type { ContextDigest } from "../state/digest.js";
import type { Delta } from "./envelope.js";

export interface MidLoopDelegate {
	propose(digest: ContextDigest, liveVaryIds: ReadonlySet<VaryId>): readonly Delta[];
}

export interface DevStaticChoiceMidLoopOptions {
	readonly epoch: number;
	readonly choice?: number;
	/** Test/dev override. Defaults to esm-env's DEV flag. */
	readonly enabled?: boolean;
}

/**
 * Trivial host-side mid-loop example: propose the same choice for every live id.
 *
 * It exists to prove the plug-in seam. The renderer never imports or calls it;
 * a host runs proposals through applyDelta, then passes the resulting choices
 * into MorpheRoot.
 */
export function createDevStaticChoiceMidLoop(
	options: DevStaticChoiceMidLoopOptions,
): MidLoopDelegate {
	const enabled = options.enabled ?? DEV;
	const choice = options.choice ?? 0;
	return {
		propose(_digest, ids) {
			if (!enabled) return [];
			return [...ids].map((id) => ({ id, choice, epoch: options.epoch }));
		},
	};
}
