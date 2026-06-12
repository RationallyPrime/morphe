/**
 * The props contract every primitive component receives from Node.svelte.
 *
 * Each primitive is handed its narrowed `node` and the resolved `ctx` for its
 * position in the tree. A primitive reads density/scale_tier/emphasis from `ctx`
 * (and the continuous values arrive as CSS vars on the boundary set by its
 * nearest Layout ancestor), and may set its own CSS vars via `style:`.
 *
 * Generic over the exact Node subtype so a primitive's <script> gets a precisely
 * typed `node`. The registry stores them as `Component<any>` (kinds are erased
 * at the map boundary), but each .svelte file declares the precise type.
 */

import type { MorpheContext } from "../context/algebra.js";
import type { Node } from "../grammar/types.js";

export interface PrimitiveProps<N extends Node = Node> {
	/** The grammar node this component renders, narrowed to its kind. */
	readonly node: N;
	/** The resolved context at this node's position. */
	readonly ctx: MorpheContext;
}
