<script lang="ts">
	import "../app.css";
	import { activeDialect } from "$morphe";

	let { children } = $props();

	// CLIENT-ONLY active-dialect persistence. `$effect` never runs during SSR, so
	// the server always renders the DEFAULT dialect (SSR-safe, no hydration crash).
	// On first client run we hydrate from localStorage; thereafter every change to
	// the global active dialect is written back. `setById` ignores unknown ids, so a
	// stale persisted value can never clobber the selection — a brief client switch
	// to the saved dialect after hydration is the only visible effect.
	$effect(() => {
		if (typeof localStorage === "undefined") return;
		const saved = localStorage.getItem("mo-dialect");
		if (saved !== null) activeDialect.setById(saved);
	});
	$effect(() => {
		if (typeof localStorage === "undefined") return;
		localStorage.setItem("mo-dialect", activeDialect.id);
	});
</script>

{@render children?.()}
