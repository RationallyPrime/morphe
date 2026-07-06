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
						{ kind: "text", value: "B1. Boot on premises", as: "display", emphasis: "strong" },
						{
							kind: "text",
							value:
								"The first Timaeus beat renders through Morphe's typed Media node with responsive sources, a stable fallback, and explicit intrinsic dimensions.",
							as: "body",
							emphasis: "muted",
						},
						{ kind: "link", href: "/", label: "Back to workbench" },
					],
				},
				{
					kind: "media",
					src: "/images/plates/b1-boot-on-premises-960.png",
					alt: "Timaeus plate B1 showing the customer appliance booting on premises.",
					aspect: "portrait",
					sources: [
						{
							type: "image/avif",
							srcset:
								"/images/plates/b1-boot-on-premises-640.avif 640w, /images/plates/b1-boot-on-premises-960.avif 960w",
						},
						{
							type: "image/webp",
							srcset:
								"/images/plates/b1-boot-on-premises-640.webp 640w, /images/plates/b1-boot-on-premises-960.webp 960w",
						},
					],
					sizes: "(min-width: 64rem) 36rem, 100vw",
					width: 960,
					height: 1280,
					eager: true,
				},
			],
		},
	],
};
