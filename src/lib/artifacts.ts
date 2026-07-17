/** Trusted compiled-surface artifact contracts and runtime validation. */

export { SOURCE_SURFACE_ARTIFACT_JSON_SCHEMA } from "./artifacts/source-schema.generated.js";
export type {
	Diagnostic,
	Ed25519Attestation,
	JsonObject,
	JsonValue,
	Sha256,
	SourceSeals,
	SourceSurfaceArtifactV1,
	ViewModelContract,
} from "./artifacts/source-types.generated.js";

export type {
	ArtifactValidationIssue,
	ArtifactValidationIssueCode,
	ArtifactValidationLimits,
	SurfaceArtifactDiagnostic,
	SurfaceArtifactDocument,
	TrustedSurfaceArtifact,
	ValidationResult,
} from "./artifacts/surface.js";
export {
	DEFAULT_ARTIFACT_VALIDATION_LIMITS,
	formatArtifactValidationIssue,
	validateNodeDocument,
	validateSurfaceArtifact,
} from "./artifacts/surface.js";
