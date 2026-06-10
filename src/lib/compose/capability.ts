/**
 * The composition corpus — the typed shape behind "What can Sókrates do for you?".
 *
 * This is MARKETING-SURFACE (a Morphe / Projection-M consumer), not core. It is
 * destined for the website, not the `eidos` package — see MIGRATION.md. It is
 * built ON the morphe primitives and GROUNDED by real Hyle output dropped under
 * `data/hyle/<system>/` (compiled models + endpoint inventory from each system's
 * OpenAPI/Swagger).
 *
 * Each `Capability` is ONE cross-system automation — the unit the composer
 * surfaces when a visitor states a pain point and names their systems. The 45
 * Humanity×dkPlus capabilities are instances of this shape:
 *   [pain] -> [source surfaces] [transform] -> [target surfaces] = [value]
 * grounded in the ACTUAL endpoints + the Eidos/Pydantic models Hyle compiled.
 * That grounding is the whole pitch: not a claim, an artifact you can verify.
 *
 * The composer surfaces grounded capabilities, not catalogue claims. `tier`
 * carries the posture so a capability can never present itself as more than it is
 * on the front door.
 */

/** Stable slug for a source system, e.g. "humanity", "dkplus". */
export type SystemId = string;

/**
 * The product CATEGORY a system belongs to — the system-AGNOSTIC axis. A
 * capability's reach is conceptually a category shape ("CRM -> ERP"); the concrete
 * systems that realize it (Twenty -> dkPlus) are the GROUNDING axis. Multiple
 * products can fill a category; the deferred template/binding split is what will
 * eventually let one category-shaped capability bind to every compatible product.
 */
export type Category = "crm" | "erp" | "wfm" | "workflow";

export interface SystemRef {
	id: SystemId;
	label: string; // display name: "Humanity", "dkPlus"
}

export type Direction = "read" | "write" | "event";

/**
 * A real endpoint surface, taken from the Hyle-compiled inventory for a system.
 * `operationId` / `model` are present when the source spec carries them; the site
 * renders these as the verifiable evidence behind a capability.
 */
export interface SurfaceUse {
	system: SystemId;
	direction: Direction;
	method: string; // "GET" | "POST" | ... (string, not enum: specs vary)
	path: string; // "/api/v2/timeclocks"
	operationId?: string; // from the OpenAPI/Hyle inventory when present
	summary?: string; // human label lifted from the spec
	model?: string; // the Eidos/Pydantic model this surface reads or writes
}

/**
 * Governance posture, shown on the front door. The marketing surface only ever
 * presents `read-only` or `proposes`; `acts` exists in the type so the same
 * corpus can drive the appliance later, where action is gated by an envelope.
 */
export type GovernanceTier = "read-only" | "proposes" | "acts";

/** One cross-system automation. */
export interface Capability {
	id: string;
	title: string; // "Approved timeclock -> payroll/work-journal posting"
	/** Matchable phrases/tags a visitor's stated pain maps onto. */
	painPoints: string[];
	/**
	 * The FULL set of systems this capability requires. A capability only surfaces
	 * when this set is a subset of the visitor's selected systems: one entry for a
	 * single-system cap, two for a cross-system pair, three for a three-way loop.
	 */
	systems: readonly SystemId[];
	source: SystemRef; // the trigger system
	target: SystemRef; // the system acted upon (== source for single-system caps)
	transform: string; // one plain-language sentence: what it does
	value: string; // the business outcome it produces
	/** The real endpoints composed — the verifiable evidence. */
	surfaces: SurfaceUse[];
	/** Eidos/Pydantic models touched, shown as proof Hyle ingested the spec. */
	models?: string[];
	tier: GovernanceTier;
}

/** A pairing the composer can answer for, with its grounded capability set. */
export interface CapabilityCorpus {
	systems: SystemRef[];
	capabilities: Capability[];
	/** Provenance: which Hyle outputs grounded this corpus. */
	groundedBy?: { system: SystemId; specVersion?: string; source: string }[];
}
