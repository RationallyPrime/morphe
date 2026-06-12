/**
 * Orval codegen for the composer's grounding specs.
 *
 * Input: the grounding specs in ./generated (Humanity OpenAPI 3.1 promoted +
 * dkPlus Swagger 2.0).
 *
 * Output: ./src/app/compose/generated/{humanity,dkplus}/ — TS types (model/) +
 * a svelte-query client (for when the appliance goes live).
 *
 * dkPlus uses the original 2.0 source, not the 3.0 conversion: the conversion
 * leaves Swagger-2.0-style parameters (type/format on the parameter rather than
 * under `schema`), invalid in OpenAPI 3.0, which crashes orval's validator.
 * Orval reads 2.0 natively. `validation: false` skips the (crash-prone) validator.
 *
 * Humanity uses a paths-stripped MODELS copy: the promoted spec has malformed
 * path keys (e.g. `/{{leave_type}}?access_token=xxxxxxx` — query params leaked
 * into path templates) that crash the parser. We need Humanity MODELS here; its
 * endpoint inventory comes from scripts/build-evidence.ts (lenient parse).
 * FIX AT SOURCE: the Hyle promotion's path templating (it would break the real
 * Humanity integration too, not just codegen).
 *
 * ZOD IS DEFERRED. orval 8.15 emits zod-3 syntax that conflicts with our zod 4
 * (record/etc. arg signatures); and the READ-ONLY composer needs model TYPES,
 * not API-model zod. Re-enable the *-zod entries for the live appliance phase and
 * resolve the orval zod target then. Visitor-input validation is a small
 * hand-written zod schema, not these.
 *
 * Run: bun run codegen
 */
import { defineConfig } from "orval";

const HUMANITY = "./generated/humanity-schedule-v2.promoted.models.openapi.json";
const DKPLUS = "./generated/dkplus_swagger_2_0.json";

export default defineConfig({
	humanity: {
		input: { target: HUMANITY, validation: false },
		output: {
			mode: "tags-split",
			target: "./src/app/compose/generated/humanity/endpoints.ts",
			schemas: "./src/app/compose/generated/humanity/model",
			client: "svelte-query",
			httpClient: "fetch",
			clean: true,
		},
	},
	dkplus: {
		input: { target: DKPLUS, validation: false },
		output: {
			mode: "tags-split",
			target: "./src/app/compose/generated/dkplus/endpoints.ts",
			schemas: "./src/app/compose/generated/dkplus/model",
			client: "svelte-query",
			httpClient: "fetch",
			clean: true,
		},
	},

	// --- Deferred to the live-appliance phase (see header) ---
	// "humanity-zod": { input: { target: HUMANITY, validation: false },
	//   output: { target: "./src/app/compose/generated/humanity/zod.ts", client: "zod" } },
	// "dkplus-zod": { input: { target: DKPLUS, validation: false },
	//   output: { target: "./src/app/compose/generated/dkplus/zod.ts", client: "zod" } },
});
