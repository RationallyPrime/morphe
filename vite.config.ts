/// <reference types="vitest/config" />

import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [sveltekit()],
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
