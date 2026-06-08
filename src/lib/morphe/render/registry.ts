/**
 * Morphe RENDER REGISTRY — maps every primitive Node `kind` to its component.
 *
 * This is the single place the renderer learns which .svelte file draws which
 * kind. Primitive agents NEVER edit this file: a new primitive is a grammar
 * change (types.ts) plus an entry here, both owned by the contract holder; an
 * agent only fills in the body of its assigned `primitives/<family>/<Name>.svelte`.
 *
 * META kinds (slot, param-ref, vary, compound) are NOT in this map: they are
 * structural and handled directly by Node.svelte (Slots/ParamRefs are resolved
 * during compound expansion; Vary renders its default; CompoundRef expands via
 * the factory). Mapping them here would be a category error.
 *
 * The map is typed `Record<PrimitiveKind, Component>` so a missing entry is a
 * compile error — render stays total.
 */

import type { Component } from "svelte";
import type { NodeKind } from "../grammar/types.js";

// Layout
import Stack from "../primitives/layout/Stack.svelte";
import Grid from "../primitives/layout/Grid.svelte";
import Cluster from "../primitives/layout/Cluster.svelte";
import Frame from "../primitives/layout/Frame.svelte";
import Spacer from "../primitives/layout/Spacer.svelte";
// Content
import Text from "../primitives/content/Text.svelte";
import NumberView from "../primitives/content/Number.svelte";
import Badge from "../primitives/content/Badge.svelte";
import Icon from "../primitives/content/Icon.svelte";
import Media from "../primitives/content/Media.svelte";
// Input
import Field from "../primitives/input/Field.svelte";
import Select from "../primitives/input/Select.svelte";
import Toggle from "../primitives/input/Toggle.svelte";
import Range from "../primitives/input/Range.svelte";
// Feedback
import Progress from "../primitives/feedback/Progress.svelte";
import Status from "../primitives/feedback/Status.svelte";
import InlineAlert from "../primitives/feedback/InlineAlert.svelte";
// Action (real <button>/<a> affordances)
import Button from "../primitives/action/Button.svelte";
import Link from "../primitives/action/Link.svelte";
// Overlay (native <dialog> / Popover API / <details>)
import Dialog from "../primitives/overlay/Dialog.svelte";
import Popover from "../primitives/overlay/Popover.svelte";
import Disclosure from "../primitives/overlay/Disclosure.svelte";

/** The kinds that map to a shipped primitive component (everything but Meta). */
export type PrimitiveKind = Exclude<NodeKind, "slot" | "param-ref" | "vary" | "compound">;

/**
 * The registry. Every PrimitiveKind MUST have an entry — the exhaustive Record
 * type makes an omission a compile error. Each component receives `{ node, ctx }`
 * props (see Node.svelte); the `Component` type here is intentionally loose on
 * props because each primitive narrows its own `node` by kind internally.
 */
export const PRIMITIVES: Record<PrimitiveKind, Component<any>> = {
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

/** Look up the component for a primitive kind. */
export function primitiveFor(kind: PrimitiveKind): Component<any> {
	return PRIMITIVES[kind];
}
