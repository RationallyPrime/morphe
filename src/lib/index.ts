/**
 * Morphe — public library barrel.
 *
 * The Phase-0 keystone surface. Authored/agent code imports from here.
 */

// Compound factory (Lemma 1)
export { PROMOTED_COMPOUNDS } from "./compounds/catalog.generated.js";
export type {
	CompoundDef,
	CompoundLifecycle,
	CompoundResolver,
	ParamSpec,
	ParamsSchema,
	ParamType,
	RegisterOptions,
	RegistrationResult,
	RestrictOptions,
} from "./compounds/factory.js";
export {
	CompoundReferenceError,
	CompoundRegistry,
	childrenOf,
	registry,
	restrictCompounds,
} from "./compounds/factory.js";
// Context algebra (Lemma 2)
export type { MorpheContext, ScaleTier } from "./context/algebra.js";
export {
	densityForCount,
	densityToSpaceStep,
	enterFrame,
	ROOT_CONTEXT,
	renormalizeBudget,
	THRESHOLDS,
	TOP_TIER_CAP,
	tierToTypeStep,
	transform,
} from "./context/algebra.js";
export {
	boundaryStyle,
	boundaryVars,
	descend,
	descendFrame,
	provideMorpheContext,
	useMorpheContext,
} from "./context/Context.svelte.js";
export type { ApplyDeltaOutcome, ApplyDeltaResult } from "./delegation/applyDelta.js";
export { applyDelta, liveVaryIds } from "./delegation/applyDelta.js";
// Delegation envelope (Lemma 6 / ADR-0004)
export type { ChoiceMap, Delta, EmissionEnvelope } from "./delegation/envelope.js";
export type { DevStaticChoiceMidLoopOptions, MidLoopDelegate } from "./delegation/midLoop.js";
export { createDevStaticChoiceMidLoop } from "./delegation/midLoop.js";
export type { ResolvedWithin } from "./delegation/resolveChoice.js";
export { resolveVaryOption, resolveWithin } from "./delegation/resolveChoice.js";
export { activeDialect } from "./dialects/active.svelte.js";
export { persistableDialect, resolveArrivalDialect } from "./dialects/arrival.js";
export { clinical } from "./dialects/clinical.js";
export type {
	DialectId,
	DialectNodeValidationIssue,
	DialectNodeValidationOptions,
	DialectNodeValidationResult,
} from "./dialects/constraints.js";
export { validateNodeForDialect } from "./dialects/constraints.js";
export { gallery } from "./dialects/gallery.js";
export { icelandicArchive } from "./dialects/icelandic-archive.js";
export { night } from "./dialects/night.js";
export type { AppliedDialect } from "./dialects/provider.svelte.js";
export { applyDialect, dialectStyle, unknownIntentsIn } from "./dialects/provider.svelte.js";
export {
	DEFAULT_DIALECT,
	DEFAULT_DIALECT_ID,
	DIALECT_IDS,
	DIALECT_LIST,
	DIALECTS,
	getDialect,
	hasDialect,
} from "./dialects/registry.js";
export { reykjavikRegistry } from "./dialects/reykjavik-registry.js";
// Dialects (Lemma 4)
export type { AlgebraPriors, Dialect, IntentDefinition, IntentDialect } from "./dialects/types.js";
// Grammar (the declarative discriminated union — single source of truth)
export type {
	ActionNode,
	Badge,
	Button,
	Cluster,
	CompoundRef,
	ContainerRole,
	ContentNode,
	ControlLabel,
	CoreIntent,
	Density,
	Dialog,
	Disclosure,
	EmphasisClaim,
	FeedbackNode,
	Field,
	Frame,
	Grid,
	GridColumn,
	Icon,
	InlineAlert,
	InputA11y,
	InputNode,
	IntentRef,
	LabelRelation,
	LayoutNode,
	Link,
	Media,
	MediaSource,
	MetaNode,
	Node,
	NodeKind,
	NumberNode,
	OverlayNode,
	ParamRef,
	Popover,
	Progress,
	Range,
	RegisterIntent,
	Select,
	SelectOption,
	Slot,
	Spacer,
	Stack,
	Status,
	StatusSignal,
	Text,
	Toggle,
	Vary,
	VaryId,
	Within,
} from "./grammar/types.js";
export { assertNever } from "./grammar/types.js";
export { GRAMMAR_VERSION } from "./grammar/version.js";
// Render contracts
export type { PrimitiveProps } from "./render/props.js";
export type { PrimitiveKind } from "./render/registry.js";
export { PRIMITIVES, primitiveFor } from "./render/registry.js";
export type {
	ActionHandler,
	ActionMap,
	ActionsRef,
	InvokeActionOptions,
} from "./state/actions.js";
export { invokeAction, provideActions, useActions } from "./state/actions.js";
export type { ContextDigest, ContextDigestVersion } from "./state/digest.js";
export {
	CONTEXT_DIGEST_VERSION,
	digestOf,
	escalationWithDigest,
} from "./state/digest.js";
export type { EscalationRef } from "./state/escalation.js";
export { provideEscalation, useEscalation } from "./state/escalation.js";
export type {
	EscalationEmitter,
	EscalationHandler,
	SubmitEvent,
	TaskTransitionEvent,
	Tier1Event,
	Tier1EventInput,
	Tier1Kind,
	Tier2Escalation,
	Tier2Event,
	ViewNotWorkingEvent,
} from "./state/events.js";
// Client store + event tiers (Lemma 5)
export type {
	JsonArray,
	JsonObject,
	JsonPrimitive,
	JsonRecord,
	JsonValue,
	MorpheStore,
	StoreOptions,
	StoreSubscriber,
} from "./state/store.svelte.js";
export {
	boundBoolean,
	boundNumber,
	boundString,
	commitTier1,
	createInMemoryMorpheStore,
	InMemoryMorpheStore,
	provideMorpheStore,
	resolveMorpheStore,
	TIER1_WINDOW_SIZE,
	useMorpheStore,
} from "./state/store.svelte.js";
export type { IntentChannel } from "./tokens/intents.js";
// Tokens
export {
	CORE_INTENTS,
	INTENT_REFS,
	intentVar,
	REGISTER_INTENTS,
	SURFACE_VARS,
} from "./tokens/intents.js";
export { SLOTS, slot, toneIntent } from "./tokens/slots.js";
