import { error } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { GRAMMAR_VERSION, hasDialect } from "$lib";
import { isValidArtifactId, parseSurfaceEnvelope } from "../../../envelope.js";
import type { PageServerLoad } from "./$types.js";

/*
 * /surfaces/[artifactId] — the viewer container (KRA-648 / MO-D3).
 *
 * SSR-fetches the artifact JSON from the topos read route over the docker
 * bridge (`MORPHE_ARTIFACT_BASE_URL/{artifactId}`); the human's browser talks
 * only to this viewer, so topos stays in-net and CORS stays fail-closed.
 *
 * Fail-closed grammar gate (MO-D5): an unsupported grammar_version renders a
 * diagnostic page naming both versions — never a silent partial render.
 * Dialect: `?dialect=` override when it names a shipped dialect, else the
 * envelope's dialect_hint (getDialect in the page is total, so a stale hint
 * still renders under the default dialect).
 */

const FETCH_TIMEOUT_MS = 4000;

export const load: PageServerLoad = async ({ params, url, fetch }) => {
	if (!isValidArtifactId(params.artifactId)) error(404, { message: "Unknown artifact." });

	const baseUrl = env.MORPHE_ARTIFACT_BASE_URL;
	if (!baseUrl) {
		error(503, {
			message: "MORPHE_ARTIFACT_BASE_URL is not configured; the viewer has no artifact store.",
			code: "not-configured",
		});
	}

	let response: Response;
	try {
		response = await fetch(
			`${baseUrl.replace(/\/+$/, "")}/${encodeURIComponent(params.artifactId)}`,
			{
				headers: { accept: "application/json" },
				signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
			},
		);
	} catch {
		error(502, {
			message: "The artifact store is unreachable.",
			code: "upstream-unreachable",
			artifactId: params.artifactId,
		});
	}

	if (response.status === 404) error(404, { message: "Unknown artifact." });
	if (!response.ok) {
		error(502, {
			message: `The artifact store answered ${response.status}.`,
			code: "upstream-unreachable",
			artifactId: params.artifactId,
		});
	}

	let body: unknown;
	try {
		body = await response.json();
	} catch {
		error(502, {
			message: "The artifact store returned a non-JSON body.",
			code: "upstream-unreachable",
			artifactId: params.artifactId,
		});
	}

	const parsed = parseSurfaceEnvelope(body);
	if (!parsed.ok) {
		error(502, {
			message: `The artifact envelope is malformed: ${parsed.reason}.`,
			code: "upstream-unreachable",
			artifactId: params.artifactId,
		});
	}

	// Fail-closed grammar gate: no partial render, name both versions (MO-D5).
	if (parsed.envelope.grammarVersion !== GRAMMAR_VERSION) {
		error(409, {
			message: "This artifact was compiled under a grammar this viewer does not support.",
			code: "grammar-mismatch",
			artifactId: params.artifactId,
			artifactVersion: parsed.envelope.grammarVersion,
			supportedVersion: GRAMMAR_VERSION,
		});
	}

	const dialectParam = url.searchParams.get("dialect");
	const dialectId =
		dialectParam !== null && hasDialect(dialectParam) ? dialectParam : parsed.envelope.dialectHint;

	return {
		artifactId: parsed.envelope.artifactId,
		tree: parsed.envelope.tree,
		dialectId,
	};
};
