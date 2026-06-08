/**
 * PRIMITIVE RENDER tests — render totality for the Action + Overlay families and
 * the input MODE extensions, plus the a11y relationships the grammar promises.
 *
 * These complement the pure-logic suites (core / lemmas.property / dialects) by
 * exercising the FULL render path — grammar -> dialect -> context -> registry ->
 * primitive -> HTML — through SSR. They run in the same `node` environment as the
 * rest of the suite: Svelte's server `render()` returns the SSR HTML string with
 * no DOM, no jsdom, no new dependency. This is the exact path the dignity demo
 * proves at runtime, asserted as strings here.
 *
 * SSR caveat honoured below: open-state `$effect`s (Dialog/Popover showModal /
 * showPopover) run only on the client, so SSR emits the CLOSED markup. We assert
 * on what SSR actually produces (the labelled, in-DOM element) — not on a
 * post-effect open state. Disclosure uses native `<details open>` (no effect), so
 * its expanded/collapsed SHAPE state IS present in SSR and is asserted directly.
 *
 * New kinds covered for totality: button, link, dialog, popover, disclosure.
 * Mode extensions covered: Field.multiline, Toggle.variant:"checkbox" (incl.
 * indeterminate), Select.variant:"radiogroup" — and each default mode still
 * renders (the grammar fixed-point: pre-mode trees stay valid).
 */

import { describe, expect, it } from "vitest";
import { render } from "svelte/server";
import MorpheRoot from "./render/MorpheRoot.svelte";
import { PRIMITIVES } from "./render/registry.js";
import { icelandicArchive } from "./dialects/icelandic-archive.js";
import { clinical } from "./dialects/clinical.js";
import type { Dialect } from "./dialects/types.js";
import type { Node } from "./grammar/types.js";

/** Render an authored tree through the full core to its SSR HTML body string. */
function ssr(tree: Node, dialect?: Dialect): string {
	return render(MorpheRoot, { props: dialect ? { tree, dialect } : { tree } }).body;
}

/* ===========================================================================
 * 1. RENDER TOTALITY — every new kind resolves through the registry and the
 *    renderer (Definition 1). A missing/typo'd registry entry would surface as
 *    an empty/garbled body, not a real element, so each assertion is a true
 *    end-to-end check that the kind flowed grammar -> registry -> component.
 * ========================================================================= */

describe("render totality — Action + Overlay kinds resolve through the registry", () => {
	it("the registry maps every new kind to a real component", () => {
		// The registry is the single place the renderer learns kind -> component.
		for (const kind of ["button", "link", "dialog", "popover", "disclosure"] as const) {
			expect(PRIMITIVES[kind]).toBeTypeOf("function");
		}
	});

	it("renders a Button (real <button>) through MorpheRoot", () => {
		const html = ssr({ kind: "button", label: "Save", variant: "solid", intent: "primary-action" });
		expect(html).toContain("<button");
		expect(html).toContain("Save");
		// Variant is channel SELECTION carried on a data attribute, not a class matrix.
		expect(html).toContain('data-variant="solid"');
		// type defaults to "button" (no implicit form submit).
		expect(html).toContain('type="button"');
	});

	it("renders a Link (real <a href>) through MorpheRoot", () => {
		const html = ssr({ kind: "link", href: "/archive", label: "Catalogue" });
		expect(html).toContain("<a");
		expect(html).toContain('href="/archive"');
		expect(html).toContain("Catalogue");
	});

	it("renders a Dialog (native <dialog>) through MorpheRoot", () => {
		const html = ssr({
			kind: "dialog",
			title: "Confirm accession",
			children: [{ kind: "text", value: "Body copy", as: "body" }],
		});
		expect(html).toContain("<dialog");
		expect(html).toContain("Confirm accession");
		// Children recurse through <Node> (overlays own their own descent, no portal).
		expect(html).toContain("Body copy");
	});

	it("renders a Popover (native popover) through MorpheRoot", () => {
		const html = ssr({
			kind: "popover",
			anchor: "trigger-1",
			id: "pop-1",
			role: "menu",
			children: [{ kind: "text", value: "Menu item", as: "body" }],
		});
		expect(html).toContain('popover="auto"');
		expect(html).toContain('id="pop-1"');
		expect(html).toContain("Menu item");
	});

	it("renders a Disclosure (native <details>/<summary>) through MorpheRoot", () => {
		const html = ssr({
			kind: "disclosure",
			summary: "Provenance",
			children: [{ kind: "text", value: "Chain of custody", as: "body" }],
		});
		expect(html).toContain("<details");
		expect(html).toContain("<summary");
		expect(html).toContain("Provenance");
		expect(html).toContain("Chain of custody");
	});

	it("renders the new kinds nested inside a layout tree (recursion stays total)", () => {
		const tree: Node = {
			kind: "stack",
			role: "section",
			children: [
				{ kind: "cluster", role: "toolbar", children: [
					{ kind: "button", label: "Primary", variant: "solid" },
					{ kind: "button", label: "Secondary", variant: "outline" },
					{ kind: "link", href: "https://example.org", label: "Source", external: "force" },
				] },
				{ kind: "disclosure", summary: "Notes", children: [
					{ kind: "text", value: "Marginalia", as: "caption" },
				] },
			],
		};
		const html = ssr(tree);
		expect(html).toContain("Primary");
		expect(html).toContain("Secondary");
		expect(html).toContain("Source");
		expect(html).toContain("Marginalia");
	});
});

/* ===========================================================================
 * 2. A11y relationships the grammar promises (cheap, SSR-visible assertions).
 * ========================================================================= */

describe("a11y — Action family accessible names (CONTRACT §7)", () => {
	it("an icon-only Button carries its a11y name (aria-label), not visible text", () => {
		const html = ssr({
			kind: "button",
			icon: "close",
			a11y: { mode: "aria-label", text: "Close" },
		});
		expect(html).toContain('aria-label="Close"');
		// Icon-only buttons mark themselves so the glyph stays decorative.
		expect(html).toContain("data-icon-only");
	});

	it("a busy Button is shape-bearing and announced (aria-busy + spinner glyph)", () => {
		const html = ssr({ kind: "button", label: "Saving", busy: true });
		expect(html).toContain('aria-busy="true"');
		// Busy is also disabled (native :disabled) and shows the progress glyph.
		expect(html).toContain("progress_activity");
		expect(html).toContain("disabled");
	});

	it("a forced-external Link carries the full new-tab affordance", () => {
		const html = ssr({ kind: "link", href: "https://elsewhere.test", label: "External", external: "force" });
		expect(html).toContain('target="_blank"');
		expect(html).toContain('rel="noopener noreferrer"');
		// Visible shape cue + SR-only completeness (WCAG 2.4.4).
		expect(html).toContain("open_in_new");
		expect(html).toContain("(opens in new tab)");
	});

	it("a non-external Link renders a plain in-context anchor (server-decided)", () => {
		const html = ssr({ kind: "link", href: "/local", label: "Local" });
		expect(html).not.toContain('target="_blank"');
		expect(html).not.toContain("open_in_new");
	});
});

describe("a11y — Overlay labelling (CONTRACT §7)", () => {
	it("a Dialog is labelled by its required title (aria-labelledby -> the heading id)", () => {
		const html = ssr({
			kind: "dialog",
			title: "Sign-off required",
			children: [{ kind: "text", value: "x", as: "body" }],
		});
		// The title is rendered into an <h2 id=...> and the dialog references it.
		const labelMatch = html.match(/aria-labelledby="([^"]+)"/);
		expect(labelMatch).not.toBeNull();
		const id = labelMatch?.[1] as string;
		// The referenced id actually exists on the heading element in the same render.
		expect(html).toContain(`id="${id}"`);
		expect(html).toContain("Sign-off required");
	});

	it("a Dialog with a description wires aria-describedby to the description element", () => {
		const html = ssr({
			kind: "dialog",
			title: "Heads up",
			description: "This cannot be undone.",
			children: [{ kind: "text", value: "x", as: "body" }],
		});
		const descMatch = html.match(/aria-describedby="([^"]+)"/);
		expect(descMatch).not.toBeNull();
		const id = descMatch?.[1] as string;
		expect(html).toContain(`id="${id}"`);
		expect(html).toContain("This cannot be undone.");
	});

	it("a dismissable Dialog exposes a labelled close affordance", () => {
		const html = ssr({
			kind: "dialog",
			title: "Closable",
			children: [{ kind: "text", value: "x", as: "body" }],
		});
		expect(html).toContain('aria-label="Close dialog"');
	});

	it("a non-dismissable Dialog has NO close affordance (a required modal can't be skipped)", () => {
		const html = ssr({
			kind: "dialog",
			title: "Required",
			dismissable: false,
			children: [{ kind: "text", value: "x", as: "body" }],
		});
		expect(html).not.toContain('aria-label="Close dialog"');
	});

	it("a closed Disclosure exposes collapsed state and the chevron SHAPE cue", () => {
		const html = ssr({ kind: "disclosure", summary: "More", children: [{ kind: "text", value: "y", as: "body" }] });
		// Native <details>: the absence of the `open` attribute IS the collapsed
		// (aria-expanded=false equivalent) state the platform exposes to AT.
		expect(html).toContain("<details");
		expect(html).not.toMatch(/<details[^>]*\sopen/);
		// State is a SHAPE (chevron), never color alone (CONTRACT §7).
		expect(html).toContain("chevron_right");
	});

	it("an open Disclosure exposes expanded state via native <details open>", () => {
		const html = ssr({ kind: "disclosure", summary: "More", open: true, children: [{ kind: "text", value: "y", as: "body" }] });
		expect(html).toMatch(/<details[^>]*\sopen/);
	});

	it("a grouped Disclosure carries the native exclusive-accordion name", () => {
		const html = ssr({
			kind: "stack",
			role: "list",
			children: [
				{ kind: "disclosure", summary: "A", group: "faq", children: [{ kind: "text", value: "a", as: "body" }] },
				{ kind: "disclosure", summary: "B", group: "faq", children: [{ kind: "text", value: "b", as: "body" }] },
			],
		});
		// `name=` makes the <details> mutually exclusive natively (no JS).
		expect(html).toContain('name="faq"');
	});

	it("a menu/listbox Popover is labelled by its anchor; a tooltip describes it", () => {
		const menu = ssr({ kind: "popover", anchor: "btn", id: "m1", role: "menu", children: [{ kind: "text", value: "i", as: "body" }] });
		expect(menu).toContain('role="menu"');
		expect(menu).toContain('aria-labelledby="btn"');

		const tip = ssr({ kind: "popover", anchor: "btn", id: "t1", role: "tooltip", children: [{ kind: "text", value: "i", as: "body" }] });
		expect(tip).toContain('role="tooltip"');
		// A tooltip is non-interactive chrome: it is NOT labelledby its anchor.
		expect(tip).not.toContain('aria-labelledby="btn"');
	});
});

/* ===========================================================================
 * 3. INPUT MODE EXTENSIONS — both modes of each input render, the default
 *    (pre-mode) mode still works (the grammar fixed-point), and the a11y
 *    label/description relationship is preserved across the mode switch.
 * ========================================================================= */

const baseA11y = (id: string) => ({ id, label: { mode: "visible" as const, text: "Label" } });

describe("Field — multiline mode extension (CONTRACT §3)", () => {
	it("default Field renders a single-line <input> (pre-mode trees stay valid)", () => {
		const html = ssr({ kind: "field", a11y: baseA11y("f1"), inputType: "email" });
		expect(html).toContain("<input");
		expect(html).not.toContain("<textarea");
		expect(html).toContain('type="email"');
		// Label relationship wired: <label for> -> <input id>.
		expect(html).toContain('for="f1"');
		expect(html).toContain('id="f1"');
	});

	it("multiline Field swaps the substrate to a native <textarea>, same a11y wiring", () => {
		const html = ssr({
			kind: "field",
			a11y: baseA11y("f2"),
			multiline: true,
			rows: 5,
			hint: "Up to 500 words",
			error: "Required",
		});
		expect(html).toContain("<textarea");
		expect(html).not.toMatch(/<input[^>]*id="f2"/);
		expect(html).toContain('rows="5"');
		// Same InputA11y wiring as single-line: id, aria-invalid, aria-describedby.
		expect(html).toContain('id="f2"');
		expect(html).toContain('aria-invalid="true"');
		const describedBy = html.match(/aria-describedby="([^"]+)"/)?.[1] as string;
		expect(describedBy).toBeTruthy();
		// The error id is part of the description set and the error element exists.
		expect(describedBy).toContain("f2-error");
		expect(html).toContain('id="f2-error"');
	});

	it("a required Field wires aria-required and the (required) SR signal", () => {
		const html = ssr({ kind: "field", a11y: { id: "f3", label: { mode: "visible", text: "Name" }, required: true } });
		expect(html).toContain('aria-required="true"');
		expect(html).toContain("(required)");
	});
});

describe("Toggle — checkbox mode extension (CONTRACT §3)", () => {
	it("default Toggle renders a real switch (button role=switch aria-checked)", () => {
		const html = ssr({ kind: "toggle", a11y: baseA11y("t1") });
		expect(html).toContain('role="switch"');
		expect(html).toContain("aria-checked");
		expect(html).not.toMatch(/type="checkbox"/);
	});

	it("checkbox mode renders a native <input type=checkbox>", () => {
		const html = ssr({ kind: "toggle", a11y: baseA11y("t2"), variant: "checkbox" });
		expect(html).toContain('type="checkbox"');
		expect(html).toContain('id="t2"');
		expect(html).not.toContain('role="switch"');
	});

	it("an indeterminate checkbox surfaces aria-checked=mixed and the dash SHAPE", () => {
		const html = ssr({ kind: "toggle", a11y: baseA11y("t3"), variant: "checkbox", indeterminate: true });
		expect(html).toContain('aria-checked="mixed"');
		// The mixed state has a distinct mark SHAPE (the dash), not color alone.
		expect(html).toContain('data-state="mixed"');
	});

	it("indeterminate is ignored in switch mode (it is checkbox-only)", () => {
		const html = ssr({ kind: "toggle", a11y: baseA11y("t4"), indeterminate: true });
		expect(html).toContain('role="switch"');
		expect(html).not.toContain('aria-checked="mixed"');
	});
});

describe("Select — radiogroup mode extension (CONTRACT §3)", () => {
	const opts = [
		{ value: "is", label: "Icelandic" },
		{ value: "en", label: "English" },
	];

	it("default Select renders a native <select> dropdown (pre-mode trees stay valid)", () => {
		const html = ssr({ kind: "select", a11y: baseA11y("s1"), options: opts });
		expect(html).toContain("<select");
		expect(html).toContain('id="s1"');
		expect(html).toContain("<option");
		expect(html).toContain("Icelandic");
		expect(html).not.toContain('role="radiogroup"');
	});

	it("radiogroup mode renders a fieldset/radiogroup with role=radio options", () => {
		const html = ssr({ kind: "select", a11y: baseA11y("s2"), options: opts, variant: "radiogroup" });
		expect(html).toContain("<fieldset");
		expect(html).toContain('role="radiogroup"');
		expect(html).toContain('role="radio"');
		expect(html).toContain("Icelandic");
		expect(html).toContain("English");
	});

	it("the radiogroup has exactly ONE tab stop (roving tabindex, ARIA APG)", () => {
		const html = ssr({ kind: "select", a11y: baseA11y("s3"), options: opts, variant: "radiogroup" });
		const tabZero = (html.match(/tabindex="0"/g) ?? []).length;
		const tabNeg = (html.match(/tabindex="-1"/g) ?? []).length;
		expect(tabZero).toBe(1);
		expect(tabNeg).toBe(opts.length - 1);
	});

	it("a required+invalid radiogroup wires aria-required and aria-invalid on the group", () => {
		const html = ssr({
			kind: "select",
			a11y: { id: "s4", label: { mode: "visible", text: "Pick" }, required: true },
			options: opts,
			variant: "radiogroup",
			error: "Choose one",
		});
		expect(html).toContain('aria-required="true"');
		expect(html).toContain('aria-invalid="true"');
		expect(html).toContain("Choose one");
	});
});

/* ===========================================================================
 * 4. GRAMMAR FIXED POINT — a tree authored BEFORE the mode/family fields
 *    existed (only old kinds, no variant/multiline/indeterminate) renders
 *    BYTE-IDENTICAL across dialects. Re-dialecting moves only the intent->scale
 *    map at the boundary; the authored structure is invariant (Lemma 4 / §3).
 *
 *    This is the load-bearing claim: adding the new kinds + mode fields did not
 *    perturb the render of any pre-existing tree.
 * ========================================================================= */

describe("grammar fixed point — pre-mode authored tree is invariant across dialects", () => {
	// Uses ONLY kinds and fields that predate the Action/Overlay/mode work:
	// layout + content + the three input primitives in their DEFAULT modes +
	// feedback. No variant/multiline/indeterminate anywhere.
	const legacyTree: Node = {
		kind: "frame",
		role: "panel",
		surface: "raised",
		children: [
			{ kind: "text", value: "Accession Sheet", as: "heading", intent: "accession" },
			{ kind: "text", value: "AM 132 fol.", as: "caption", intent: "provenance" },
			{
				kind: "stack",
				role: "form",
				children: [
					{ kind: "field", a11y: { id: "title", label: { mode: "visible", text: "Title" } }, inputType: "text" },
					{
						kind: "select",
						a11y: { id: "cat", label: { mode: "visible", text: "Category" } },
						options: [
							{ value: "ms", label: "Manuscript" },
							{ value: "pr", label: "Print" },
						],
					},
					{ kind: "toggle", a11y: { id: "pub", label: { mode: "visible", text: "Public" } } },
					{ kind: "range", a11y: { id: "yr", label: { mode: "visible", text: "Year" } }, min: 1000, max: 1500 },
				],
			},
			{ kind: "status", tone: "info", signal: { text: "Awaiting sign-off", icon: "schedule" } },
			{ kind: "progress", value: 0.4, label: "Cataloguing" },
		],
	};

	// `.mo-root` carries the dialect attr + override vars, which DO differ; the
	// invariant is the rendered TREE body, so we compare with that boundary
	// stripped. (Lemma 4: only the intent->scale boundary moves, not structure.)
	// The root is `<div class="mo-root …" data-mo-dialect=… style="…vars…">BODY</div>`
	// (Svelte appends a scoped class hash, so we match the class PREFIX), with a
	// trailing SSR hydration comment after the closing tag.
	function innerBody(html: string): string {
		const rootStart = html.indexOf('class="mo-root');
		const open = html.indexOf(">", rootStart) + 1;
		const close = html.lastIndexOf("</div>");
		return html.slice(open, close);
	}

	it("the same legacy tree renders structurally identical under icelandic-archive and clinical", () => {
		const a = ssr(legacyTree, icelandicArchive);
		const b = ssr(legacyTree, clinical);
		// The two boundaries differ (proves the dialect actually moved)…
		expect(a).not.toBe(b);
		// …but the authored TREE body is byte-identical (the fixed point).
		expect(innerBody(a)).toBe(innerBody(b));
	});

	it("the legacy tree still renders every old input in its DEFAULT mode", () => {
		const html = ssr(legacyTree);
		expect(html).toContain("<input"); // Field default (single-line)
		expect(html).toContain("<select"); // Select default (dropdown)
		expect(html).toContain('role="switch"'); // Toggle default (switch)
		expect(html).toContain('type="range"'); // Range
		// No mode-extension markup leaked into a tree that never asked for it.
		expect(html).not.toContain("<textarea");
		expect(html).not.toContain('role="radiogroup"');
		expect(html).not.toContain('type="checkbox"');
	});
});
