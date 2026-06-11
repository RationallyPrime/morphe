/**
 * The dossier MID LOOP (KRA-374) — the first real `MidLoopDelegate`.
 *
 * Until now the delegation seam shipped only `createDevStaticChoiceMidLoop`,
 * a stub proving the plug. This delegate closes the circle for real: the
 * wizard mirrors tier-1 interaction into a MorpheStore (`commitTier1`), the
 * host hands this delegate the resulting `ContextDigest`, and it proposes
 * bounded movement — the systems section re-sets itself ledger → compact as
 * the named-system count grows. Every proposal still passes `applyDelta`
 * host-side; this module never touches an envelope or the renderer.
 *
 * This is deliberately the architecture rehearsal for the multi-customer
 * control plane: observation in, typed bounded proposals out, the gate between.
 */

import type { MidLoopDelegate } from "$morphe";
import { DOSSIER_SYSTEMS_CHOICES, DOSSIER_SYSTEMS_ID } from "./dossier.js";

/** The store path the wizard mirrors the named-system count into. */
export const DOSSIER_NAMED_SYSTEMS_PATH = "onboarding.systems.named";

/** The store path the wizard mirrors the active step id into (digest color). */
export const DOSSIER_STEP_PATH = "onboarding.step";

/** Named systems at or above this count read better compact than as a ledger. */
export const DOSSIER_COMPACT_THRESHOLD = 3;

/**
 * Build the delegate. `currentEpoch` is read at proposal time so the delegate
 * always stamps the emission it is acting on — applyDelta still enforces
 * staleness for any proposer that lies.
 */
export function createDossierMidLoop(currentEpoch: () => number): MidLoopDelegate {
	return {
		propose(digest, liveIds) {
			if (!liveIds.has(DOSSIER_SYSTEMS_ID)) return [];
			const raw = digest.state[DOSSIER_NAMED_SYSTEMS_PATH];
			const named = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
			const choice =
				named >= DOSSIER_COMPACT_THRESHOLD
					? DOSSIER_SYSTEMS_CHOICES.compact
					: DOSSIER_SYSTEMS_CHOICES.ledger;
			return [{ id: DOSSIER_SYSTEMS_ID, choice, epoch: currentEpoch() }];
		},
	};
}
