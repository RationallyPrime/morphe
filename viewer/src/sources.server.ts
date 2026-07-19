/**
 * Server-side source-config access: parses `MORPHE_SOURCES` and resolves
 * per-source bearer tokens from PRIVATE env. Tokens are injected during SSR
 * only — they never reach the browser, and a source that NAMES a token env
 * whose value is absent is a configuration error (fail closed), never a
 * silent unauthenticated fetch.
 */

import { error } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { parseSourcesConfig, type SourceConfig } from "./sources.js";

export function loadSources(): ReadonlyMap<string, SourceConfig> {
	const parsed = parseSourcesConfig(env.MORPHE_SOURCES);
	if (!parsed.ok) {
		error(503, {
			message: `MORPHE_SOURCES is invalid: ${parsed.reason}.`,
			code: "not-configured",
		});
	}
	return parsed.sources;
}

export function bearerFor(source: SourceConfig): string | undefined {
	if (source.tokenEnv === undefined) return undefined;
	const token = env[source.tokenEnv];
	if (token === undefined || token === "") {
		error(503, {
			message: `Source "${source.id}" names token env ${source.tokenEnv}, which is unset.`,
			code: "not-configured",
		});
	}
	return token;
}
