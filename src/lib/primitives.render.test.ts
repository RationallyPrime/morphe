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

import { render } from "svelte/server";
import { describe, expect, it } from "vitest";
import { registry } from "./compounds/factory.js";
import type { ChoiceMap } from "./delegation/envelope.js";
import { clinical } from "./dialects/clinical.js";
import { icelandicArchive } from "./dialects/icelandic-archive.js";
import type { Dialect } from "./dialects/types.js";
import type { Node } from "./grammar/types.js";
import { GRAMMAR_VERSION } from "./grammar/version.js";
import MorpheRoot from "./render/MorpheRoot.svelte";
import { PRIMITIVES } from "./render/registry.js";
import { createInMemoryMorpheStore, type MorpheStore } from "./state/store.svelte.js";

/** Render an authored tree through the full core to its SSR HTML body string. */
function ssr(
	tree: Node,
	options?:
		| Dialect
		| { readonly dialect?: Dialect; readonly store?: MorpheStore; readonly choices?: ChoiceMap },
): string {
	if (options && "id" in options) {
		return render(MorpheRoot, { props: { tree, dialect: options } }).body;
	}
	return render(MorpheRoot, { props: { tree, ...options } }).body;
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
				{
					kind: "cluster",
					role: "toolbar",
					children: [
						{ kind: "button", label: "Primary", variant: "solid" },
						{ kind: "button", label: "Secondary", variant: "outline" },
						{ kind: "link", href: "https://example.org", label: "Source", external: "force" },
					],
				},
				{
					kind: "disclosure",
					summary: "Notes",
					children: [{ kind: "text", value: "Marginalia", as: "caption" }],
				},
			],
		};
		const html = ssr(tree);
		expect(html).toContain("Primary");
		expect(html).toContain("Secondary");
		expect(html).toContain("Source");
		expect(html).toContain("Marginalia");
	});

	it("renders known siblings around an unknown CompoundRef without throwing", () => {
		const tree: Node = {
			kind: "stack",
			role: "section",
			children: [
				{ kind: "text", value: "before", as: "body" },
				{ kind: "compound", name: "definitely-not-registered", args: {} },
				{ kind: "text", value: "after", as: "body" },
			],
		};
		let html = "";
		expect(() => {
			html = ssr(tree);
		}).not.toThrow();
		expect(html).toContain("before");
		expect(html).toContain("after");
	});

	it("renders known siblings around an invalid CompoundRef without throwing", () => {
		registry.register({
			name: "invalid-call-probe",
			version: "1.0.0",
			grammarVersion: GRAMMAR_VERSION,
			params: {
				type: "object",
				properties: { content: { type: "node", required: true } },
			},
			template: { kind: "param-ref", param: "content" },
		});
		const tree: Node = {
			kind: "stack",
			role: "section",
			children: [
				{ kind: "text", value: "before", as: "body" },
				{ kind: "compound", name: "invalid-call-probe", args: {} },
				{ kind: "text", value: "after", as: "body" },
			],
		};
		let html = "";
		expect(() => {
			html = ssr(tree);
		}).not.toThrow();
		expect(html).toContain("before");
		expect(html).toContain("after");
	});

	it("renders known siblings around an invalid promoted EntityHeader without throwing", () => {
		// The generated EntityHeader is registered in the process-wide `registry`; an
		// invalid call (missing the required kicker/title) must render empty and leave
		// its siblings intact (the factory gate's totality contract, D8).
		const tree: Node = {
			kind: "stack",
			role: "section",
			children: [
				{ kind: "text", value: "before", as: "body" },
				{ kind: "compound", name: "EntityHeader", args: {} },
				{ kind: "text", value: "after", as: "body" },
			],
		};
		let html = "";
		expect(() => {
			html = ssr(tree);
		}).not.toThrow();
		expect(html).toContain("before");
		expect(html).toContain("after");
	});

	it("renders known siblings around an invalid promoted StatBand without throwing", () => {
		// StatBand carries no required args, so an empty call is valid; an unknown
		// argument is the invalid case. It must render empty and leave its siblings
		// intact (the factory gate's totality contract, D8).
		const tree: Node = {
			kind: "stack",
			role: "section",
			children: [
				{ kind: "text", value: "before", as: "body" },
				{ kind: "compound", name: "StatBand", args: { bogus: { kind: "text", value: "x" } } },
				{ kind: "text", value: "after", as: "body" },
			],
		};
		let html = "";
		expect(() => {
			html = ssr(tree);
		}).not.toThrow();
		expect(html).toContain("before");
		expect(html).toContain("after");
	});

	it("renders known siblings around a Within variation point without throwing", () => {
		const tree: Node = {
			kind: "stack",
			role: "section",
			children: [
				{ kind: "text", value: "before", as: "body" },
				{
					kind: "within",
					id: "density-panel",
					dimension: "density",
					range: [0, 2],
					default: 1,
				},
				{ kind: "text", value: "after", as: "body" },
			],
		};
		let html = "";
		expect(() => {
			html = ssr(tree);
		}).not.toThrow();
		expect(html).toContain("before");
		expect(html).toContain("after");
		expect(html).not.toContain("density-panel");
	});

	it("a dialect's compound allowlist hides an out-of-dialect compound at render (G|D)", () => {
		// Registered and valid — but the rendering dialect restricts to a
		// different subset, so the ref reads as unknown: nothing renders, the
		// siblings survive, and nothing throws (the same totality path).
		registry.register({
			name: "render-gating-probe",
			version: "1.0.0",
			grammarVersion: GRAMMAR_VERSION,
			params: { type: "object", properties: {} },
			template: {
				kind: "stack",
				role: "panel",
				children: [{ kind: "text", value: "gated-content", as: "body" }],
			},
		});
		const tree: Node = {
			kind: "stack",
			role: "section",
			children: [
				{ kind: "text", value: "before", as: "body" },
				{ kind: "compound", name: "render-gating-probe", args: {} },
				{ kind: "text", value: "after", as: "body" },
			],
		};

		// Unrestricted dialect (compounds: []): the compound expands.
		expect(ssr(tree, icelandicArchive)).toContain("gated-content");

		// A dialect restricted to a disjoint subset: same tree, content gone.
		const restricted: Dialect = { ...icelandicArchive, compounds: ["some-other-compound"] };
		let html = "";
		expect(() => {
			html = ssr(tree, restricted);
		}).not.toThrow();
		expect(html).not.toContain("gated-content");
		expect(html).toContain("before");
		expect(html).toContain("after");
	});

	it("allows the same text node instance to appear twice under one container", () => {
		const shared: Node = { kind: "text", value: "twice", as: "body" };
		const tree: Node = {
			kind: "stack",
			role: "list",
			children: [shared, shared],
		};
		let html = "";
		expect(() => {
			html = ssr(tree);
		}).not.toThrow();
		expect(html.match(/twice/g)).toHaveLength(2);
	});

	it("allows the same spacer node instance to be shared across nested containers", () => {
		const shared: Node = { kind: "spacer", size: "lg" };
		const tree: Node = {
			kind: "stack",
			role: "section",
			children: [
				{ kind: "cluster", role: "inline", children: [shared] },
				{ kind: "cluster", role: "inline", children: [shared] },
			],
		};
		let html = "";
		expect(() => {
			html = ssr(tree);
		}).not.toThrow();
		expect(html.match(/data-size="lg"/g)).toHaveLength(2);
	});
});

/* ===========================================================================
 * 2. LAYOUT ROLE DEFAULTS — omitted Stack.direction is still a substrate
 *    decision, not an authoring burden.
 * ========================================================================= */

describe("layout Stack defaults", () => {
	it("defaults vertical document-flow roles to block direction", () => {
		for (const role of ["page", "section", "list"] as const) {
			const html = ssr({
				kind: "stack",
				role,
				children: [{ kind: "text", value: role, as: "body" }],
			});
			expect(html).toContain(`data-role="${role}"`);
			expect(html).toContain('data-direction="block"');
		}
	});

	it("keeps omitted direction adaptive for non-structural Stack roles", () => {
		const html = ssr({
			kind: "stack",
			role: "toolbar",
			children: [{ kind: "text", value: "tools", as: "body" }],
		});
		expect(html).toContain('data-role="toolbar"');
		expect(html).toContain('data-direction="auto"');
	});

	it("honors explicit Stack direction even on structural roles", () => {
		const html = ssr({
			kind: "stack",
			role: "section",
			direction: "inline",
			children: [{ kind: "text", value: "explicit", as: "body" }],
		});
		expect(html).toContain('data-role="section"');
		expect(html).toContain('data-direction="inline"');
	});
});

/* ===========================================================================
 * 3. A11y relationships the grammar promises (cheap, SSR-visible assertions).
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
		const html = ssr({
			kind: "link",
			href: "https://elsewhere.test",
			label: "External",
			external: "force",
		});
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
		const html = ssr({
			kind: "disclosure",
			summary: "More",
			children: [{ kind: "text", value: "y", as: "body" }],
		});
		// Native <details>: the absence of the `open` attribute IS the collapsed
		// (aria-expanded=false equivalent) state the platform exposes to AT.
		expect(html).toContain("<details");
		expect(html).not.toMatch(/<details[^>]*\sopen/);
		// State is a SHAPE (chevron), never color alone (CONTRACT §7).
		expect(html).toContain("chevron_right");
	});

	it("an open Disclosure exposes expanded state via native <details open>", () => {
		const html = ssr({
			kind: "disclosure",
			summary: "More",
			open: true,
			children: [{ kind: "text", value: "y", as: "body" }],
		});
		expect(html).toMatch(/<details[^>]*\sopen/);
	});

	it("a grouped Disclosure carries the native exclusive-accordion name", () => {
		const html = ssr({
			kind: "stack",
			role: "list",
			children: [
				{
					kind: "disclosure",
					summary: "A",
					group: "faq",
					children: [{ kind: "text", value: "a", as: "body" }],
				},
				{
					kind: "disclosure",
					summary: "B",
					group: "faq",
					children: [{ kind: "text", value: "b", as: "body" }],
				},
			],
		});
		// `name=` makes the <details> mutually exclusive natively (no JS).
		expect(html).toContain('name="faq"');
	});

	it("a menu/listbox Popover is labelled by its anchor; a tooltip describes it", () => {
		const menu = ssr({
			kind: "popover",
			anchor: "btn",
			id: "m1",
			role: "menu",
			children: [{ kind: "text", value: "i", as: "body" }],
		});
		expect(menu).toContain('role="menu"');
		expect(menu).toContain('aria-labelledby="btn"');

		const tip = ssr({
			kind: "popover",
			anchor: "btn",
			id: "t1",
			role: "tooltip",
			children: [{ kind: "text", value: "i", as: "body" }],
		});
		expect(tip).toContain('role="tooltip"');
		// A tooltip is non-interactive chrome: it is NOT labelledby its anchor.
		expect(tip).not.toContain('aria-labelledby="btn"');
	});
});

/* ===========================================================================
 * 4. INPUT MODE EXTENSIONS — both modes of each input render, the default
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
		const html = ssr({
			kind: "field",
			a11y: { id: "f3", label: { mode: "visible", text: "Name" }, required: true },
		});
		expect(html).toContain('aria-required="true"');
		expect(html).toContain("(required)");
	});
});

describe("bindings — bound input primitives read initial tier-1 state", () => {
	it("reads Field, Select, Toggle, and Range initial values from the provided store", () => {
		const store = createInMemoryMorpheStore({
			"title.path": "Stored title",
			"lang.path": "en",
			"published.path": true,
			"year.path": 1440,
		});
		const tree: Node = {
			kind: "stack",
			role: "form",
			children: [
				{ kind: "field", a11y: baseA11y("bind-title"), bind: "title.path" },
				{
					kind: "select",
					a11y: baseA11y("bind-lang"),
					bind: "lang.path",
					options: [
						{ value: "is", label: "Icelandic" },
						{ value: "en", label: "English" },
					],
				},
				{ kind: "toggle", a11y: baseA11y("bind-published"), bind: "published.path" },
				{ kind: "range", a11y: baseA11y("bind-year"), min: 1200, max: 1600, bind: "year.path" },
			],
		};

		const html = ssr(tree, { store });

		expect(html).toContain('value="Stored title"');
		expect(html).toMatch(/<option[^>]*value="en"[^>]*selected/);
		expect(html).toContain('data-on="true"');
		expect(html).toContain(">1440</output>");
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
		const html = ssr({
			kind: "toggle",
			a11y: baseA11y("t3"),
			variant: "checkbox",
			indeterminate: true,
		});
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
		const html = ssr({
			kind: "select",
			a11y: baseA11y("s2"),
			options: opts,
			variant: "radiogroup",
		});
		expect(html).toContain("<fieldset");
		expect(html).toContain('role="radiogroup"');
		expect(html).toContain('role="radio"');
		expect(html).toContain("Icelandic");
		expect(html).toContain("English");
	});

	it("the radiogroup has exactly ONE tab stop (roving tabindex, ARIA APG)", () => {
		const html = ssr({
			kind: "select",
			a11y: baseA11y("s3"),
			options: opts,
			variant: "radiogroup",
		});
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
					{
						kind: "field",
						a11y: { id: "title", label: { mode: "visible", text: "Title" } },
						inputType: "text",
					},
					{
						kind: "select",
						a11y: { id: "cat", label: { mode: "visible", text: "Category" } },
						options: [
							{ value: "ms", label: "Manuscript" },
							{ value: "pr", label: "Print" },
						],
					},
					{ kind: "toggle", a11y: { id: "pub", label: { mode: "visible", text: "Public" } } },
					{
						kind: "range",
						a11y: { id: "yr", label: { mode: "visible", text: "Year" } },
						min: 1000,
						max: 1500,
					},
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

	// FP1 is a STRUCTURAL invariant: the element tree / kinds / roles / intents are
	// the same under any dialect. A dialect's `rootDensity` PRIOR, however, is meant
	// to move the density-derived CONTINUOUS boundary values (the `--mo-ctx-space`
	// gap/padding step, the progress track size, the Status compact flag) — clinical
	// ships `compact`, the Archive `regular`, and FP5 pins that the prior applies. So
	// normalize exactly those density-derived values before the structural compare;
	// the dedicated assertion below proves the prior genuinely DID move them (which
	// before the SSR-seeding fix it silently did not, leaving both at ROOT_CONTEXT).
	function structuralBody(html: string): string {
		return innerBody(html)
			.replace(/--mo-ctx-space:var\(--mo-space-\d+\)/g, "--mo-ctx-space:Z")
			.replace(/--mo-progress-track: var\(--mo-space-\d+\)/g, "--mo-progress-track: Z")
			.replace(/data-compact="(?:true|false)"/g, 'data-compact="Z"');
	}

	it("the same legacy tree renders structurally identical under icelandic-archive and clinical", () => {
		const a = ssr(legacyTree, icelandicArchive);
		const b = ssr(legacyTree, clinical);
		// The two boundaries differ (proves the dialect actually moved)…
		expect(a).not.toBe(b);
		// …but the authored TREE structure is identical once the density-derived
		// boundary values (which the dialect's density prior legitimately moves) are
		// normalized — the fixed point. Element tree, kinds, roles, intents: invariant.
		expect(structuralBody(a)).toBe(structuralBody(b));
	});

	it("the dialect's density PRIOR actually reaches the SSR tree (the seeding regression)", () => {
		// The complement of the structural invariant: clinical's compact prior must
		// genuinely compress the density-derived boundary values relative to the
		// Archive's regular prior on the SERVER render. Before the fix both descended
		// from ROOT_CONTEXT (regular), so these were byte-identical — the bug.
		const archive = innerBody(ssr(legacyTree, icelandicArchive));
		const clinic = innerBody(ssr(legacyTree, clinical));
		// The root Frame's gap/padding step: compact -> space-3, regular -> space-5.
		expect(clinic).toContain("--mo-ctx-space:var(--mo-space-3)");
		expect(archive).toContain("--mo-ctx-space:var(--mo-space-5)");
		expect(clinic).not.toContain("--mo-ctx-space:var(--mo-space-5)");
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

describe("variation choices — MorpheRoot passes choices only, never epochs", () => {
	const varyingCopy: Node = {
		kind: "vary",
		id: "copy-choice",
		options: [
			{ kind: "text", value: "First option", as: "body" },
			{ kind: "text", value: "Second option", as: "body" },
			{ kind: "text", value: "Third option", as: "body" },
		],
		default: 2,
	};

	it("renders the Vary option selected by the root choice map", () => {
		const html = ssr(varyingCopy, { choices: { "copy-choice": 1 } });
		expect(html).toContain("Second option");
		expect(html).not.toContain("First option");
		expect(html).not.toContain("Third option");
	});

	it("falls back byte-identically to the authored default when choices are absent or empty", () => {
		const absent = ssr(varyingCopy);
		const empty = ssr(varyingCopy, { choices: {} });
		expect(absent).toBe(empty);
		expect(absent).toContain("Third option");
	});

	it("defensively clamps an out-of-range choice map entry into the Vary options", () => {
		const high = ssr(varyingCopy, { choices: { "copy-choice": 99 } });
		const low = ssr(varyingCopy, { choices: { "copy-choice": -99 } });
		expect(high).toContain("Third option");
		expect(low).toContain("First option");
	});
});

describe("emphasis subalgebra — renormalization reaches the SSR tree (Budget-conservation, WIRED)", () => {
	// The PARENT grants each child its rendered emphasis, so the data-emphasis the
	// children render reflects the LAW (budget + top-tier cap), not the raw
	// self-claims. Before the wiring, each node echoed its own claim regardless of
	// budget (the comment in Stack.svelte described a law the code never ran).
	const leaf: Node = { kind: "text", value: "x", as: "body" };

	/** The data-emphasis the mo-stack elements render, in document order. Scoped to
	 *  the stacks so the leaf text's own (baseline) data-emphasis doesn't count. */
	function stackEmphases(html: string): string[] {
		return [...html.matchAll(/class="mo-stack[^"]*"[^>]*?data-emphasis="(\w+)"/g)].map(
			(m) => m[1] as string,
		);
	}

	it("two critical claims under B=2 render the renormalized [strong, muted], NOT [critical, critical]", () => {
		const tree: Node = {
			kind: "frame",
			role: "page",
			surface: "base",
			budget: 2,
			children: [
				{ kind: "stack", role: "list", emphasis: "critical", children: [leaf] },
				{ kind: "stack", role: "list", emphasis: "critical", children: [leaf] },
			],
		};
		// renormalizeBudget(2, [critical, critical]) = [strong, muted]: the first
		// claimant keeps as much as B allows; the second is demoted to fit.
		expect(stackEmphases(ssr(tree))).toEqual(["strong", "muted"]);
	});

	it("an explicit strong claim flanked by unmarked siblings is NOT starved", () => {
		const tree: Node = {
			kind: "frame",
			role: "page",
			surface: "base",
			budget: 2,
			children: [
				{ kind: "stack", role: "list", children: [leaf] }, // unmarked → normal baseline (free)
				{ kind: "stack", role: "list", emphasis: "strong", children: [leaf] },
				{ kind: "stack", role: "list", children: [leaf] }, // unmarked → normal baseline (free)
			],
		};
		// Unmarked siblings don't compete for budget, so the strong claim survives B=2
		// and the siblings render the normal baseline (never quieted to muted).
		expect(stackEmphases(ssr(tree))).toEqual(["normal", "strong", "normal"]);
	});

	it("a strong-granted container emits the strong stroke tier for its subtree (the orbit reaches the cascade)", () => {
		const tree: Node = {
			kind: "frame",
			role: "page",
			surface: "base",
			budget: 3,
			children: [{ kind: "stack", role: "list", emphasis: "strong", children: [leaf] }],
		};
		// The granted-strong stack emits --mo-ctx-stroke at the emphasis tier so its
		// descendant control borders inherit a heavier edge; emphasisToStrokeStep maps
		// strong → the strong border-width step. A normal node emits the hairline step.
		const html = ssr(tree);
		expect(html).toMatch(/--mo-ctx-stroke:\s*var\(--mo-border-width-strong\)/); // strong stack
		expect(html).toMatch(/--mo-ctx-stroke:\s*var\(--mo-border-width\)/); // the page Frame (normal)
	});
});

describe("Content leaves — inline color resolves to a CSS value in SSR, not a Svelte signal", () => {
	// REGRESSION: `style:color` (the shorthand) on Text/Number serialized the
	// $derived SIGNAL (a getter function) into the SSR style attribute instead of
	// its value, so server-rendered intent-colored text shipped `style="color:
	// function (...){...}"` — invalid CSS, wrong color until hydration. The explicit
	// `style:color={color}` form resolves the value. These pin the resolved var.
	it("Text emits its intent color as a var(), never a serialized function", () => {
		const html = ssr({ kind: "text", value: "x", as: "body", intent: "provenance" });
		expect(html).not.toContain("color: function");
		expect(html).toMatch(/color:\s*var\(--mo-intent-provenance-on\)/);
	});

	it("Number emits its intent color as a var(), never a serialized function", () => {
		const html = ssr({ kind: "number", value: 42, format: "integer", intent: "evidence" });
		expect(html).not.toContain("color: function");
		expect(html).toMatch(/color:\s*var\(--mo-intent-evidence-on\)/);
	});

	it("Number never throws on a malformed currency code — renders plain instead", () => {
		// Currency codes are authored DATA; a 4-letter ticker must not RangeError
		// the pane (renderer totality). It degrades to plain formatting.
		const html = ssr({ kind: "number", value: 1250, format: "currency", currency: "USDT" });
		expect(html).toContain("mo-number");
		expect(html).not.toContain("USDT");
	});

	it("Number formats a well-formed currency code", () => {
		const html = ssr({ kind: "number", value: 1250, format: "currency", currency: "ISK" });
		expect(html).toContain("mo-number");
	});

	it("Icon emits its intent color as a var(), never a serialized function", () => {
		const html = ssr({
			kind: "icon",
			name: "circle",
			a11y: { role: "img", label: "marker" },
			intent: "caution",
		});
		expect(html).not.toContain("color: function");
		expect(html).toMatch(/color:\s*var\(--mo-intent-caution-on\)/);
	});
});

describe("SSR dialect-prior seeding — the root descends from the dialect's clamped priors", () => {
	// REGRESSION (CONTRACT §8, the global-dialect seeding bug): the dialect's
	// density prior must reach the root Frame on the SERVER render. The carrier is
	// the `ctx` PROP MorpheRoot hands the root Node (not a context set in an effect,
	// which is stripped on the server and runs too late on the client). A Frame that
	// OMITS its own `density` inherits it from that parent ctx; the inherited density
	// becomes the `--mo-ctx-space` boundary var on the Frame's <section>. So this
	// asserts the priors actually flowed: clinical (compact) -> space-3, default
	// (regular) -> space-5. Before the fix, both rendered space-5 (ROOT_CONTEXT)
	// because the root context was never visible to the child captured at init.
	const frameInheritsDensity: Node = {
		kind: "frame",
		role: "page",
		surface: "base",
		// NO `density` here — the Frame inherits it from the dialect root context, so
		// the dialect's compact/regular prior is exactly what this test observes.
		children: [{ kind: "text", value: "Record", as: "body" }],
	};

	/** The boundary `--mo-ctx-space` on the OUTERMOST (root) Frame's <section>. */
	function rootFrameSpace(html: string): string | undefined {
		const sectionStart = html.indexOf("<section");
		if (sectionStart === -1) return undefined;
		const tagEnd = html.indexOf(">", sectionStart);
		const tag = html.slice(sectionStart, tagEnd);
		return tag.match(/--mo-ctx-space:\s*([^;"]+)/)?.[1]?.trim();
	}

	it("under clinical (compact prior) the root Frame emits the compact space step", () => {
		const space = rootFrameSpace(ssr(frameInheritsDensity, clinical));
		expect(space, "root Frame has no --mo-ctx-space under clinical").toBeDefined();
		// compact density -> --mo-space-3 (see densityToSpaceStep). The bug left this
		// at --mo-space-5 (regular) because the clinical prior never reached the root.
		expect(space).toBe("var(--mo-space-3)");
	});

	it("under the default (regular prior) the root Frame emits the regular space step", () => {
		const space = rootFrameSpace(ssr(frameInheritsDensity, icelandicArchive));
		expect(space).toBe("var(--mo-space-5)");
	});

	it("the prior genuinely differs across dialects on the SERVER render", () => {
		// The two are not equal — proof the dialect's density prior is what the root
		// resolves from, not a single hardcoded ROOT_CONTEXT for every dialect.
		expect(rootFrameSpace(ssr(frameInheritsDensity, clinical))).not.toBe(
			rootFrameSpace(ssr(frameInheritsDensity, icelandicArchive)),
		);
	});
});

/* ===========================================================================
 * LEDGER AFFORDANCES — the tabular extensions a register needs, each an OPTIONAL
 * field on an EXISTING primitive (no new kind), resolved into colour/space by the
 * dialect + algebra. Two things are asserted for each: the behaviour, and the
 * grammar fixed-point (a tree authored BEFORE the field still renders unchanged).
 * ========================================================================= */

describe("ledger affordances — Text.polarity / Grid.ruled / Stack.indent", () => {
	it("Text.polarity routes a negative amount through the dialect's --mo-numeric-negative channel", () => {
		const html = ssr(
			{
				kind: "text",
				value: "(2140.13 USD)",
				as: "body",
				intent: "evidence",
				numeric: true,
				polarity: "negative",
			},
			clinical,
		);
		expect(html).toContain('data-polarity="negative"');
		// Colour rides the numeric channel (with a fallback to the base ink), NOT the
		// carrying `evidence` intent — a negative reads "in the red" wherever a dialect
		// defines that channel; clinical does.
		expect(html).toContain("--mo-numeric-negative");
	});

	it("Text.polarity positive reads the calm numeric channel", () => {
		const html = ssr(
			{ kind: "text", value: "354.98 EUR", as: "body", numeric: true, polarity: "positive" },
			clinical,
		);
		expect(html).toContain('data-polarity="positive"');
		// Positive routes through its own channel too, but with a fallback to the base
		// ink — no dialect defines `--mo-numeric-positive`, so it renders calm ink.
		expect(html).toContain("--mo-numeric-positive");
	});

	it("a Text WITHOUT polarity still renders and carries no polarity attr (the fixed-point)", () => {
		const html = ssr({ kind: "text", value: "plain body", as: "body" }, clinical);
		expect(html).toContain("plain body");
		expect(html).not.toContain("data-polarity");
	});

	it("Grid.ruled marks a TABULAR list for hairline rows", () => {
		const html = ssr(
			{
				kind: "grid",
				role: "list",
				columns: ["flexible", "content"],
				ruled: true,
				children: [
					{
						kind: "grid",
						role: "inline",
						children: [
							{ kind: "text", value: "Cash" },
							{ kind: "text", value: "100.00", numeric: true },
						],
					},
				],
			},
			clinical,
		);
		expect(html).toContain("data-ruled");
		expect(html).toContain("data-columns");
	});

	it("Grid.ruled is INERT on a non-tabular grid — no columns ⇒ no rules (the fixed-point)", () => {
		const html = ssr(
			{ kind: "grid", role: "list", ruled: true, children: [{ kind: "text", value: "card" }] },
			clinical,
		);
		expect(html).not.toContain("data-ruled");
	});

	it("Stack.indent insets a hierarchical row by its tree LEVEL (level → space scale)", () => {
		const html = ssr(
			{
				kind: "stack",
				role: "inline",
				direction: "block",
				indent: 2,
				children: [{ kind: "text", value: "Expenses:SaaS:AI" }],
			},
			clinical,
		);
		expect(html).toMatch(/--mo-stack-indent:\s*2/);
	});

	it("Stack.indent absent or 0 emits no inset (the fixed-point)", () => {
		const flat = ssr(
			{
				kind: "stack",
				role: "inline",
				direction: "block",
				children: [{ kind: "text", value: "Expenses" }],
			},
			clinical,
		);
		expect(flat).not.toContain("--mo-stack-indent");
		const zero = ssr(
			{
				kind: "stack",
				role: "inline",
				direction: "block",
				indent: 0,
				children: [{ kind: "text", value: "Expenses" }],
			},
			clinical,
		);
		expect(zero).not.toContain("--mo-stack-indent");
	});
});
