<script lang="ts">
	import { untrack } from "svelte";
	import { page } from "$app/state";
	import "$lib/styles.css";
	import "../app.css";
	import {
		activeDialect,
		applyDialect,
		DEFAULT_DIALECT_ID,
		DIALECT_IDS,
		dialectStyle,
		hasDialect,
		persistableDialect,
		resolveArrivalDialect,
	} from "$lib";

	let { children } = $props();

	const DIALECT_STORAGE_KEY = "mo-dialect.v2";
	const LEGACY_DIALECT_STORAGE_KEY = "mo-dialect";

	let arrivalResolved = false;

	const shellStyle = $derived(dialectStyle(applyDialect(activeDialect.current)));
	const navItems = [
		{ href: "/", label: "Workbench" },
		{ href: "/substrate", label: "Playground" },
		{ href: "/preview/capability-page.demo/rev-001", label: "Preview" },
		{ href: "/p/demo", label: "Published" },
	] as const;

	$effect(() => {
		if (typeof localStorage === "undefined") return;
		localStorage.removeItem(LEGACY_DIALECT_STORAGE_KEY);

		const dialectParam = untrack(() => page.url.searchParams.get("dialect"));
		const persistedDialect = localStorage.getItem(DIALECT_STORAGE_KEY);
		const resolved = resolveArrivalDialect(dialectParam, persistedDialect, DIALECT_IDS);
		if (resolved !== null && hasDialect(resolved)) activeDialect.setById(resolved);
		arrivalResolved = true;
	});
	$effect(() => {
		const id = activeDialect.id;
		if (!arrivalResolved || typeof localStorage === "undefined") return;
		const value = persistableDialect(
			id,
			localStorage.getItem(DIALECT_STORAGE_KEY),
			DEFAULT_DIALECT_ID,
		);
		if (value !== null) localStorage.setItem(DIALECT_STORAGE_KEY, value);
	});
</script>

<svelte:head>
	<title>Morphe Workbench</title>
</svelte:head>

<a class="skip" href="#main">Skip to content</a>
<div class="shell" style={shellStyle}>
	<header class="nav">
		<a class="nav__brand" href="/" aria-label="Morphe workbench home">
			<span class="nav__mark" aria-hidden="true"></span>
			<span>Morphe</span>
		</a>
		<nav class="nav__links" aria-label="Morphe surfaces">
			{#each navItems as item (item.href)}
				<a
					href={item.href}
					data-active={page.url.pathname === item.href ||
						(item.href !== "/" && page.url.pathname.startsWith(item.href))}
				>
					{item.label}
				</a>
			{/each}
		</nav>
	</header>
	<main id="main" class="shell__main">
		{@render children?.()}
	</main>
</div>

<style>
	.shell {
		display: flex;
		flex-direction: column;
		min-block-size: 100vh;
		background: var(--mo-intent-surface-base);
	}
	.shell__main {
		flex: 1 1 auto;
	}
	.nav {
		position: sticky;
		inset-block-start: 0;
		z-index: 30;
		display: flex;
		flex-wrap: wrap;
		gap: var(--mo-space-4);
		align-items: center;
		justify-content: space-between;
		padding: var(--mo-space-3) clamp(var(--mo-space-4), 5vw, var(--mo-space-8));
		border-block-end: 1px solid var(--mo-intent-outline);
		background: color-mix(in oklab, var(--mo-intent-surface-base) 92%, transparent);
		backdrop-filter: blur(16px);
	}
	.nav__brand {
		display: inline-flex;
		align-items: center;
		gap: var(--mo-space-3);
		color: var(--mo-intent-on-surface);
		font-family: var(--mo-font-display);
		font-size: var(--mo-type-5);
		font-weight: 700;
		text-decoration: none;
	}
	.nav__mark {
		inline-size: 1rem;
		block-size: 1rem;
		border: 1px solid var(--mo-intent-primary-action-surface);
		border-radius: 50%;
		background:
			linear-gradient(
				90deg,
				transparent 47%,
				var(--mo-intent-primary-action-surface) 47% 53%,
				transparent 53%
			),
			linear-gradient(
				0deg,
				transparent 47%,
				var(--mo-intent-primary-action-surface) 47% 53%,
				transparent 53%
			),
			var(--mo-intent-surface-raised);
		box-shadow: 0 0 0 0.25rem
			color-mix(in oklab, var(--mo-intent-primary-action-surface) 16%, transparent);
	}
	.nav__links {
		display: flex;
		flex-wrap: wrap;
		gap: var(--mo-space-1);
		justify-content: flex-end;
	}
	.nav__links a {
		padding: var(--mo-space-2) var(--mo-space-3);
		border-radius: var(--mo-radius-2);
		color: var(--mo-intent-on-surface-muted);
		font-family: var(--mo-font-body);
		font-size: var(--mo-type-3);
		font-weight: 650;
		text-decoration: none;
	}
	.nav__links a:hover,
	.nav__links a[data-active="true"] {
		background: var(--mo-intent-surface-raised);
		color: var(--mo-intent-on-surface);
	}
	.nav__links a:focus-visible,
	.nav__brand:focus-visible {
		outline: 2px solid var(--mo-intent-primary-action-ring);
		outline-offset: 2px;
	}
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
