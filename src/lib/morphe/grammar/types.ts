/**
 * Morphe grammar — the Node discriminated union (Lemma 1 / Definition 2).
 *
 * THIS FILE IS DECLARATIVE ONLY. It is the TS-first source of truth for the
 * grammar in Phase 0 (no agent yet), kept as a pure, logic-free discriminated
 * union so the later lift to a Pydantic source + JSON-Schema codegen is
 * mechanical. Do not put runtime logic, defaults, helpers, or branded-type
 * machinery that requires evaluation in here — only types and the literal
 * `kind` discriminants.
 *
 * Design DNA enforced here:
 *   - Primitives (P) are FIXED and factored by COMPOSITIONAL ROLE, not widget
 *     taxonomy: Layout / Content / Input / Feedback / Meta (+ CompoundRef).
 *   - Accessibility semantics are REQUIRED typed props on inputs. An Input
 *     without a label relationship must be a TYPE ERROR, not a lint warning.
 *   - Vertical vocabulary lives ONLY at the intent layer (tokens/intents.ts).
 *     Nothing here references raw scales or pixel values; authored trees emit
 *     ROLES, PRIORITIES and INTENTS, never geometry. (Lemma 2 / Lemma 3.)
 *
 * Primitive agents MUST NOT edit this file. If a primitive needs a new prop,
 * that is a grammar change and goes through the contract owner.
 */

/* ---------------------------------------------------------------------------
 * Shared vocabularies
 * ------------------------------------------------------------------------- */

/**
 * A container's compositional role. Consumed by the context algebra (Lemma 2)
 * to pick the per-role transform `C_child = f(C_parent, role_child)`. These are
 * roles, not widgets: the same role can render with different appearance under
 * different dialects.
 */
export type ContainerRole =
	| "page" // top-level document region; usually a Frame's child
	| "section" // a major editorial/functional band
	| "panel" // a bounded card-like grouping
	| "toolbar" // a dense horizontal control band
	| "list" // a repeated homogeneous sequence
	| "form" // a group of inputs with a shared submit intent
	| "field-group" // related inputs that read as one unit
	| "inline"; // a run of in-flow content (a Cluster's default)

/** Density tier carried in the context record. */
export type Density = "compact" | "regular" | "spacious";

/**
 * An emphasis CLAIM made by a node. The algebra RENORMALIZES claims against the
 * parent's emphasis budget B (Budget-conservation law) — a node never gets to
 * unilaterally set its rendered emphasis. "muted" never claims budget.
 */
export type EmphasisClaim = "muted" | "normal" | "strong" | "critical";

/**
 * The set of core intents (semantic, vertical-NEUTRAL). Dialects EXTEND this set
 * with vertical discourse roles at the intent layer (Lemma 4); they never rename
 * these. Slots map onto intents; components reference intents, never scales.
 */
export type CoreIntent =
	| "primary-action"
	| "neutral"
	| "provenance"
	| "evidence"
	| "accession"
	| "caution"
	| "success"
	| "info";

/**
 * An intent reference. A bare `CoreIntent` is always valid; a dialect intent is
 * referenced by string and validated at apply-time against the active dialect's
 * intent set (kept as a widened string so authored trees stay portable across
 * dialects without a grammar change).
 */
export type IntentRef = CoreIntent | (string & {});

/* ---------------------------------------------------------------------------
 * Accessibility — REQUIRED FIELDS (Lemma 1 closing paragraph)
 *
 * The whole point: an inaccessible tree is UNREPRESENTABLE. Inputs cannot be
 * constructed without a label relationship; status signals cannot be expressed
 * by color alone (a paired text/shape signal is required).
 * ------------------------------------------------------------------------- */

/**
 * How an interactive primitive is labelled. Exactly one mechanism must be
 * chosen — there is no "unlabelled" inhabitant of this type.
 */
export type LabelRelation =
	| { readonly mode: "visible"; readonly text: string }
	| { readonly mode: "aria-label"; readonly text: string }
	| { readonly mode: "labelledby"; readonly id: string };

/** Required accessibility envelope on every Input primitive. */
export interface InputA11y {
	/** Stable id used to wire label/description relationships in the DOM. */
	readonly id: string;
	/** Mandatory label relationship — there is no unlabelled input. */
	readonly label: LabelRelation;
	/** Optional id of a describing element (hint/error) wired via aria-describedby. */
	readonly describedBy?: string;
	/** Whether the input is required for submission (sets aria-required). */
	readonly required?: boolean;
}

/**
 * A non-color signal that MUST accompany any functional-color status. Functional
 * color is never the only signal (Lemma 1 / a11y rule, WCAG 1.4.1).
 */
export interface StatusSignal {
	/** Human-readable status text — the always-present, color-independent signal. */
	readonly text: string;
	/** Optional icon name reinforcing the status by shape. */
	readonly icon?: string;
}

/* ---------------------------------------------------------------------------
 * LAYOUT primitives — pure positioning, carriers of composition context.
 * ------------------------------------------------------------------------- */

export interface Stack {
	readonly kind: "stack";
	readonly role: ContainerRole;
	/** "auto" lets a container query flip the axis with no JS (Lemma 2). */
	readonly direction?: "block" | "inline" | "auto";
	readonly emphasis?: EmphasisClaim;
	readonly children: readonly Node[];
}

export interface Grid {
	readonly kind: "grid";
	readonly role: ContainerRole;
	/** Author intent, not pixels: the algebra compiles tracks into space. */
	readonly minTrack?: "narrow" | "regular" | "wide";
	readonly emphasis?: EmphasisClaim;
	readonly children: readonly Node[];
}

export interface Cluster {
	readonly kind: "cluster";
	readonly role: ContainerRole;
	readonly justify?: "start" | "center" | "end" | "between";
	readonly align?: "start" | "center" | "end" | "baseline";
	readonly emphasis?: EmphasisClaim;
	readonly children: readonly Node[];
}

/**
 * A context reset — the analogue of a new stacking context. Resets scale_tier
 * and re-roots depth for its subtree (Monotone-depth law allows a reset ONLY at
 * a Frame).
 */
export interface Frame {
	readonly kind: "frame";
	readonly role: ContainerRole;
	/** The surface this frame establishes; drives the surface-elevation token. */
	readonly surface?: "base" | "raised" | "sunken";
	/** Density override for the subtree; absent means inherit. */
	readonly density?: Density;
	/** Emphasis budget B granted to the subtree; absent means inherit. */
	readonly budget?: number;
	readonly children: readonly Node[];
}

export interface Spacer {
	readonly kind: "spacer";
	/** Author intent, mapped onto the space scale by the algebra. */
	readonly size?: "xs" | "sm" | "md" | "lg" | "xl";
}

/* ---------------------------------------------------------------------------
 * CONTENT primitives.
 * ------------------------------------------------------------------------- */

export interface Text {
	readonly kind: "text";
	readonly value: string;
	/** Semantic level; the algebra maps it onto the type scale + tier. */
	readonly as?: "display" | "heading" | "subheading" | "body" | "caption";
	readonly emphasis?: EmphasisClaim;
	readonly intent?: IntentRef;
	/** Truncate to a line count; author intent, not a pixel height. */
	readonly clamp?: number;
}

export interface NumberNode {
	readonly kind: "number";
	readonly value: number;
	/** Presentational format; locale resolution happens at render. */
	readonly format?: "plain" | "integer" | "currency" | "percent" | "compact";
	readonly currency?: string;
	readonly emphasis?: EmphasisClaim;
	readonly intent?: IntentRef;
}

export interface Badge {
	readonly kind: "badge";
	readonly label: string;
	readonly intent?: IntentRef;
	/** Shape reinforcement so the badge does not rely on color alone. */
	readonly icon?: string;
}

export interface Icon {
	readonly kind: "icon";
	readonly name: string;
	/**
	 * Decorative icons are hidden from AT; meaningful icons MUST carry a label.
	 * The union makes "meaningful but unlabelled" unrepresentable.
	 */
	readonly a11y: { readonly role: "decorative" } | { readonly role: "img"; readonly label: string };
	readonly intent?: IntentRef;
}

export interface Media {
	readonly kind: "media";
	readonly src: string;
	/** Alt text is required; an empty string is the explicit "decorative" opt-out. */
	readonly alt: string;
	readonly aspect?: "square" | "video" | "portrait" | "auto";
}

/* ---------------------------------------------------------------------------
 * INPUT primitives — the stateful providers (Lemma 5). a11y is REQUIRED.
 * ------------------------------------------------------------------------- */

export interface Field {
	readonly kind: "field";
	readonly a11y: InputA11y;
	readonly inputType?: "text" | "email" | "password" | "number" | "search" | "tel" | "url";
	readonly placeholder?: string;
	/** Optional binding path (Lemma 5); never a live value on the wire. */
	readonly bind?: string;
	readonly hint?: string;
	/** When present, the field is in an error state with this message. */
	readonly error?: string;
}

export interface SelectOption {
	readonly value: string;
	readonly label: string;
	readonly disabled?: boolean;
}

export interface Select {
	readonly kind: "select";
	readonly a11y: InputA11y;
	readonly options: readonly SelectOption[];
	readonly bind?: string;
	readonly hint?: string;
	readonly error?: string;
}

export interface Toggle {
	readonly kind: "toggle";
	readonly a11y: InputA11y;
	readonly bind?: string;
	readonly hint?: string;
}

export interface Range {
	readonly kind: "range";
	readonly a11y: InputA11y;
	readonly min: number;
	readonly max: number;
	readonly step?: number;
	readonly bind?: string;
	readonly hint?: string;
}

/* ---------------------------------------------------------------------------
 * FEEDBACK primitives — functional color is never the only signal.
 * ------------------------------------------------------------------------- */

export interface Progress {
	readonly kind: "progress";
	/** 0..1, or omitted for an indeterminate spinner. */
	readonly value?: number;
	/** Required label so the progress is announced, not just shown. */
	readonly label: string;
	readonly intent?: IntentRef;
}

export interface Status {
	readonly kind: "status";
	readonly tone: "success" | "caution" | "info" | "neutral";
	/** Paired non-color signal — required (WCAG 1.4.1). */
	readonly signal: StatusSignal;
}

export interface InlineAlert {
	readonly kind: "inline-alert";
	readonly tone: "success" | "caution" | "info";
	readonly title: string;
	readonly detail?: string;
	/** "assertive" for errors that interrupt, "polite" otherwise. */
	readonly live?: "polite" | "assertive";
}

/* ---------------------------------------------------------------------------
 * META primitives — structural; implemented by the renderer/factory, not stubs.
 * ------------------------------------------------------------------------- */

/**
 * A fill point in a compound template. The renderer fills it from the call
 * site's `CompoundRef.slots[name]`. Outside a compound expansion a Slot renders
 * its `fallback` (or nothing).
 */
export interface Slot {
	readonly kind: "slot";
	readonly name: string;
	readonly fallback?: readonly Node[];
}

/**
 * A reference to one of the enclosing compound's OWN params (hygienic: resolves
 * only against `CompoundDef.params`, never the call site). Replaced during
 * expansion by the bound argument; if the bound value is itself a Node subtree
 * it is spliced, otherwise it is coerced to a Text node by the expander.
 */
export interface ParamRef {
	readonly kind: "param-ref";
	readonly param: string;
}

/**
 * A bounded variation point (Lemma 6). Phase 0 renders `options[default]`; the
 * mid loop will later choose among options within the slow loop's envelope.
 */
export interface Vary {
	readonly kind: "vary";
	readonly id: string;
	readonly options: readonly Node[];
	readonly default?: number;
	/** What a future mid loop optimizes; inert in Phase 0. */
	readonly objective?: "salience" | "density" | "compactness";
}

/* ---------------------------------------------------------------------------
 * COMPOUND reference — the open-under-composition vocabulary (Lemma 1).
 * ------------------------------------------------------------------------- */

export interface CompoundRef {
	readonly kind: "compound";
	readonly name: string;
	/** Validated at expansion against the named CompoundDef's params schema. */
	readonly args: Readonly<Record<string, unknown>>;
	/** Fill the template's named Slots from the call site. */
	readonly slots?: Readonly<Record<string, readonly Node[]>>;
}

/* ---------------------------------------------------------------------------
 * The Node union — discriminated by `kind`.
 * ------------------------------------------------------------------------- */

export type LayoutNode = Stack | Grid | Cluster | Frame | Spacer;
export type ContentNode = Text | NumberNode | Badge | Icon | Media;
export type InputNode = Field | Select | Toggle | Range;
export type FeedbackNode = Progress | Status | InlineAlert;
export type MetaNode = Slot | ParamRef | Vary;

export type Node =
	| LayoutNode
	| ContentNode
	| InputNode
	| FeedbackNode
	| MetaNode
	| CompoundRef;

/** The string literal discriminants — the closed set of primitive kinds. */
export type NodeKind = Node["kind"];

/**
 * Compile-time exhaustiveness helper for switch statements over `kind`.
 * Calling this in a `default:` branch makes a missing case a TYPE error.
 */
export function assertNever(value: never): never {
	throw new Error(`Unhandled Node kind: ${JSON.stringify(value)}`);
}
