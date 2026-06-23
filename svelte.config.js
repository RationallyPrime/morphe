import adapter from "@sveltejs/adapter-vercel";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		// Pinned Vercel adapter (not adapter-auto): faster/robust installs and an
		// explicit function runtime, so the build-image Node version can't break the
		// adapt step (adapter-auto's on-the-fly install choked on the Node 24 builder).
		adapter: adapter({ runtime: "nodejs22.x" }),
	},
};

export default config;
