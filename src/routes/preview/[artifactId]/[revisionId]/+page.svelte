<script lang="ts">
	import { getDialect } from "$lib";
	import { MorpheRoot } from "$lib/components";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();
	const dialect = $derived(getDialect(data.dialectId));
</script>

<MorpheRoot tree={data.tree} {dialect} />
