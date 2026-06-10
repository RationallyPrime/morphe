<script lang="ts">
/*
 * OnboardingGate — the email-capture screen in front of the intake (ADR-0001).
 * Native control surface (outside any Morphe tree), styled from the --mo-*
 * tokens. Posts to /api/onboarding/request-link, which emails the visitor a
 * 30-minute magic link. When the link service is absent (503 not-configured)
 * it degrades to the open conversation path: a mailto to the founder. A
 * honeypot field drops bots.
 */
const FOUNDER_EMAIL = "hakon@sokrates.is";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let { tokenError = null }: { tokenError?: "expired" | "invalid" | null } = $props();

let email = $state("");
let companyUrl = $state(""); // honeypot — stays empty for humans
let status = $state<"idle" | "submitting" | "sent" | "error" | "unavailable">("idle");

const emailValid = $derived(EMAIL_RE.test(email.trim()));
const canSubmit = $derived(emailValid && status !== "submitting");

const staleNote = $derived(
	tokenError === "expired"
		? "That link had expired. Enter your email and we send a fresh one."
		: tokenError === "invalid"
			? "That link did not check out. Enter your email and we send a fresh one."
			: null,
);

const mailtoHref = `mailto:${FOUNDER_EMAIL}?subject=${encodeURIComponent("Sókrates onboarding")}&body=${encodeURIComponent("We would like to start onboarding. Our operation runs on:")}`;

async function submit(): Promise<void> {
	if (!canSubmit) return;
	status = "submitting";
	try {
		const res = await fetch("/api/onboarding/request-link", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: email.trim(), company_url: companyUrl }),
		});
		const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
		if (res.ok && data.ok) {
			status = "sent";
		} else if (res.status === 503 && data.error === "not-configured") {
			status = "unavailable";
		} else {
			status = "error";
		}
	} catch {
		status = "error";
	}
}
</script>

{#if status === "sent"}
	<div class="ack" role="status" aria-live="polite">
		<span class="ack__glyph material-symbols-outlined" aria-hidden="true">mark_email_unread</span>
		<div>
			<p class="ack__title">Check your inbox.</p>
			<p class="ack__body">
				We sent a link to {email.trim()}. It is good for 30 minutes — one click and the
				intake opens. Your draft saves as you go, so you can stop and come back.
			</p>
		</div>
	</div>
{:else if status === "unavailable"}
	<div class="ack" role="status" aria-live="polite">
		<span class="ack__glyph material-symbols-outlined" aria-hidden="true">forum</span>
		<div>
			<p class="ack__title">Start with the conversation instead.</p>
			<p class="ack__body">
				The link service is not available right now. Email
				<a class="gate__mailto" href={mailtoHref}>{FOUNDER_EMAIL}</a> and we pick it up from
				there — Hákon replies by hand, usually within 48 hours.
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
		{#if staleNote}
			<p class="gate__note" role="status">{staleNote}</p>
		{/if}

		<div class="field">
			<label class="field__label" for="gate-email">Your work email</label>
			<input
				id="gate-email"
				class="field__input"
				type="email"
				autocomplete="email"
				required
				placeholder="you@company.is"
				bind:value={email}
			/>
		</div>

		<!-- Honeypot: hidden from humans, catnip for bots. -->
		<div class="hp" aria-hidden="true">
			<label for="gate-company-url">Company URL</label>
			<input id="gate-company-url" type="text" tabindex="-1" autocomplete="off" bind:value={companyUrl} />
		</div>

		<div class="form__actions">
			<button class="submit" type="submit" disabled={!canSubmit}>
				{status === "submitting" ? "Sending…" : "Send me the link"}
			</button>
			<span class="form__hint">One click, no password. The link is good for 30 minutes.</span>
		</div>

		{#if status === "error"}
			<p class="form__error" role="alert">
				Something went wrong sending that. Email
				<a class="gate__mailto" href={mailtoHref}>{FOUNDER_EMAIL}</a> directly and we will pick it up.
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
	.gate__note {
		margin: 0;
		font-family: var(--mo-font-body);
		font-size: var(--mo-type-3);
		color: var(--mo-intent-caution-on);
	}
	.gate__mailto {
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
