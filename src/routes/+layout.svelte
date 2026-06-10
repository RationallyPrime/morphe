<script lang="ts">
import { untrack } from "svelte";
import { page } from "$app/state";
import "../app.css";
import "$lib/site/site.css";
import Nav from "$lib/site/Nav.svelte";
import {
	activeDialect,
	applyDialect,
	DEFAULT_DIALECT_ID,
	DIALECT_IDS,
	dialectStyle,
	persistableDialect,
	resolveArrivalDialect,
} from "$morphe";

let { children } = $props();

/*
 * Dialect persistence, v2. The v1 key ("mo-dialect") was written back
 * UNCONDITIONALLY on boot, so the then-default (icelandic-archive) was stored
 * for every visitor as if they had chosen it — and the ADR-0005 gallery flip
 * could never reach a returning visitor. v2 persists only EXPLICIT moves
 * (persistableDialect); the key bump is the one-time amnesty for the polluted
 * v1 values, which are removed on sight.
 */
const DIALECT_STORAGE_KEY = "mo-dialect.v2";
const LEGACY_DIALECT_STORAGE_KEY = "mo-dialect";

// Guards the write-back from racing the restore on mount: until arrival
// resolution has run, nothing is persisted.
let arrivalResolved = false;

// Apply the active dialect's intent vars at the SHELL boundary so the WHOLE site
// re-themes as one — the native chrome (nav, footer, CTAs, forms) and every
// MorpheRoot together. Without this, only the Morphe trees would follow a dialect
// flip and the chrome would stay on the static :root archive defaults. Reactive,
// so flipping the dialect on /substrate re-themes everything live; SSR renders the
// default dialect (activeDialect.current is the default until client hydration).
const shellStyle = $derived(dialectStyle(applyDialect(activeDialect.current)));

// CLIENT-ONLY arrival resolution + persistence. `$effect` never runs during SSR,
// so the server always renders the DEFAULT dialect (SSR-safe, no hydration crash).
// On first client run we resolve the arrival: a VALID `?cohort=` landing param
// (τ_frame attribution, DESIGN.md §9) outranks the persisted choice; an unknown
// param is ignored and the persisted choice stands. The URL read is `untrack`ed
// and localStorage is non-reactive, so this effect runs ONCE on mount — arrival
// attribution applies once and never fights a later in-session toggle, which the
// write-back effect below persists as usual. `setById` ignores unknown ids, so a
// stale persisted value can never clobber the selection.
$effect(() => {
	if (typeof localStorage === "undefined") return;
	// One-time amnesty: drop the v1 key entirely (default-polluted, see above).
	localStorage.removeItem(LEGACY_DIALECT_STORAGE_KEY);
	const cohort = untrack(() => page.url.searchParams.get("cohort"));
	const persisted = localStorage.getItem(DIALECT_STORAGE_KEY);
	const resolved = resolveArrivalDialect(cohort, persisted, DIALECT_IDS);
	if (resolved !== null) activeDialect.setById(resolved);
	arrivalResolved = true;
});
$effect(() => {
	const id = activeDialect.id; // reactive read first: subscribe on every run
	if (!arrivalResolved || typeof localStorage === "undefined") return;
	const value = persistableDialect(id, localStorage.getItem(DIALECT_STORAGE_KEY), DEFAULT_DIALECT_ID);
	if (value !== null) localStorage.setItem(DIALECT_STORAGE_KEY, value);
});
</script>

<a class="skip" href="#main">Skip to content</a>
<div class="shell" style={shellStyle}>
	<Nav />
	<main id="main" class="shell__main">
		{@render children?.()}
	</main>
</div>

<style>
	.shell {
		display: flex;
		flex-direction: column;
		min-block-size: 100vh;
	}
	.shell__main {
		flex: 1 1 auto;
	}

	/* Accessible skip link — visible only on keyboard focus. */
	.skip {
		position: absolute;
		inset-inline-start: var(--mo-space-3);
		inset-block-start: -100%;
		z-index: 60;
		padding: var(--mo-space-3) var(--mo-space-5);
		border-radius: var(--mo-radius-2);
		background: var(--mo-intent-primary-action-surface);
		color: var(--mo-intent-primary-action-on);
		font-family: var(--mo-font-body);
		font-weight: 600;
		text-decoration: none;
	}
	.skip:focus {
		inset-block-start: var(--mo-space-3);
	}
</style>
