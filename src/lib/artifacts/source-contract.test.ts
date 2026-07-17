import { describe, expect, it } from "vitest";
import { SOURCE_SURFACE_ARTIFACT_JSON_SCHEMA } from "./source-schema.generated.js";

interface SchemaObject {
	readonly type?: string;
	readonly const?: unknown;
	readonly pattern?: string;
	readonly additionalProperties?: boolean;
	readonly required?: readonly string[];
	readonly properties?: Readonly<Record<string, SchemaObject>>;
	readonly anyOf?: readonly SchemaObject[];
}

describe("generated SourceSurfaceArtifactV1 ingress contract", () => {
	it("pins the strict outer envelope and excludes compiled-tree authority", () => {
		const schema = SOURCE_SURFACE_ARTIFACT_JSON_SCHEMA as SchemaObject;
		const properties = schema.properties ?? {};

		expect(schema.additionalProperties).toBe(false);
		expect(properties.kind?.const).toBe("morphe.source-surface");
		expect(properties.wire_version?.const).toBe("1.0");
		expect(properties.schema).toBeDefined();
		expect(properties.schema_).toBeUndefined();
		for (const forbidden of ["tree", "grammar_version", "compiler_version", "dialect_id"]) {
			expect(properties[forbidden]).toBeUndefined();
		}
	});

	it("pins canonical timestamps, SHA-256 seals, and Ed25519 signature text", () => {
		const schema = SOURCE_SURFACE_ARTIFACT_JSON_SCHEMA as SchemaObject & {
			readonly $defs?: Readonly<Record<string, SchemaObject>>;
		};
		const properties = schema.properties ?? {};
		const definitions = schema.$defs ?? {};

		expect(properties.produced_at?.type).toBe("string");
		expect(properties.produced_at?.pattern).toBe("^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}Z$");
		expect(properties.valid_until?.anyOf?.map((branch) => branch.type)).toEqual(["string", "null"]);
		expect(definitions.Sha256?.pattern).toBe("^sha256:[0-9a-f]{64}$");
		expect(definitions.Ed25519Attestation?.properties?.algorithm?.const).toBe("Ed25519");
		expect(definitions.Ed25519Attestation?.properties?.signature?.pattern).toBe(
			"^[A-Za-z0-9_-]{85}[AQgw]$",
		);
	});
});
