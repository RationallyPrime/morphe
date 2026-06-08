<script lang="ts">
/*
 * ContactForm — the front door. Native control surface (outside any Morphe tree),
 * styled from the --mo-* tokens. Posts to /api/contact, which alerts the founder
 * over ntfy. No customer auto-reply. On a delivery failure it offers a mailto
 * fallback so a lead is never lost. A honeypot field drops bots.
 */
const FOUNDER_EMAIL = "hakon@sokrates.is";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let name = $state("");
let email = $state("");
let operation = $state("");
let companyUrl = $state(""); // honeypot — stays empty for humans
let status = $state<"idle" | "submitting" | "ok" | "error">("idle");

const emailValid = $derived(EMAIL_RE.test(email.trim()));
const operationValid = $derived(operation.trim().length >= 2);
const canSubmit = $derived(
	emailValid && operationValid && status !== "submitting",
);

const mailtoHref = $derived(
	`mailto:${FOUNDER_EMAIL}?subject=${encodeURIComponent("Sókrates — operation enquiry")}&body=${encodeURIComponent(
		operation.trim() || "We run our operation on:",
	)}`,
);

async function submit(): Promise<void> {
	if (!canSubmit) return;
	status = "submitting";
	try {
		const res = await fetch("/api/contact", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: name.trim(),
				email: email.trim(),
				operation: operation.trim(),
				company_url: companyUrl,
			}),
		});
		const data = (await res.json().catch(() => ({}))) as { ok?: boolean };
		status = res.ok && data.ok ? "ok" : "error";
	} catch {
		status = "error";
	}
}
</script>

{#if status === "ok"}
	<div class="ack" role="status" aria-live="polite">
		<span class="ack__glyph material-symbols-outlined" aria-hidden="true">mark_email_read</span>
		<div>
			<p class="ack__title">Received. Thank you.</p>
			<p class="ack__body">
				Hákon reads every one and replies by hand, usually within 48 hours. No deck, no
				slides — a conversation about the work.
			</p>
		</div>
	</div>
{:else}
	<form
		class="form"
		onsubmit={(e) => {
			e.preventDefault();
			void submit();
		}}
	>
		<div class="field">
			<label class="field__label" for="contact-name">Your name</label>
			<input id="contact-name" class="field__input" type="text" autocomplete="name" bind:value={name} />
		</div>

		<div class="field">
			<label class="field__label" for="contact-email">Email</label>
			<input
				id="contact-email"
				class="field__input"
				type="email"
				autocomplete="email"
				required
				bind:value={email}
			/>
		</div>

		<div class="field">
			<label class="field__label" for="contact-operation">What runs your operation today?</label>
			<textarea
				id="contact-operation"
				class="field__input"
				rows="4"
				required
				placeholder="e.g. dkPlus for finance, Humanity for shifts, and a lot of spreadsheets in between."
				bind:value={operation}
			></textarea>
		</div>

		<!-- Honeypot: hidden from humans, catnip for bots. -->
		<div class="hp" aria-hidden="true">
			<label for="contact-company-url">Company URL</label>
			<input id="contact-company-url" type="text" tabindex="-1" autocomplete="off" bind:value={companyUrl} />
		</div>

		<div class="form__actions">
			<button class="submit" type="submit" disabled={!canSubmit}>
				{status === "submitting" ? "Sending…" : "Start the conversation"}
			</button>
			<span class="form__hint">One conversation is usually enough.</span>
		</div>

		{#if status === "error"}
			<p class="form__error" role="alert">
				Something went wrong sending that. Email
				<a class="form__mailto" href={mailtoHref}>{FOUNDER_EMAIL}</a> directly and we will pick it up.
			</p>
		{/if}
	</form>
{/if}

<style>
	.form {
		display: flex;
		flex-direction: column;
		gap: var(--mo-space-4);
		max-inline-size: 48rem;
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
	.field__input {
		width: 100%;
		padding: var(--mo-space-4);
		border: 0;
		border-radius: var(--mo-radius-2);
		background: var(--mo-intent-surface-raised);
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

	.hp {
		position: absolute;
		left: -9999px;
		width: 1px;
		height: 1px;
		overflow: hidden;
	}

	.form__actions {
		display: flex;
		align-items: center;
		gap: var(--mo-space-4);
		flex-wrap: wrap;
		margin-block-start: var(--mo-space-1);
	}
	.submit {
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
	.submit:hover:not(:disabled) {
		background: var(--mo-intent-primary-action-hover);
	}
	.submit:disabled {
		background: var(--mo-intent-primary-action-disabled);
		cursor: default;
	}
	.submit:focus-visible {
		outline: 2px solid var(--mo-intent-primary-action-ring);
		outline-offset: 2px;
	}
	.form__hint {
		font-family: var(--mo-font-mono);
		font-size: var(--mo-type-2);
		color: var(--mo-intent-on-surface-muted);
	}
	.form__error {
		margin: 0;
		font-family: var(--mo-font-body);
		font-size: var(--mo-type-3);
		color: var(--mo-intent-caution-on);
	}
	.form__mailto {
		color: var(--mo-intent-accession-on);
	}

	.ack {
		display: flex;
		gap: var(--mo-space-4);
		align-items: flex-start;
		max-inline-size: 48rem;
		padding: var(--mo-space-5);
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
		margin: 0;
		font-family: var(--mo-font-body);
		font-size: var(--mo-type-3);
		line-height: 1.55;
		color: var(--mo-intent-on-surface-muted);
	}
	@media (prefers-reduced-motion: reduce) {
		.submit {
			transition: none;
		}
	}
</style>
