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

/**
 * Opaque variation-point id shared by Vary/Within and delegation deltas.
 * Assignment-compatible with existing string ids while still giving the contract
 * a named type to thread through the delegation surface.
 */
export type VaryId = string & { readonly __morpheVaryId?: never };

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

/**
 * A column sizing intent for a TABULAR Grid (author intent, never pixels):
 *   - "flexible": grows to absorb remaining width (the label / name column).
 *   - "content":  sized to its widest cell (numeric / badge / meta columns).
 * Consumed only when `Grid.columns` is present; the Grid's direct-child rows
 * (each a Grid) adopt these tracks via CSS subgrid, so columns line up across
 * every row — the table affordance ledgers need, expressed as an extension of
 * the existing Grid, not a new primitive.
 */
export type GridColumn = "flexible" | "content";

export interface Grid {
	readonly kind: "grid";
	readonly role: ContainerRole;
	/** Author intent, not pixels: the algebra compiles tracks into space. */
	readonly minTrack?: "narrow" | "regular" | "wide";
	/**
	 * Explicit column template — turns the Grid into a tabular/ledger list whose
	 * direct-child rows (each a Grid) align to one shared set of tracks via
	 * subgrid, so columns line up across rows. Absent ⇒ the auto-fit card
	 * behaviour is unchanged (the grammar fixed-point: every tree authored before
	 * this field existed stays valid).
	 */
	readonly columns?: readonly GridColumn[];
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
	/**
	 * Numeric register — tabular figures (`font-variant-numeric: tabular-nums`) so
	 * digits align vertically in ledger columns. A presentation capability of the
	 * SAME primitive, not a new kind; absent ⇒ proportional figures (the grammar
	 * fixed-point). Pairs with quantities carried as strings (ADR-0002), which
	 * never become JS numbers — the register is purely how the glyphs are spaced.
	 */
	readonly numeric?: boolean;
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

/** One responsive candidate set for a Media node (a `<source type srcset>`). */
export interface MediaSource {
	/** Image MIME type of the set, e.g. "image/avif". */
	readonly type: string;
	/** Comma-separated URL + width-descriptor candidates, e.g. "/a-640.avif 640w, …". */
	readonly srcset: string;
}

export interface Media {
	readonly kind: "media";
	readonly src: string;
	/** Alt text is required; an empty string is the explicit "decorative" opt-out. */
	readonly alt: string;
	readonly aspect?: "square" | "video" | "portrait" | "auto";
	/** Responsive candidate sets; when present, render `<picture>` with `src` as fallback. */
	readonly sources?: ReadonlyArray<MediaSource>;
	/** Slot-width hint for the candidate sets (the `sizes` attribute). */
	readonly sizes?: string;
	/** Intrinsic pixel width of the fallback bitmap (CLS prevention; metadata, not layout). */
	readonly width?: number;
	/** Intrinsic pixel height of the fallback bitmap (CLS prevention; metadata, not layout). */
	readonly height?: number;
	/** Above-the-fold opt-out of lazy loading; absent means lazy. */
	readonly eager?: boolean;
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
	/**
	 * Multiline MODE (the `<textarea>` substrate) — an optional capability of the
	 * SAME Field primitive, not a new kind. Absent/false = single-line `<input>`.
	 * Optional + defaulted so every existing authored Field stays valid (the
	 * grammar fixed-point is preserved). `inputType` is ignored when multiline.
	 */
	readonly multiline?: boolean;
	/** Visible row count in multiline mode; ignored single-line. */
	readonly rows?: number;
	/** Whether a multiline control may be user-resized; ignored single-line. */
	readonly resizable?: boolean;
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
	/**
	 * Presentation MODE of the SAME Select primitive — not a new kind.
	 *   - "dropdown"   (default): a native `<select>` (free keyboard / type-ahead).
	 *   - "radiogroup": a `<fieldset>`/`<legend>` group of `role="radio"` options
	 *                   with roving tabindex — for small option sets that read as
	 *                   one mutually-exclusive choice.
	 * Optional + defaulted to "dropdown" so existing authored Selects stay valid.
	 */
	readonly variant?: "dropdown" | "radiogroup";
}

export interface Toggle {
	readonly kind: "toggle";
	readonly a11y: InputA11y;
	readonly bind?: string;
	readonly hint?: string;
	/**
	 * Semantic MODE of the SAME Toggle primitive — not a new kind.
	 *   - "switch"   (default): a real `<button role="switch" aria-checked>` —
	 *                an on/off setting that takes effect immediately.
	 *   - "checkbox": a native `<input type="checkbox">` — a selectable item in a
	 *                 set / a form value committed on submit; supports the
	 *                 indeterminate (`aria-checked="mixed"`) tri-state.
	 * Optional + defaulted to "switch" so existing authored Toggles stay valid.
	 */
	readonly variant?: "switch" | "checkbox";
	/**
	 * Tri-state (mixed) for the checkbox mode only — drives `el.indeterminate`
	 * and `aria-checked="mixed"`. Ignored in switch mode.
	 */
	readonly indeterminate?: boolean;
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
 * ACTION family — where the genuine BROWSER CAPABILITY of an affordance lives.
 *
 * These are PRIMITIVES (P), not compounds: a button and a link are not data you
 * compose, they are platform elements whose keyboard/focus/activation/navigation
 * semantics the browser itself supplies. A clickable <div> is FORBIDDEN — a11y
 * demands the real <button>/<a> elements, so the grammar ships them as kinds.
 *
 * The action/link split is kept honest: Button is the <button> ACTION affordance
 * (does something here), Link is the <a href> NAVIGATION affordance (goes
 * somewhere). Neither is polymorphic into the other.
 *
 * Phase 0 has no live event wire, so an action carries its intent DECLARATIVELY
 * (an `action` id), exactly as `Vary` carries a variation id it cannot yet
 * resolve — the later loop binds it; the grammar stays pure-declarative.
 * ------------------------------------------------------------------------- */

/**
 * How an interactive control with no visible text is labelled. A Button MAY use
 * visible child text instead (its `label`); when it has none (an icon-only
 * button) an accessible name is REQUIRED, so this makes "icon-only & unlabelled"
 * unrepresentable. Mirrors `LabelRelation` minus the "visible" arm (the visible
 * arm IS the `label` field).
 */
export type ControlLabel =
	| { readonly mode: "aria-label"; readonly text: string }
	| { readonly mode: "labelledby"; readonly id: string };

/**
 * Fields shared by every Button, regardless of how it is named. The a11y arm is
 * factored out so the public `Button` can REQUIRE a name exactly when there is no
 * visible `label` — making "icon-only and unlabelled" unrepresentable.
 */
interface ButtonBase {
	readonly kind: "button";
	/**
	 * Visual register, mapped onto the action SLOTS by channel SELECTION, never a
	 * className matrix: solid paints surface+on; outline paints border+on over a
	 * transparent surface; ghost paints on only with a hover surface.
	 */
	readonly variant?: "solid" | "outline" | "ghost";
	/** Intent backing the chrome; the amber `primary-action` beacon used sparingly. */
	readonly intent?: IntentRef;
	/** The native button `type`; "button" by default (no implicit form submit). */
	readonly type?: "button" | "submit" | "reset";
	readonly disabled?: boolean;
	/** Busy/pending: sets `aria-busy` and shows a reduced-motion-aware spinner. */
	readonly busy?: boolean;
	/**
	 * Declarative action id (Phase 0 has no live wire) — carried like `Vary.id`.
	 * The later loop binds a handler to it; the grammar emits intent, not logic.
	 */
	readonly action?: string;
	/** Optional shape glyph (Material Symbol) shown alongside / instead of text. */
	readonly icon?: string;
	/**
	 * Optional stable DOM id — the ANCHOR seam for overlays. A `Popover` names
	 * this id as its `anchor`; the Popover primitive then annotates this button
	 * with the `popovertarget` / `aria-controls` / `aria-expanded` relationships
	 * at mount ("we never fabricate the trigger; we only annotate the element the
	 * author anchored"). Still declarative: the tree carries an id, never a wire.
	 */
	readonly id?: string;
}

/**
 * A button is EITHER labelled by visible text (`label`, which is the accessible
 * name) OR — when icon-only — it MUST carry an explicit accessible-name
 * relationship in `a11y`. There is no "no visible text and no a11y name"
 * inhabitant: an inaccessible button is unrepresentable (CONTRACT §7).
 */
export type Button =
	| (ButtonBase & { readonly label: string; readonly a11y?: ControlLabel })
	| (ButtonBase & { readonly label?: undefined; readonly a11y: ControlLabel });

export interface Link {
	readonly kind: "link";
	/** Navigation target. Required — a link without a destination is not a link. */
	readonly href: string;
	/** Visible link text (the accessible name). */
	readonly label: string;
	/** Intent backing the link; defaults to the provenance/citation register. */
	readonly intent?: IntentRef;
	/**
	 * External-link affordance (the load-bearing a11y detail). The SERVER decides
	 * (a server-driven primitive must not read `window`):
	 *   - "auto"  (default): treat as same-origin unless the primitive can tell.
	 *   - "force": render target=_blank + rel + the "(opens in new tab)" cue.
	 *   - "hide":  suppress the external cue even if cross-origin.
	 */
	readonly external?: "auto" | "force" | "hide";
}

/* ---------------------------------------------------------------------------
 * OVERLAY family — the PLATFORM TOP LAYER. Genuine browser capability: native
 * `<dialog>` (modal, focus-trap, ::backdrop, Escape, focus restoration) and the
 * Popover API (top layer, light-dismiss, anchored). These are NOT
 * absolutely-positioned divs in overflow containers — that is the legacy mistake
 * three runtime libraries fought. Overlays MUST use the platform top layer.
 *
 * Open state is carried DECLARATIVELY in Phase 0 (a `bind` store-path + an
 * `open?` default), like every other stateful provider — the wire never carries
 * a live value. Reduced motion is honoured for any enter/leave transition.
 * ------------------------------------------------------------------------- */

export interface Dialog {
	readonly kind: "dialog";
	/**
	 * Accessible title — wired as `aria-labelledby` onto the native `<dialog>`.
	 * Required: a modal dialog without an accessible name is unrepresentable.
	 */
	readonly title: string;
	/** Optional longer description wired via `aria-describedby`. */
	readonly description?: string;
	/** Default open state for the static render; live open rides `bind`. */
	readonly open?: boolean;
	/** Optional binding path for open state (Lemma 5); never a live value. */
	readonly bind?: string;
	/** Whether Escape / backdrop / a close affordance dismiss it (default true). */
	readonly dismissable?: boolean;
	/** The dialog body. */
	readonly children: readonly Node[];
}

export interface Popover {
	readonly kind: "popover";
	/**
	 * Id of the anchor element this popover is positioned against (CSS Anchor
	 * Positioning `position-anchor` / the `popovertarget` invoker). Required: an
	 * anchored, non-modal overlay must know what it is anchored to.
	 */
	readonly anchor: string;
	/** This popover's own id (the `popovertarget` value / `id` attribute). */
	readonly id: string;
	/** Preferred placement; the browser's `position-try` reflows when it won't fit. */
	readonly placement?: "top" | "bottom" | "start" | "end";
	/**
	 * ARIA role appropriate to use: a tooltip needs none of the roving keyboard a
	 * menu/listbox needs. Defaults to "tooltip".
	 */
	readonly role?: "tooltip" | "menu" | "listbox";
	/** Default open state; live open rides `bind`. */
	readonly open?: boolean;
	/** Optional binding path for open state; never a live value. */
	readonly bind?: string;
	/** The popover body. */
	readonly children: readonly Node[];
}

export interface Disclosure {
	readonly kind: "disclosure";
	/**
	 * The always-visible summary (the `<summary>` / the `aria-expanded` button
	 * label). Required: a disclosure with no trigger label is unrepresentable.
	 */
	readonly summary: string;
	/** Whether the region starts expanded (the native `<details open>`). */
	readonly open?: boolean;
	/**
	 * Single-open accordion grouping: `<details>` sharing a `name` are mutually
	 * exclusive natively (no JS). Absent = independent disclosure.
	 */
	readonly group?: string;
	/** The collapsible region content. */
	readonly children: readonly Node[];
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
	readonly id: VaryId;
	readonly options: readonly Node[];
	readonly default?: number;
	/** What a future mid loop optimizes; inert in Phase 0. */
	readonly objective?: "salience" | "density" | "compactness";
}

/**
 * A bounded continuous variation point (Lemma 6). R2.1 introduces the typed
 * socket; R2.3 resolves choices into the existing algebra inputs.
 */
export interface Within {
	readonly kind: "within";
	readonly id: VaryId;
	readonly dimension: "density" | "emphasis" | "collapse";
	readonly range: readonly [number, number];
	readonly default: number;
}

/* ---------------------------------------------------------------------------
 * COMPOUND reference — the open-under-composition vocabulary (Lemma 1).
 * ------------------------------------------------------------------------- */

export interface CompoundRef {
	readonly kind: "compound";
	readonly name: string;
	/** Validated at expansion against the named CompoundDef's params schema. */
	readonly args: Readonly<Record<string, unknown>>;
	/**
	 * The call site's claim on behalf of the expansion root. Hygienic: a template
	 * root must not carry its own claim; the registration gate rejects it.
	 */
	readonly emphasis?: EmphasisClaim;
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
/** Action family — real <button>/<a> affordances (genuine browser capability). */
export type ActionNode = Button | Link;
/** Overlay family — native <dialog> / Popover API / <details> (platform top layer). */
export type OverlayNode = Dialog | Popover | Disclosure;
export type MetaNode = Slot | ParamRef | Vary | Within;

export type Node =
	| LayoutNode
	| ContentNode
	| InputNode
	| FeedbackNode
	| ActionNode
	| OverlayNode
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
