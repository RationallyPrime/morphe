<script lang="ts">
	/*
	 * / — the smoke page. This IS the Corollary-1 "dignity test" (proposal §12):
	 * a hand-authored Node tree rendered through grammar + algebra + tokens + the
	 * default dialect, with a live dialect toggle proving the Lemma-3 fixed point.
	 *
	 * The page body lives in the shared ./_demo/DignityDemo.svelte component (also
	 * mounted at /dignity). All authored DATA (tree, the CatalogueEntry compound,
	 * and the second dialect) lives in ./_demo/tree.ts. Nothing here reaches into
	 * the core.
	 */
	import DignityDemo from "./_demo/DignityDemo.svelte";
</script>

<DignityDemo />
