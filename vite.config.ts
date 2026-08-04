/// <reference types="vitest/config" />

import { fileURLToPath } from "node:url";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vitest/config";

const kernelProofFixtureRoot = fileURLToPath(new URL("./fixtures/krepis-proof/", import.meta.url));

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		fs: {
			// The neutral proof host imports only the six sealed public Node fixtures.
			// Keep the exception narrower than the repository root.
			allow: [kernelProofFixtureRoot],
		},
	},
	test: {
		include: [
			"src/**/*.{test,spec}.{js,ts}",
			"scripts/**/*.{test,spec}.{js,ts}",
			"viewer/src/**/*.{test,spec}.{js,ts}",
		],
		exclude: ["src/test-fixtures/**/*.{test,spec}.{js,ts}"],
		environment: "node",
	},
});
