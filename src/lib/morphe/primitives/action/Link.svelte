<script lang="ts">

	/*
	 * Link — the NAVIGATION affordance (genuine browser capability). A real
	 * `<a href>`: native navigation, middle-click, context menu, Cmd/Ctrl-click for
	 * free. Kept distinct from Button — a link GOES somewhere, a button DOES
	 * something; neither is polymorphic into the other, and a clickable `<div>` is
	 * FORBIDDEN: a11y demands the real element (CONTRACT §3, §7).
	 *
	 * The load-bearing a11y detail is the EXTERNAL-link affordance. When the target
	 * opens in a new tab we must:
	 *   1. set target=_blank + rel="noopener noreferrer" (noopener severs the
	 *      reverse-tabnabbing handle on window.opener; noreferrer also strips the
	 *      Referer — together they are the new-tab safety floor);
	 *   2. render a VISIBLE indicator (the open_in_new glyph) so sighted users are
	 *      warned of the context switch; AND
	 *   3. carry an SR-only "(opens in new tab)" span so the accessible name is
	 *      complete on its own — a link must mean something standalone, not rely on
	 *      surrounding sentence context (WCAG 2.4.4 / 2.4.9).
	 * The SERVER decides externality (a server-driven primitive must not read
	 * `window`), so it rides the grammar node's `external` tri-state. "force" =>
	 * render the cue; "auto"/"hide" => render a plain in-context anchor.
	 *
	 * Functional COLOUR is never the only signal (CONTRACT §7): the underline is the
	 * affordance, and the open_in_new GLYPH (a shape, not a hue) carries the
	 * externality. Both survive a monochrome / colour-blind render.
	 *
	 * Colour resolves through SLOTS.link -> intents -> scales — default the
	 * provenance/citation register, NOT the amber beacon (a link is lineage, not a
	 * call to action). The focus ring is the shared neutral GEOMETRY over the
	 * per-intent ring colour. No raw scale, no hex, no className synthesis: the
	 * discrete intent/externality decisions ride `data-*` attributes (open for
	 * dialect styling extension), the continuous colours ride this component's own
	 * `--mo-link-*` CSS vars (the C9 carrier).
	 */

	import type { Link } from "../../grammar/types.js";
	import type { PrimitiveProps } from "../../render/props.js";
	import { SLOTS } from "../../tokens/slots.js";

	let { node }: PrimitiveProps<Link> = $props();

	const intent = $derived(node.intent ?? "provenance");
	// Externality is SERVER-decided: only "force" renders the new-tab affordance.
	// "auto" (default) and "hide" both render a plain in-context anchor — the
	// server passes "force" when it has resolved a cross-origin / new-tab target,
	// and "hide" lets it suppress the cue even when the target is cross-origin.
	const isExternal = $derived(node.external === "force");

	// Stateful chrome through the CSS-var channel (the C9 carrier); discrete
	// decisions ride data-* attributes selected in the style block.
	const onColor = $derived(SLOTS.link.on(intent));
	const hoverColor = $derived(SLOTS.link.hover(intent));
	const ringColor = $derived(SLOTS.focus.ring(intent));
</script>

<a
	href={node.href}
	class="mo-link"
	data-intent={intent}
	data-external={isExternal ? "" : undefined}
	target={isExternal ? "_blank" : undefined}
	rel={isExternal ? "noopener noreferrer" : undefined}
	style:--mo-link-on={onColor}
	style:--mo-link-hover={hoverColor}
	style:--mo-link-ring={ringColor}
>
	<span class="mo-link__label">{node.label}</span>{#if isExternal}<span
			class="mo-link__cue"
			><span class="mo-link__ext material-symbols-outlined" aria-hidden="true"
				>open_in_new</span
			><span class="mo-link__sr"> (opens in new tab)</span></span
		>{/if}
</a>

<style>
	.mo-link {
		/* inline so the link flows inside running prose; the cue rides along. */
		display: inline;
		color: var(--mo-link-on);
		font-family: var(--mo-font-body);
		font-size: var(--mo-ctx-type, var(--mo-type-4));
		line-height: inherit;
		border-radius: var(--mo-radius-1);
		/* The underline IS the affordance — a shape signal that survives a
		   monochrome render (functional colour is never the only signal). */
		text-decoration-line: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 0.18em;
		text-decoration-color: color-mix(in oklab, var(--mo-link-on) 55%, transparent);
		transition:
			color 0.15s ease,
			text-decoration-color 0.15s ease,
			text-decoration-thickness 0.15s ease;
	}
	.mo-link:hover {
		color: var(--mo-link-hover);
		/* Hover SHIFTS the underline (shape), not only the hue: thicker + solid. */
		text-decoration-thickness: 2px;
		text-decoration-color: currentColor;
	}
	.mo-link:focus-visible {
		outline: var(--mo-ring-width) solid var(--mo-link-ring);
		outline-offset: var(--mo-ring-offset);
		text-decoration-color: currentColor;
	}

	/* The external cue stays welded to the end of the label: the glyph never
	   orphans onto its own line, and the trailing space before it is collapsed
	   so the icon sits snug against the last word. */
	.mo-link__cue {
		white-space: nowrap;
	}
	.mo-link__ext {
		/* Material Symbols glyph — sized relative to the text, baseline-aligned,
		   and NEVER underlined (the underline belongs to the words, not the icon). */
		font-size: 0.85em;
		line-height: 1;
		margin-inline-start: 0.15em;
		vertical-align: -0.08em;
		text-decoration: none;
		font-variation-settings: "wght" 500;
	}

	/* SR-only — the accessible name is complete standalone; sighted users get the
	   glyph, AT users get the words. */
	.mo-link__sr {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		clip-path: inset(50%);
		white-space: nowrap;
		border: 0;
	}

	/* Honour forced-colors (Windows High Contrast): never let the ring/underline
	   vanish into a system surface. */
	@media (forced-colors: active) {
		.mo-link {
			text-decoration-color: LinkText;
		}
		.mo-link:focus-visible {
			outline-color: Highlight;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.mo-link {
			transition: none;
		}
	}
</style>
