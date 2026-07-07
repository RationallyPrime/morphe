import adapterNode from "@sveltejs/adapter-node";
import adapterVercel from "@sveltejs/adapter-vercel";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/*
 * Box viewer — the STRIPPED standalone app (KRA-648 / MO-D3 adjudication).
 *
 * One route + /healthz, importing the same $lib renderer/dialects/tokens as
 * the playground app (kit.files.lib below). Deliberately NOT a route in the
 * playground: that app ships an unauthenticated, outbound-proxy-capable
 * POST /api/adaptive/decision — not appliance-shippable.
 *
 * Adapter is env-switched: adapter-vercel by default (parity with the main
 * app's pinned runtime), adapter-node when MORPHE_VIEWER_ADAPTER=node (the
 * distroless image build).
 */

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter:
			process.env.MORPHE_VIEWER_ADAPTER === "node"
				? adapterNode()
				: adapterVercel({ runtime: "nodejs22.x" }),
		files: {
			lib: "../src/lib",
		},
	},
};

export default config;
