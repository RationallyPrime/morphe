import { createHash } from "node:crypto";
import type { Sha256 } from "../artifacts/source-types.generated.js";
import { validateNodeDocument } from "../artifacts/surface.js";
import { GRAMMAR_VERSION } from "../grammar/version.js";
import { buildSurface } from "./build.js";
import { COMPILER_BUILD_SHA256 } from "./build-id.generated.js";
import { DEFAULT_EMIT_CONTEXT, type EmitContext, emitNode, SurfaceEmitLimitError } from "./emit.js";
import type { TrustedSourceSurface } from "./source.js";
import type { CompilationResult, CompilerDiagnostic, SurfaceNode, TemporalPolicy } from "./spec.js";

export const COMPILER_VERSION = "0.3.5";

export class SurfaceCompilerInvariantError extends Error {}

function collectDiagnostics(spec: SurfaceNode, output: CompilerDiagnostic[]): void {
	output.push(...spec.diagnostics);
	for (const child of [...spec.children, ...spec.items]) collectDiagnostics(child, output);
}

function canonicalJson(value: unknown): string {
	if (value === null || typeof value === "boolean" || typeof value === "string") {
		return JSON.stringify(value);
	}
	if (typeof value === "number") {
		if (!Number.isFinite(value)) throw new TypeError("canonical JSON requires finite numbers");
		return JSON.stringify(value);
	}
	if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
	if (typeof value !== "object") throw new TypeError("value is outside the JSON domain");
	const record = value as Record<string, unknown>;
	return `{${Object.keys(record)
		.sort()
		.filter((key) => record[key] !== undefined)
		.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
		.join(",")}}`;
}

function sha256(value: unknown): Sha256 {
	const canonical = canonicalJson(value);
	return `sha256:${createHash("sha256").update(canonical, "utf8").digest("hex")}`;
}

function limitDiagnostic(error: SurfaceEmitLimitError): CompilerDiagnostic {
	return {
		code: error.code,
		severity: "warning",
		path: "$",
		message: error.message,
	};
}

/**
 * Options for {@link compileSourceSurface}. The temporal policy is the viewer's
 * presentation choice for instant-typed values (default {@link DEFAULT_TEMPORAL_POLICY}
 * = minute); `now` injects the render-time clock the `relative` policy reads, kept
 * explicit so a compile is reproducible for a fixed instant.
 */
export interface CompileSourceSurfaceOptions {
	readonly temporalPolicy?: TemporalPolicy;
	readonly now?: () => Date;
}

/**
 * Pure, dialect-free edge compilation over already-admitted testimony.
 * Dialect policy and its delivery receipt are intentionally downstream.
 *
 * The temporal policy is a compiler INPUT, not a renderer reformat: one formatting
 * truth, deterministic per (source, policy), so the receipt (which records the policy)
 * stays honest. The signed source is never mutated — only the compiled display text
 * bends to the policy.
 */
export function compileSourceSurface(
	source: TrustedSourceSurface,
	options: CompileSourceSurfaceOptions = {},
): CompilationResult {
	const context: EmitContext = {
		temporalPolicy: options.temporalPolicy ?? DEFAULT_EMIT_CONTEXT.temporalPolicy,
		now: options.now ?? DEFAULT_EMIT_CONTEXT.now,
	};
	const spec = buildSurface(source.schema, source.data, {
		root: source.schema,
		diagnostics: source.diagnostics,
	});
	const diagnostics: CompilerDiagnostic[] = [];
	collectDiagnostics(spec, diagnostics);

	let emitted: unknown;
	try {
		emitted = emitNode(spec, undefined, context);
	} catch (error) {
		if (!(error instanceof SurfaceEmitLimitError)) throw error;
		const diagnostic = limitDiagnostic(error);
		diagnostics.push(diagnostic);
		emitted = {
			kind: "inline-alert",
			tone: "caution",
			title: "Surface limit",
			detail: diagnostic.message,
		};
	}

	const validated = validateNodeDocument(emitted);
	if (!validated.ok) {
		const issue = validated.issues[0];
		throw new SurfaceCompilerInvariantError(
			issue === undefined
				? "surface compiler emitted an invalid Node"
				: `surface compiler emitted an invalid Node: ${issue.message}`,
		);
	}

	return {
		tree: validated.value,
		diagnostics,
		receipt: {
			sourceTestimonySha256: source.sourceTestimonySha256,
			compilerVersion: COMPILER_VERSION,
			compilerBuildSha256: COMPILER_BUILD_SHA256,
			grammarVersion: GRAMMAR_VERSION,
			treeSha256: sha256(validated.value),
			diagnosticsSha256: sha256(diagnostics),
			temporalPolicy: context.temporalPolicy,
			surfaceIdGate: source.surfaceIdGate,
		},
	};
}
