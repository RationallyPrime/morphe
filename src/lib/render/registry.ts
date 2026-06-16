/**
 * Morphe RENDER REGISTRY — maps every primitive Node `kind` to its component.
 *
 * This is the single place the renderer learns which .svelte file draws which
 * kind. Primitive agents NEVER edit this file: a new primitive is a grammar
 * change (types.ts) plus an entry here, both owned by the contract holder; an
 * agent only fills in the body of its assigned `primitives/<family>/<Name>.svelte`.
 *
 * META kinds (slot, param-ref, vary, within, compound) are NOT in this map: they
 * are structural and handled directly by Node.svelte (Slots/ParamRefs are
 * resolved during compound expansion; Vary/Within render through delegation
 * semantics; CompoundRef expands via the factory). Mapping them here would be a
 * category error.
 *
 * The map is typed `Record<PrimitiveKind, Component>` so a missing entry is a
 * compile error — render stays total.
 */

import type { Component } from "svelte";
import type { NodeKind } from "../grammar/types.js";
// Action (real <button>/<a> affordances)
import Button from "../primitives/action/Button.svelte";
import Link from "../primitives/action/Link.svelte";
import Badge from "../primitives/content/Badge.svelte";
import Icon from "../primitives/content/Icon.svelte";
import Media from "../primitives/content/Media.svelte";
import NumberView from "../primitives/content/Number.svelte";
// Content
import Text from "../primitives/content/Text.svelte";
import InlineAlert from "../primitives/feedback/InlineAlert.svelte";
// Feedback
import Progress from "../primitives/feedback/Progress.svelte";
import Status from "../primitives/feedback/Status.svelte";
// Input
import Field from "../primitives/input/Field.svelte";
import Range from "../primitives/input/Range.svelte";
import Select from "../primitives/input/Select.svelte";
import Toggle from "../primitives/input/Toggle.svelte";
import Cluster from "../primitives/layout/Cluster.svelte";
import Frame from "../primitives/layout/Frame.svelte";
import Grid from "../primitives/layout/Grid.svelte";
import Spacer from "../primitives/layout/Spacer.svelte";
// Layout
import Stack from "../primitives/layout/Stack.svelte";
// Overlay (native <dialog> / Popover API / <details>)
import Dialog from "../primitives/overlay/Dialog.svelte";
import Disclosure from "../primitives/overlay/Disclosure.svelte";
import Popover from "../primitives/overlay/Popover.svelte";

/** The kinds that map to a shipped primitive component (everything but Meta). */
export type PrimitiveKind = Exclude<
	NodeKind,
	"slot" | "param-ref" | "vary" | "within" | "compound"
>;

/**
 * The registry. Every PrimitiveKind MUST have an entry — the exhaustive Record
 * type makes an omission a compile error. Each component receives `{ node, ctx }`
 * props (see Node.svelte); the component type is intentionally loose on props
 * because each primitive narrows its own `node` by kind internally.
 *
 * The map is built LAZILY (memoised on first access), never at module-eval time.
 * This module sits in a necessary import cycle: `Node.svelte` imports it for
 * `primitiveFor`, every primitive imports `Node.svelte` to recurse, and this
 * module imports every primitive. Reading the component bindings into a literal
 * at eval time races that cycle — under a native-ESM loader (Vite dev) a binding
 * can still be in its temporal dead zone, so the eager literal threw "Cannot
 * access 'Cluster' before initialization" and left `cluster`/`link` silently
 * unrenderable while the earlier-resolved kinds rendered. Deferring the reads to
 * first render (after every module in the cycle has initialised) makes the
 * registry total regardless of load order, with no change to the public shape.
 */
// biome-ignore lint/suspicious/noExplicitAny: heterogeneous registry — each primitive narrows its own `node` by kind; no common prop type exists.
type PrimitiveMap = Record<PrimitiveKind, Component<any>>;

let memoized: PrimitiveMap | null = null;
function primitivesMap(): PrimitiveMap {
	memoized ??= {
		stack: Stack,
		grid: Grid,
		cluster: Cluster,
		frame: Frame,
		spacer: Spacer,
		text: Text,
		number: NumberView,
		badge: Badge,
		icon: Icon,
		media: Media,
		field: Field,
		select: Select,
		toggle: Toggle,
		range: Range,
		progress: Progress,
		status: Status,
		"inline-alert": InlineAlert,
		button: Button,
		link: Link,
		dialog: Dialog,
		popover: Popover,
		disclosure: Disclosure,
	};
	return memoized;
}

/** Look up the component for a primitive kind. */
// biome-ignore lint/suspicious/noExplicitAny: same heterogeneous-registry escape as the map above.
export function primitiveFor(kind: PrimitiveKind): Component<any> {
	return primitivesMap()[kind];
}

/**
 * The primitive map as an object — lazily resolved so reads never trip the
 * import-cycle dead zone (see above). Property access, `in`, and enumeration all
 * forward to the memoised map, so consumers and tests use it exactly like the
 * plain object it replaces.
 */
export const PRIMITIVES: PrimitiveMap = new Proxy({} as PrimitiveMap, {
	get: (_target, key) => primitivesMap()[key as PrimitiveKind],
	has: (_target, key) => key in primitivesMap(),
	ownKeys: () => Reflect.ownKeys(primitivesMap()),
	getOwnPropertyDescriptor: (_target, key) => ({
		enumerable: true,
		configurable: true,
		value: primitivesMap()[key as PrimitiveKind],
	}),
});
