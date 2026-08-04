import type { Node } from "$lib";

export type CompoundReference = Extract<Node, { readonly kind: "compound" }>;

export interface CompoundMintFixture {
	readonly name: string;
	readonly purpose: string;
	readonly reference: CompoundReference;
}

export const MINTED_COMPOUND_NAMES = [
	"ContentSection",
	"SignalBand",
	"DefinitionRow",
	"ProgressRow",
	"Trail",
	"OperationalPane",
	"RecordCard",
	"DiagnosticGroup",
	"EmptyState",
] as const;

function text(
	value: string,
	as: "display" | "heading" | "subheading" | "body" | "caption" = "body",
	intent?: "neutral" | "provenance" | "evidence" | "accession" | "caution" | "success" | "info",
): Node {
	return { kind: "text", value, as, ...(intent === undefined ? {} : { intent }) };
}

function status(label: string, tone: "success" | "caution" | "info" | "neutral" = "info"): Node {
	return { kind: "status", tone, signal: { text: label } };
}

function action(label: string): Node {
	return {
		kind: "button",
		label,
		action: "mint.record",
		intent: "primary-action",
	};
}

function provenance(label: string): CompoundReference {
	return {
		kind: "compound",
		name: "ProvenanceFooter",
		args: { heading: text(`${label} evidence`, "caption", "provenance") },
		slots: {
			facts: [text("Package catalog and benchmark fixture agree.", "caption")],
			seals: [{ kind: "badge", label: "Minted", intent: "success", icon: "verified" }],
			links: [
				{
					kind: "link",
					href: "/substrate",
					label: "Inspect the compound mint",
					intent: "provenance",
				},
			],
		},
	};
}

function signalCard(label: string): CompoundReference {
	return {
		kind: "compound",
		name: "SignalCard",
		args: {
			kicker: text("Signal fixture", "caption", "accession"),
			title: text(label, "subheading"),
			measure: { kind: "number", value: 17, format: "integer", label: "Promoted compounds" },
		},
		slots: {
			signal: [status("Catalog valid", "success")],
			body: [text("Every argument and slot is caller-authored.", "body")],
		},
	};
}

function trailEntry(label: string): CompoundReference {
	return {
		kind: "compound",
		name: "TrailEntry",
		args: {
			stamp: text("T+00", "caption", "provenance"),
			summary: text(label, "body"),
		},
		slots: {
			signals: [status("Recorded", "success")],
			detail: [text("The event retains its explanatory detail.", "caption")],
			ref: [{ kind: "link", href: "/substrate", label: "Open event context" }],
			provenance: [text("event:morphe-compound-mint", "caption", "provenance")],
		},
	};
}

export const COMPOUND_MINT_FIXTURES: readonly CompoundMintFixture[] = Object.freeze([
	{
		name: "SignalCard",
		purpose: "A compact signal identity whose framing stays caller-owned.",
		reference: signalCard("SignalCard benchmark"),
	},
	{
		name: "EntityHeader",
		purpose: "A context-resetting entity lede with caller-authored status and provenance.",
		reference: {
			kind: "compound",
			name: "EntityHeader",
			args: {
				kicker: text("Entity fixture", "caption", "accession"),
				title: text("EntityHeader benchmark", "subheading"),
				keyFigure: { kind: "number", value: 17, format: "integer", label: "Entries" },
			},
			slots: {
				signal: [status("Current", "success")],
				meta: [text("Scope · promoted package vocabulary", "caption")],
				provenance: [provenance("EntityHeader")],
			},
		},
	},
	{
		name: "ProvenanceFooter",
		purpose: "Progressively disclosed facts, seals, and authoritative links.",
		reference: provenance("ProvenanceFooter"),
	},
	{
		name: "StatBand",
		purpose: "A wrap-capable list of caller-authored signal tiles.",
		reference: {
			kind: "compound",
			name: "StatBand",
			args: {},
			slots: { tiles: [signalCard("Nested StatBand tile")] },
		},
	},
	{
		name: "Breakdown",
		purpose: "A labelled collection of proportion or progress rows.",
		reference: {
			kind: "compound",
			name: "Breakdown",
			args: { title: text("Breakdown benchmark", "subheading") },
			slots: {
				rows: [
					{
						kind: "compound",
						name: "ProgressRow",
						args: {
							label: text("Evidence coverage", "body"),
							progress: { kind: "progress", value: 1, label: "Evidence coverage" },
							value: text("100%", "caption", "evidence"),
						},
						slots: {
							signal: [status("Complete", "success")],
							detail: [text("All declared lanes are populated.", "caption")],
						},
					},
				],
			},
		},
	},
	{
		name: "TrailEntry",
		purpose: "One ordered event with signals, detail, references, and provenance.",
		reference: trailEntry("TrailEntry benchmark minted"),
	},
	{
		name: "KeyValuePanel",
		purpose: "Three caller-owned tiers of key/value evidence.",
		reference: {
			kind: "compound",
			name: "KeyValuePanel",
			args: {},
			slots: {
				primary: [text("Primary · promoted", "body", "evidence")],
				secondary: [text("Secondary · node and slot variability only", "caption")],
				provenance: [text("catalog:morphe@0.12.0", "caption", "provenance")],
			},
		},
	},
	{
		name: "ContentSection",
		purpose: "A stable section reading order with caller-owned content and actions.",
		reference: {
			kind: "compound",
			name: "ContentSection",
			args: {
				heading: text("ContentSection benchmark", "subheading"),
				summary: text("A neutral region for authored content.", "body"),
			},
			slots: {
				meta: [{ kind: "badge", label: "section", intent: "accession" }],
				body: [text("The host decides how this section is reached and framed.", "body")],
				actions: [action("Record section evidence")],
				detail: [text("No geometry or domain policy is encoded.", "caption")],
			},
		},
	},
	{
		name: "SignalBand",
		purpose: "A labelled, wrap-capable collection of complete signal nodes.",
		reference: {
			kind: "compound",
			name: "SignalBand",
			args: {
				heading: text("SignalBand benchmark", "subheading"),
				summary: text("Signals retain their own text and shape.", "body"),
			},
			slots: {
				meta: [{ kind: "badge", label: "3 signals", intent: "provenance" }],
				signals: [
					status("Catalog admitted", "success"),
					status("CMS validated", "info"),
					signalCard("Nested neutral signal"),
				],
				detail: [text("Color is paired with explicit signal text.", "caption")],
			},
		},
	},
	{
		name: "DefinitionRow",
		purpose: "A term/value pair with independent status, detail, and action lanes.",
		reference: {
			kind: "compound",
			name: "DefinitionRow",
			args: {
				term: text("DefinitionRow", "caption", "accession"),
				value: text("A neutral relation between an authored term and value.", "body"),
			},
			slots: {
				signal: [status("Defined", "success")],
				detail: [text("The value may itself be any valid Node.", "caption")],
				actions: [{ kind: "link", href: "/substrate", label: "Inspect definition evidence" }],
			},
		},
	},
	{
		name: "ProgressRow",
		purpose: "A labelled progress measure with exact value and explanatory lanes.",
		reference: {
			kind: "compound",
			name: "ProgressRow",
			args: {
				label: text("ProgressRow benchmark", "body"),
				progress: { kind: "progress", value: 0.64, label: "Compound mint progress" },
				value: text("64% · evidence assembly", "caption", "evidence"),
			},
			slots: {
				signal: [status("Advancing", "info")],
				detail: [text("The caller owns both the measure and exact value.", "caption")],
			},
		},
	},
	{
		name: "Trail",
		purpose: "An ordered evidence collection composed from caller-authored entries.",
		reference: {
			kind: "compound",
			name: "Trail",
			args: {
				heading: text("Trail benchmark", "subheading"),
				summary: text("A trail owns ordering, not event identity.", "body"),
			},
			slots: {
				meta: [{ kind: "badge", label: "ordered", intent: "accession" }],
				items: [trailEntry("Catalog definition registered")],
				actions: [action("Record trail evidence")],
				provenance: [provenance("Trail")],
			},
		},
	},
	{
		name: "OperationalPane",
		purpose: "A route-owned pane with separate controls, body, detail, and provenance.",
		reference: {
			kind: "compound",
			name: "OperationalPane",
			args: {
				eyebrow: text("Operational fixture", "caption", "accession"),
				title: text("OperationalPane benchmark", "subheading"),
				summary: text("The host supplies routing and live authority.", "body"),
			},
			slots: {
				signal: [status("Available", "success")],
				controls: [action("Record pane evidence")],
				body: [text("Pane content remains typed authored data.", "body")],
				detail: [text("The route decides context reset and elevation.", "caption")],
				provenance: [provenance("OperationalPane")],
			},
		},
	},
	{
		name: "RecordCard",
		purpose: "A persistent-record summary without recipe, Law, or kernel policy.",
		reference: {
			kind: "compound",
			name: "RecordCard",
			args: {
				eyebrow: text("Record fixture", "caption", "accession"),
				title: text("RecordCard benchmark", "subheading"),
				summary: text("One neutral record identity and its caller-owned facts.", "body"),
			},
			slots: {
				signal: [status("Current", "success")],
				facts: [
					{
						kind: "compound",
						name: "DefinitionRow",
						args: {
							term: text("Catalog key", "caption"),
							value: text("RecordCard", "body", "evidence"),
						},
						slots: {
							signal: [status("Known", "success")],
							detail: [text("Stable package identity.", "caption")],
							actions: [{ kind: "link", href: "/substrate", label: "Open catalog" }],
						},
					},
				],
				actions: [action("Record card evidence")],
				provenance: [provenance("RecordCard")],
			},
		},
	},
	{
		name: "DiagnosticGroup",
		purpose: "A scoped diagnostic collection with explicit text, repair, and detail.",
		reference: {
			kind: "compound",
			name: "DiagnosticGroup",
			args: {
				heading: text("DiagnosticGroup benchmark", "subheading"),
				summary: text("Diagnostics remain evidence, not hidden color.", "body"),
			},
			slots: {
				signal: [status("Review required", "caution")],
				diagnostics: [
					{
						kind: "inline-alert",
						tone: "caution",
						title: "Fixture diagnostic",
						detail: "The group retains the complete diagnostic message.",
						repair: "Review the caller-owned repair path.",
					},
				],
				actions: [{ kind: "link", href: "/substrate", label: "Inspect diagnostic source" }],
				detail: [text("Live repair authority stays outside Morphe.", "caption")],
			},
		},
	},
	{
		name: "EmptyState",
		purpose: "An explicit absence with caller-owned symbol, next step, and context.",
		reference: {
			kind: "compound",
			name: "EmptyState",
			args: {
				title: text("No unreviewed compounds", "subheading"),
				summary: text("Every catalog entry has a maintained benchmark fixture.", "body"),
			},
			slots: {
				symbol: [
					{ kind: "icon", name: "inventory_2", a11y: { role: "decorative" }, intent: "info" },
				],
				actions: [action("Record empty-state evidence")],
				detail: [text("Absence is not represented as failure by default.", "caption")],
			},
		},
	},
]);

export function presentCompoundMint(): Node {
	return {
		kind: "frame",
		role: "page",
		surface: "base",
		children: [
			{
				kind: "stack",
				role: "section",
				children: [
					text("Compound Mint", "display"),
					text(
						"Sixteen promoted compounds measured against ActionSummary without copying its shape.",
						"body",
					),
					status("Every non-gold catalog entry has a complete fixture", "success"),
					{
						kind: "grid",
						role: "list",
						minTrack: "wide",
						children: COMPOUND_MINT_FIXTURES.map((fixture) => ({
							kind: "frame",
							role: "section",
							surface: "raised",
							children: [
								{
									kind: "stack",
									role: "section",
									children: [
										text(`${fixture.name} · benchmark`, "heading", "accession"),
										text(fixture.purpose, "caption"),
										fixture.reference,
									],
								},
							],
						})),
					},
				],
			},
		],
	};
}
