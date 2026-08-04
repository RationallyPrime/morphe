/**
 * Native `/substrate` deterministic-mid-loop host contract.
 *
 * This module owns policy and host-only evidence vocabulary, not authored UI.
 * It is deliberately SSR-pure: no clock, randomness, browser globals, I/O, or
 * mutable process state participate in a choice.
 */

import type { DeterministicObjectivePolicy } from "$lib";
import { LIVE_PROOF_IDS, LIVE_PROOF_STORE_PATH } from "../_playground/live-proof-contract.js";

/**
 * The host's complete deterministic authority declaration.
 *
 * `hostOnly` is structurally live in the authored tree but deliberately absent
 * here. That gives the neutral host a visible proof that canonical structural
 * admission can still be rejected by the narrower declared policy.
 */
export const LIVE_PROOF_POLICY: DeterministicObjectivePolicy = Object.freeze({
	id: "neutral-deterministic-live-proof-v1",
	targets: Object.freeze([
		{
			id: LIVE_PROOF_IDS.mode,
			objective: "salience",
			allowedChoices: Object.freeze([0, 1, 2]),
		},
		{
			id: LIVE_PROOF_IDS.density,
			objective: "density",
			allowedChoices: Object.freeze([0, 1, 2]),
		},
		{
			id: LIVE_PROOF_IDS.emphasis,
			objective: "salience",
			allowedChoices: Object.freeze([0, 1, 2, 3]),
		},
		{
			id: LIVE_PROOF_IDS.detail,
			objective: "compactness",
			allowedChoices: Object.freeze([0, 1]),
		},
	]),
	observableStorePaths: Object.freeze([LIVE_PROOF_STORE_PATH]),
	observableTier1Kinds: Object.freeze(["selection"]),
	choose: ({ digest, target }) => {
		const preference = digest.state[LIVE_PROOF_STORE_PATH];
		const selected =
			preference === "compact" || preference === "decision" ? preference : "evidence";
		const hasCommittedSelection = digest.recentEvents.some(
			(event) => event.kind === "selection" && event.path === LIVE_PROOF_STORE_PATH,
		);

		switch (target.id) {
			case LIVE_PROOF_IDS.mode:
				return selected === "compact" ? 0 : selected === "decision" ? 2 : 1;
			case LIVE_PROOF_IDS.density:
				return selected === "compact" ? 0 : selected === "decision" ? 2 : 1;
			case LIVE_PROOF_IDS.emphasis:
				return hasCommittedSelection ? 2 : 1;
			case LIVE_PROOF_IDS.detail:
				return selected === "decision" ? 1 : 0;
			default:
				return undefined;
		}
	},
} satisfies DeterministicObjectivePolicy);
