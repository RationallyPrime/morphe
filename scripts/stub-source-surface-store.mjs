/**
 * Source-v1 fixture origin for the compiler-renderer browser contract.
 *
 * It deliberately enforces both halves of negotiation: the viewer must request
 * the source-v1 media type and the response carries that exact Content-Type.
 * The fixture is the committed, Python-generated, non-expiring Taxis testimony.
 */

import { readFileSync } from "node:fs";
import { createServer } from "node:http";

const HOST = "127.0.0.1";
const PORT = Number(process.env.MORPHE_EDGE_STUB_PORT ?? "4401");
const SOURCE_MEDIA_TYPE = "application/vnd.morphe.source-surface+json;v=1";
const SOURCE_PATH = "/source/taxis-roster";
const LEGACY_PATH = "/legacy/taxis-roster";
const fixture = readFileSync(
	new URL("../fixtures/source-surface/taxis-roster.source.json", import.meta.url),
);
const legacyTree = JSON.parse(
	readFileSync(
		new URL("../fixtures/source-surface/taxis-roster.node.json", import.meta.url),
		"utf8",
	),
);
const legacyArtifact = {
	artifact_version: "1.0.0",
	tree: legacyTree,
	grammar_version: "0.2.0",
	producer_version: "0.3.3",
	compiler_version: "0.3.3",
	diagnostics: [],
	produced_at: "2026-07-17T12:00:00Z",
};

function acceptsSourceV1(value) {
	return (value ?? "")
		.split(",")
		.map((part) => part.trim())
		.some((part) => part === SOURCE_MEDIA_TYPE || part.startsWith(`${SOURCE_MEDIA_TYPE};q=`));
}

function json(response, status, body) {
	const encoded = Buffer.from(`${JSON.stringify(body)}\n`);
	response.writeHead(status, {
		"cache-control": "no-store",
		"content-length": String(encoded.byteLength),
		"content-type": "application/json",
	});
	response.end(encoded);
}

const server = createServer((request, response) => {
	const url = new URL(request.url ?? "/", `http://${HOST}:${PORT}`);
	if (request.method === "GET" && url.pathname === "/healthz") {
		json(response, 200, { ok: true });
		return;
	}
	if (request.method === "GET" && url.pathname === LEGACY_PATH) {
		json(response, 200, legacyArtifact);
		return;
	}
	if (request.method !== "GET" || url.pathname !== SOURCE_PATH) {
		json(response, 404, { error: "not-found" });
		return;
	}
	if (!acceptsSourceV1(request.headers.accept)) {
		json(response, 406, { error: "source-v1-accept-required" });
		return;
	}
	response.writeHead(200, {
		"cache-control": "no-store",
		"content-length": String(fixture.byteLength),
		"content-type": SOURCE_MEDIA_TYPE,
	});
	response.end(fixture);
});

server.listen(PORT, HOST, () => {
	process.stdout.write(`source-v1 fixture listening on http://${HOST}:${PORT}${SOURCE_PATH}\n`);
});

function close() {
	server.close(() => process.exit(0));
}

process.on("SIGINT", close);
process.on("SIGTERM", close);
