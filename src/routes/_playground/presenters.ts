import type { JsonRecord, Node } from "$lib";
import { presentCompoundMint } from "./compound-mint.js";
import { exhibitFor } from "./exhibits.js";
import { kernelProofCaseFor } from "./kernel-proof.js";
import { LIVE_PROOF_IDS, LIVE_PROOF_STORE_PATH } from "./live-proof-contract.js";
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
			case "gold":
				return presentActionSummaryGold();
			case "compounds":
				return presentCompoundMint();
			case "grammar":
				return presentGrammarStudio(input.grammarVariant);
			case "dialects":
				return presentDialectLab(input.activeDialectId);
			case "state":
				return presentStateActions(input.storeSnapshot, input.actionLog);
			case "vary":
				return presentVaryDelta();
			case "cms":
				return presentCmsPipeline();
			case "kernels":
				return kernelProofCaseFor(input.kernelProofCaseId).tree;
			case "local-ai":
				return presentLocalAiExhibit(input.localDraft, input.localSource, input.localDiagnostics);
		}
	})();

	const kernelProof =
		input.activeExhibit === "kernels" ? kernelProofCaseFor(input.kernelProofCaseId) : undefined;

	return {
		tree,
		proof: [
			{ label: "exhibit", value: exhibit.label },
			{ label: "proof", value: exhibit.proofFocus },
			{ label: "dialect", value: input.activeDialectId },
			{
				label: "variation host",
				value:
					input.activeExhibit === "vary"
						? "Native deterministic policy; renderer receives choices only"
						: "Host-owned choice map",
			},
			{
				label: "actions",
				value: input.actionLog.length === 0 ? "none" : input.actionLog.join(", "),
			},
			{ label: "bound paths", value: summarizeStore(input.storeSnapshot) },
			{
				label: "source",
				value: kernelProof === undefined ? input.localSource : "sealed signed source-v1 fixture",
			},
			{
				label: "diagnostics",
				value:
					kernelProof !== undefined || input.localDiagnostics.length === 0
						? "none"
						: input.localDiagnostics.join(", "),
			},
			...(kernelProof === undefined
				? []
				: [
						{ label: "kernel / issuer", value: kernelProof.issuer },
						{ label: "operation", value: kernelProof.operationId },
						{ label: "surface id", value: kernelProof.surfaceId },
						{ label: "source revision", value: kernelProof.sourceRevision },
						{ label: "testimony", value: kernelProof.testimonySha256 },
						{ label: "tree receipt", value: kernelProof.treeSha256 },
					]),
		],
	};
}

/** The machine-marked benchmark fixture from ADR-0022. Keep this tree host-neutral. */
export function presentActionSummaryGold(): Node {
	return {
		kind: "frame",
		role: "page",
		surface: "base",
		budget: 4,
		children: [
			{
				kind: "frame",
				role: "section",
				surface: "raised",
				children: [
					{
						kind: "compound",
						name: "ActionSummary",
						args: {
							eyebrow: {
								kind: "text",
								value: "Gold Standard · ActionSummary@1.0.0",
								as: "caption",
								intent: "accession",
							},
							title: {
								kind: "text",
								value: "Close the governed action circuit",
								as: "heading",
								emphasis: "strong",
							},
							summary: {
								kind: "text",
								value:
									"Every ActionSummary lane is populated while dialect, bindings, choices, and actions remain owned by MorpheRoot.",
								as: "body",
							},
						},
						slots: {
							signal: [
								{
									kind: "status",
									tone: "success",
									signal: { text: "Gold circuit connected", icon: "verified" },
								},
							],
							context: [
								{
									kind: "grid",
									role: "form",
									minTrack: "regular",
									children: [
										{
											kind: "field",
											a11y: {
												id: "gold-note",
												label: { mode: "visible", text: "Evidence note" },
												required: true,
											},
											bind: "gold.note",
											hint: "A tier-1 path owned by the host store.",
										},
										{
											kind: "select",
											a11y: {
												id: "gold-posture",
												label: { mode: "visible", text: "Review posture" },
											},
											bind: "gold.posture",
											options: [
												{ value: "observe", label: "Observe" },
												{ value: "ratify", label: "Ratify" },
											],
										},
										{
											kind: "toggle",
											a11y: {
												id: "gold-reviewed",
												label: { mode: "visible", text: "Evidence reviewed" },
											},
											bind: "gold.reviewed",
											variant: "switch",
										},
										{
											kind: "range",
											a11y: {
												id: "gold-confidence",
												label: { mode: "visible", text: "Confidence" },
											},
											min: 0,
											max: 100,
											step: 1,
											bind: "gold.confidence",
										},
									],
								},
							],
							action: [
								{
									kind: "cluster",
									role: "toolbar",
									children: [
										{
											kind: "button",
											label: "Advance evidence",
											action: "gold.advance",
											intent: "primary-action",
											icon: "arrow_forward",
										},
										{
											kind: "button",
											label: "Record attestation",
											action: "gold.attest",
											intent: "success",
											icon: "verified_user",
										},
										{
											kind: "link",
											href: "/preview/capability-page.demo/rev-001",
											label: "Open CMS proof",
											intent: "provenance",
										},
									],
								},
							],
							detail: [
								{
									kind: "within",
									id: "gold.detail",
									dimension: "collapse",
									range: [0, 1],
									default: 0,
									summary: "Inspect the complete gold circuit",
									target: {
										kind: "stack",
										role: "field-group",
										children: [
											{
												kind: "vary",
												id: "gold.mode",
												default: 0,
												objective: "salience",
												options: [
													varyPanel("Compact evidence", "The base authored branch."),
													varyPanel("Expanded review", "The host selected deeper context."),
													varyPanel("Decision receipt", "The host selected the close-out branch."),
												],
											},
											{
												kind: "within",
												id: "gold.density",
												dimension: "density",
												range: [0, 2],
												default: 1,
												target: {
													kind: "compound",
													name: "ProvenanceFooter",
													args: {
														heading: {
															kind: "text",
															value: "Certification evidence",
															as: "caption",
															intent: "authority",
														},
													},
													slots: {
														facts: [
															{
																kind: "text",
																value:
																	"Catalog, CMS, renderer, and browser evidence share this fixture.",
																as: "caption",
																intent: "footnote",
															},
														],
														seals: [
															{
																kind: "badge",
																label: "ADR-0022",
																intent: "success",
																icon: "verified",
															},
														],
														links: [
															{
																kind: "link",
																href: "/substrate",
																label: "Re-run workbench evidence",
																intent: "provenance",
															},
														],
													},
												},
											},
										],
									},
								},
							],
						},
					},
				],
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
					intent: "aside",
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
				intent: "aside",
			},
		],
	);
}

/** A pure authored proof tree. It never reads host choices, epoch, policy, or digest. */
export function presentVaryDelta(): Node {
	return section("Deterministic Vary + Delta", "The tree grants a narrow live variation space.", [
		{
			kind: "status",
			tone: "info",
			signal: {
				text: "Evidence stays visible.",
				icon: "fact_check",
			},
		},
		{
			kind: "grid",
			role: "form",
			minTrack: "regular",
			children: [
				{
					kind: "select",
					a11y: {
						id: "live-proof-preference",
						label: { mode: "visible", text: "Deterministic policy preference" },
					},
					bind: LIVE_PROOF_STORE_PATH,
					options: [
						{ value: "compact", label: "Compact" },
						{ value: "evidence", label: "Evidence" },
						{ value: "decision", label: "Decision" },
					],
				},
			],
		},
		{
			kind: "text",
			value:
				"Policy neutral-deterministic-live-proof-v1 observes only live.proof.preference and tier-1 selection events. live.proof.host-only is structurally live but intentionally outside policy authority.",
			as: "caption",
			intent: "provenance",
		},
		{
			kind: "vary",
			id: LIVE_PROOF_IDS.mode,
			default: 0,
			objective: "salience",
			options: [
				varyPanel("Compact reading", "Short, scannable, neutral evidence."),
				varyPanel("Evidence review", "Expanded context without changing authored authority."),
				varyPanel("Decision preparation", "A third authored branch for a bounded choice."),
			],
		},
		{
			kind: "within",
			id: LIVE_PROOF_IDS.density,
			dimension: "density",
			range: [0, 2],
			default: 1,
			target: {
				kind: "frame",
				role: "panel",
				surface: "raised",
				children: [
					{
						kind: "stack",
						role: "panel",
						children: [
							{
								kind: "text",
								value: "Targeted density",
								as: "heading",
							},
							{
								kind: "text",
								value: "Only this panel receives the resolved density context.",
								as: "body",
								emphasis: "muted",
							},
						],
					},
				],
			},
		},
		{
			kind: "within",
			id: LIVE_PROOF_IDS.emphasis,
			dimension: "emphasis",
			range: [0, 3],
			default: 1,
			target: {
				kind: "frame",
				role: "panel",
				surface: "sunken",
				children: [
					{
						kind: "text",
						value:
							"Targeted emphasis enters the normal sibling budget; it cannot create extra visual authority.",
						as: "body",
					},
				],
			},
		},
		{
			kind: "vary",
			id: LIVE_PROOF_IDS.hostOnly,
			default: 0,
			objective: "compactness",
			options: [
				{
					kind: "status",
					tone: "caution",
					signal: { text: "Host-only: policy excluded." },
				},
				{
					kind: "status",
					tone: "caution",
					signal: { text: "Policy cannot select this." },
				},
			],
		},
		{
			kind: "within",
			id: LIVE_PROOF_IDS.detail,
			dimension: "collapse",
			range: [0, 1],
			default: 0,
			summary: "Reveal bounded variation evidence",
			target: {
				kind: "stack",
				role: "list",
				children: [
					{
						kind: "text",
						value:
							"Collapse owns one explicit detail subtree and has no authority over its visible evidence siblings.",
						as: "body",
					},
					{
						kind: "text",
						value:
							"Epoch, digest, policy, user locks, and receipts remain host state outside the authored tree.",
						as: "caption",
						intent: "aside",
					},
				],
			},
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
