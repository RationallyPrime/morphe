import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { JsonObject, JsonValue } from "../artifacts/source-types.generated.js";
import { validateAuthenticatedSchemaData } from "./schema.js";

// F4 (KRA-765): cross-language composition-parity. `composition-order-v1.json`
// carries `properties` beside `allOf` with NO explicit top-level `type: object`.
// The Python stamper (_stamp_property_order) and this admission gate
// (signedOrderReason) both key on `properties` presence, not on `type`. The Python
// suite (test_source_surface_contract.py) stamps the signed order from these exact
// bytes; this suite proves the TypeScript gate admits the stamped schema and — the
// teeth — refuses the same schema before it has been stamped.

const FIXTURE_ROOT = new URL("../../../fixtures/source-surface/", import.meta.url);

interface CompositionFixture {
	readonly schema: JsonObject;
	readonly data: JsonValue;
	readonly expected_order: readonly string[];
}

function fixture(): CompositionFixture {
	return JSON.parse(
		readFileSync(new URL("composition-order-v1.json", FIXTURE_ROOT), "utf8"),
	) as CompositionFixture;
}

describe("Python/TypeScript composition-schema order parity", () => {
	it("admits the stamped composition schema the Python stamper produces", () => {
		const { schema, data, expected_order } = fixture();
		// The fixture must genuinely omit an explicit object type, otherwise it is
		// not exercising the composition path both languages key `properties` on.
		expect(Object.hasOwn(schema, "type")).toBe(false);
		expect(Array.isArray(schema.allOf)).toBe(true);

		const stamped: JsonObject = { ...schema, "x-morphe": { order: [...expected_order] } };
		expect(validateAuthenticatedSchemaData(stamped, data)).toEqual({ ok: true, value: true });
	});

	it("refuses the same composition schema before it carries the signed order", () => {
		const { schema, data } = fixture();
		const result = validateAuthenticatedSchemaData(schema, data);
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("unreachable");
		expect(result.reason).toContain("signed x-morphe.order");
	});
});
