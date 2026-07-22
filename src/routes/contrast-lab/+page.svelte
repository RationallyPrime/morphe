<script lang="ts">
	/*
	 * Contrast lab — a deterministic CI proof surface for KRA-796 Defect 3.
	 *
	 * A composed fixture that renders REAL Morphe primitives (Text / Number / Link
	 * on the three surface tiers, across intents) so the browser contrast matrix
	 * and the composed-a11y checks (`e2e/contrast-a11y.e2e.ts`) always have live,
	 * on-screen ink + a real `mo-link` to inspect — the app's other routes gate
	 * their links behind disclosures. `?dialect=<id>` pins the dialect; otherwise
	 * the global active dialect applies. Not linked from nav: a test fixture, not a
	 * product page (the playground is a proof surface — CLAUDE.md).
	 */
	import { page } from "$app/stores";
	import { getDialect } from "$lib";
	import { MorpheRoot } from "$lib/components";
	import type { Node } from "$lib/grammar/types.js";
	import { CORE_INTENTS, REGISTER_INTENTS } from "$lib/tokens/intents.js";

	const INTENTS = [...CORE_INTENTS, ...REGISTER_INTENTS];

	const dialectId = $derived($page.url.searchParams.get("dialect") ?? undefined);
	const dialect = $derived(dialectId ? getDialect(dialectId) : undefined);

	/** One surface frame holding an ink line per intent + a real Link per intent. */
	function surfaceBlock(surface: "base" | "raised" | "sunken"): Node {
		const inkLines: Node[] = INTENTS.flatMap((intent) => [
			{ kind: "text", value: `${intent} ink`, as: "body", intent } as Node,
			{ kind: "number", value: 1234.56, format: "currency", currency: "ISK", intent } as Node,
			{
				kind: "link",
				href: `/lab/${intent}`,
				label: `${intent} link`,
				intent,
				gloss: "A contrast-test navigation link.",
			} as Node,
		]);
		return {
			kind: "frame",
			role: "panel",
			surface,
			children: [
				{ kind: "text", value: `surface: ${surface}`, as: "subheading" },
				{ kind: "stack", role: "section", children: inkLines },
			],
		};
	}

	/** Parent-owned layout regressions (KRA-800): chips, local queries, min-width. */
	function signalCard(label: string, token?: string): Node {
		return {
			kind: "compound",
			name: "SignalCard",
			args: {
				kicker:
					token === undefined
						? { kind: "text", value: "cell-local", as: "caption", intent: "folio" }
						: {
								kind: "cluster",
								role: "inline",
								children: [{ kind: "text", value: token, as: "caption" }],
							},
				title: { kind: "text", value: label, as: "subheading" },
				measure: { kind: "number", value: 32, format: "integer", intent: "evidence" },
			},
			slots: { body: [] },
		};
	}

	const clusterPressureToken = "KRA800_CLUSTER_PRESSURE_0123456789_ABCDEFGHIJKLMNOPQRSTUVWXYZ";
	const layoutProofs: readonly Node[] = [
		{ kind: "text", value: "Layout ownership lab", as: "heading" },
		{
			kind: "grid",
			role: "field-group",
			columns: ["content", "flexible"],
			children: [
				{ kind: "text", value: "Status chip probe", as: "caption" },
				{
					kind: "status",
					tone: "success",
					signal: { text: "open" },
					href: "/lab/open",
					gloss: "The layout probe is open.",
				},
				{ kind: "text", value: "Badge chip probe", as: "caption" },
				{ kind: "badge", label: "classified", intent: "provenance" },
				{ kind: "text", value: "Button chip probe", as: "caption" },
				{ kind: "button", label: "Review", action: "layout-proof.review" },
			],
		},
		{
			kind: "grid",
			role: "list",
			minTrack: "regular",
			children: [
				signalCard("Layout card A", clusterPressureToken),
				signalCard("Layout card B"),
				signalCard("Layout card C"),
			],
		},
	];

	const tree = $derived<Node>({
		kind: "stack",
		role: "page",
		children: [
			{ kind: "text", value: "Contrast lab", as: "heading" },
			surfaceBlock("base"),
			surfaceBlock("raised"),
			surfaceBlock("sunken"),
			...layoutProofs,
		],
	});
</script>

<main class="lab">
	{#if dialect}
		<MorpheRoot {tree} {dialect} />
	{:else}
		<MorpheRoot {tree} />
	{/if}
</main>

<style>
	.lab {
		padding: var(--mo-space-5, 1rem);
	}
</style>
