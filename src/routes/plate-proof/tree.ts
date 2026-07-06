import type { Node } from "$lib";

export const plateProofTree: Node = {
	kind: "frame",
	role: "page",
	surface: "base",
	budget: 3,
	children: [
		{
			kind: "grid",
			role: "section",
			minTrack: "regular",
			children: [
				{
					kind: "stack",
					role: "section",
					direction: "block",
					emphasis: "strong",
					children: [
						{ kind: "badge", label: "plate proof", intent: "evidence", icon: "image" },
						{ kind: "text", value: "Signal map", as: "display", emphasis: "strong" },
						{
							kind: "text",
							value:
								"A neutral demo plate renders through Morphe's typed Media node with responsive sources, a stable fallback, and explicit intrinsic dimensions.",
							as: "body",
							emphasis: "muted",
						},
						{ kind: "link", href: "/", label: "Back to workbench" },
					],
				},
				{
					kind: "media",
					src: "/images/plates/signal-map-960.png",
					alt: "Abstract demo plate: a signal map of nodes and routed connections on a dark field.",
					aspect: "video",
					sources: [
						{
							type: "image/avif",
							srcset:
								"/images/plates/signal-map-640.avif 640w, /images/plates/signal-map-960.avif 960w",
						},
						{
							type: "image/webp",
							srcset:
								"/images/plates/signal-map-640.webp 640w, /images/plates/signal-map-960.webp 960w",
						},
					],
					sizes: "(min-width: 64rem) 36rem, 100vw",
					width: 960,
					height: 540,
					eager: true,
				},
			],
		},
	],
};
