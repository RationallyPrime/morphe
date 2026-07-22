import { createPrivateKey, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Node } from "$lib";
import type { SourceSurfaceArtifactV1 } from "$lib/artifacts/source-types.generated.js";
import { computeSourceEvidence, encodeBase64url } from "$lib/surface-edge/attest.js";
import { emitNodeWithTrackedLinkPaints } from "$lib/surface-edge/emit.js";
import { resolveBoardLinks } from "./board-links.js";
import { rewriteKernelLinks } from "./links.js";
import { parseSourceSurfaceResponse } from "./source-envelope.js";
import type { BoardConfig, BoardJoin, SourceConfig, SurfaceEntry } from "./sources.js";
import { SOURCE_SURFACE_V1_MEDIA_TYPE } from "./surface-reader.js";

interface GoldenVector {
	readonly private_key_seed_hex: string;
	readonly public_key_base64url: string;
	readonly artifact: SourceSurfaceArtifactV1;
}

type Mutable<T> = T extends readonly (infer Item)[]
	? Mutable<Item>[]
	: T extends object
		? { -readonly [Key in keyof T]: Mutable<T[Key]> }
		: T;

const VECTOR = JSON.parse(
	readFileSync(
		new URL("../../fixtures/source-surface/source-surface-v1.ed25519-vector.json", import.meta.url),
		"utf8",
	),
) as GoldenVector;
const PKCS8_ED25519_SEED_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");

const EMPLOYEE_SCHEMA = {
	type: "object",
	title: "Employee detail",
	additionalProperties: false,
	properties: {
		header: {
			type: "object",
			title: "Employee",
			additionalProperties: false,
			properties: { employee: { type: "string", title: "Employee" } },
			required: ["employee"],
			"x-morphe": { strategy: "entity-header", order: ["employee"] },
		},
	},
	required: ["header"],
	"x-morphe": { order: ["header"] },
};

const JOIN: BoardJoin = {
	id: "employee-to-payslip",
	scope: "board",
	from: {
		source: "taxis",
		family: "taxis.employee",
		selector: { kind: "admitted-surface-id", instanceSegment: 1 },
		paint: { path: "$.header.employee", mode: "scalar-value" },
	},
	target: { source: "misthos", pane: "payslip", queryParameter: "worker_id" },
};

function source(id: string, entry: SurfaceEntry): SourceConfig {
	return {
		id,
		title: id,
		kind: "kernel",
		baseUrl: `http://${id}.test`,
		governedParams: [],
		surfaces: [entry],
	};
}

const TAXIS_ENTRY: SurfaceEntry = {
	id: "employee",
	title: "Employee",
	path: "/orgs/taxis-org/surfaces/employee?worker_id=representative",
	representation: "source-v1",
	sourceSurfaceId: "taxis.employee:taxis-org:representative:2026-07-22",
	routeOnly: true,
};
const MISTHOS_ENTRY: SurfaceEntry = {
	id: "payslip",
	title: "Payslip",
	path: "/orgs/misthos-org/surfaces/payslip?run_id=run-7&worker_id=representative",
	representation: "source-v1",
	sourceSurfaceId: "misthos.payslip:misthos-org:run-7:representative",
	routeOnly: true,
};
const TAXIS = source("taxis", TAXIS_ENTRY);
const BOARD: BoardConfig = {
	version: 2,
	board: "signed-fixture",
	sources: new Map([
		["taxis", TAXIS],
		["misthos", source("misthos", MISTHOS_ENTRY)],
	]),
	joins: [JOIN],
};

async function signedEmployee(): Promise<Mutable<SourceSurfaceArtifactV1>> {
	const artifact = structuredClone(VECTOR.artifact) as Mutable<SourceSurfaceArtifactV1>;
	artifact.surface_id = "taxis.employee:taxis-org:signed-worker:2026-07-22";
	artifact.view_model.id = "taxis.employee";
	artifact.schema = EMPLOYEE_SCHEMA;
	artifact.data = { header: { employee: "Matthías" } };
	artifact.diagnostics = [];
	const evidence = await computeSourceEvidence({
		...artifact,
		valid_until: artifact.valid_until ?? null,
		diagnostics: [],
		required_capabilities: artifact.required_capabilities ?? [],
	});
	artifact.seals.schema_sha256 = evidence.schemaSha256;
	artifact.seals.content_sha256 = evidence.contentSha256;
	artifact.seals.testimony_sha256 = evidence.testimonySha256;
	const key = createPrivateKey({
		key: Buffer.concat([
			PKCS8_ED25519_SEED_PREFIX,
			Buffer.from(VECTOR.private_key_seed_hex, "hex"),
		]),
		format: "der",
		type: "pkcs8",
	});
	artifact.attestation.signature = encodeBase64url(sign(null, evidence.signingMessage, key));
	return artifact;
}

function links(value: unknown): readonly Extract<Node, { kind: "link" }>[] {
	const found: Extract<Node, { kind: "link" }>[] = [];
	const pending: unknown[] = [value];
	while (pending.length > 0) {
		const current = pending.pop();
		if (current === null || typeof current !== "object") continue;
		if (Array.isArray(current)) {
			pending.push(...current);
			continue;
		}
		const record = current as Record<string, unknown>;
		if (record.kind === "link") {
			found.push(record as unknown as Extract<Node, { kind: "link" }>);
		}
		pending.push(...Object.values(record));
	}
	return found;
}

describe("signed board-link delivery", () => {
	it("uses the admitted identity, never the hostile request or representative pin", async () => {
		const artifact = await signedEmployee();
		const parsed = await parseSourceSurfaceResponse(
			new Response(JSON.stringify(artifact), {
				headers: { "content-type": SOURCE_SURFACE_V1_MEDIA_TYPE },
			}),
			{
				artifactId: "taxis:employee",
				dialectHint: "ledger",
				admission: {
					expectedIssuer: "taxis",
					expectedSurfaceId: TAXIS_ENTRY.sourceSurfaceId,
					surfaceIdMatch: "family",
					publicKeys: {
						taxis: { "taxis-fixture-2026-01": VECTOR.public_key_base64url },
					},
					now: () => new Date("2026-07-17T12:01:00Z"),
				},
			},
		);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;

		// The upstream request could say `worker_id=attacker`; it is intentionally
		// absent from the resolver API. Only the admitted signed id is available.
		const plan = resolveBoardLinks(
			BOARD,
			"taxis",
			parsed.envelope.admittedSurfaceId,
			parsed.envelope.sourceIr,
			"2026-07-22",
		);
		const painted = emitNodeWithTrackedLinkPaints(
			parsed.envelope.sourceIr,
			plan.paints,
			undefined,
			parsed.envelope.sourceEmitContext,
		);
		const delivered = rewriteKernelLinks(painted.tree, TAXIS, undefined, painted.paintedLinks);
		expect(links(delivered)).toContainEqual({
			kind: "link",
			href: "/s/misthos/payslip?worker_id=signed-worker&as_of=2026-07-22",
			label: "Matthías",
		});
		expect(JSON.stringify(delivered)).not.toContain("attacker");
		expect(JSON.stringify(delivered)).not.toContain("representative");
	});
});
