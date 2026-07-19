import type { Node } from "$lib";
import { GRAMMAR_VERSION } from "$lib";
import { compileSourceSurface } from "$lib/surface-edge/compile.js";
import { admitSourceSurfaceJson, type SourceAdmissionOptions } from "$lib/surface-edge/source.js";
import type { CompilationReceipt, TemporalPolicy } from "$lib/surface-edge/spec.js";
import { readSourceSurfaceResponse } from "./surface-reader.js";

export interface CompiledSourceEnvelope {
	readonly artifactId: string;
	readonly grammarVersion: string;
	readonly compilerVersion: string;
	readonly dialectHint: string;
	readonly tree: Node;
	readonly compilationReceipt: CompilationReceipt;
	/**
	 * The concrete `surface_id` the admission gate actually accepted. For a family-mode
	 * drill-through (KRA-776/777) this is the producer's family-canonical instance — the
	 * carrier of the kernel's resolved window (KRA-779/KRA-789) — which can differ from
	 * the pinned representative the request was made through.
	 */
	readonly admittedSurfaceId: string;
}

export type SourceEnvelopeResult =
	| { readonly ok: true; readonly envelope: CompiledSourceEnvelope }
	| { readonly ok: false; readonly reason: string; readonly rawGrammarVersion?: string };

export interface SourceEnvelopeOptions {
	readonly artifactId: string;
	readonly dialectHint: string;
	readonly admission: SourceAdmissionOptions;
	/**
	 * The viewer's instant presentation policy. The signed source is never mutated;
	 * only the compiled display text bends to this. Omitted → the compiler default
	 * (minute). The chosen policy is recorded on the compilation receipt.
	 */
	readonly temporalPolicy?: TemporalPolicy;
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
		compiled = compileSourceSurface(admitted.value, {
			...(options.temporalPolicy === undefined ? {} : { temporalPolicy: options.temporalPolicy }),
		});
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
			admittedSurfaceId: admitted.value.surface_id,
		},
	};
}
