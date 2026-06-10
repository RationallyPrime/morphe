/**
 * Morphe EVENT TIERS — the typed taxonomy of the purity contract (Lemma 5).
 *
 * The tier boundaries are LAW, and the law is enforced structurally, not by
 * convention:
 *
 *   TIER 0 — hover, focus, keystroke, scroll, drag. Never leaves the
 *   component. There is deliberately NO Tier0Event type: tier-0 interaction
 *   has no wire representation at all, so it is unrepresentable outside its
 *   component. (The deliverable at tier 0 is the absence of one.)
 *
 *   TIER 1 — a COMMITTED selection, filter edit, expand/collapse, sort.
 *   Commits to the client store and is recorded in the store's bounded
 *   recent-event window — the raw material of the ContextDigest (R1.3).
 *   `Tier1Event` is stamped by the STORE (its injected clock), never by the
 *   primitive: pure code carries no `Date.now()`.
 *
 *   TIER 2 — submit, task transition, an explicit "this view isn't working".
 *   Surfaces as a TYPED CALLBACK at the `MorpheRoot` boundary as a recorded
 *   `Tier2Escalation` (`event` + `ContextDigest`) — not a DOM event, not a
 *   store write. A tier-2 event's payload is `JsonValue`-typed by construction,
 *   so it cannot carry live tier-0 state (no element refs, no handlers, no
 *   class instances are representable).
 *
 * Cross-tier smuggling is type-impossible in both directions: the store's
 * recorder accepts only the tier-1 input shape (it mints `tier: 1` itself),
 * and the root-internal escalation emitter accepts only `Tier2Event`.
 * MorpheRoot records the `ContextDigest` at that boundary before the host
 * callback runs. A tier-1 handler has no escalation capability to reach for —
 * input primitives consume the store context, never the escalation context
 * (asserted by the architecture scan in `store.test.ts`).
 */

import type { ContextDigest } from "./digest.js";
import type { JsonRecord, JsonValue } from "./json.js";

/* ---------------------------------------------------------------------------
 * Tier 1 — committed interaction state.
 * ------------------------------------------------------------------------- */

/** What a tier-1 commit IS, semantically (VISION §8's tier table). */
export type Tier1Kind = "selection" | "filter-edit" | "expand" | "collapse" | "sort";

/**
 * A recorded tier-1 commit. Constructed ONLY by the store's recorder — the
 * `tier` discriminant and the `at` stamp (from the store's injected clock)
 * are minted there, so a primitive can neither forge a tier nor read a clock.
 */
export interface Tier1Event {
	readonly tier: 1;
	readonly kind: Tier1Kind;
	/** The flat opaque store path the commit wrote (ADR-0003). */
	readonly path: string;
	/** The committed value — full JSON, replace-on-write semantics. */
	readonly value: JsonValue;
	/** Milliseconds from the store's injected clock (deterministic in tests). */
	readonly at: number;
}

/** The primitive-facing input shape: tier and timestamp are the store's. */
export type Tier1EventInput = Omit<Tier1Event, "tier" | "at">;

/* ---------------------------------------------------------------------------
 * Tier 2 — escalation. A discriminated union; extend by adding a member.
 * ------------------------------------------------------------------------- */

/** A form-ish submit inside a Morphe tree (native page chrome stays native). */
export interface SubmitEvent {
	readonly tier: 2;
	readonly kind: "submit";
	/** What was submitted — an id the host's vocabulary assigns. */
	readonly id: string;
	/** Committed (tier-1) values relevant to the submit — never live state. */
	readonly values?: JsonRecord;
}

/** A task-level transition (step completed, flow advanced/abandoned). */
export interface TaskTransitionEvent {
	readonly tier: 2;
	readonly kind: "task-transition";
	readonly from?: string;
	readonly to: string;
}

/**
 * The explicit dissatisfaction signal — "this view isn't working". Vocabulary
 * only for now: the type exists so hosts can handle it, but no shipped UI
 * fires it yet (which affordance offers it is a product decision).
 */
export interface ViewNotWorkingEvent {
	readonly tier: 2;
	readonly kind: "view-not-working";
	readonly note?: string;
}

export type Tier2Event = SubmitEvent | TaskTransitionEvent | ViewNotWorkingEvent;

/** The root-internal emitter: primitives fire the event; MorpheRoot records the digest. */
export type EscalationEmitter = (event: Tier2Event) => void;

/** A recorded tier-2 escalation: the event plus the point-in-time digest. */
export interface Tier2Escalation {
	readonly event: Tier2Event;
	readonly digest: ContextDigest;
}

/** The host-facing `MorpheRoot` escalation callback — the replay record surface. */
export type EscalationHandler = (record: Tier2Escalation) => void;
