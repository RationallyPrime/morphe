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

import type { ApplyDeltaResult, ChoiceMap, EmissionEnvelope } from "$lib";
import { activeDialect, applyDelta, getDialect } from "$lib";
import type { SiteIntent } from "./intents.js";

/** The result of executing one intent through the engine. */
export type IntentOutcome =
	| { readonly kind: "navigate"; readonly href: string }
	| { readonly kind: "morphed" }
	| { readonly kind: "rejected"; readonly reason: ApplyDeltaResult | "no-stage" };

/**
 * Resolve a Vary point's default choice by walking an authored tree (pure,
 * structural). Used by the toggle path: closing an open morph means returning
 * the Vary to its authored default branch, whatever that is — the engine never
 * hardcodes a stage's choice numbering.
 */
export function varyDefaultChoice(node: unknown, id: string): number | null {
	if (node === null || typeof node !== "object") return null;
	if (Array.isArray(node)) {
		for (const child of node) {
			const found = varyDefaultChoice(child, id);
			if (found !== null) return found;
		}
		return null;
	}
	const record = node as Record<string, unknown>;
	if (record.kind === "vary" && record.id === id) {
		return typeof record.default === "number" ? record.default : 0;
	}
	for (const value of Object.values(record)) {
		const found = varyDefaultChoice(value, id);
		if (found !== null) return found;
	}
	return null;
}

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
				// TOGGLE: invoking the morph that is already open closes it — the
				// Vary returns to its authored default branch. A chip you opened
				// is a chip you can close; the palette rides the same semantics.
				const closing = stage.choices[intent.action.id] === intent.action.choice;
				const choice = closing
					? (varyDefaultChoice(stage.tree, intent.action.id) ?? 0)
					: intent.action.choice;
				// Stamp the LIVE epoch: a synchronous visitor is acting on the
				// emission they can see. Staleness guards async proposers, and
				// applyDelta still enforces it for them.
				const outcome = applyDelta(stage, {
					id: intent.action.id,
					choice,
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
				announcement = closing ? "Closed." : (intent.announce ?? `${intent.label} — shown below.`);
				return { kind: "morphed" };
			}
		}
	},
};
