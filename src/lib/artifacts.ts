/** Trusted compiled-surface artifact contracts and runtime validation. */

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
