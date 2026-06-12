<script lang="ts">
	/*
	 * Popover — an ANCHORED, NON-MODAL overlay on the PLATFORM TOP LAYER.
	 *
	 * The genuine browser capability lives in two native platform features, so this
	 * primitive is a thin wrapper around them — never a re-implementation:
	 *
	 *   1. The native Popover API (`popover="auto"`) gives the PLATFORM TOP LAYER
	 *      (no z-index wars, no portal, NO OVERFLOW CLIPPING — it escapes every
	 *      `overflow:hidden`/`clip` ancestor) plus LIGHT-DISMISS — outside-click AND
	 *      Escape close it FOR FREE. We do NOT hand-roll a `mousedown` outside-click
	 *      listener or a `keydown` Escape listener; that was the legacy mistake.
	 *   2. CSS Anchor Positioning (`position-anchor` / `position-area` /
	 *      `position-try`) anchors the panel to its trigger and flips/shifts it when
	 *      it won't fit — declaratively, ZERO JS in the position loop (the τ_fast
	 *      "browser-visible flexes need no JS" principle). The anchor relationship
	 *      flows from the grammar's `anchor` id via the `--mo-anchor` carrier.
	 *
	 * a11y (CONTRACT §7):
	 *   - `id` is REQUIRED (the popovertarget / aria-controls value); `anchor` is
	 *     REQUIRED (an anchored overlay must know its trigger).
	 *   - The TRIGGER carries `aria-expanded` reflecting open state and
	 *     `aria-controls` pointing at this panel — wired in the ontoggle handler
	 *     because the trigger lives elsewhere in the server-driven tree. (We never
	 *     fabricate the trigger; we only annotate the element the author anchored.)
	 *   - `role` picks the keyboard contract: a `tooltip` needs no roving; a `menu`
	 *     / `listbox` gets roving tabindex (one tab stop, arrows move, Home/End),
	 *     applied by a tiny Svelte action — the SHARED roving pattern, not a per-
	 *     primitive bespoke listener. The panel is labelled by its trigger.
	 *
	 * Open state is tier-0 $state, reflected onto the native popover via an $effect;
	 * the wire carries only a `bind` store-path + an `open?` default (never a live
	 * value). Surface/on/border resolve through SLOTS.overlay → intents → scales
	 * (no raw px/hex). Reduced motion is honoured by a media query in the style block.
	 */

	import type { Action } from "svelte/action";
	import type { Popover } from "../../grammar/types.js";
	import Node from "../../render/Node.svelte";
	import type { PrimitiveProps } from "../../render/props.js";
	import { boundBoolean, commitTier1, useMorpheStore } from "../../state/store.svelte.js";
	import { SLOTS } from "../../tokens/slots.js";

	let { node, ctx }: PrimitiveProps<Popover> = $props();
	const store = useMorpheStore();

	const role = $derived(node.role ?? "tooltip");
	const placement = $derived(node.placement ?? "bottom");
	/** Menu/listbox get arrow-key roving; a tooltip is non-interactive chrome. */
	const isMenu = $derived(role === "menu" || role === "listbox");

	const surface = $derived(SLOTS.overlay.surface());
	const onColor = $derived(SLOTS.overlay.on());
	const borderColor = $derived(SLOTS.overlay.border());

	/**
	 * CSS Anchor Positioning binds the panel to a named anchor. The author's
	 * `anchor` id becomes a dashed-ident anchor name; the trigger element must
	 * declare `anchor-name: --<anchor>` (the action below ensures it), and the
	 * panel reads it via `position-anchor`. This carries the continuous
	 * positioning relationship as a CSS custom property (the C9 carrier) — no JS
	 * position loop.
	 */
	const anchorName = $derived(`--mo-anchor-${node.anchor}`);

	// tier-0 local open state; seeded from tier-1 when bound, otherwise node.open.
	// svelte-ignore state_referenced_locally
	let open = $state(boundBoolean(store, node.bind, node.open ?? false));
	let el = $state<HTMLDivElement | null>(null);

	/** Reflect open state onto the native popover top layer. */
	$effect(() => {
		const pop = el;
		if (!pop || typeof pop.togglePopover !== "function") return;
		// showPopover/hidePopover throw if already in that state; guard via matches().
		const shown = pop.matches(":popover-open");
		if (open && !shown) pop.showPopover();
		else if (!open && shown) pop.hidePopover();
	});

	/**
	 * Wire the TRIGGER relationship (a11y + anchor) onto the author-anchored
	 * element, which lives elsewhere in the server-driven tree. This is an init/
	 * sync side-effect, not className synthesis: it sets `aria-controls`,
	 * `aria-expanded`, the popovertarget invoker, and the `anchor-name` the panel
	 * positions against — all relationships the platform needs but that can only be
	 * resolved once the trigger is in the DOM. Re-runs when open flips so
	 * `aria-expanded` stays truthful.
	 */
	$effect(() => {
		if (typeof document === "undefined") return;
		const trigger = document.getElementById(node.anchor);
		if (!trigger) return;
		trigger.setAttribute("aria-controls", node.id);
		trigger.setAttribute("aria-expanded", open ? "true" : "false");
		// The popover-invoker relationship the API uses for activation + dismissal.
		trigger.setAttribute("popovertarget", node.id);
		// The anchor end of CSS Anchor Positioning — the panel reads this name.
		trigger.style.setProperty("anchor-name", anchorName);
		if (role === "tooltip") trigger.setAttribute("aria-describedby", node.id);
	});

	/** Native popover toggle event is the single source of truth for open state. */
	function onToggle(e: ToggleEvent): void {
		const next = e.newState === "open";
		setOpen(next);
		if (next && isMenu) focusFirstItem();
	}

	function setOpen(next: boolean): void {
		if (open === next) return;
		open = next;
		commitTier1(store, node.bind, next ? "expand" : "collapse", next);
	}

	/* --------------------------------------------------------------------------
	 * Roving tabindex — the SHARED keyboard contract for menu/listbox panels.
	 * One tab stop for the whole panel; arrows move the active item, Home/End jump
	 * to the ends, Escape closes (in addition to the API's native light-dismiss).
	 * A tooltip carries no roving (it is non-interactive chrome). This is the same
	 * pattern RadioGroup and Tabs use — implemented once, as a tiny Svelte action.
	 * ------------------------------------------------------------------------ */

	function rovingItems(panel: HTMLElement): HTMLElement[] {
		return Array.from(
			panel.querySelectorAll<HTMLElement>(
				'[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"], [role="option"], button:not([disabled]), a[href]',
			),
		);
	}

	function focusFirstItem(): void {
		const panel = el;
		if (!panel) return;
		const items = rovingItems(panel);
		const first = items[0];
		for (const it of items) it.tabIndex = it === first ? 0 : -1;
		first?.focus();
	}

	function moveActive(items: HTMLElement[], from: number, delta: number): void {
		if (items.length === 0) return;
		const next = (from + delta + items.length) % items.length;
		const target = items[next];
		if (!target) return;
		for (const it of items) it.tabIndex = it === target ? 0 : -1;
		target.focus();
	}

	/**
	 * Svelte action: install the roving keyboard contract on the panel. Gated on
	 * `enabled` (true only for menu/listbox) — a tooltip is non-interactive chrome
	 * and installs no listener. The param is reactive: were `role` ever to change,
	 * the action's `update` would re-gate without re-mounting the panel.
	 */
	const roving: Action<HTMLElement, boolean> = (panel, enabled) => {
		function onKeydown(e: KeyboardEvent): void {
			const items = rovingItems(panel);
			const current = document.activeElement as HTMLElement | null;
			const idx = current ? items.indexOf(current) : -1;
			switch (e.key) {
				case "ArrowDown":
				case "ArrowRight":
					e.preventDefault();
					moveActive(items, idx, 1);
					break;
				case "ArrowUp":
				case "ArrowLeft":
					e.preventDefault();
					moveActive(items, idx, -1);
					break;
				case "Home":
					e.preventDefault();
					moveActive(items, -1, 1);
					break;
				case "End":
					e.preventDefault();
					moveActive(items, 0, -1);
					break;
				case "Escape":
					// The API light-dismisses on Escape too; closing explicitly keeps
					// our $state truthful even if focus is on a nested control.
					setOpen(false);
					break;
			}
		}
		let attached = false;
		function sync(on: boolean): void {
			if (on && !attached) {
				panel.addEventListener("keydown", onKeydown);
				attached = true;
			} else if (!on && attached) {
				panel.removeEventListener("keydown", onKeydown);
				attached = false;
			}
		}
		sync(enabled ?? false);
		return {
			update(next: boolean): void {
				sync(next);
			},
			destroy(): void {
				sync(false);
			},
		};
	};
</script>

<!-- biome-ignore lint/a11y/useValidAriaRole: `role` is grammar-typed to "tooltip" | "menu" | "listbox" — all valid ARIA roles; the linter cannot evaluate the derived. -->
<div
	bind:this={el}
	id={node.id}
	class="mo-popover"
	popover="auto"
	role={role}
	aria-labelledby={isMenu ? node.anchor : undefined}
	data-placement={placement}
	data-anchor={node.anchor}
	data-bind={node.bind}
	ontoggle={onToggle}
	use:roving={isMenu}
	style:--mo-overlay-surface={surface}
	style:--mo-overlay-on={onColor}
	style:--mo-overlay-border={borderColor}
	style:--mo-anchor={anchorName}
>
	{#each node.children as child, i (i)}
		<Node node={child} {ctx} />
	{/each}
</div>

<style>
	.mo-popover {
		/* Reset the UA popover box so we own the chrome. */
		margin: 0;
		inset: auto;
		padding: var(--mo-space-4);
		border: var(--mo-ctx-stroke, var(--mo-border-width)) solid var(--mo-overlay-border);
		border-radius: var(--mo-radius-2);
		background: var(--mo-overlay-surface);
		color: var(--mo-overlay-on);
		font-family: var(--mo-font-body);
		font-size: var(--mo-ctx-type, var(--mo-type-3));
		/* FIXED inline size, not a max: a max lets the panel shrink to min-content
		   when its primary position-area has little room (e.g. a trigger near the
		   viewport's inline-end), and a shrunken panel never OVERFLOWS — so the
		   position-try fallbacks never fire and the panel renders as a crushed
		   column instead of flipping to the side with room. A fixed size makes a
		   cramped placement genuinely overflow, which is what position-try needs. */
		inline-size: min(92vw, 22rem);
		/* A fixed-width top-layer panel must wrap ANY content handed to it — an
		   unbroken token (an endpoint path, a long identifier) would otherwise
		   overflow the panel edge invisibly. */
		overflow-wrap: anywhere;

		/*
		 * CSS Anchor Positioning — the panel anchors to the trigger's anchor-name
		 * (set by the effect above via the `--mo-anchor` carrier). `position-area`
		 * places it on the requested side; `position-try` flips it to the opposite
		 * side (and a corner spill) when it won't fit. ZERO JS in the position loop.
		 */
		position-anchor: var(--mo-anchor);
		margin-block: var(--mo-space-2);
		margin-inline: var(--mo-space-2);
	}

	/* Placement → position-area; the browser reflows via position-try fallbacks. */
	.mo-popover[data-placement="bottom"] {
		position-area: block-end span-inline-end;
		position-try-fallbacks: block-start span-inline-end, block-end span-inline-start;
	}
	.mo-popover[data-placement="top"] {
		position-area: block-start span-inline-end;
		position-try-fallbacks: block-end span-inline-end, block-start span-inline-start;
	}
	.mo-popover[data-placement="start"] {
		position-area: inline-start span-block-end;
		position-try-fallbacks: inline-end span-block-end, inline-start span-block-start;
	}
	.mo-popover[data-placement="end"] {
		position-area: inline-end span-block-end;
		position-try-fallbacks: inline-start span-block-end, inline-end span-block-start;
	}

	/* Enter/leave: a quiet fade + slight rise. Allowed-discrete + @starting-style
	   so the native top-layer toggle animates without JS. */
	.mo-popover {
		opacity: 1;
		translate: 0 0;
		transition:
			opacity 120ms ease,
			translate 120ms ease,
			overlay 120ms allow-discrete,
			display 120ms allow-discrete;
	}
	.mo-popover:not(:popover-open) {
		opacity: 0;
		translate: 0 var(--mo-space-2);
	}
	@starting-style {
		.mo-popover:popover-open {
			opacity: 0;
			translate: 0 var(--mo-space-2);
		}
	}

	/* Roving items: one tab stop owns focus; the rest are reachable by arrows. */
	.mo-popover :global([role="menuitem"]:focus-visible),
	.mo-popover :global([role="menuitemradio"]:focus-visible),
	.mo-popover :global([role="menuitemcheckbox"]:focus-visible),
	.mo-popover :global([role="option"]:focus-visible) {
		outline: var(--mo-ring-width) solid var(--mo-intent-primary-action-ring);
		outline-offset: var(--mo-ring-offset);
	}

	@media (prefers-reduced-motion: reduce) {
		.mo-popover {
			transition: none;
			translate: none;
		}
		.mo-popover:not(:popover-open) {
			translate: none;
		}
		@starting-style {
			.mo-popover:popover-open {
				translate: none;
			}
		}
	}
</style>
