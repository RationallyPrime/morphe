/**
 * Morphe — public library barrel.
 *
 * The Phase-0 keystone surface. Authored/agent code imports from here.
 */

// Grammar (the declarative discriminated union — single source of truth)
export type {
	Node,
	NodeKind,
	LayoutNode,
	ContentNode,
	InputNode,
	FeedbackNode,
	ActionNode,
	OverlayNode,
	MetaNode,
	CompoundRef,
	ContainerRole,
	Density,
	EmphasisClaim,
	CoreIntent,
	IntentRef,
	InputA11y,
	LabelRelation,
	StatusSignal,
	Stack,
	Grid,
	Cluster,
	Frame,
	Spacer,
	Text,
	NumberNode,
	Badge,
	Icon,
	Media,
	Field,
	Select,
	SelectOption,
	Toggle,
	Range,
	Progress,
	Status,
	InlineAlert,
	Button,
	ControlLabel,
	Link,
	Dialog,
	Popover,
	Disclosure,
	Slot,
	ParamRef,
	Vary,
} from "./grammar/types.js";
export { assertNever } from "./grammar/types.js";

// Context algebra (Lemma 2)
export type { MorpheContext, ScaleTier } from "./context/algebra.js";
export {
	ROOT_CONTEXT,
	THRESHOLDS,
	TOP_TIER_CAP,
	transform,
	enterFrame,
	densityForCount,
	renormalizeBudget,
	tierToTypeStep,
	densityToSpaceStep,
} from "./context/algebra.js";
export {
	useMorpheContext,
	provideMorpheContext,
	descend,
	descendFrame,
	boundaryVars,
	boundaryStyle,
} from "./context/Context.svelte.js";

// Compound factory (Lemma 1)
export type {
	CompoundDef,
	ParamsSchema,
	ParamSpec,
	ParamType,
	RegistrationResult,
} from "./compounds/factory.js";
export { CompoundRegistry, registry, childrenOf } from "./compounds/factory.js";

// Tokens
export { CORE_INTENTS, intentVar, SURFACE_VARS } from "./tokens/intents.js";
export type { IntentChannel } from "./tokens/intents.js";
export { slot, SLOTS, toneIntent } from "./tokens/slots.js";

// Dialects (Lemma 4)
export type { Dialect, IntentDialect, IntentDefinition, AlgebraPriors } from "./dialects/types.js";
export { icelandicArchive, DEFAULT_DIALECT } from "./dialects/icelandic-archive.js";
export { clinical } from "./dialects/clinical.js";
export { reykjavikRegistry } from "./dialects/reykjavik-registry.js";
export { applyDialect, dialectStyle } from "./dialects/provider.svelte.js";
export type { AppliedDialect } from "./dialects/provider.svelte.js";
export {
	getDialect,
	hasDialect,
	DIALECTS,
	DIALECT_IDS,
	DEFAULT_DIALECT_ID,
} from "./dialects/registry.js";
export { activeDialect } from "./dialects/active.svelte.js";

// Render
export { Node as RenderNode } from "./render/index.js";
export { default as MorpheRoot } from "./render/MorpheRoot.svelte";
export { PRIMITIVES, primitiveFor } from "./render/registry.js";
export type { PrimitiveKind } from "./render/registry.js";
export type { PrimitiveProps } from "./render/props.js";
