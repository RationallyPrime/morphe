import type { JsonRecord, Node } from "$lib";
import { exhibitFor } from "./exhibits.js";
import type {
	GrammarVariant,
	PlaygroundPresentation,
	PlaygroundPresentationInput,
} from "./types.js";
import type { LocalAdaptiveDraft, LocalAdaptiveTone } from "./validation.js";

const primitiveLabels: Record<GrammarVariant, readonly string[]> = {
	layout: ["Frame", "Stack", "Grid", "Cluster", "Spacer"],
	content: ["Text", "Number", "Badge", "Icon", "Media"],
	input: ["Field", "Select", "Toggle", "Range"],
	feedback: ["Status", "InlineAlert", "Progress"],
	overlay: ["Disclosure", "Dialog", "Popover"],
	media: ["Media source", "Aspect", "Alt text", "Intrinsic size"],
};

const toneIntent: Record<LocalAdaptiveTone, "info" | "success" | "caution"> = {
	info: "info",
	success: "success",
	caution: "caution",
};

export function presentPlayground(input: PlaygroundPresentationInput): PlaygroundPresentation {
	const exhibit = exhibitFor(input.activeExhibit);
	const tree = (() => {
		switch (input.activeExhibit) {
			case "grammar":
				return presentGrammarStudio(input.grammarVariant);
			case "dialects":
				return presentDialectLab(input.activeDialectId);
			case "state":
				return presentStateActions(input.storeSnapshot, input.actionLog);
			case "vary":
				return presentVaryDelta(input.selectedVaryChoice);
			case "cms":
				return presentCmsPipeline();
			case "local-ai":
				return presentLocalAiExhibit(input.localDraft, input.localSource, input.localDiagnostics);
		}
	})();

	return {
		tree,
		proof: [
			{ label: "exhibit", value: exhibit.label },
			{ label: "proof", value: exhibit.proofFocus },
			{ label: "dialect", value: input.activeDialectId },
			{ label: "choice demo.mode", value: String(input.selectedVaryChoice) },
			{
				label: "actions",
				value: input.actionLog.length === 0 ? "none" : input.actionLog.join(", "),
			},
			{ label: "bound paths", value: summarizeStore(input.storeSnapshot) },
			{ label: "source", value: input.localSource },
			{
				label: "diagnostics",
				value: input.localDiagnostics.length === 0 ? "none" : input.localDiagnostics.join(", "),
			},
		],
	};
}

export function presentLocalAdaptiveDraft(draft: LocalAdaptiveDraft): Node {
	return {
		kind: "frame",
		role: "panel",
		surface: "raised",
		children: [
			{
				kind: "stack",
				role: "section",
				children: [
					{
						kind: "cluster",
						role: "toolbar",
						align: "center",
						children: draft.badges.map((label) => ({
							kind: "badge",
							label,
							intent: toneIntent[draft.tone],
						})),
					},
					{ kind: "text", value: draft.title, as: "heading", emphasis: "strong" },
					{ kind: "text", value: draft.summary, as: "body", emphasis: "muted" },
					{ kind: "status", tone: draft.tone, signal: { text: "Draft passed contract" } },
					{
						kind: "button",
						label: draft.nextActionLabel,
						action: "local-ai.next",
						intent: toneIntent[draft.tone],
					},
				],
			},
		],
	};
}

export function presentPinnedDialectProof(): Node {
	return {
		kind: "frame",
		role: "panel",
		surface: "sunken",
		children: [
			{
				kind: "stack",
				role: "section",
				children: [
					{ kind: "badge", label: "night", intent: "provenance", icon: "dark_mode" },
					{ kind: "text", value: "Pinned dialect boundary", as: "heading" },
					{
						kind: "text",
						value:
							"This nested proof is rendered in its own MorpheRoot with the night dialect while the workbench follows the active global dialect.",
						as: "body",
						emphasis: "muted",
					},
				],
			},
		],
	};
}

function presentGrammarStudio(variant: GrammarVariant): Node {
	const labels = primitiveLabels[variant];
	return section("Grammar Studio", "Node families are authored data, not components.", [
		{
			kind: "cluster",
			role: "inline",
			children: labels.map((label) => ({ kind: "badge", label, intent: "provenance" })),
		},
		{
			kind: "disclosure",
			summary: "Selected Node JSON",
			children: [
				{
					kind: "text",
					value: JSON.stringify({ family: variant, primitives: labels }, null, 2),
					as: "caption",
					intent: "marginalia",
				},
			],
		},
	]);
}

function presentDialectLab(activeDialectId: string): Node {
	return section("Dialect Lab", "The authored tree stays fixed while the intent layer moves.", [
		{ kind: "badge", label: `active: ${activeDialectId}`, intent: "accession", icon: "palette" },
		{
			kind: "media",
			src: "/images/demo/interface-lab.svg",
			alt: "Neutral interface lab proof rendered through the active Morphe dialect.",
			aspect: "video",
			width: 1280,
			height: 720,
		},
		{
			kind: "status",
			tone: "success",
			signal: { text: "Same tree, different dialect" },
		},
	]);
}

function presentStateActions(snapshot: JsonRecord, actionLog: readonly string[]): Node {
	return section(
		"State + Actions",
		"Bound inputs write paths; buttons resolve opaque action ids.",
		[
			{
				kind: "grid",
				role: "section",
				minTrack: "regular",
				children: [
					{
						kind: "field",
						a11y: {
							id: "playground-goal",
							label: { mode: "visible", text: "Interface goal" },
							required: true,
						},
						inputType: "text",
						bind: "playground.goal",
						hint: "Initial value comes from the root-provided Morphe store.",
					},
					{
						kind: "toggle",
						a11y: {
							id: "playground-reviewed",
							label: { mode: "visible", text: "Reviewed" },
						},
						bind: "playground.reviewed",
						variant: "switch",
					},
				],
			},
			{
				kind: "cluster",
				role: "toolbar",
				children: [
					{ kind: "button", label: "Rotate mode", action: "demo.rotate", icon: "sync" },
					{
						kind: "button",
						label: "Record review",
						action: "demo.review",
						intent: "success",
						icon: "done",
					},
				],
			},
			{
				kind: "text",
				value: `Store paths: ${summarizeStore(snapshot)}. Actions: ${
					actionLog.length === 0 ? "none" : actionLog.join(", ")
				}`,
				as: "caption",
				intent: "marginalia",
			},
		],
	);
}

function presentVaryDelta(selectedChoice: number): Node {
	return section("Vary + Delta", "The host choice map selects the live branch.", [
		{
			kind: "vary",
			id: "demo.mode",
			default: 0,
			objective: "salience",
			options: [
				varyPanel("Compact triage", "Short, scannable, operator-first."),
				varyPanel("Evidence review", "Expanded evidence with diagnostics."),
				varyPanel("Decision close", "Final branch focused on action."),
			],
		},
		{
			kind: "status",
			tone: "info",
			signal: { text: `Host choice demo.mode=${selectedChoice}` },
		},
	]);
}

function presentCmsPipeline(): Node {
	return section("CMS Pipeline", "Compiled trees and publication pointers stay as proof routes.", [
		{
			kind: "cluster",
			role: "inline",
			children: [
				{
					kind: "link",
					href: "/preview/capability-page.demo/rev-001",
					label: "Preview capability-page.demo/rev-001",
				},
				{ kind: "link", href: "/p/demo", label: "Published pointer /p/demo" },
			],
		},
		{
			kind: "status",
			tone: "success",
			signal: { text: "Built-in fixture remains available without local artifacts" },
		},
	]);
}

function presentLocalAiExhibit(
	draft: LocalAdaptiveDraft,
	source: string,
	diagnostics: readonly string[],
): Node {
	return {
		kind: "frame",
		role: "page",
		surface: "base",
		children: [
			{
				kind: "stack",
				role: "section",
				children: [
					{ kind: "badge", label: "Local AI Provider", intent: "provenance", icon: "neurology" },
					{
						kind: "text",
						value: "Chrome Prompt API behind a small typed draft",
						as: "display",
						emphasis: "strong",
					},
					presentLocalAdaptiveDraft(draft),
					{
						kind: "inline-alert",
						tone: source === "chrome-live" ? "success" : "info",
						title: `Source: ${source}`,
						detail: diagnostics.length === 0 ? "No diagnostics reported." : diagnostics.join(", "),
						live: "polite",
					},
				],
			},
		],
	};
}

function section(title: string, summary: string, children: readonly Node[]): Node {
	return {
		kind: "frame",
		role: "page",
		surface: "base",
		budget: 4,
		children: [
			{
				kind: "stack",
				role: "section",
				children: [
					{ kind: "badge", label: title, intent: "provenance" },
					{ kind: "text", value: title, as: "display", emphasis: "strong" },
					{ kind: "text", value: summary, as: "body", emphasis: "muted" },
					...children,
				],
			},
		],
	};
}

function varyPanel(title: string, body: string): Node {
	return {
		kind: "frame",
		role: "panel",
		surface: "raised",
		children: [
			{
				kind: "stack",
				role: "panel",
				children: [
					{ kind: "text", value: title, as: "heading" },
					{ kind: "text", value: body, as: "body", emphasis: "muted" },
				],
			},
		],
	};
}

function summarizeStore(snapshot: JsonRecord): string {
	const keys = Object.keys(snapshot).sort();
	return keys.length === 0 ? "none" : keys.join(", ");
}
