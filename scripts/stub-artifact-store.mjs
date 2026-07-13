/**
 * Stub topos surface-artifact store — CI/local smoke harness for the box
 * viewer (KRA-648). Serves the KRA-644 `SurfaceArtifactResponse` envelope
 * shape on GET /api/v1/surfaces/{artifact_id}:
 *
 *   surface:capability-page:run-42     a supported-grammar artifact (ledger)
 *   surface:capability-page:run-drift  grammar_version 9.9.9 → the viewer
 *                                      must fail closed with a diagnostic
 *   anything else                      404
 *
 * Run: node scripts/stub-artifact-store.mjs  (listens on :4399)
 */

import { createServer } from "node:http";

const artifact = {
	artifact_id: "surface:capability-page:run-42",
	recipe_name: "capability-page",
	run_id: "run-42",
	trace_id: "trace-1",
	grammar_version: "0.2.0",
	compiler_version: "0.1.0",
	produced_at: "2026-07-06T00:00:00Z",
	dialect_hint: "ledger",
	diagnostic_count: 0,
	artifact_sequence: 1,
	stored_at: "2026-07-06T00:00:01Z",
	artifact: {
		tree: {
			kind: "frame",
			role: "page",
			surface: "base",
			children: [
				{
					kind: "stack",
					role: "section",
					children: [
						{ kind: "badge", label: "topos artifact", intent: "provenance", icon: "schema" },
						{
							kind: "text",
							value: "Served from the artifact store",
							as: "display",
							emphasis: "strong",
						},
						{ kind: "text", value: "Rendered by the box viewer", as: "body" },
					],
				},
			],
		},
		grammar_version: "0.2.0",
		producer_version: "0.1.0",
		diagnostics: [],
		produced_at: "2026-07-06T00:00:00Z",
		compiler_version: "0.1.0",
	},
};

const drifted = structuredClone(artifact);
drifted.artifact_id = "surface:capability-page:run-drift";
drifted.grammar_version = "9.9.9";

const PORT = Number(process.env.STUB_PORT ?? 4399);

createServer((req, res) => {
	const id = decodeURIComponent((req.url ?? "").split("/").pop() ?? "");
	const body = id === artifact.artifact_id ? artifact : id === drifted.artifact_id ? drifted : null;
	if (body === null) {
		res.writeHead(404, { "content-type": "application/json" });
		res.end('{"detail":"not found"}');
		return;
	}
	res.writeHead(200, { "content-type": "application/json" });
	res.end(JSON.stringify(body));
}).listen(PORT, () => {
	console.error(`stub artifact store on :${PORT}`);
});
