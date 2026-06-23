/// <reference types="vitest/config" />

import { sveltekit } from "@sveltejs/kit/vite";
import { svelteTesting } from "@testing-library/svelte/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [sveltekit(), svelteTesting()],
	test: {
		include: ["src/test-fixtures/**/*.{test,spec}.{js,ts}"],
		environment: "jsdom",
	},
});
