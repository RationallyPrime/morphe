<script lang="ts">
import { untrack } from "svelte";
import { page } from "$app/state";
import "../app.css";
import "$lib/site/site.css";
import Footer from "$lib/site/Footer.svelte";
import Nav from "$lib/site/Nav.svelte";
import {
	activeDialect,
	applyDialect,
	DIALECT_IDS,
	dialectStyle,
	resolveArrivalDialect,
} from "$morphe";

let { children } = $props();

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
	const cohort = untrack(() => page.url.searchParams.get("cohort"));
	const persisted = localStorage.getItem("mo-dialect");
	const resolved = resolveArrivalDialect(cohort, persisted, DIALECT_IDS);
	if (resolved !== null) activeDialect.setById(resolved);
});
$effect(() => {
	if (typeof localStorage === "undefined") return;
	localStorage.setItem("mo-dialect", activeDialect.id);
});
</script>

<a class="skip" href="#main">Skip to content</a>
<div class="shell" style={shellStyle}>
	<Nav />
	<main id="main" class="shell__main">
		{@render children?.()}
	</main>
	<Footer />
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
