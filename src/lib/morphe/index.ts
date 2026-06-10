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
	VaryId,
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
	Within,
} from "./grammar/types.js";
export { assertNever } from "./grammar/types.js";

// Delegation envelope (Lemma 6 / ADR-0004)
export type { ChoiceMap, Delta, EmissionEnvelope } from "./delegation/envelope.js";
export type { ApplyDeltaOutcome, ApplyDeltaResult } from "./delegation/applyDelta.js";
export { applyDelta, liveVaryIds } from "./delegation/applyDelta.js";

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

// Client store + event tiers (Lemma 5)
export type {
	JsonPrimitive,
	JsonArray,
	JsonObject,
	JsonValue,
	JsonRecord,
	StoreSubscriber,
	StoreOptions,
	MorpheStore,
} from "./state/store.svelte.js";
export {
	InMemoryMorpheStore,
	createInMemoryMorpheStore,
	provideMorpheStore,
	useMorpheStore,
	resolveMorpheStore,
	boundString,
	boundNumber,
	boundBoolean,
	commitTier1,
	TIER1_WINDOW_SIZE,
} from "./state/store.svelte.js";
export type {
	Tier1Kind,
	Tier1Event,
	Tier1EventInput,
	Tier2Event,
	Tier2Escalation,
	SubmitEvent,
	TaskTransitionEvent,
	ViewNotWorkingEvent,
	EscalationEmitter,
	EscalationHandler,
} from "./state/events.js";
export type {
	ActionHandler,
	ActionMap,
	ActionsRef,
	InvokeActionOptions,
} from "./state/actions.js";
export { provideActions, useActions, invokeAction } from "./state/actions.js";
export type { ContextDigest, ContextDigestVersion } from "./state/digest.js";
export {
	CONTEXT_DIGEST_VERSION,
	digestOf,
	escalationWithDigest,
} from "./state/digest.js";
export { provideEscalation, useEscalation } from "./state/escalation.js";
export type { EscalationRef } from "./state/escalation.js";

// Compound factory (Lemma 1)
export type {
	CompoundDef,
	CompoundLifecycle,
	CompoundResolver,
	ParamsSchema,
	ParamSpec,
	ParamType,
	RegisterOptions,
	RegistrationResult,
	RestrictOptions,
} from "./compounds/factory.js";
export {
	CompoundRegistry,
	registry,
	restrictCompounds,
	childrenOf,
} from "./compounds/factory.js";

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
export { resolveArrivalDialect } from "./dialects/arrival.js";

// Render
export { Node as RenderNode } from "./render/index.js";
export { default as MorpheRoot } from "./render/MorpheRoot.svelte";
export { PRIMITIVES, primitiveFor } from "./render/registry.js";
export type { PrimitiveKind } from "./render/registry.js";
export type { PrimitiveProps } from "./render/props.js";
