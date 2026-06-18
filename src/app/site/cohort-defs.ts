/**
 * THE SHIPPED COHORTS — the cohort DATA, kept apart from the machinery.
 *
 * `cohorts.ts` owns the registry, the gate, and the arrival/persistence logic;
 * THIS module owns the campaign data those mechanisms operate on. The seam is the
 * open/closed line: adding a cohort edits this file ONLY — never the registry. A
 * cohort selects a registered dialect (the gate rejects an unknown one) and a
 * `CohortCopyOverlay` — a partial statement over BASE_COPY (`copy.ts`). It overrides
 * only what it names and inherits the rest; FaqEntry stays atomic and `faq.order`
 * replaces wholesale, so `resolveCopy` is always total.
 *
 * Dialect assignments span six registers so the six cohorts read as six places,
 * not three (a cohort is a STANCE, but identical looks blur distinct audiences).
 * Three were minted for this expansion — `ledger` (teal), `estate` (copper),
 * `foundry` (steel) — alongside the shipped `reykjavik-registry`, `clinical`, and
 * default `gallery`. New registers land as dialects first (CONTRACT.md §8), then a
 * cohort selects them here.
 */

import type { Cohort } from "./cohorts.js";

/**
 * pharma-sovereign — regulated drug-development companies that mandate Sovereign
 * deployment for IP reasons. Wears the `clinical` dialect (the regulated/GxP
 * console register). Copy leads with the IP/sovereignty pitch: local inference
 * only, no outbound inference calls; the rest of the site copy is inherited.
 */
export const PHARMA_SOVEREIGN: Cohort = {
	id: "pharma-sovereign",
	dialect: "clinical",
	copy: {
		nav: { cta: "Discuss sovereign deployment" },
		composer: {
			lede: "Name the friction and the systems you run. Sókrates returns the cross-system moves that fit — every one on local inference, your IP never leaving the building.",
			painPlaceholder:
				"e.g. assay results sit in the LIMS, batch records in the MES, and QA reconciles them by hand before every release",
		},
		contact: {
			operationPlaceholder:
				"e.g. a LIMS for assays, an ELN for studies, and a validated QMS that can't go to the cloud.",
		},
		meta: {
			title: "Sókrates — A sovereign AI department for drug development",
			description:
				"An on-premises AI department for regulated drug development. Local inference only, no outbound inference calls: your pipeline IP is reasoned over where it lives and never sent to a cloud model. Every act on a signed, auditable record.",
		},
		hero: {
			title: "A sovereign AI department for drug development.",
			lede: "Sókrates runs your cross-system operational work on a Sovereign appliance on your premises, on local inference — no outbound inference calls, ever. Your compounds, assays and trial data are read and acted on where they already live, and never sent to a model in the cloud. Tell it what runs your operation, and see what it takes on.",
		},
		closingCta: {
			sub: "Bring the workflow your IP constraints have kept off every cloud tool. Thirty minutes is enough to see Sókrates run it without your data leaving the building.",
		},
		faq: {
			entries: {
				"data-residency": {
					q: "Can our IP — compounds, assays, trial data — stay in-house?",
					a: "It never leaves. The appliance is installed inside your network and runs on local inference only — no outbound inference calls at all. A roughly 200-billion-parameter model runs on the box itself; your data is reasoned over where it already lives. No cloud model ever sees your pipeline.",
				},
				"no-shared-model": {
					q: "Could a model trained elsewhere ever see our pipeline?",
					a: "Never. The Sovereign appliance calls no externally hosted model, and nothing from your environment trains a shared one. The weights live on the box; your data stays on the box.",
				},
				"validation-audit": {
					q: "How does it hold up to validation and an audit?",
					a: "Every action is a typed act with a named owner and a signed authority record, and the full causal tree of each act is preserved as one auditable record: who did what, under whose authorization, with what data, in what order. The audit trail is the substrate itself, not a report bolted on after — built for the evidence standard your validation and QA teams already work to.",
				},
			},
			order: [
				"data-residency",
				"no-shared-model",
				"validation-audit",
				"what-if-wrong",
				"exit",
				"chatgpt-diff",
				"mid-migration",
			],
		},
	},
};

/**
 * finance-controls — CFO / controller / risk buyer. Wears the `ledger` dialect (the
 * teal financial-controls register). Stance: governed finance operations, audit
 * evidence, a read-by-default posture that opens write-side action only under named
 * authority.
 */
export const FINANCE_CONTROLS: Cohort = {
	id: "finance-controls",
	dialect: "ledger",
	copy: {
		nav: { cta: "Discuss controls" },
		composer: {
			lede: "Name the finance friction and the systems behind it. Sókrates returns the cross-system moves that fit — read by default, every act on an audit record.",
			painPlaceholder:
				"e.g. month-end reconciliation crosses the ERP, the bank file and three spreadsheets, and one controller carries it",
		},
		contact: {
			operationPlaceholder:
				"e.g. an ERP for the ledger, a bank portal for statements, and spreadsheets for the close.",
		},
		meta: {
			title: "Sókrates for financial controls",
			description:
				"A governed, on-premises AI department for finance teams that need cross-system answers, audit evidence and controlled action across ERP, CRM, banking files and spreadsheets.",
		},
		hero: {
			title: "A governed AI department for financial operations.",
			lede: "Sókrates reads the systems behind close, billing, collections and approvals, then turns recurring finance questions into cited answers and controlled workflows. Read by default. Propose with evidence. Act only under authority.",
		},
		closingCta: {
			heading: "Bring one financial control that still lives in a person.",
			sub: "A reconciliation, approval path or month-end exception is enough to test whether Sókrates can carry the work without weakening the controls.",
		},
		faq: {
			order: ["finance-writes", "audit-evidence", "reconciliation-start", "data-residency", "exit"],
			entries: {
				"finance-writes": {
					q: "Can it change financial records?",
					a: "Not by default. The first posture is read and draft: Sókrates shows the source evidence, proposes the action and waits at the approval gate. Write-side action only opens for classes of work you authorise.",
				},
				"audit-evidence": {
					q: "What does audit see?",
					a: "The useful answer is not just the result. Sókrates keeps the source rows, the reasoned path, the actor, the approval and the finished act together as one record.",
				},
				"reconciliation-start": {
					q: "Where would we start?",
					a: "Start with a recurring exception: invoice mismatches, late collections, customer-credit checks, month-end accrual questions or approvals that keep crossing email, ERP and spreadsheets.",
				},
				"data-residency": {
					q: "Our financial data cannot leave our control.",
					a: "The appliance is installed on your premises. The sovereign posture uses local inference and keeps the operating record under your custody.",
				},
				exit: {
					q: "What happens if we stop?",
					a: "Clean exit. Your operational extracts, map, rule contracts, approval history and evidence record remain yours. The managed department ends; ownership of the record does not.",
				},
			},
		},
	},
};

/**
 * public-sector-sovereign — agencies, municipalities, public bodies. Wears the
 * `reykjavik-registry` dialect. Stance: local custody, the public record, local
 * inference and an approval trail before any work moves.
 */
export const PUBLIC_SECTOR_SOVEREIGN: Cohort = {
	id: "public-sector-sovereign",
	dialect: "reykjavik-registry",
	copy: {
		nav: { cta: "Review data custody" },
		composer: {
			lede: "Name the operational friction and the systems behind it. Sókrates returns the cross-system moves that fit — local custody, every answer cited to the record.",
			painPlaceholder:
				"e.g. a case status crosses the casework system, the finance ledger and a procurement tool, and a clerk stitches it together",
		},
		contact: {
			operationPlaceholder:
				"e.g. a casework system, a finance ledger, and a procurement tool — all kept on-premises.",
		},
		meta: {
			title: "Sókrates for sovereign public operations",
			description:
				"An on-premises AI department for public bodies that need cross-system answers, local custody, source evidence and a record for every authorised act.",
		},
		hero: {
			title: "Sovereign AI for public operations.",
			lede: "Sókrates answers operational questions across casework, finance, procurement and reporting systems while keeping custody local. It cites the records behind the answer and leaves an authority trail before work moves.",
		},
		closingCta: {
			heading: "Bring one public workflow that crosses systems.",
			sub: "A backlog report, procurement exception, finance handoff or case-status question is enough to see whether Sókrates can help without weakening custody.",
		},
		faq: {
			order: ["citizen-data", "public-record", "procurement-control", "what-if-wrong", "exit"],
			entries: {
				"citizen-data": {
					q: "Does citizen or agency data leave our network?",
					a: "This cohort assumes the sovereign configuration: the appliance is installed on your premises and uses local inference. Sensitive records are not sent to a generic cloud model to make the system useful.",
				},
				"public-record": {
					q: "Can the result become part of the public record?",
					a: "Sókrates is designed to keep the answer tied to its source evidence, actor, approval and action history. That gives a records team something inspectable instead of an unsupported model transcript.",
				},
				"procurement-control": {
					q: "Can it work inside procurement constraints?",
					a: "The right wedge is not a broad automation programme. Start with one recurring operational question and keep action behind human approval until the authority model is proven.",
				},
				"what-if-wrong": {
					q: "What happens if it gets something wrong?",
					a: "Human approval remains the default trust posture. Sókrates can answer and draft from evidence; controlled actions pause at the gates you set.",
				},
				exit: {
					q: "What if we need to leave?",
					a: "The hardware, operational extracts, map, rule contracts, evidence and approval history remain under your custody. The service can end without taking the record with it.",
				},
			},
		},
	},
};

/**
 * healthcare-operations — healthcare OPERATIONS, never clinical decision support.
 * Wears the `clinical` dialect. Stance: scheduling, procurement, billing, staffing,
 * records requests and patient-data custody — the work around care, not the care.
 */
export const HEALTHCARE_OPERATIONS: Cohort = {
	id: "healthcare-operations",
	dialect: "clinical",
	copy: {
		nav: { cta: "Map one workflow" },
		composer: {
			lede: "Name the operational friction around care and the systems behind it. Sókrates returns the cross-system moves that fit — operations, never clinical judgement.",
			painPlaceholder:
				"e.g. a roster change crosses the scheduling system, the HR tool and payroll, and a coordinator reconciles it by hand",
		},
		contact: {
			operationPlaceholder:
				"e.g. a scheduling system, an HR and rota tool, a billing system, and records requests in between.",
		},
		meta: {
			title: "Sókrates for healthcare operations",
			description:
				"A governed, on-premises AI department for healthcare operations: scheduling, procurement, billing, staffing and records workflows with local custody and approval gates.",
		},
		hero: {
			title: "An AI department for healthcare operations, not clinical judgement.",
			lede: "Sókrates helps with the work around care: scheduling, purchasing, billing, staffing, records requests and approvals. It runs on-premises, cites the operational records behind each answer and pauses controlled action for human approval.",
		},
		closingCta: {
			heading: "Bring one operational workflow around care.",
			sub: "Start with scheduling drift, procurement exceptions, billing handoffs or a records request that crosses systems. The first test should be useful without touching clinical judgement.",
		},
		faq: {
			order: [
				"not-clinical-decision",
				"patient-data",
				"approval-gates",
				"healthcare-start",
				"exit",
			],
			entries: {
				"not-clinical-decision": {
					q: "Does Sókrates make clinical decisions?",
					a: "No. This cohort should keep the boundary explicit: operational workflows only. Diagnosis, treatment, triage and clinical judgement stay outside the marketing promise.",
				},
				"patient-data": {
					q: "What happens to patient data?",
					a: "The sovereign posture keeps the appliance on your premises and uses local inference. The working assumption is that sensitive records stay under your custody.",
				},
				"approval-gates": {
					q: "Can it act without approval?",
					a: "The first posture is answer and draft. Controlled actions pause at the gates you set, with the source evidence and proposed act visible before anything changes.",
				},
				"healthcare-start": {
					q: "Where would we start?",
					a: "Choose a workflow around care rather than inside clinical judgement: rota changes, purchasing exceptions, billing status, records requests or operational reporting.",
				},
				exit: {
					q: "What if we leave?",
					a: "The operational extracts, map, rule contracts, evidence and approval history remain yours. The managed department ends; custody of the record does not.",
				},
			},
		},
	},
};

/**
 * industrial-quality — manufacturing / quality / maintenance. Wears the `foundry`
 * dialect (the steel industrial register). Stance: deviations, shortages, CAPA-like
 * workflows, QMS-adjacent evidence without pretending to replace the QMS.
 */
export const INDUSTRIAL_QUALITY: Cohort = {
	id: "industrial-quality",
	dialect: "foundry",
	copy: {
		nav: { cta: "Bring one exception" },
		composer: {
			lede: "Name the exception and the systems behind it. Sókrates returns the cross-system moves that fit — evidence-bearing, without replacing your QMS.",
			painPlaceholder:
				"e.g. a deviation crosses the QMS, the ERP and a maintenance log, and one senior operator carries the evidence",
		},
		contact: {
			operationPlaceholder:
				"e.g. a QMS for deviations, an ERP for inventory, an MES on the line, and a maintenance log.",
		},
		meta: {
			title: "Sókrates for industrial quality",
			description:
				"A governed, on-premises AI department for industrial operators that need evidence-bearing workflows across QMS, ERP, MES, maintenance, inventory and approvals.",
		},
		hero: {
			title: "An AI department for controlled industrial work.",
			lede: "Sókrates connects the systems around production, quality, maintenance and finance, then turns recurring exceptions into evidence-bearing workflows. It shows the source records, proposes the next move and acts only under the authority you grant.",
		},
		closingCta: {
			heading: "Bring one exception that keeps leaving the system.",
			sub: "A deviation, shortage, maintenance handoff or quality approval is enough to test whether Sókrates can carry the work on the record.",
		},
		faq: {
			order: ["quality-scope", "deviation-start", "evidence-chain", "data-residency", "exit"],
			entries: {
				"quality-scope": {
					q: "Is this a quality system?",
					a: "No. Sókrates is an operating layer around the systems you already run. It can help route evidence, propose governed actions and preserve the record, but it does not replace your QMS.",
				},
				"deviation-start": {
					q: "Where would we start?",
					a: "Start where work leaves the system: deviations, shortages, maintenance follow-up, supplier exceptions, document approvals or production questions that require three records and one senior operator.",
				},
				"evidence-chain": {
					q: "Can it preserve the evidence chain?",
					a: "That is the point. The answer should carry source records, reasoned path, approval and resulting action together, so the next person is not reconstructing the story from chat and screenshots.",
				},
				"data-residency": {
					q: "Can this run inside our environment?",
					a: "The appliance is installed on your premises. The sovereign posture keeps inference and operating history local.",
				},
				exit: {
					q: "What happens if we stop?",
					a: "Your extracts, map, rule contracts, evidence and approval history remain yours. The managed department can end without trapping the operating record.",
				},
			},
		},
	},
};

/**
 * rollup-integration — PE / platform / acquisition-heavy operators. Wears the
 * `estate` dialect (the copper roll-up/holdings register). Stance: one governed
 * operating map across inherited systems, before / during / after migration —
 * migration is the wedge, not the bill.
 */
export const ROLLUP_INTEGRATION: Cohort = {
	id: "rollup-integration",
	dialect: "estate",
	copy: {
		nav: { cta: "Map the estate" },
		composer: {
			lede: "Name the post-close question and the systems behind it. Sókrates returns the cross-system moves that fit — one operating map across what each company already runs.",
			painPlaceholder:
				"e.g. a revenue question crosses three companies' ERPs, two CRMs and a pile of spreadsheets, post-close",
		},
		contact: {
			operationPlaceholder:
				"e.g. three inherited ERPs, two CRMs, and the spreadsheets holding the platform together.",
		},
		meta: {
			title: "Sókrates for roll-up integration",
			description:
				"An on-premises AI department for acquisition-heavy operators that need one governed operating map across inherited systems before, during and after migration.",
		},
		hero: {
			title: "One operating map across the companies you bought.",
			lede: "Sókrates sits across inherited ERPs, finance tools, CRMs, project systems and spreadsheets, then answers the questions the platform needs without forcing every company through one migration first.",
		},
		closingCta: {
			heading: "Bring one post-close question you still answer by hand.",
			sub: "Revenue status, working-capital exceptions, vendor exposure or staffing commitments are enough to test whether Sókrates can map the estate without making migration the first move.",
		},
		faq: {
			order: [
				"no-migration-first",
				"multi-entity-evidence",
				"operating-controls",
				"mid-migration",
				"exit",
			],
			entries: {
				"no-migration-first": {
					q: "Do we need to migrate first?",
					a: "No. The wedge is the opposite: build a governed operating map across what each company already runs, then keep the same questions intact before, during and after cutover.",
				},
				"multi-entity-evidence": {
					q: "Can it handle different systems in each business?",
					a: "That is the roll-up problem. Sókrates maps the sources by scope and keeps the evidence tied to the system and entity it came from.",
				},
				"operating-controls": {
					q: "Can platform controls differ by company?",
					a: "Yes in the model. The point is not one blunt rule everywhere; it is named authority, scoped evidence and controlled action for each class of work.",
				},
				"mid-migration": {
					q: "We're mid-migration. We can't take on another project.",
					a: "The migration is the wedge. Sókrates provides semantic continuity across it: the same operational questions, the same evidence posture, before, during and after cutover.",
				},
				exit: {
					q: "What happens if we leave?",
					a: "The operating map, extracts, rule contracts, evidence and approval history remain yours. No hostage-taking around the one record the platform needs most.",
				},
			},
		},
	},
};

/**
 * midmarket-ops — broad founder-led / operator-led midmarket. Wears the default
 * `gallery` dialect (this is closest to the base pitch). Stance: the senior-person
 * bottleneck and the work between systems.
 */
export const MIDMARKET_OPS: Cohort = {
	id: "midmarket-ops",
	dialect: "gallery",
	copy: {
		nav: { cta: "Map one workflow" },
		composer: {
			lede: "Name the friction and the systems you run. Sókrates returns the cross-system moves that fit — the work between systems that keeps landing on one person.",
			painPlaceholder:
				"e.g. a won deal stalls before delivery because the CRM, the project tool and finance never quite line up",
		},
		contact: {
			operationPlaceholder:
				"e.g. a CRM for sales, a project tool for delivery, payroll for the team, and spreadsheets in between.",
		},
		meta: {
			title: "Sókrates for midmarket operations",
			description:
				"An on-premises AI department for companies whose cross-system work still depends on one senior operator, too many spreadsheets and too many handoffs.",
		},
		hero: {
			title: "Give the work between your systems a department.",
			lede: "Sókrates connects the CRM, ERP, workforce tools, project systems and spreadsheets that actually run the company. It answers recurring operational questions with evidence, proposes the next move and waits for authority before controlled work happens.",
		},
		closingCta: {
			heading: "Bring one workflow that still needs the person who knows everything.",
			sub: "A staffing handoff, invoice delay, won-deal stall or reporting question is enough to see whether Sókrates can carry the work between systems.",
		},
		faq: {
			order: [
				"not-another-tool",
				"senior-person-bottleneck",
				"where-start",
				"what-if-wrong",
				"exit",
			],
			entries: {
				"not-another-tool": {
					q: "Is this another tool for people to remember?",
					a: "The useful shape is the opposite. Sókrates is there for the work between systems: the recurring questions, handoffs and approvals that people currently reconstruct by memory.",
				},
				"senior-person-bottleneck": {
					q: "What if the problem is one person knowing everything?",
					a: "That is the clearest use case. Sókrates turns the hidden operating map into something inspectable: which systems matter, which evidence supports the answer and what authority is needed to act.",
				},
				"where-start": {
					q: "Where would we start?",
					a: "Start with one recurring drag: won deals that stall before delivery, payroll changes that miss the roster, invoices waiting on context or a weekly report one person rebuilds by hand.",
				},
				"what-if-wrong": {
					q: "What happens if it gets something wrong?",
					a: "Human approval is the default trust posture. Sókrates can answer and draft from evidence; controlled actions wait at the gates you set.",
				},
				exit: {
					q: "What if we want to leave?",
					a: "Clean exit. The hardware is yours; your operational data is yours. We deliver a portable custody export of your extracts, operating map, rule contracts, evidence and approval history.",
				},
			},
		},
	},
};

/**
 * The shipped cohorts, in registration order. Adding a cohort = define it above
 * and list it here; the registry and the gate need no change (open/closed).
 */
export const SITE_COHORTS: readonly Cohort[] = [
	PHARMA_SOVEREIGN,
	FINANCE_CONTROLS,
	PUBLIC_SECTOR_SOVEREIGN,
	HEALTHCARE_OPERATIONS,
	INDUSTRIAL_QUALITY,
	ROLLUP_INTEGRATION,
	MIDMARKET_OPS,
];
