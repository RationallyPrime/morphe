import type { Node } from "$lib";
import { GRAMMAR_VERSION } from "$lib";
import { compileSourceSurface } from "$lib/surface-edge/compile.js";
import { admitSourceSurfaceJson, type SourceAdmissionOptions } from "$lib/surface-edge/source.js";
import type { CompilationReceipt } from "$lib/surface-edge/spec.js";
import { readSourceSurfaceResponse } from "./surface-reader.js";

export interface CompiledSourceEnvelope {
	readonly artifactId: string;
	readonly grammarVersion: string;
	readonly compilerVersion: string;
	readonly dialectHint: string;
	readonly tree: Node;
	readonly compilationReceipt: CompilationReceipt;
}

export type SourceEnvelopeResult =
	| { readonly ok: true; readonly envelope: CompiledSourceEnvelope }
	| { readonly ok: false; readonly reason: string; readonly rawGrammarVersion?: string };

export interface SourceEnvelopeOptions {
	readonly artifactId: string;
	readonly dialectHint: string;
	readonly admission: SourceAdmissionOptions;
}

/**
 * Source-v1 reader: exact media → raw/JCS admission → deterministic compilation
 * → grammar gate. The loader applies host transforms and gates the exact final
 * tree against the dialect that will actually render. No unbranded testimony
 * reaches the compiler and no unvalidated compiler output reaches that gate.
 */
export async function parseSourceSurfaceResponse(
	response: Response,
	options: SourceEnvelopeOptions,
): Promise<SourceEnvelopeResult> {
	const body = await readSourceSurfaceResponse(response);
	if (!body.ok) return body;

	const admitted = await admitSourceSurfaceJson(body.rawJson, options.admission);
	if (!admitted.ok) {
		return {
			ok: false,
			reason: `source ${admitted.issue.code} gate failed: ${admitted.issue.reason}`,
		};
	}

	let compiled: ReturnType<typeof compileSourceSurface>;
	try {
		compiled = compileSourceSurface(admitted.value);
	} catch (error) {
		return {
			ok: false,
			reason: `edge compilation failed: ${
				error instanceof Error ? error.message : "unknown compiler failure"
			}`,
		};
	}
	if (compiled.receipt.grammarVersion !== GRAMMAR_VERSION) {
		return {
			ok: false,
			reason: `edge compiler grammar_version ${compiled.receipt.grammarVersion} is not supported`,
			rawGrammarVersion: compiled.receipt.grammarVersion,
		};
	}
	return {
		ok: true,
		envelope: {
			artifactId: options.artifactId,
			grammarVersion: compiled.receipt.grammarVersion,
			compilerVersion: compiled.receipt.compilerVersion,
			dialectHint: options.dialectHint,
			tree: compiled.tree,
			compilationReceipt: compiled.receipt,
		},
	};
}
