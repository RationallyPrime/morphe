# Coherent Morphe Playground Implementation Plan

> **Status: shipped** — implemented in `src/routes/_playground/**`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current `/substrate` smoke surface with one coherent Morphe workbench that demonstrates grammar, dialects, state/actions, variation, CMS publication, and browser-local AI fallback behavior.

**Architecture:** Keep all playground-specific logic in route-host modules under `src/routes/_playground/**`; the package surface under `src/lib/**` remains unchanged. The route owns native controls, provider state, actions, choices, and the store; pure presenters compile typed view state into Morphe `Node` trees; `MorpheRoot` renders only validated deterministic trees.

**Tech Stack:** SvelteKit + Svelte 5 runes, TypeScript strict, Morphe public `$lib` seams, Zod, Vitest SSR/server tests, Biome via `bun run lint`.

---

## Spec And Constraints

**Spec:** `docs/superpowers/specs/2026-06-23-coherent-morphe-playground-design.md`

**Branch:** `playground/coherent-workbench`

**Hard boundaries:**
- Do not add Sokrates-specific content, routes, endpoints, aliases, or assets.
- Do not export playground modules from `src/lib`.
- Do not deep-import private `src/lib/**` internals from route code; use `$lib` and `$lib/components`.
- Do not vendor `Ar9av/gemini-nano-chrome`; use direct browser feature detection for Chrome Prompt API.
- Do not let model output become a Morphe `Node` directly. Model output must pass `LocalAdaptiveDraft` validation and deterministic presentation.

## File Structure

Create:
- `src/routes/_playground/types.ts` — route-only view-model types and exhibit ids.
- `src/routes/_playground/exhibits.ts` — closed exhibit registry and option lists.
- `src/routes/_playground/validation.ts` — Zod contract for `LocalAdaptiveDraft` plus JSON-schema-like `responseConstraint`.
- `src/routes/_playground/fallback.ts` — deterministic fallback draft and diagnostics helpers.
- `src/routes/_playground/presenters.ts` — pure functions from typed playground state to Morphe `Node` trees and proof rail rows.
- `src/routes/_playground/local-ai.ts` — dependency-injected browser Prompt API adapter.
- `src/routes/_playground/validation.test.ts` — contract tests for local draft validation.
- `src/routes/_playground/presenters.test.ts` — SSR-oriented presenter coverage.
- `src/routes/_playground/local-ai.test.ts` — provider tests with fake Prompt API adapters.

Modify:
- `src/routes/substrate/+page.svelte` — host shell, native controls, `MorpheRoot` preview, proof rail, provider invocation.
- `src/routes/substrate/substrate-page.render.test.ts` — SSR assertions for the coherent workbench.

No package exports, schema artifacts, Python files, or static assets are required for the first slice.

---

### Task 1: Local Adaptive Draft Contract

**Files:**
- Create: `src/routes/_playground/validation.test.ts`
- Create: `src/routes/_playground/validation.ts`

- [ ] **Step 1: Write the failing validation tests**

Create `src/routes/_playground/validation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
	LOCAL_ADAPTIVE_DRAFT_RESPONSE_CONSTRAINT,
	validateLocalAdaptiveDraft,
} from "./validation.js";

const validDraft = {
	title: "Operational signal",
	summary: "A compact evidence-led panel for a local adaptive decision.",
	tone: "info",
	badges: ["local", "validated"],
	nextActionLabel: "Record review",
} as const;

describe("local adaptive draft validation", () => {
	it("accepts the bounded semantic draft used by the Prompt API exhibit", () => {
		const result = validateLocalAdaptiveDraft(validDraft);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.draft).toEqual(validDraft);
		}
	});

	it("rejects missing required fields with field diagnostics", () => {
		const result = validateLocalAdaptiveDraft({
			title: "Missing summary",
			tone: "info",
			badges: [],
			nextActionLabel: "Continue",
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.diagnostics.join(" ")).toContain("summary");
		}
	});

	it("rejects unknown tones", () => {
		const result = validateLocalAdaptiveDraft({ ...validDraft, tone: "urgent" });

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.diagnostics.join(" ")).toContain("tone");
		}
	});

	it("rejects overlong labels and non-string badges", () => {
		const result = validateLocalAdaptiveDraft({
			...validDraft,
			nextActionLabel:
				"This label is intentionally much longer than the native control can carry",
			badges: ["ok", 42],
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			const diagnostics = result.diagnostics.join(" ");
			expect(diagnostics).toContain("nextActionLabel");
			expect(diagnostics).toContain("badges.1");
		}
	});

	it("exports the same bounded object shape as the response constraint", () => {
		expect(LOCAL_ADAPTIVE_DRAFT_RESPONSE_CONSTRAINT).toMatchObject({
			type: "object",
			additionalProperties: false,
			required: ["title", "summary", "tone", "badges", "nextActionLabel"],
		});
	});
});
```

- [ ] **Step 2: Run the new test and verify it fails**

Run:

```bash
bunx vitest run src/routes/_playground/validation.test.ts
```

Expected: FAIL because `src/routes/_playground/validation.ts` does not exist.

- [ ] **Step 3: Implement the validation module**

Create `src/routes/_playground/validation.ts`:

```ts
import { z } from "zod";

const shortText = z.string().trim().min(1).max(48);
const summaryText = z.string().trim().min(1).max(220);
const badgeText = z.string().trim().min(1).max(24);

export const LOCAL_ADAPTIVE_DRAFT_RESPONSE_CONSTRAINT = Object.freeze({
	type: "object",
	additionalProperties: false,
	properties: {
		title: { type: "string", minLength: 1, maxLength: 48 },
		summary: { type: "string", minLength: 1, maxLength: 220 },
		tone: { type: "string", enum: ["info", "success", "caution"] },
		badges: {
			type: "array",
			maxItems: 4,
			items: { type: "string", minLength: 1, maxLength: 24 },
		},
		nextActionLabel: { type: "string", minLength: 1, maxLength: 48 },
	},
	required: ["title", "summary", "tone", "badges", "nextActionLabel"],
} as const);

export const localAdaptiveDraftSchema = z
	.object({
		title: shortText,
		summary: summaryText,
		tone: z.enum(["info", "success", "caution"]),
		badges: z.array(badgeText).max(4),
		nextActionLabel: shortText,
	})
	.strict();

export type LocalAdaptiveDraft = z.infer<typeof localAdaptiveDraftSchema>;

export type LocalAdaptiveTone = LocalAdaptiveDraft["tone"];

export interface LocalAdaptiveDraftValid {
	readonly ok: true;
	readonly draft: LocalAdaptiveDraft;
}

export interface LocalAdaptiveDraftInvalid {
	readonly ok: false;
	readonly diagnostics: readonly string[];
}

export type LocalAdaptiveDraftValidation =
	| LocalAdaptiveDraftValid
	| LocalAdaptiveDraftInvalid;

export function validateLocalAdaptiveDraft(input: unknown): LocalAdaptiveDraftValidation {
	const parsed = localAdaptiveDraftSchema.safeParse(input);
	if (parsed.success) {
		return { ok: true, draft: parsed.data };
	}
	return {
		ok: false,
		diagnostics: parsed.error.issues.map((issue) => {
			const path = issue.path.length === 0 ? "draft" : issue.path.join(".");
			return `draft-invalid:${path}:${issue.code}`;
		}),
	};
}
```

- [ ] **Step 4: Run the validation test and verify it passes**

Run:

```bash
bunx vitest run src/routes/_playground/validation.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit the validation contract**

Run:

```bash
git add src/routes/_playground/validation.ts src/routes/_playground/validation.test.ts
git commit -m "feat(playground): add local draft validation contract"
```

---

### Task 2: Exhibit Types, Fallbacks, And Presenters

**Files:**
- Create: `src/routes/_playground/types.ts`
- Create: `src/routes/_playground/exhibits.ts`
- Create: `src/routes/_playground/fallback.ts`
- Create: `src/routes/_playground/presenters.test.ts`
- Create: `src/routes/_playground/presenters.ts`

- [ ] **Step 1: Write presenter tests first**

Create `src/routes/_playground/presenters.test.ts`:

```ts
import { render } from "svelte/server";
import { describe, expect, it } from "vitest";
import type { JsonRecord } from "$lib";
import { MorpheRoot } from "$lib/components";
import { EXHIBITS } from "./exhibits.js";
import { FALLBACK_LOCAL_ADAPTIVE_DRAFT } from "./fallback.js";
import {
	presentLocalAdaptiveDraft,
	presentPinnedDialectProof,
	presentPlayground,
} from "./presenters.js";
import type { ExhibitId, ProviderSource } from "./types.js";

const baseInput = {
	activeExhibit: "grammar" as ExhibitId,
	grammarVariant: "layout",
	activeDialectId: "gallery",
	selectedVaryChoice: 0,
	actionLog: [] as readonly string[],
	storeSnapshot: {} as JsonRecord,
	localDraft: FALLBACK_LOCAL_ADAPTIVE_DRAFT,
	localSource: "fallback" as ProviderSource,
	localDiagnostics: ["fallback:not-requested"] as readonly string[],
};

describe("playground presenters", () => {
	it("renders every registered exhibit through MorpheRoot on the server", () => {
		for (const exhibit of EXHIBITS) {
			const presentation = presentPlayground({
				...baseInput,
				activeExhibit: exhibit.id,
			});

			const html = render(MorpheRoot, { props: { tree: presentation.tree } }).body;

			expect(html).toContain(exhibit.label);
			expect(presentation.proof.length).toBeGreaterThan(2);
		}
	});

	it("maps each local adaptive tone to a renderable Morphe feedback tree", () => {
		for (const tone of ["info", "success", "caution"] as const) {
			const tree = presentLocalAdaptiveDraft({
				...FALLBACK_LOCAL_ADAPTIVE_DRAFT,
				tone,
			});
			const html = render(MorpheRoot, { props: { tree } }).body;

			expect(html).toContain(`data-tone="${tone}"`);
		}
	});

	it("provides a pinned dialect proof tree separate from the main exhibit tree", () => {
		const html = render(MorpheRoot, { props: { tree: presentPinnedDialectProof() } }).body;

		expect(html).toContain("Pinned dialect boundary");
		expect(html).toContain("night");
	});
});
```

- [ ] **Step 2: Run the presenter test and verify it fails**

Run:

```bash
bunx vitest run src/routes/_playground/presenters.test.ts
```

Expected: FAIL because `_playground` presenter modules do not exist.

- [ ] **Step 3: Add shared route-host types**

Create `src/routes/_playground/types.ts`:

```ts
import type { JsonRecord, Node } from "$lib";
import type { LocalAdaptiveDraft } from "./validation.js";

export const EXHIBIT_IDS = ["grammar", "dialects", "state", "vary", "cms", "local-ai"] as const;
export type ExhibitId = (typeof EXHIBIT_IDS)[number];

export const GRAMMAR_VARIANTS = [
	"layout",
	"content",
	"input",
	"feedback",
	"overlay",
	"media",
] as const;
export type GrammarVariant = (typeof GRAMMAR_VARIANTS)[number];

export type ProviderSource =
	| "fallback"
	| "chrome-unavailable"
	| "chrome-downloading"
	| "chrome-live"
	| "sidecar";

export interface ExhibitDefinition {
	readonly id: ExhibitId;
	readonly label: string;
	readonly summary: string;
	readonly proofFocus: string;
}

export interface ProofRailItem {
	readonly label: string;
	readonly value: string;
}

export interface PlaygroundPresentationInput {
	readonly activeExhibit: ExhibitId;
	readonly grammarVariant: GrammarVariant;
	readonly activeDialectId: string;
	readonly selectedVaryChoice: number;
	readonly actionLog: readonly string[];
	readonly storeSnapshot: JsonRecord;
	readonly localDraft: LocalAdaptiveDraft;
	readonly localSource: ProviderSource;
	readonly localDiagnostics: readonly string[];
}

export interface PlaygroundPresentation {
	readonly tree: Node;
	readonly proof: readonly ProofRailItem[];
}
```

- [ ] **Step 4: Add the closed exhibit registry**

Create `src/routes/_playground/exhibits.ts`:

```ts
import { DIALECT_IDS } from "$lib";
import type { ExhibitDefinition, ExhibitId, GrammarVariant } from "./types.js";
import { EXHIBIT_IDS, GRAMMAR_VARIANTS } from "./types.js";

export const EXHIBITS: readonly ExhibitDefinition[] = Object.freeze([
	{
		id: "grammar",
		label: "Grammar Studio",
		summary: "Curated primitive families and their authored Node data.",
		proofFocus: "Node grammar",
	},
	{
		id: "dialects",
		label: "Dialect Lab",
		summary: "One authored tree re-themed through every shipped dialect.",
		proofFocus: "Intent remap",
	},
	{
		id: "state",
		label: "State + Actions",
		summary: "Bound paths and declarative action ids wired at the root.",
		proofFocus: "Host sockets",
	},
	{
		id: "vary",
		label: "Vary + Delta",
		summary: "Host-owned choices select a branch without mutating the tree.",
		proofFocus: "Choice map",
	},
	{
		id: "cms",
		label: "CMS Pipeline",
		summary: "Compiled preview and publication pointer proof surfaces.",
		proofFocus: "Compiled artifact",
	},
	{
		id: "local-ai",
		label: "Local AI Provider",
		summary: "Chrome Prompt API as progressive enhancement behind a small draft contract.",
		proofFocus: "Validated draft",
	},
]);

export const DEFAULT_EXHIBIT: ExhibitId = "grammar";
export const DEFAULT_GRAMMAR_VARIANT: GrammarVariant = "layout";
export const DIALECT_OPTIONS: readonly string[] = DIALECT_IDS;

export function isExhibitId(value: string): value is ExhibitId {
	return (EXHIBIT_IDS as readonly string[]).includes(value);
}

export function isGrammarVariant(value: string): value is GrammarVariant {
	return (GRAMMAR_VARIANTS as readonly string[]).includes(value);
}

export function exhibitFor(id: ExhibitId): ExhibitDefinition {
	const exhibit = EXHIBITS.find((candidate) => candidate.id === id);
	if (exhibit) return exhibit;
	throw new Error(`Unknown playground exhibit "${id}".`);
}
```

- [ ] **Step 5: Add deterministic fallback data**

Create `src/routes/_playground/fallback.ts`:

```ts
import type { LocalAdaptiveDraft } from "./validation.js";

export const FALLBACK_LOCAL_ADAPTIVE_DRAFT: LocalAdaptiveDraft = Object.freeze({
	title: "Deterministic adaptive panel",
	summary:
		"Chrome local AI is optional. Morphe still renders a schema-valid tree through the same presenter.",
	tone: "info",
	badges: ["fallback", "validated"],
	nextActionLabel: "Record fallback",
});

export function fallbackDiagnostics(reason: string): readonly string[] {
	return [`fallback:${reason}`];
}
```

- [ ] **Step 6: Implement pure presenters**

Create `src/routes/_playground/presenters.ts`:

```ts
import type { JsonRecord, Node } from "$lib";
import { exhibitFor } from "./exhibits.js";
import type {
	GrammarVariant,
	PlaygroundPresentation,
	PlaygroundPresentationInput,
	ProofRailItem,
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
			{ label: "actions", value: input.actionLog.length === 0 ? "none" : input.actionLog.join(", ") },
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
	return section("State + Actions", "Bound inputs write paths; buttons resolve opaque action ids.", [
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
	]);
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
```

- [ ] **Step 7: Run presenter tests and verify they pass**

Run:

```bash
bunx vitest run src/routes/_playground/presenters.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 8: Commit presenter modules**

Run:

```bash
git add src/routes/_playground/types.ts src/routes/_playground/exhibits.ts src/routes/_playground/fallback.ts src/routes/_playground/presenters.ts src/routes/_playground/presenters.test.ts
git commit -m "feat(playground): add coherent exhibit presenters"
```

---

### Task 3: Browser-Local AI Provider Adapter

**Files:**
- Create: `src/routes/_playground/local-ai.test.ts`
- Create: `src/routes/_playground/local-ai.ts`

- [ ] **Step 1: Write provider tests with fake adapters**

Create `src/routes/_playground/local-ai.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { FALLBACK_LOCAL_ADAPTIVE_DRAFT } from "./fallback.js";
import { generateLocalAdaptiveDraft } from "./local-ai.js";
import type { PromptLanguageModelApi } from "./local-ai.js";

const promptInput = {
	goal: "Review an exception queue",
	dialectId: "gallery",
} as const;

function fakeApi(
	availability: "unavailable" | "downloadable" | "downloading" | "available",
	response: string,
): PromptLanguageModelApi {
	return {
		async availability() {
			return availability;
		},
		async create() {
			return {
				async prompt() {
					return response;
				},
				destroy() {},
			};
		},
	};
}

describe("local AI provider", () => {
	it("falls back when no LanguageModel adapter is available", async () => {
		const result = await generateLocalAdaptiveDraft(promptInput, { api: undefined });

		expect(result.source).toBe("chrome-unavailable");
		expect(result.draft).toEqual(FALLBACK_LOCAL_ADAPTIVE_DRAFT);
		expect(result.diagnostics).toContain("chrome-unavailable:LanguageModel");
	});

	it("keeps deterministic preview active during model download states", async () => {
		const result = await generateLocalAdaptiveDraft(promptInput, {
			api: fakeApi("downloadable", "{}"),
		});

		expect(result.source).toBe("chrome-downloading");
		expect(result.diagnostics).toContain("chrome-downloading:downloadable");
	});

	it("returns a live draft after available Prompt API output passes validation", async () => {
		const result = await generateLocalAdaptiveDraft(promptInput, {
			api: fakeApi(
				"available",
				JSON.stringify({
					title: "Live local draft",
					summary: "Gemini Nano produced a bounded semantic draft.",
					tone: "success",
					badges: ["chrome", "validated"],
					nextActionLabel: "Use draft",
				}),
			),
		});

		expect(result.source).toBe("chrome-live");
		expect(result.draft.title).toBe("Live local draft");
		expect(result.diagnostics).toEqual(["chrome-live"]);
	});

	it("falls back on invalid JSON", async () => {
		const result = await generateLocalAdaptiveDraft(promptInput, {
			api: fakeApi("available", "{not-json"),
		});

		expect(result.source).toBe("fallback");
		expect(result.draft).toEqual(FALLBACK_LOCAL_ADAPTIVE_DRAFT);
		expect(result.diagnostics[0]).toContain("chrome-error:invalid-json");
	});

	it("falls back on schema-invalid draft output", async () => {
		const result = await generateLocalAdaptiveDraft(promptInput, {
			api: fakeApi("available", JSON.stringify({ title: "Missing fields" })),
		});

		expect(result.source).toBe("fallback");
		expect(result.diagnostics.join(" ")).toContain("draft-invalid");
	});

	it("falls back when create or prompt throws", async () => {
		const result = await generateLocalAdaptiveDraft(promptInput, {
			api: {
				async availability() {
					return "available";
				},
				async create() {
					throw new DOMException("blocked", "NotAllowedError");
				},
			},
		});

		expect(result.source).toBe("fallback");
		expect(result.diagnostics).toContain("chrome-error:NotAllowedError");
	});
});
```

- [ ] **Step 2: Run the provider test and verify it fails**

Run:

```bash
bunx vitest run src/routes/_playground/local-ai.test.ts
```

Expected: FAIL because `src/routes/_playground/local-ai.ts` does not exist.

- [ ] **Step 3: Implement the dependency-injected provider**

Create `src/routes/_playground/local-ai.ts`:

```ts
import { FALLBACK_LOCAL_ADAPTIVE_DRAFT } from "./fallback.js";
import type { ProviderSource } from "./types.js";
import {
	LOCAL_ADAPTIVE_DRAFT_RESPONSE_CONSTRAINT,
	validateLocalAdaptiveDraft,
} from "./validation.js";
import type { LocalAdaptiveDraft } from "./validation.js";

export type PromptAvailability = "unavailable" | "downloadable" | "downloading" | "available";

export interface PromptDownloadMonitor {
	addEventListener(type: "downloadprogress", listener: (event: Event) => void): void;
}

export interface PromptSession {
	prompt(input: string): Promise<string>;
	destroy?(): void;
}

export interface PromptLanguageModelApi {
	availability(): Promise<PromptAvailability> | PromptAvailability;
	create(options?: {
		readonly responseConstraint?: unknown;
		readonly monitor?: (monitor: PromptDownloadMonitor) => void;
	}): Promise<PromptSession>;
}

export interface LocalAiPromptInput {
	readonly goal: string;
	readonly dialectId: string;
}

export interface LocalAiProviderOptions {
	readonly api?: PromptLanguageModelApi;
}

export interface LocalAiGenerationResult {
	readonly source: ProviderSource;
	readonly draft: LocalAdaptiveDraft;
	readonly diagnostics: readonly string[];
}

interface GlobalLanguageModel {
	readonly LanguageModel?: PromptLanguageModelApi;
}

export function resolveBrowserLanguageModel(): PromptLanguageModelApi | undefined {
	if (typeof globalThis === "undefined") return undefined;
	return (globalThis as GlobalLanguageModel).LanguageModel;
}

export async function generateLocalAdaptiveDraft(
	input: LocalAiPromptInput,
	options: LocalAiProviderOptions = {},
): Promise<LocalAiGenerationResult> {
	const api = options.api ?? resolveBrowserLanguageModel();
	if (!api) {
		return fallbackResult("chrome-unavailable", ["chrome-unavailable:LanguageModel"]);
	}

	try {
		const availability = await api.availability();
		if (availability === "unavailable") {
			return fallbackResult("chrome-unavailable", ["chrome-unavailable:availability"]);
		}
		if (availability === "downloadable" || availability === "downloading") {
			return fallbackResult("chrome-downloading", [`chrome-downloading:${availability}`]);
		}

		const session = await api.create({
			responseConstraint: LOCAL_ADAPTIVE_DRAFT_RESPONSE_CONSTRAINT,
			monitor(monitor) {
				monitor.addEventListener("downloadprogress", () => {});
			},
		});

		try {
			const raw = await session.prompt(buildPrompt(input));
			let parsed: unknown;
			try {
				parsed = JSON.parse(raw);
			} catch {
				return fallbackResult("fallback", ["chrome-error:invalid-json"]);
			}

			const validation = validateLocalAdaptiveDraft(parsed);
			if (!validation.ok) {
				return fallbackResult("fallback", validation.diagnostics);
			}

			return {
				source: "chrome-live",
				draft: validation.draft,
				diagnostics: ["chrome-live"],
			};
		} finally {
			session.destroy?.();
		}
	} catch (error) {
		return fallbackResult("fallback", [`chrome-error:${errorName(error)}`]);
	}
}

function buildPrompt(input: LocalAiPromptInput): string {
	return [
		"You are generating a bounded semantic draft for the Morphe playground.",
		"Return only JSON matching the provided responseConstraint.",
		`Task goal: ${input.goal}`,
		`Active dialect: ${input.dialectId}`,
		"Use tone info, success, or caution. Keep badges short.",
	].join("\n");
}

function fallbackResult(source: ProviderSource, diagnostics: readonly string[]): LocalAiGenerationResult {
	return {
		source,
		draft: FALLBACK_LOCAL_ADAPTIVE_DRAFT,
		diagnostics,
	};
}

function errorName(error: unknown): string {
	if (error instanceof DOMException && error.name) return error.name;
	if (error instanceof Error && error.name) return error.name;
	return "unknown";
}
```

- [ ] **Step 4: Run provider tests and verify they pass**

Run:

```bash
bunx vitest run src/routes/_playground/local-ai.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit provider adapter**

Run:

```bash
git add src/routes/_playground/local-ai.ts src/routes/_playground/local-ai.test.ts
git commit -m "feat(playground): add browser local ai provider seam"
```

---

### Task 4: Integrate The Coherent `/substrate` Workbench

**Files:**
- Modify: `src/routes/substrate/substrate-page.render.test.ts`
- Modify: `src/routes/substrate/+page.svelte`

- [ ] **Step 1: Replace the route SSR test**

Replace `src/routes/substrate/substrate-page.render.test.ts` with:

```ts
import { render } from "svelte/server";
import { describe, expect, it } from "vitest";
import SubstratePage from "./+page.svelte";

describe("/substrate coherent playground", () => {
	it("SSR renders the workbench navigation, controls, preview, and proof rail", () => {
		const html = render(SubstratePage).body;

		expect(html).toContain("Morphe Workbench");
		expect(html).toContain("Grammar Studio");
		expect(html).toContain("Dialect Lab");
		expect(html).toContain("State + Actions");
		expect(html).toContain("Vary + Delta");
		expect(html).toContain("CMS Pipeline");
		expect(html).toContain("Local AI Provider");
		expect(html).toContain("Proof rail");
		expect(html).toContain("Chrome local AI unavailable");
		expect(html).toContain("Preview capability-page.demo/rev-001");
	});
});
```

- [ ] **Step 2: Run the route test and verify it fails against the current page**

Run:

```bash
bunx vitest run src/routes/substrate/substrate-page.render.test.ts
```

Expected: FAIL because the current `/substrate` page still renders the older adaptive lab.

- [ ] **Step 3: Replace the route script and markup with the workbench host**

Replace the `<script>` and markup portions of `src/routes/substrate/+page.svelte` with this code. Keep the style block replacement from Step 4 in the same file.

```svelte
<script lang="ts">
	import type { ActionMap, ChoiceMap, JsonRecord } from "$lib";
	import {
		activeDialect,
		createInMemoryMorpheStore,
		DEFAULT_DIALECT_ID,
		getDialect,
	} from "$lib";
	import { MorpheRoot } from "$lib/components";
	import { DIALECT_OPTIONS, EXHIBITS } from "../_playground/exhibits.js";
	import { FALLBACK_LOCAL_ADAPTIVE_DRAFT, fallbackDiagnostics } from "../_playground/fallback.js";
	import { generateLocalAdaptiveDraft } from "../_playground/local-ai.js";
	import { presentPinnedDialectProof, presentPlayground } from "../_playground/presenters.js";
	import type { ExhibitId, GrammarVariant, ProviderSource } from "../_playground/types.js";
	import { GRAMMAR_VARIANTS } from "../_playground/types.js";
	import type { LocalAdaptiveDraft } from "../_playground/validation.js";

	const store = createInMemoryMorpheStore({
		"playground.goal": "Review an exception queue",
		"playground.reviewed": false,
	});

	let activeExhibit = $state<ExhibitId>("grammar");
	let grammarVariant = $state<GrammarVariant>("layout");
	let selectedDialectId = $state(DEFAULT_DIALECT_ID);
	let selectedVaryChoice = $state(0);
	let actionLog = $state<readonly string[]>([]);
	let localGoal = $state("Review an exception queue");
	let localDraft = $state<LocalAdaptiveDraft>(FALLBACK_LOCAL_ADAPTIVE_DRAFT);
	let localSource = $state<ProviderSource>("chrome-unavailable");
	let localDiagnostics = $state<readonly string[]>(["chrome-unavailable:LanguageModel"]);
	let localBusy = $state(false);

	const choices = $derived<ChoiceMap>({ "demo.mode": selectedVaryChoice });
	const actions = $derived<ActionMap>({
		"demo.rotate": () => {
			selectedVaryChoice = (selectedVaryChoice + 1) % 3;
			recordAction("demo.rotate");
		},
		"demo.review": () => recordAction("demo.review"),
		"local-ai.next": () => recordAction("local-ai.next"),
	});
	const storeSnapshot = $derived<JsonRecord>(store.snapshot());
	const presentation = $derived(
		presentPlayground({
			activeExhibit,
			grammarVariant,
			activeDialectId: activeDialect.id,
			selectedVaryChoice,
			actionLog,
			storeSnapshot,
			localDraft,
			localSource,
			localDiagnostics,
		}),
	);

	function recordAction(id: string): void {
		actionLog = [id, ...actionLog].slice(0, 8);
	}

	function selectExhibit(id: ExhibitId): void {
		activeExhibit = id;
	}

	function setGrammarVariant(event: Event): void {
		const value = (event.currentTarget as HTMLSelectElement).value;
		if ((GRAMMAR_VARIANTS as readonly string[]).includes(value)) {
			grammarVariant = value as GrammarVariant;
		}
	}

	function setDialect(event: Event): void {
		const value = (event.currentTarget as HTMLSelectElement).value;
		selectedDialectId = value;
		activeDialect.setById(value);
	}

	function setVaryChoice(event: Event): void {
		selectedVaryChoice = Number((event.currentTarget as HTMLInputElement).value);
	}

	async function runLocalAi(): Promise<void> {
		localBusy = true;
		const result = await generateLocalAdaptiveDraft({
			goal: localGoal,
			dialectId: activeDialect.id,
		});
		localDraft = result.draft;
		localSource = result.source;
		localDiagnostics = result.diagnostics;
		localBusy = false;
	}

	function resetLocalAi(): void {
		localDraft = FALLBACK_LOCAL_ADAPTIVE_DRAFT;
		localSource = "fallback";
		localDiagnostics = fallbackDiagnostics("manual-reset");
	}
</script>

<svelte:head>
	<title>Morphe Playground</title>
	<meta
		name="description"
		content="A neutral Morphe workbench for typed Node rendering, dialect switching, CMS preview routes, actions, bindings, variation choices, and local adaptive fallback rendering."
	/>
</svelte:head>

<main class="workbench">
	<header class="workbench__mast">
		<p class="workbench__eyebrow">Morphe Workbench</p>
		<h1>Substrate under live pressure</h1>
		<p>
			One neutral playground for authored UI as data, dialects, context algebra, state
			sockets, variation, CMS publication, and adaptive providers.
		</p>
	</header>

	<div class="workbench__grid">
		<nav class="workbench__nav" aria-label="Playground exhibits">
			{#each EXHIBITS as exhibit (exhibit.id)}
				<button
					type="button"
					class:active={activeExhibit === exhibit.id}
					aria-current={activeExhibit === exhibit.id ? "page" : undefined}
					onclick={() => selectExhibit(exhibit.id)}
				>
					<span>{exhibit.label}</span>
					<small>{exhibit.summary}</small>
				</button>
			{/each}
		</nav>

		<section class="workbench__controls" aria-label="Exhibit controls">
			<h2>Controls</h2>
			{#if activeExhibit === "grammar"}
				<label class="field" for="grammar-variant">
					<span>Primitive family</span>
					<select id="grammar-variant" value={grammarVariant} onchange={setGrammarVariant}>
						{#each GRAMMAR_VARIANTS as variant (variant)}
							<option value={variant}>{variant}</option>
						{/each}
					</select>
				</label>
			{:else if activeExhibit === "dialects"}
				<label class="field" for="dialect-select">
					<span>Global dialect</span>
					<select id="dialect-select" value={selectedDialectId} onchange={setDialect}>
						{#each DIALECT_OPTIONS as dialectId (dialectId)}
							<option value={dialectId}>{dialectId}</option>
						{/each}
					</select>
				</label>
			{:else if activeExhibit === "state"}
				<p class="control-copy">Use the rendered Morphe inputs and buttons in the preview.</p>
			{:else if activeExhibit === "vary"}
				<label class="field" for="vary-choice">
					<span>Choice demo.mode</span>
					<input
						id="vary-choice"
						type="range"
						min="0"
						max="2"
						step="1"
						value={selectedVaryChoice}
						oninput={setVaryChoice}
					/>
				</label>
			{:else if activeExhibit === "cms"}
				<div class="link-stack">
					<a href="/preview/capability-page.demo/rev-001">Preview route</a>
					<a href="/p/demo">Published route</a>
				</div>
			{:else if activeExhibit === "local-ai"}
				<label class="field" for="local-goal">
					<span>Prompt goal</span>
					<textarea id="local-goal" rows="4" bind:value={localGoal}></textarea>
				</label>
				<div class="button-row">
					<button type="button" onclick={runLocalAi} disabled={localBusy}>
						{localBusy ? "Checking..." : "Try Chrome local AI"}
					</button>
					<button type="button" onclick={resetLocalAi}>Reset fallback</button>
				</div>
				<p class="control-copy">Chrome local AI unavailable unless the browser exposes LanguageModel.</p>
			{/if}
		</section>

		<section class="workbench__preview" aria-label="Morphe preview">
			<MorpheRoot tree={presentation.tree} store={store} actions={actions} choices={choices} />
			{#if activeExhibit === "dialects"}
				<div class="pinned">
					<MorpheRoot tree={presentPinnedDialectProof()} dialect={getDialect("night")} />
				</div>
			{/if}
		</section>

		<aside class="workbench__proof" aria-label="Proof rail">
			<h2>Proof rail</h2>
			<dl>
				{#each presentation.proof as item (item.label)}
					<div>
						<dt>{item.label}</dt>
						<dd>{item.value}</dd>
					</div>
				{/each}
			</dl>
		</aside>
	</div>
</main>
```

- [ ] **Step 4: Replace the route style block**

Replace the `<style>` block in `src/routes/substrate/+page.svelte` with:

```svelte
<style>
	.workbench {
		min-block-size: 100vh;
		background: var(--mo-intent-surface-base);
		color: var(--mo-intent-on-surface);
	}
	.workbench__mast {
		padding: clamp(var(--mo-space-6), 6vw, var(--mo-space-9))
			clamp(var(--mo-space-4), 5vw, var(--mo-space-8)) var(--mo-space-5);
		max-inline-size: 82rem;
		margin-inline: auto;
	}
	.workbench__eyebrow {
		margin: 0 0 var(--mo-space-2);
		font-family: var(--mo-font-mono);
		font-size: var(--mo-type-2);
		color: var(--mo-intent-accession-on);
	}
	.workbench__mast h1 {
		margin: 0;
		max-inline-size: 14ch;
		font-family: var(--mo-font-display);
		font-size: clamp(var(--mo-type-7), 6vw, var(--mo-type-9));
		line-height: var(--mo-leading-tight);
	}
	.workbench__mast p:last-child {
		max-inline-size: 64ch;
		margin: var(--mo-space-3) 0 0;
		font-size: var(--mo-type-4);
		line-height: var(--mo-leading-normal);
		color: var(--mo-intent-on-surface-muted);
	}
	.workbench__grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--mo-space-4);
		padding: 0 clamp(var(--mo-space-4), 5vw, var(--mo-space-8))
			clamp(var(--mo-space-6), 6vw, var(--mo-space-9));
		max-inline-size: 96rem;
		margin-inline: auto;
	}
	.workbench__nav,
	.workbench__controls,
	.workbench__proof {
		border: 1px solid var(--mo-intent-outline);
		border-radius: var(--mo-radius-2);
		background: var(--mo-intent-surface-raised);
	}
	.workbench__nav {
		display: grid;
		align-content: start;
		overflow: clip;
	}
	.workbench__nav button {
		display: grid;
		gap: var(--mo-space-1);
		inline-size: 100%;
		border: 0;
		border-block-end: 1px solid var(--mo-intent-outline);
		padding: var(--mo-space-3);
		background: transparent;
		color: inherit;
		text-align: start;
		font: inherit;
		cursor: pointer;
	}
	.workbench__nav button:last-child {
		border-block-end: 0;
	}
	.workbench__nav button:hover,
	.workbench__nav button.active {
		background: var(--mo-intent-surface-sunken);
	}
	.workbench__nav span {
		font-weight: 750;
	}
	.workbench__nav small,
	.control-copy,
	.workbench__proof dd {
		color: var(--mo-intent-on-surface-muted);
	}
	.workbench__controls,
	.workbench__proof {
		padding: var(--mo-space-4);
	}
	.workbench__controls h2,
	.workbench__proof h2 {
		margin: 0 0 var(--mo-space-3);
		font-size: var(--mo-type-4);
	}
	.field {
		display: grid;
		gap: var(--mo-space-2);
		font-size: var(--mo-type-3);
		font-weight: 700;
	}
	.field select,
	.field input,
	.field textarea,
	.button-row button,
	.link-stack a {
		box-sizing: border-box;
		inline-size: 100%;
		border: 1px solid var(--mo-intent-outline);
		border-radius: var(--mo-radius-2);
		padding: var(--mo-space-3);
		background: var(--mo-intent-surface-base);
		color: var(--mo-intent-on-surface);
		font: inherit;
	}
	.field textarea {
		resize: vertical;
	}
	.button-row,
	.link-stack {
		display: grid;
		gap: var(--mo-space-2);
	}
	.button-row button {
		cursor: pointer;
		font-weight: 750;
	}
	.button-row button:disabled {
		cursor: wait;
		opacity: 0.64;
	}
	.link-stack a {
		text-decoration: none;
	}
	.workbench__preview {
		min-inline-size: 0;
	}
	.workbench__preview :global(.mo-root) {
		min-block-size: 100%;
	}
	.pinned {
		margin-block-start: var(--mo-space-4);
		border: 1px solid var(--mo-intent-outline);
		border-radius: var(--mo-radius-2);
		overflow: clip;
	}
	.workbench__proof dl {
		display: grid;
		gap: var(--mo-space-3);
		margin: 0;
	}
	.workbench__proof div {
		display: grid;
		gap: var(--mo-space-1);
		padding-block-end: var(--mo-space-3);
		border-block-end: 1px solid var(--mo-intent-outline);
	}
	.workbench__proof div:last-child {
		padding-block-end: 0;
		border-block-end: 0;
	}
	.workbench__proof dt {
		font-family: var(--mo-font-mono);
		font-size: var(--mo-type-2);
		color: var(--mo-intent-accession-on);
	}
	.workbench__proof dd {
		margin: 0;
		overflow-wrap: anywhere;
		font-size: var(--mo-type-2);
	}
	@media (min-width: 72rem) {
		.workbench__grid {
			grid-template-columns: minmax(15rem, 0.8fr) minmax(16rem, 0.9fr) minmax(0, 2.4fr)
				minmax(14rem, 0.8fr);
			align-items: start;
		}
		.workbench__nav,
		.workbench__controls,
		.workbench__proof {
			position: sticky;
			inset-block-start: var(--mo-space-4);
		}
	}
</style>
```

- [ ] **Step 5: Run route SSR test**

Run:

```bash
bunx vitest run src/routes/substrate/substrate-page.render.test.ts
```

Expected: PASS, 1 test.

- [ ] **Step 6: Run focused playground tests**

Run:

```bash
bunx vitest run src/routes/_playground/validation.test.ts src/routes/_playground/presenters.test.ts src/routes/_playground/local-ai.test.ts src/routes/substrate/substrate-page.render.test.ts
```

Expected: PASS, 15 tests.

- [ ] **Step 7: Commit route integration**

Run:

```bash
git add src/routes/substrate/+page.svelte src/routes/substrate/substrate-page.render.test.ts
git commit -m "feat(playground): integrate coherent substrate workbench"
```

---

### Task 5: Gates, Build Smoke, And Boundary Scan

**Files:**
- No source files expected.
- Modify only if commands expose real failures from Tasks 1-4.

- [ ] **Step 1: Run formatter if Biome asks for changes**

Run:

```bash
bun run lint
```

Expected: PASS. If Biome reports fixable formatting, run:

```bash
bun run format
```

Then re-run:

```bash
bun run lint
```

Expected: PASS.

- [ ] **Step 2: Run Svelte type checking**

Run:

```bash
bun run check
```

Expected: PASS with `svelte-check found 0 errors and 0 warnings`.

- [ ] **Step 3: Run the full JavaScript test suite**

Run:

```bash
bun run test
```

Expected: PASS for the existing node suite, the existing DOM fixture suite, and the new playground tests.

- [ ] **Step 4: Run production build**

Run:

```bash
bun run build
```

Expected: PASS and Vite/SvelteKit emit the production build.

- [ ] **Step 5: Run the stale Sokrates-site boundary scan**

Run:

```bash
rg -n "src/app/(site|compose|server)|\\$site|\\$compose|\\$serverlib|/api/(rerank|contact|onboarding)|sokrates-mark|the-box|/images/plates|static/images/team" .
```

Expected: no matches.

- [ ] **Step 6: Run the full composed gate**

Run:

```bash
just gates
```

Expected: PASS for lint, check, test, build, py-test, py-lint, py-types, schema-check, and cms-schema-check.

- [ ] **Step 7: Start the local dev server for visual verification**

Run:

```bash
bun run dev -- --host 127.0.0.1
```

Expected: Vite prints a local URL, usually `http://127.0.0.1:5173/`.

- [ ] **Step 8: Verify the workbench in a browser**

Open `/substrate` at the Vite URL and verify:
- The first viewport is the workbench, not a landing page.
- The six exhibit nav items are visible and clickable.
- Each exhibit changes the Morphe preview.
- Dialect selection changes the global Morphe preview and the pinned proof remains night.
- State exhibit inputs render and action buttons update the proof rail after clicks.
- Vary range changes the selected branch.
- CMS links open `/preview/capability-page.demo/rev-001` and `/p/demo`.
- Local AI fallback is visible before Chrome Prompt API is available.
- Text does not overlap or overflow at desktop width and a narrow mobile viewport.

- [ ] **Step 9: Stop the dev server**

Use `Ctrl-C` in the dev-server terminal.

- [ ] **Step 10: Commit final verification fixes if any were required**

If Tasks 5.1-5.9 required source changes, run:

```bash
git add src/routes/_playground src/routes/substrate
git commit -m "fix(playground): tighten workbench verification"
```

Expected: commit only source/test changes caused by verification. If no source changes were needed, skip this commit.

---

## Self-Review Checklist

- Spec coverage:
  - Six exhibits: Task 2 and Task 4.
  - Local AI progressive enhancement: Task 1 and Task 3.
  - Deterministic presenter trust boundary: Task 2 and Task 3.
  - Proof rail: Task 2 and Task 4.
  - CMS proof routes: Task 2 and Task 4.
  - Full gates and stale-site scan: Task 5.
- Type consistency:
  - `ProviderSource` values match the spec: `fallback`, `chrome-unavailable`, `chrome-downloading`, `chrome-live`, `sidecar`.
  - `LocalAdaptiveDraft` fields match the spec exactly.
  - `ChoiceMap` key is `demo.mode`, matching the `Vary` node id.
  - `ActionMap` keys match the rendered Morphe buttons: `demo.rotate`, `demo.review`, `local-ai.next`.
- Scope:
  - No package exports.
  - No arbitrary Node editor.
  - No Sokrates content.
  - No Chrome extension or Origin Trial work.
