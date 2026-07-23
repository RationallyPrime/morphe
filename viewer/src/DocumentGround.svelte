<script lang="ts">
	/*
	 * DocumentGround — paint the DOCUMENT ground in the active dialect.
	 *
	 * The dialect's var spread rides the viewer shell, so `body`'s own
	 * `--mo-intent-surface-base` still resolves to the :root gallery bone.
	 * Any region the shell has not painted — overscroll, a mid-scroll
	 * compositor flash, a partial paint — then flashes the wrong world under
	 * a dark deployment (the timaeus.sokrates.is cream-void bug). Stamping
	 * the dialect's ground onto <body> keeps the document and the shell one
	 * surface. The injected values are package-authored dialect strings
	 * (scale-var color-mix expressions, resolvable at :root), never user
	 * input, so the head style tag carries only our own CSS.
	 */
	import type { AppliedDialect } from "$lib";

	let { applied }: { applied: AppliedDialect } = $props();
	const ground = $derived(applied.vars["--mo-intent-surface-base"]);
	const ink = $derived(applied.vars["--mo-intent-on-surface"]);
</script>

<svelte:head>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- dialect-authored CSS only -->
	<!-- `html body` outranks the app.css `body` reset regardless of style-tag
	     order in the bundle. -->
	{@html `<style>html body{background-color:${ground};color:${ink}}</style>`}
</svelte:head>
