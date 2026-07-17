/**
 * Public server-only source-surface admission and compilation seam.
 *
 * `compileSourceSurface` is deliberately synchronous and uses Node crypto for
 * deterministic receipt hashes. Import this subpath from server/edge-delivery
 * code, never from a browser component bundle.
 */

export type { SourceEvidence } from "./surface-edge/attest.js";
export {
	canonicalJson,
	canonicalJsonSha256,
	computeSourceEvidence,
	decodeCanonicalBase64url,
	encodeBase64url,
	SOURCE_SIGNATURE_CONTEXT,
} from "./surface-edge/attest.js";
export { COMPILER_BUILD_SHA256 } from "./surface-edge/build-id.generated.js";
export {
	COMPILER_VERSION,
	compileSourceSurface,
	SurfaceCompilerInvariantError,
} from "./surface-edge/compile.js";
export type { SourceValidationLimits } from "./surface-edge/schema.js";
export { DEFAULT_SOURCE_VALIDATION_LIMITS } from "./surface-edge/schema.js";
export type {
	SourceAdmissionIssue,
	SourceAdmissionIssueCode,
	SourceAdmissionOptions,
	SourceAdmissionResult,
	SourceFreshnessPolicy,
	SourceReplayContext,
	SourceReplayGuard,
	TrustedSourceSurface,
} from "./surface-edge/source.js";
export {
	admitSourceSurfaceJson,
	MAX_SOURCE_SURFACE_BYTES,
} from "./surface-edge/source.js";
export type {
	CompilationReceipt,
	CompilationResult,
	CompilerDiagnostic,
} from "./surface-edge/spec.js";
