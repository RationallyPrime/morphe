/**
 * The onboarding DOSSIER (KRA-371) — the visitor's intake as a typed record.
 *
 * The marketing claim is "Sókrates reads the systems you already run and
 * compiles them into a typed map"; this module performs that claim on the
 * visitor's own answers. The wizard (a native control surface) owns the draft;
 * this presenter turns each draft into a Morphe record tree — the registry
 * aesthetic: a continuous accession sequence, folio markers, marginalia, and
 * the seal register (its first use anywhere on the site) once the server
 * witnesses receipt.
 *
 * Two Vary points carry ALL morphing, so every movement is gated by applyDelta:
 *   - DOSSIER_STAGE_ID    open(0) ↔ sealed(1)   — submit success seals.
 *   - DOSSIER_SYSTEMS_ID  ledger(0) ↔ compact(1) — the mid loop re-sets the
 *     systems section as the named-system count grows (dossier-midloop.ts).
 *
 * Pure functions returning Node — no clock, no RNG, no I/O (receipt/sealedAt
 * are passed in; the server owns minting). Raw grammar primitives only: no
 * CompoundRefs (nothing to smuggle through string fields) and no Input
 * primitives (the record is render-only; controls stay native).
 */

import { SYSTEMS, type System } from "$compose";
import type { EmissionEnvelope, EmphasisClaim, IntentRef, Node, Text, VaryId } from "$lib";

/* ---------------------------------------------------------------------------
 * The draft shape (mirrors the wizard's state — the wizard imports these).
 * ------------------------------------------------------------------------- */

export interface DossierContact {
	readonly name: string;
	readonly title: string;
	readonly email: string;
	readonly phone: string;
	readonly company: string;
	readonly website: string;
}

export interface DossierSystem {
	readonly name: string;
	readonly vendor: string;
	readonly deployment: string;
	readonly role: string;
	readonly criticality: string;
}

export interface DossierDraft {
	readonly contact: DossierContact;
	readonly systems: readonly DossierSystem[];
	readonly priorities: ReadonlyArray<{ readonly workflow: string }>;
	readonly outcomes: string;
}

export type DossierStep = "contact" | "systems" | "priorities" | "outcomes";

export interface DossierOpts {
	/** The wizard step in focus — its section header reads as the active one. */
	readonly activeStep?: DossierStep;
	/** The server-minted accession id; its presence authors the sealed branch's badge. */
	readonly receipt?: string;
	/** Pre-formatted seal date line (presenters carry no clock). */
	readonly sealedAt?: string;
}

/* ---------------------------------------------------------------------------
 * Variation points — the only movement the record permits.
 * ------------------------------------------------------------------------- */

export const DOSSIER_STAGE_ID = "onboarding-dossier-stage" as VaryId;
export const DOSSIER_STAGE_CHOICES = { open: 0, sealed: 1 } as const;

export const DOSSIER_SYSTEMS_ID = "onboarding-dossier-systems" as VaryId;
export const DOSSIER_SYSTEMS_CHOICES = { ledger: 0, compact: 1 } as const;

/* ---------------------------------------------------------------------------
 * Grounding — recognize systems Sókrates already reads (the SYSTEMS registry).
 * Conservative by design: an exact label/id hit, a curated alias, a whole-token
 * hit for one-word labels, or a substring hit for multi-word labels. Vendor
 * field first (the more precise signal), then the visitor's own name for it.
 * ------------------------------------------------------------------------- */

const VENDOR_ALIASES: Readonly<Record<string, string>> = {
	dk: "dkplus",
	"dk+": "dkplus",
	"dk plus": "dkplus",
	bc: "businesscentral",
	dynamics: "businesscentral",
	"dynamics 365": "businesscentral",
	d365: "businesscentral",
	navision: "businesscentral",
	"twenty crm": "twenty",
	"jira cloud": "jira",
	"jira software": "jira",
	"fifty skills": "50skills",
};

function normalized(raw: string): string {
	return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

/** The registered system a draft entry grounds to, or null when unrecognized. */
export function groundedSystem(entry: {
	readonly name: string;
	readonly vendor: string;
}): System | null {
	for (const raw of [entry.vendor, entry.name]) {
		const text = normalized(raw);
		if (!text) continue;
		const aliased = VENDOR_ALIASES[text];
		if (aliased !== undefined) {
			return SYSTEMS.find((s) => s.id === aliased) ?? null;
		}
		for (const sys of SYSTEMS) {
			const label = sys.label.toLowerCase();
			if (text === label || text === sys.id) return sys;
			const wholeToken = !label.includes(" ") && text.split(" ").includes(label);
			const multiWord = label.includes(" ") && text.includes(label);
			if (wholeToken || multiWord) return sys;
		}
	}
	return null;
}

/* ---------------------------------------------------------------------------
 * Record-side vocabulary — how the registry names the wizard's select values.
 * ------------------------------------------------------------------------- */

const DEPLOYMENT_LABELS: Readonly<Record<string, string>> = {
	cloud_saas: "Cloud / SaaS",
	on_premise: "On-premise",
	hybrid: "Hybrid",
};

const ROLE_LABELS: Readonly<Record<string, string>> = {
	source_of_record: "System of record",
	consumer: "Consumer",
	internal_tool: "Internal tool",
	unknown: "Role uncertain",
};

const CRITICALITY_LABELS: Readonly<Record<string, string>> = {
	critical: "Critical",
	important: "Important",
	secondary: "Secondary",
};

/* ---------------------------------------------------------------------------
 * Authoring helpers — the same local idiom as morph-stage.ts.
 * ------------------------------------------------------------------------- */

type TextAs = NonNullable<Text["as"]>;
type TextExtra = { readonly emphasis?: EmphasisClaim; readonly intent?: IntentRef };

function t(value: string, as: TextAs, extra?: TextExtra): Node {
	return { kind: "text", value, as, ...extra };
}

function folio(label: string): Node {
	return { kind: "badge", label, intent: "folio" };
}

function eyebrow(value: string, active: boolean): Node {
	return t(value, "caption", { intent: "accession", ...(active ? { emphasis: "strong" } : {}) });
}

function inline(children: readonly Node[]): Node {
	return { kind: "cluster", role: "inline", align: "baseline", children };
}

function section(children: readonly Node[]): Node {
	return { kind: "stack", role: "section", direction: "block", children };
}

function panel(children: readonly Node[]): Node {
	return {
		kind: "frame",
		role: "section",
		surface: "raised",
		budget: 3,
		children: [section(children)],
	};
}

/** The continuous accession counter — one sequence through the whole record. */
function accessionCounter(): () => string {
	let n = 0;
	return () => {
		n += 1;
		return String(n).padStart(3, "0");
	};
}

function compact<T>(items: ReadonlyArray<T | null | undefined | false | "">): T[] {
	return items.filter((x): x is T => Boolean(x));
}

/* ---------------------------------------------------------------------------
 * Sections — each renders only when it has content. One shared spine builds
 * both branches so open and sealed can never diverge on the record itself.
 * ------------------------------------------------------------------------- */

function contactSection(contact: DossierContact, active: boolean, next: () => string): Node | null {
	const company = contact.company.trim();
	const name = contact.name.trim();
	if (!company && !name) return null;
	const title = contact.title.trim();
	const person = company && name ? `${name}${title ? `, ${title}` : ""}` : title;
	const reach = compact([contact.email.trim(), contact.phone.trim(), contact.website.trim()]).join(
		" · ",
	);
	return section(
		compact([
			eyebrow("Contact", active),
			inline([folio(next()), t(company || name, "subheading", { emphasis: "strong" })]),
			person ? t(person, "caption", { emphasis: "muted" }) : null,
			reach ? t(reach, "caption", { emphasis: "muted" }) : null,
		]),
	);
}

function systemFacts(s: DossierSystem): string {
	return compact([
		s.vendor.trim(),
		DEPLOYMENT_LABELS[s.deployment],
		ROLE_LABELS[s.role],
		CRITICALITY_LABELS[s.criticality],
	]).join(" · ");
}

function groundingLine(s: DossierSystem): Node | null {
	const grounded = groundedSystem(s);
	if (!grounded) return null;
	return t(`Sókrates already reads ${grounded.label} — grounding on file.`, "caption", {
		intent: "provenance",
	});
}

function ledgerEntry(s: DossierSystem, num: string): Node {
	const facts = systemFacts(s);
	return section(
		compact([
			inline(
				compact([
					folio(num),
					t(s.name.trim(), "subheading", { emphasis: "strong" }),
					s.criticality === "critical"
						? { kind: "badge", label: "Critical", intent: "caution" }
						: null,
				]),
			),
			facts ? t(facts, "caption", { emphasis: "muted" }) : null,
			groundingLine(s),
		]),
	);
}

function compactEntry(s: DossierSystem, num: string): Node {
	const facts = systemFacts(s);
	const grounded = groundedSystem(s);
	return section(
		compact([
			inline([folio(num), t(s.name.trim(), "body", { emphasis: "strong" })]),
			facts ? t(facts, "caption", { emphasis: "muted" }) : null,
			grounded ? t("Grounded.", "caption", { intent: "provenance" }) : null,
		]),
	);
}

function systemsSection(
	systems: readonly DossierSystem[],
	active: boolean,
	next: () => string,
): Node | null {
	const named = systems.filter((s) => s.name.trim().length > 0);
	if (named.length === 0) return null;
	const numbered = named.map((s) => [s, next()] as const);
	return section([
		eyebrow("The operation", active),
		{
			kind: "vary",
			id: DOSSIER_SYSTEMS_ID,
			default: DOSSIER_SYSTEMS_CHOICES.ledger,
			options: [
				{
					kind: "stack",
					role: "list",
					direction: "block",
					children: numbered.map(([s, num]) => ledgerEntry(s, num)),
				},
				{
					kind: "grid",
					role: "list",
					minTrack: "narrow",
					children: numbered.map(([s, num]) => compactEntry(s, num)),
				},
			],
		},
	]);
}

function prioritiesSection(
	priorities: ReadonlyArray<{ readonly workflow: string }>,
	active: boolean,
	next: () => string,
): Node | null {
	const workflows = priorities.map((p) => p.workflow.trim()).filter((w) => w.length > 0);
	if (workflows.length === 0) return null;
	return section([
		eyebrow("Where it hurts", active),
		...workflows.map((w) => inline([folio(next()), t(w, "body", { emphasis: "muted" })])),
	]);
}

function outcomesSection(outcomes: string, active: boolean, next: () => string): Node | null {
	const value = outcomes.trim();
	if (!value) return null;
	return section([
		eyebrow("What good looks like", active),
		inline([folio(next()), t(value, "body", { emphasis: "muted" })]),
	]);
}

function recordSections(draft: DossierDraft, activeStep?: DossierStep): Node[] {
	const next = accessionCounter();
	return compact([
		contactSection(draft.contact, activeStep === "contact", next),
		systemsSection(draft.systems, activeStep === "systems", next),
		prioritiesSection(draft.priorities, activeStep === "priorities", next),
		outcomesSection(draft.outcomes, activeStep === "outcomes", next),
	]);
}

/* ---------------------------------------------------------------------------
 * The two branches.
 * ------------------------------------------------------------------------- */

function openRecord(draft: DossierDraft, opts: DossierOpts): Node {
	const sections = recordSections(draft, opts.activeStep);
	const note =
		sections.length === 0
			? "Nothing on file yet. The record assembles itself as you answer — nothing leaves this page until you submit."
			: "A draft, building as you answer. Nothing is sent until you submit.";
	return panel([
		{
			kind: "cluster",
			role: "inline",
			justify: "between",
			align: "baseline",
			children: [eyebrow("The intake record", false), folio("DRAFT")],
		},
		...sections,
		{ kind: "spacer", size: "sm" },
		t(note, "caption", { intent: "marginalia" }),
	]);
}

function sealedRecord(draft: DossierDraft, opts: DossierOpts): Node {
	const sealedLine = opts.sealedAt ? `Sealed ${opts.sealedAt}.` : null;
	return panel(
		compact([
			{
				kind: "cluster",
				role: "inline",
				justify: "between",
				align: "baseline",
				children: [
					eyebrow("The intake record", false),
					{ kind: "badge", label: opts.receipt ?? "RECEIVED", intent: "seal" },
				],
			},
			{
				kind: "status",
				tone: "success",
				signal: { text: "Received and on file", icon: "task_alt" },
			},
			...recordSections(draft),
			{ kind: "spacer", size: "sm" },
			sealedLine ? t(sealedLine, "caption", { emphasis: "muted" }) : null,
			t("Hákon reads every record himself. Expect a reply within two working days.", "caption", {
				intent: "marginalia",
			}),
		]),
	);
}

/* ---------------------------------------------------------------------------
 * The public surface.
 * ------------------------------------------------------------------------- */

/** The pure record tree: one stage Vary, open by default, sealed by delta. */
export function dossierTree(draft: DossierDraft, opts: DossierOpts = {}): Node {
	return {
		kind: "vary",
		id: DOSSIER_STAGE_ID,
		default: DOSSIER_STAGE_CHOICES.open,
		options: [openRecord(draft, opts), sealedRecord(draft, opts)],
	};
}

/** A fresh emission envelope for the wizard to install around the record. */
export function dossierEnvelope(
	draft: DossierDraft,
	opts: DossierOpts = {},
	epoch = 1,
): EmissionEnvelope {
	return { epoch, tree: dossierTree(draft, opts), choices: {} };
}
