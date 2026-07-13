import { type RenderedEmphasis, renderedChildEmphasis } from "../context/algebra.js";
import type { ChoiceMap } from "../delegation/envelope.js";
import { resolveNodeEmphasisClaim } from "../delegation/resolveChoice.js";
import type { Node } from "../grammar/types.js";

/**
 * Resolve a container's child grants against the choice map visible at its
 * render boundary. The context algebra owns normalization; this adapter owns
 * the delegation-aware claim strategy shared by every recursive container.
 */
export function resolveChildEmphasisGrants(
	budget: number,
	children: readonly Node[],
	choices: ChoiceMap | undefined,
): readonly RenderedEmphasis[] {
	return renderedChildEmphasis(budget, children, (candidate) =>
		resolveNodeEmphasisClaim(candidate, choices),
	);
}
