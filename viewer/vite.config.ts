import { fileURLToPath } from "node:url";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [sveltekit()],
	// The stripped viewer is a sub-app that deliberately consumes the package
	// source and workspace dependencies from the repository root. Vite's default
	// sub-root allow list omits both, which leaves SSR working but blocks the
	// SvelteKit client entry (and therefore hydration) in development.
	server: {
		fs: {
			allow: [fileURLToPath(new URL("..", import.meta.url))],
		},
	},
});
