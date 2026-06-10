/**
 * The INTENT ENGINE (ADR-0006 §2–3, KRA-355) — the mechanism half: one
 * execution path every affordance shares.
 *
 * Chips and the keystroke palette both call `intentEngine.execute(intent)`
 * and nothing else — the acceptance bar is that the two affordances CANNOT
 * diverge, so divergence is made unrepresentable: there is exactly one
 * interpreter over the closed `IntentAction` union.
 *
 *   - `navigate` is returned to the CALLER (`{kind: "navigate", href}`):
 *     a chip simply lets its anchor act, the palette routes via `goto`.
 *     The engine never touches `window` — SSR-safe by construction, same
 *     discipline as `active.svelte.ts`.
 *   - `flip-dialect` toggles the global dialect store between the pair and
 *     announces the new ground.
 *   - `stage-delta` stamps the LIVE envelope epoch onto the authored
 *     `{id, choice}` and runs it through `applyDelta` — the R2 gate. On
 *     "applied" the envelope advances (the renderer follows `choices`); on
 *     ANY rejection the envelope reference is untouched, so the page renders
 *     unchanged — render totality at the morph seam.
 *
 * The STAGE is the engine's one piece of state: an `EmissionEnvelope` the
 * home page installs around its morphable region (none in this slice;
 * KRA-356–359 install real Vary content), plus the polite live-region line
 * (`announcement`) that gives every morph a screen-reader voice.
 */

import type { ApplyDeltaResult, ChoiceMap, EmissionEnvelope } from "$morphe";
import { activeDialect, applyDelta, getDialect } from "$morphe";
import type { SiteIntent } from "./intents.js";

/** The result of executing one intent through the engine. */
export type IntentOutcome =
	| { readonly kind: "navigate"; readonly href: string }
	| { readonly kind: "morphed" }
	| { readonly kind: "rejected"; readonly reason: ApplyDeltaResult | "no-stage" };

/** The stage envelope; null until a page installs a morphable region. */
let stage = $state<EmissionEnvelope | null>(null);

/** The last morph's polite announcement (rendered into an aria-live region). */
let announcement = $state("");

export const intentEngine = {
	/** The live stage envelope (reactive); null when no stage is installed. */
	get stage(): EmissionEnvelope | null {
		return stage;
	},

	/** The live choices to hand `MorpheRoot` (reactive). */
	get choices(): ChoiceMap | undefined {
		return stage?.choices;
	},

	/** The current live-region line (reactive). */
	get announcement(): string {
		return announcement;
	},

	/** Install (or re-emit) the stage envelope. Client-only by discipline. */
	setStage(envelope: EmissionEnvelope | null): void {
		stage = envelope;
	},

	/** Execute one intent — the single path chips and palette share. */
	execute(intent: SiteIntent): IntentOutcome {
		switch (intent.action.kind) {
			case "navigate":
				return { kind: "navigate", href: intent.href };

			case "flip-dialect": {
				const [light, dark] = intent.action.between;
				// From the light ground go dark; from ANY other ground (the dark
				// half, or a dialect outside the pair) turn the lights on.
				const target = activeDialect.id === light ? dark : light;
				activeDialect.setById(target);
				announcement = `Page restyled — ${getDialect(target).label}.`;
				return { kind: "morphed" };
			}

			case "stage-delta": {
				if (stage === null) {
					return { kind: "rejected", reason: "no-stage" };
				}
				// Stamp the LIVE epoch: a synchronous visitor is acting on the
				// emission they can see. Staleness guards async proposers, and
				// applyDelta still enforces it for them.
				const outcome = applyDelta(stage, {
					id: intent.action.id,
					choice: intent.action.choice,
					epoch: stage.epoch,
				});
				if (outcome.result !== "applied") {
					if (import.meta.env.DEV) {
						console.warn(
							`[morphe-site] morph "${intent.id}" rejected by the gate: ${outcome.result}`,
						);
					}
					return { kind: "rejected", reason: outcome.result };
				}
				stage = outcome.envelope;
				announcement = intent.announce ?? `${intent.label} — shown below.`;
				return { kind: "morphed" };
			}
		}
	},
};
