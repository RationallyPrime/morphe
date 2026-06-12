<script lang="ts">
/*
 * Onboarding — the guided intake flow. A native control surface (outside any
 * Morphe tree) styled from the --mo-* tokens: a four-step wizard (Contact ->
 * Systems -> Priorities -> Outcomes) with a clickable stepper, debounced
 * localStorage draft persistence (so a reload or a phone interruption never
 * loses progress), and a submit that posts to /api/onboarding (founder alert via
 * Postmark email + ntfy). On a delivery failure it offers a mailto fallback so an
 * intake is never lost. The magic-link gate (ADR-0001) lives in the route, not
 * here: the page passes the verified token (sent along on submit) and the
 * gate-verified email as a prefill.
 *
 * THE DOSSIER (KRA-370): beside the wizard, a MorpheRoot renders the visitor's
 * intake as a typed record, re-emitted per draft change (the slow loop). The
 * wizard mirrors tier-1 interaction into a MorpheStore; the dossier mid loop
 * reads the digest and proposes the systems section's ledger↔compact movement;
 * submit success seals the record — every movement gated by applyDelta, the
 * sealed record pinned to the night dialect (the vitrine idiom, "filed into
 * the archive"). The wizard stays native; the record tree carries no inputs.
 */
import { onMount } from "svelte";
import type { ChoiceMap, EmissionEnvelope } from "$lib";
import {
	applyDelta,
	commitTier1,
	createInMemoryMorpheStore,
	digestOf,
	liveVaryIds,
	night,
} from "$lib";
import { MorpheRoot } from "$lib/components";
import { DOSSIER_STAGE_CHOICES, DOSSIER_STAGE_ID, dossierEnvelope } from "./dossier.js";
import {
	createDossierMidLoop,
	DOSSIER_NAMED_SYSTEMS_PATH,
	DOSSIER_STEP_PATH,
} from "./dossier-midloop.js";

let {
	token = null,
	prefillEmail = null,
}: { token?: string | null; prefillEmail?: string | null } = $props();

const FOUNDER_EMAIL = "hakon@sokrates.is";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DRAFT_KEY = "sokrates-onboarding-draft-v1";
const MAX_PRIORITIES = 3;

type StepId = "contact" | "systems" | "priorities" | "outcomes";
const STEPS: readonly { id: StepId; label: string }[] = [
	{ id: "contact", label: "Contact" },
	{ id: "systems", label: "Systems" },
	{ id: "priorities", label: "Priorities" },
	{ id: "outcomes", label: "Outcomes" },
];

const DEPLOYMENTS = [
	{ value: "", label: "Deployment…" },
	{ value: "cloud_saas", label: "Cloud / SaaS" },
	{ value: "on_premise", label: "On-premise" },
	{ value: "hybrid", label: "Hybrid" },
];
const ROLES = [
	{ value: "", label: "Its role…" },
	{ value: "source_of_record", label: "System of record" },
	{ value: "consumer", label: "Consumer" },
	{ value: "internal_tool", label: "Internal tool" },
	{ value: "unknown", label: "Not sure" },
];
const CRITICALITIES = [
	{ value: "", label: "How critical…" },
	{ value: "critical", label: "Critical" },
	{ value: "important", label: "Important" },
	{ value: "secondary", label: "Secondary" },
];

interface SystemEntry {
	name: string;
	vendor: string;
	deployment: string;
	role: string;
	criticality: string;
}
const blankSystem = (): SystemEntry => ({
	name: "",
	vendor: "",
	deployment: "",
	role: "",
	criticality: "",
});

let contact = $state({
	name: "",
	title: "",
	email: "",
	phone: "",
	company: "",
	website: "",
});
let systems = $state<SystemEntry[]>([blankSystem()]);
let priorities = $state<{ workflow: string }[]>([{ workflow: "" }]);
let outcomes = $state("");
let stepIndex = $state(0);
let status = $state<"editing" | "submitting" | "done" | "error">("editing");

const current = $derived(STEPS[stepIndex]);

// --- the dossier (KRA-370) ----------------------------------------------
// The record's tier-1 store: the wizard (native chrome) mirrors interaction
// into it via commitTier1, so the mid loop has a real digest to read.
const store = createInMemoryMorpheStore();
let receipt = $state<string | null>(null);
let sealedAt = $state<string | null>(null);

// The slow loop: each draft change re-emits a fresh envelope. The epoch is a
// plain monotonic counter (not reactive state) bumped per emission — ADR-0004,
// epochs live host-side and are consumed by applyDelta before render.
let emission = 0;
const envelope = $derived.by<EmissionEnvelope>(() => {
	emission += 1;
	return dossierEnvelope(
		{
			contact: { ...contact },
			systems: systems.map((s) => ({ ...s })),
			priorities: priorities.map((p) => ({ ...p })),
			outcomes,
		},
		{
			...(current ? { activeStep: current.id } : {}),
			...(receipt !== null ? { receipt } : {}),
			...(sealedAt !== null ? { sealedAt } : {}),
		},
		emission,
	);
});

const midLoop = createDossierMidLoop(() => envelope.epoch);

// The one ack sentence the seal adds (a real minted id only — the "RECEIVED"
// fallback would read as noise).
const receiptLine = $derived(
	receipt !== null && receipt !== "RECEIVED" ? `Your record is sealed as intake ${receipt}. ` : "",
);

// The gate: the seal delta (submit success) and the mid loop's proposals both
// pass through applyDelta against the live emission; a rejected delta leaves
// the envelope reference untouched, so nothing broken can ever render.
const choices = $derived.by<ChoiceMap>(() => {
	let env = envelope;
	if (receipt !== null) {
		const sealed = applyDelta(env, {
			id: DOSSIER_STAGE_ID,
			choice: DOSSIER_STAGE_CHOICES.sealed,
			epoch: env.epoch,
		});
		if (sealed.result === "applied") env = sealed.envelope;
	}
	for (const delta of midLoop.propose(digestOf(store), liveVaryIds(env.tree))) {
		const applied = applyDelta(env, delta);
		if (applied.result === "applied") env = applied.envelope;
	}
	return env.choices;
});

// The tier-1 mirror: named-system count + active step, committed only on real
// change (commitTier1 records an event per call; same-value re-commits would
// flood the bounded window).
let lastNamed = -1;
let lastStep: StepId | null = null;
$effect(() => {
	const named = systems.filter((s) => s.name.trim().length > 0).length;
	if (named !== lastNamed) {
		lastNamed = named;
		commitTier1(store, DOSSIER_NAMED_SYSTEMS_PATH, "filter-edit", named);
	}
	const step = current?.id ?? null;
	if (step !== null && step !== lastStep) {
		lastStep = step;
		commitTier1(store, DOSSIER_STEP_PATH, "selection", step);
	}
});

// --- validation ---------------------------------------------------------
const emailValid = $derived(EMAIL_RE.test(contact.email.trim()));
const contactValid = $derived(
	contact.name.trim().length > 0 &&
		emailValid &&
		contact.company.trim().length > 0,
);
const systemsValid = $derived(systems.some((s) => s.name.trim().length > 0));
const outcomesValid = $derived(outcomes.trim().length > 1);

function stepValid(id: StepId): boolean {
	switch (id) {
		case "contact":
			return contactValid;
		case "systems":
			return systemsValid;
		case "priorities":
			return true; // optional but encouraged
		case "outcomes":
			return outcomesValid;
	}
}
const canNext = $derived(current ? stepValid(current.id) : false);
const canSubmit = $derived(
	contactValid && systemsValid && outcomesValid && status !== "submitting",
);

// --- system / priority row management -----------------------------------
function addSystem(): void {
	systems = [...systems, blankSystem()];
}
function removeSystem(i: number): void {
	systems =
		systems.length > 1 ? systems.filter((_, idx) => idx !== i) : systems;
}
function addPriority(): void {
	if (priorities.length < MAX_PRIORITIES)
		priorities = [...priorities, { workflow: "" }];
}
function removePriority(i: number): void {
	priorities =
		priorities.length > 1
			? priorities.filter((_, idx) => idx !== i)
			: priorities;
}

// --- navigation ---------------------------------------------------------
function goTo(i: number): void {
	stepIndex = Math.min(Math.max(0, i), STEPS.length - 1);
}
function next(): void {
	if (canNext) goTo(stepIndex + 1);
}
function back(): void {
	goTo(stepIndex - 1);
}

// --- draft persistence --------------------------------------------------
onMount(() => {
	try {
		const raw = localStorage.getItem(DRAFT_KEY);
		if (raw) {
			const d = JSON.parse(raw) as Partial<{
				contact: typeof contact;
				systems: SystemEntry[];
				priorities: { workflow: string }[];
				outcomes: string;
				stepIndex: number;
			}>;
			if (d.contact) contact = { ...contact, ...d.contact };
			if (Array.isArray(d.systems) && d.systems.length > 0) {
				systems = d.systems.map((s) => ({ ...blankSystem(), ...s }));
			}
			if (Array.isArray(d.priorities) && d.priorities.length > 0) {
				priorities = d.priorities.map((p) => ({
					workflow: typeof p.workflow === "string" ? p.workflow : "",
				}));
			}
			if (typeof d.outcomes === "string") outcomes = d.outcomes;
			if (typeof d.stepIndex === "number")
				stepIndex = Math.min(Math.max(0, d.stepIndex), STEPS.length - 1);
		}
	} catch {
		// A corrupt draft is discarded silently — start fresh.
	}
	// Gate-verified prefill: runs on a fresh visit (no draft) AND after a draft
	// restore, but never clobbers an email the visitor typed themselves.
	if (!contact.email.trim() && prefillEmail) contact.email = prefillEmail;
});

// Debounced autosave. $effect skips SSR, so the draft is client-only.
$effect(() => {
	const snapshot = JSON.stringify(
		$state.snapshot({ contact, systems, priorities, outcomes, stepIndex }),
	);
	if (typeof localStorage === "undefined" || status === "done") return;
	const id = setTimeout(() => {
		try {
			localStorage.setItem(DRAFT_KEY, snapshot);
		} catch {
			// Storage full / blocked — non-fatal.
		}
	}, 400);
	return () => clearTimeout(id);
});

function clearDraft(): void {
	try {
		localStorage.removeItem(DRAFT_KEY);
	} catch {
		// non-fatal
	}
}

function startOver(): void {
	contact = {
		name: "",
		title: "",
		email: "",
		phone: "",
		company: "",
		website: "",
	};
	systems = [blankSystem()];
	priorities = [{ workflow: "" }];
	outcomes = "";
	stepIndex = 0;
	status = "editing";
	receipt = null;
	sealedAt = null;
	clearDraft();
}

// --- submit -------------------------------------------------------------
const mailtoHref = $derived(
	`mailto:${FOUNDER_EMAIL}?subject=${encodeURIComponent(
		`Sókrates onboarding — ${contact.company.trim() || contact.email.trim()}`,
	)}&body=${encodeURIComponent(outcomes.trim() || "Our operation runs on:")}`,
);

async function submit(): Promise<void> {
	if (!canSubmit) return;
	status = "submitting";
	try {
		const res = await fetch("/api/onboarding", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				contact: $state.snapshot(contact),
				systems: systems
					.filter((s) => s.name.trim().length > 0)
					.map((s) => $state.snapshot(s)),
				priorities: priorities
					.filter((p) => p.workflow.trim().length > 0)
					.map((p) => $state.snapshot(p)),
				outcomes: outcomes.trim(),
				...(token ? { token } : {}),
			}),
		});
		const data = (await res.json().catch(() => ({}))) as { ok?: boolean; receipt?: string };
		if (res.ok && data.ok) {
			receipt = typeof data.receipt === "string" ? data.receipt : "RECEIVED";
			sealedAt = new Date().toLocaleDateString("en-GB", {
				day: "numeric",
				month: "long",
				year: "numeric",
			});
			status = "done";
			clearDraft();
		} else {
			status = "error";
		}
	} catch {
		status = "error";
	}
}
</script>

<div class="onb-layout">
	<div class="onb-flow">
		{#if status === "done"}
			<div class="ack" role="status" aria-live="polite">
				<span class="ack__glyph material-symbols-outlined" aria-hidden="true">task_alt</span>
				<div>
					<p class="ack__title">Received. We have your intake.</p>
					<p class="ack__body">
						{receiptLine}Hákon reviews each one by hand and replies within a couple of working
						days, usually with the first questions Sókrates would ask about your systems.
					</p>
					<button class="ghost" type="button" onclick={startOver}>Submit another</button>
				</div>
			</div>
		{:else}
			<div class="onb">
		<!-- Stepper -->
		<ol class="strip" aria-label="Onboarding steps">
			{#each STEPS as step, i (step.id)}
				<li class="strip__item">
					<button
						class="strip__btn"
						type="button"
						data-state={i === stepIndex ? "active" : stepValid(step.id) ? "done" : "todo"}
						aria-current={i === stepIndex ? "step" : undefined}
						onclick={() => goTo(i)}
					>
						<span class="strip__num">{String(i + 1).padStart(2, "0")}</span>
						<span class="strip__label">{step.label}</span>
					</button>
				</li>
			{/each}
		</ol>

		<div class="panel">
			{#if current?.id === "contact"}
				<h2 class="panel__title">Who are we talking to?</h2>
				<p class="panel__lede">The basics, so we can reach you.</p>
				<div class="grid2">
					<div class="field">
						<label class="field__label" for="onb-name">Your name</label>
						<input id="onb-name" class="field__input" type="text" autocomplete="name" bind:value={contact.name} />
					</div>
					<div class="field">
						<label class="field__label" for="onb-title">Your title</label>
						<input id="onb-title" class="field__input" type="text" autocomplete="organization-title" bind:value={contact.title} />
					</div>
					<div class="field">
						<label class="field__label" for="onb-email">Email</label>
						<input id="onb-email" class="field__input" type="email" autocomplete="email" required bind:value={contact.email} />
					</div>
					<div class="field">
						<label class="field__label" for="onb-phone">Phone</label>
						<input id="onb-phone" class="field__input" type="tel" autocomplete="tel" bind:value={contact.phone} />
					</div>
					<div class="field">
						<label class="field__label" for="onb-company">Company</label>
						<input id="onb-company" class="field__input" type="text" autocomplete="organization" required bind:value={contact.company} />
					</div>
					<div class="field">
						<label class="field__label" for="onb-website">Website</label>
						<input id="onb-website" class="field__input" type="url" autocomplete="url" placeholder="https://" bind:value={contact.website} />
					</div>
				</div>
			{:else if current?.id === "systems"}
				<h2 class="panel__title">What runs the operation?</h2>
				<p class="panel__lede">
					The systems Sókrates would read. The ERP, the finance stack, the CRM, the rosters, the
					spreadsheets that actually run the place. Add as many as matter.
				</p>
				<div class="rows">
					{#each systems as system, i (i)}
						<fieldset class="row">
							<legend class="row__legend">System {i + 1}</legend>
							<div class="grid2">
								<div class="field">
									<label class="field__label" for={`sys-name-${i}`}>What you call it</label>
									<input id={`sys-name-${i}`} class="field__input" type="text" bind:value={system.name} />
								</div>
								<div class="field">
									<label class="field__label" for={`sys-vendor-${i}`}>Vendor / product</label>
									<input id={`sys-vendor-${i}`} class="field__input" type="text" placeholder="e.g. dkPlus, Humanity, Twenty" bind:value={system.vendor} />
								</div>
								<div class="field">
									<label class="field__label" for={`sys-deploy-${i}`}>Deployment</label>
									<select id={`sys-deploy-${i}`} class="field__input" bind:value={system.deployment}>
										{#each DEPLOYMENTS as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
									</select>
								</div>
								<div class="field">
									<label class="field__label" for={`sys-role-${i}`}>Role</label>
									<select id={`sys-role-${i}`} class="field__input" bind:value={system.role}>
										{#each ROLES as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
									</select>
								</div>
								<div class="field">
									<label class="field__label" for={`sys-crit-${i}`}>Criticality</label>
									<select id={`sys-crit-${i}`} class="field__input" bind:value={system.criticality}>
										{#each CRITICALITIES as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
									</select>
								</div>
							</div>
							{#if systems.length > 1}
								<button class="row__remove" type="button" onclick={() => removeSystem(i)}>Remove</button>
							{/if}
						</fieldset>
					{/each}
				</div>
				<button class="ghost" type="button" onclick={addSystem}>
					<span class="material-symbols-outlined" aria-hidden="true">add</span> Add another system
				</button>
			{:else if current?.id === "priorities"}
				<h2 class="panel__title">Where does it hurt first?</h2>
				<p class="panel__lede">
					Up to three workflows that eat a senior calendar today. Plain language is best, e.g. "the
					monthly close takes three days of reconciling between systems".
				</p>
				<div class="rows">
					{#each priorities as priority, i (i)}
						<div class="field">
							<label class="field__label" for={`pri-${i}`}>Workflow {i + 1}</label>
							<div class="row__inline">
								<textarea id={`pri-${i}`} class="field__input" rows="2" bind:value={priority.workflow}></textarea>
								{#if priorities.length > 1}
									<button class="row__remove" type="button" onclick={() => removePriority(i)} aria-label={`Remove workflow ${i + 1}`}>
										<span class="material-symbols-outlined" aria-hidden="true">close</span>
									</button>
								{/if}
							</div>
						</div>
					{/each}
				</div>
				{#if priorities.length < MAX_PRIORITIES}
					<button class="ghost" type="button" onclick={addPriority}>
						<span class="material-symbols-outlined" aria-hidden="true">add</span> Add a workflow
					</button>
				{/if}
			{:else if current?.id === "outcomes"}
				<h2 class="panel__title">What would good look like?</h2>
				<p class="panel__lede">
					The outcomes you would judge this by in six months. Be concrete: hours reclaimed, the close
					cut from three days to half a day, errors that stop reaching customers.
				</p>
				<div class="field">
					<label class="field__label" for="onb-outcomes">Desired outcomes</label>
					<textarea id="onb-outcomes" class="field__input" rows="6" required bind:value={outcomes}></textarea>
				</div>
			{/if}
		</div>

		<!-- Footer controls -->
		<div class="controls">
			<div class="controls__left">
				{#if stepIndex > 0}
					<button class="ghost" type="button" onclick={back}>
						<span class="material-symbols-outlined" aria-hidden="true">arrow_back</span> Back
					</button>
				{/if}
				<button class="ghost ghost--quiet" type="button" onclick={startOver}>Start over</button>
			</div>
			<div class="controls__right">
				{#if stepIndex < STEPS.length - 1}
					<button class="primary" type="button" onclick={next} disabled={!canNext}>
						Next <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
					</button>
				{:else}
					<button class="primary" type="button" onclick={submit} disabled={!canSubmit}>
						{status === "submitting" ? "Sending…" : "Submit intake"}
					</button>
				{/if}
			</div>
		</div>

				{#if status === "error"}
					<p class="err" role="alert">
						Something went wrong sending that. Email
						<a class="err__link" href={mailtoHref}>{FOUNDER_EMAIL}</a> and we will pick it up directly.
					</p>
				{/if}
			</div>
		{/if}
	</div>

	<!-- The record: render-only Morphe tree (the wizard is the control surface).
	     Deliberately NOT aria-live — it rebuilds per keystroke; the ack's status
	     region carries the one seal announcement. Sealed pins the night dialect:
	     the record is filed into the archive while the page keeps its ground. -->
	<aside class="onb-record" aria-label="Your intake record">
		<MorpheRoot
			tree={envelope.tree}
			{choices}
			{store}
			dialect={receipt !== null ? night : undefined}
		/>
	</aside>
</div>

<style>
	/* The two tracks: the wizard (the work) and the record (the proof). One
	   column on narrow viewports — the record follows the form; side by side
	   once there is room to watch it build. */
	.onb-layout {
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--mo-space-6);
		align-items: start;
	}
	.onb-flow {
		min-inline-size: 0;
	}
	.onb-record {
		min-inline-size: 0;
	}
	@media (min-width: 64rem) {
		.onb-layout {
			grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
		}
		.onb-record {
			position: sticky;
			inset-block-start: var(--mo-space-6);
		}
	}

	.onb {
		display: flex;
		flex-direction: column;
		gap: var(--mo-space-6);
	}

	/* Stepper */
	.strip {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--mo-space-2);
	}
	.strip__item {
		flex: 1 1 8rem;
	}
	.strip__btn {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: var(--mo-space-1);
		align-items: flex-start;
		padding: var(--mo-space-3) var(--mo-space-4);
		border: 0;
		border-radius: var(--mo-radius-2);
		background: var(--mo-intent-surface-raised);
		outline: 1px solid var(--mo-intent-outline);
		outline-offset: -1px;
		cursor: pointer;
		text-align: start;
		transition: outline-color 0.16s ease;
	}
	.strip__btn[data-state="active"] {
		outline-color: var(--mo-intent-primary-action-surface);
	}
	.strip__btn:focus-visible {
		outline: 2px solid var(--mo-intent-primary-action-ring);
		outline-offset: 1px;
	}
	.strip__num {
		font-family: var(--mo-font-mono);
		font-size: var(--mo-type-1);
		letter-spacing: 0.08em;
		color: var(--mo-intent-on-surface-muted);
	}
	.strip__btn[data-state="active"] .strip__num,
	.strip__btn[data-state="done"] .strip__num {
		color: var(--mo-intent-accession-on);
	}
	.strip__label {
		font-family: var(--mo-font-body);
		font-size: var(--mo-type-3);
		font-weight: 500;
		color: var(--mo-intent-on-surface);
	}

	.panel__title {
		margin: 0 0 var(--mo-space-2);
		font-family: var(--mo-font-display);
		font-size: var(--mo-type-6);
		font-weight: 500;
		letter-spacing: -0.01em;
		color: var(--mo-intent-on-surface);
	}
	.panel__lede {
		margin: 0 0 var(--mo-space-5);
		max-inline-size: 60ch;
		font-family: var(--mo-font-body);
		font-size: var(--mo-type-4);
		line-height: 1.55;
		color: var(--mo-intent-on-surface-muted);
	}

	.grid2 {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
		gap: var(--mo-space-4);
	}
	.rows {
		display: flex;
		flex-direction: column;
		gap: var(--mo-space-5);
		margin-block-end: var(--mo-space-4);
	}
	.row {
		margin: 0;
		padding: var(--mo-space-5);
		border: 0;
		border-radius: var(--mo-radius-3);
		background: var(--mo-intent-surface-raised);
		outline: 1px solid var(--mo-intent-outline);
		outline-offset: -1px;
	}
	.row__legend {
		padding: 0 var(--mo-space-2);
		margin-inline-start: calc(-1 * var(--mo-space-2));
		font-family: var(--mo-font-mono);
		font-size: var(--mo-type-1);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--mo-intent-accession-on);
	}
	.row__remove {
		margin-block-start: var(--mo-space-4);
		appearance: none;
		border: 0;
		background: transparent;
		color: var(--mo-intent-on-surface-muted);
		font-family: var(--mo-font-mono);
		font-size: var(--mo-type-2);
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: var(--mo-space-1);
	}
	.row__remove:hover {
		color: var(--mo-intent-caution-on);
	}
	.row__inline {
		display: flex;
		gap: var(--mo-space-3);
		align-items: flex-start;
	}
	.row__inline .field__input {
		flex: 1 1 auto;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--mo-space-2);
	}
	.field__label {
		font-family: var(--mo-font-mono);
		font-size: var(--mo-type-2);
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--mo-intent-on-surface-muted);
	}
	/* biome-ignore lint/style/noDescendingSpecificity: `.row__inline .field__input` above only sets flex and wins on specificity by design; the base rule lives with the .field block. */
	.field__input {
		width: 100%;
		padding: var(--mo-space-3) var(--mo-space-4);
		border: 0;
		border-radius: var(--mo-radius-2);
		background: var(--mo-intent-surface-base);
		color: var(--mo-intent-on-surface);
		font-family: var(--mo-font-body);
		font-size: var(--mo-type-4);
		line-height: 1.5;
		outline: 1px solid var(--mo-intent-outline);
		outline-offset: -1px;
		resize: vertical;
	}
	.field__input::placeholder {
		color: var(--mo-intent-on-surface-muted);
		opacity: 1;
	}
	.field__input:focus-visible {
		outline: 2px solid var(--mo-intent-primary-action-ring);
		outline-offset: 1px;
	}

	.controls {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--mo-space-4);
		flex-wrap: wrap;
	}
	.controls__left,
	.controls__right {
		display: flex;
		gap: var(--mo-space-3);
		align-items: center;
	}

	.primary {
		display: inline-flex;
		align-items: center;
		gap: var(--mo-space-2);
		appearance: none;
		border: 0;
		cursor: pointer;
		padding: var(--mo-space-3) var(--mo-space-6);
		min-block-size: 2.75rem;
		border-radius: var(--mo-radius-3);
		background: var(--mo-intent-primary-action-surface);
		color: var(--mo-intent-primary-action-on);
		font-family: var(--mo-font-body);
		font-size: var(--mo-type-4);
		font-weight: 600;
		transition: background-color 0.16s ease;
	}
	.primary:hover:not(:disabled) {
		background: var(--mo-intent-primary-action-hover);
	}
	.primary:disabled {
		background: var(--mo-intent-primary-action-disabled);
		cursor: default;
	}
	.primary:focus-visible {
		outline: 2px solid var(--mo-intent-primary-action-ring);
		outline-offset: 2px;
	}

	.ghost {
		display: inline-flex;
		align-items: center;
		gap: var(--mo-space-2);
		appearance: none;
		border: 0;
		cursor: pointer;
		padding: var(--mo-space-3) var(--mo-space-4);
		border-radius: var(--mo-radius-3);
		background: transparent;
		color: var(--mo-intent-on-surface);
		outline: 1px solid var(--mo-intent-outline);
		outline-offset: -1px;
		font-family: var(--mo-font-body);
		font-size: var(--mo-type-3);
		font-weight: 500;
		transition: outline-color 0.16s ease;
	}
	.ghost:hover {
		outline-color: var(--mo-intent-accession-on);
	}
	.ghost--quiet {
		outline: 0;
		color: var(--mo-intent-on-surface-muted);
	}
	.ghost--quiet:hover {
		color: var(--mo-intent-on-surface);
	}
	.ghost:focus-visible {
		outline: 2px solid var(--mo-intent-primary-action-ring);
		outline-offset: 2px;
	}
	.ghost .material-symbols-outlined,
	.primary .material-symbols-outlined {
		font-size: 1.2em;
	}

	.err {
		margin: 0;
		font-family: var(--mo-font-body);
		font-size: var(--mo-type-3);
		color: var(--mo-intent-caution-on);
	}
	.err__link {
		color: var(--mo-intent-accession-on);
	}

	.ack {
		display: flex;
		gap: var(--mo-space-4);
		align-items: flex-start;
		padding: var(--mo-space-6);
		border-radius: var(--mo-radius-3);
		background: var(--mo-intent-surface-raised);
		outline: 1px solid var(--mo-intent-outline);
		outline-offset: -1px;
	}
	.ack__glyph {
		font-size: 1.75rem;
		color: var(--mo-intent-success-on);
		flex: none;
	}
	.ack__title {
		margin: 0 0 var(--mo-space-2);
		font-family: var(--mo-font-display);
		font-size: var(--mo-type-5);
		color: var(--mo-intent-on-surface);
	}
	.ack__body {
		margin: 0 0 var(--mo-space-4);
		font-family: var(--mo-font-body);
		font-size: var(--mo-type-3);
		line-height: 1.55;
		color: var(--mo-intent-on-surface-muted);
	}

	@media (prefers-reduced-motion: reduce) {
		.primary,
		.ghost,
		.strip__btn {
			transition: none;
		}
	}
</style>
