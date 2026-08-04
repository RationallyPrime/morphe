/**
 * Pure authored socket vocabulary shared by the playground tree and its native
 * `/substrate` host. It grants no policy authority by itself.
 */

/** The one tier-1 path the neutral deterministic policy may observe. */
export const LIVE_PROOF_STORE_PATH = "live.proof.preference";

/** Directly authored variation ids; none are inferred from prose or controls. */
export const LIVE_PROOF_IDS = {
	mode: "live.proof.mode",
	density: "live.proof.density",
	emphasis: "live.proof.emphasis",
	detail: "live.proof.detail",
	hostOnly: "live.proof.host-only",
} as const;
