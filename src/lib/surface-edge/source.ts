import { Buffer } from "node:buffer";
import type {
	Diagnostic,
	JsonObject,
	JsonValue,
	Sha256,
	SourceSurfaceArtifactV1,
} from "../artifacts/source-types.generated.js";
import {
	computeSourceEvidence,
	parseJcsJson,
	sealsMatch,
	verifyEd25519Attestation,
} from "./attest.js";
import {
	inspectSourceComplexity,
	type NormalizedDiagnostic,
	type NormalizedSourceSurfaceArtifact,
	type SourceValidationLimits,
	validateAuthenticatedSchemaData,
	validateSourceEnvelope,
} from "./schema.js";
import {
	DEFAULT_SURFACE_ID_GATE,
	isValidSurfaceId,
	type SurfaceIdGateMode,
	surfaceFamily,
} from "./spec.js";

declare const trustedSourceSurface: unique symbol;

/** Immutable source testimony admitted by identity, crypto, freshness, and schema gates. */
export type TrustedSourceSurface = NormalizedSourceSurfaceArtifact & {
	readonly schema: JsonObject;
	readonly data: JsonValue;
	readonly diagnostics: readonly NormalizedDiagnostic[];
	readonly sourceTestimonySha256: Sha256;
	/** Which identity gate mode admitted this testimony; carried into the receipt. */
	readonly surfaceIdGate: SurfaceIdGateMode;
	readonly [trustedSourceSurface]: true;
};

export type SourceAdmissionIssueCode =
	| "json"
	| "bounds"
	| "envelope"
	| "grammar"
	| "identity"
	| "seal"
	| "key"
	| "signature"
	| "freshness"
	| "replay"
	| "schema"
	| "capability";

export interface SourceAdmissionIssue {
	readonly code: SourceAdmissionIssueCode;
	readonly reason: string;
}

export type SourceAdmissionResult =
	| { readonly ok: true; readonly value: TrustedSourceSurface }
	| { readonly ok: false; readonly issue: SourceAdmissionIssue };

export interface SourceFreshnessPolicy {
	/** Maximum age when `valid_until` alone would otherwise permit older testimony. */
	readonly maxAgeMs: number;
	/** Clock tolerance applied to future production and expiry checks. */
	readonly maxFutureSkewMs: number;
}

export interface SourceReplayContext {
	readonly issuer: string;
	readonly surfaceId: string;
	readonly sourceRevision: string;
	readonly testimonySha256: Sha256;
	readonly producedAt: string;
	readonly validUntil: string | null;
}

export type SourceReplayGuard = (context: SourceReplayContext) => boolean | Promise<boolean>;

/** One issuer's pinned Ed25519 keys, indexed by signed key_id. */
export type SourceIssuerPublicKeys = Readonly<Record<string, string>> | ReadonlyMap<string, string>;

/** Host-owned trust roots, indexed by issuer and then key_id. */
export type SourcePublicKeyring =
	| Readonly<Record<string, SourceIssuerPublicKeys>>
	| ReadonlyMap<string, SourceIssuerPublicKeys>;

export interface SourceAdmissionOptions {
	readonly expectedIssuer: string;
	readonly expectedSurfaceId: string;
	/**
	 * How to check the admitted `surface_id` against {@link expectedSurfaceId}.
	 *
	 * `exact` (default) demands verbatim equality — the pinned/unforwarded request.
	 * `family` relaxes ONLY this check to a match on the grammar-parsed `<source>.<pane>`
	 * family token (the segment before the first `:`; see {@link surfaceFamily}) for a
	 * derived drill-through instance whose forwarded params made the producer emit a
	 * param-scoped id. The caller decides this from how it built the request, never from
	 * the artifact; every other trust gate (issuer, seals, key, signature, freshness,
	 * schema, capability) stays strict in both modes.
	 */
	readonly surfaceIdMatch?: SurfaceIdGateMode;
	/** Public keys are pinned by (issuer, key_id), never learned from testimony. */
	readonly publicKeys: SourcePublicKeyring;
	readonly supportedCapabilities?: ReadonlySet<string>;
	readonly limits?: Partial<SourceValidationLimits>;
	readonly freshness?: Partial<SourceFreshnessPolicy>;
	readonly now?: () => Date;
	readonly replayGuard?: SourceReplayGuard;
}

const DEFAULT_FRESHNESS: SourceFreshnessPolicy = Object.freeze({
	maxAgeMs: 5 * 60 * 1_000,
	maxFutureSkewMs: 30 * 1_000,
});
export const MAX_SOURCE_SURFACE_BYTES = 2 * 1024 * 1024;

function failure(code: SourceAdmissionIssueCode, reason: string): SourceAdmissionResult {
	return { ok: false, issue: { code, reason } };
}

function keyedValue<T>(
	values: Readonly<Record<string, T>> | ReadonlyMap<string, T>,
	key: string,
): T | undefined {
	if (values instanceof Map) return values.get(key);
	const record = values as Readonly<Record<string, T>>;
	return Object.hasOwn(record, key) ? record[key] : undefined;
}

function publicKeyFor(
	keys: SourcePublicKeyring,
	issuer: string,
	keyId: string,
): string | undefined {
	const issuerKeys = keyedValue(keys, issuer);
	return issuerKeys === undefined ? undefined : keyedValue(issuerKeys, keyId);
}

/**
 * The identity-gate reason, or null when `surfaceId` satisfies the requested mode.
 *
 * `exact` requires verbatim equality. `family` requires `surfaceId` to share the expected
 * id's grammar-parsed `<source>.<pane>` family token — so a param-scoped derived instance
 * is admitted while a cross-family id (a different `<source>.<pane>` slot) still hard-fails.
 * The pin is grammar-checked first (KRA-777): a misconfigured `<source>:<pane>:…` pin can
 * no longer collapse the family and admit foreign panes. Only `surface_id` is relaxed here;
 * the issuer check and every crypto/freshness/schema gate run unchanged downstream.
 */
function surfaceIdGateReason(
	surfaceId: string,
	expectedSurfaceId: string,
	mode: SurfaceIdGateMode,
): string | null {
	if (mode === "exact") {
		return surfaceId === expectedSurfaceId
			? null
			: "surface_id does not match the requested surface";
	}
	const expectedFamily = surfaceFamily(expectedSurfaceId);
	if (expectedFamily === null) {
		return "expected surface_id does not parse under the surface_id family grammar";
	}
	return surfaceFamily(surfaceId) === expectedFamily
		? null
		: "surface_id is outside the requested surface family";
}

function canonicalTimestamp(value: string): Date | null {
	const parsed = new Date(value);
	if (!Number.isFinite(parsed.getTime())) return null;
	return parsed.toISOString().replace(".000Z", "Z") === value ? parsed : null;
}

function freshnessReason(
	artifact: NormalizedSourceSurfaceArtifact,
	options: SourceAdmissionOptions,
): string | null {
	const producedAt = canonicalTimestamp(artifact.produced_at);
	if (producedAt === null) return "produced_at is not a real canonical UTC timestamp";
	const validUntil =
		artifact.valid_until === null ? null : canonicalTimestamp(artifact.valid_until);
	if (artifact.valid_until !== null && validUntil === null) {
		return "valid_until is not a real canonical UTC timestamp";
	}
	if (validUntil !== null && validUntil.getTime() < producedAt.getTime()) {
		return "valid_until precedes produced_at";
	}

	const now = (options.now ?? (() => new Date()))();
	if (!Number.isFinite(now.getTime())) return "viewer clock did not return a valid timestamp";
	const policy = { ...DEFAULT_FRESHNESS, ...options.freshness };
	if (!Number.isFinite(policy.maxAgeMs) || policy.maxAgeMs < 0) {
		return "freshness maxAgeMs must be a non-negative finite number";
	}
	if (!Number.isFinite(policy.maxFutureSkewMs) || policy.maxFutureSkewMs < 0) {
		return "freshness maxFutureSkewMs must be a non-negative finite number";
	}
	if (producedAt.getTime() > now.getTime() + policy.maxFutureSkewMs) {
		return "source testimony was produced too far in the future";
	}
	if (now.getTime() - producedAt.getTime() > policy.maxAgeMs + policy.maxFutureSkewMs) {
		return "source testimony exceeds the configured maximum age";
	}
	if (validUntil !== null && now.getTime() - policy.maxFutureSkewMs > validUntil.getTime()) {
		return "source testimony is no longer valid";
	}
	return null;
}

function unsupportedCapability(
	artifact: NormalizedSourceSurfaceArtifact,
	supported: ReadonlySet<string>,
): string | null {
	for (const capability of artifact.required_capabilities) {
		if (!supported.has(capability)) return capability;
	}
	return null;
}

function cloneAndFreeze<T>(value: T): T {
	const clone = structuredClone(value);
	const pending: object[] = [];
	if (typeof clone === "object" && clone !== null) pending.push(clone);
	const seen = new WeakSet<object>();
	while (pending.length > 0) {
		const current = pending.pop();
		if (!current || seen.has(current)) continue;
		seen.add(current);
		for (const child of Object.values(current)) {
			if (typeof child === "object" && child !== null) pending.push(child);
		}
		Object.freeze(current);
	}
	return clone;
}

function admittedSnapshot(
	artifact: NormalizedSourceSurfaceArtifact,
	testimonySha256: Sha256,
	surfaceIdGate: SurfaceIdGateMode,
): TrustedSourceSurface {
	return cloneAndFreeze({
		...artifact,
		sourceTestimonySha256: testimonySha256,
		surfaceIdGate,
	}) as TrustedSourceSurface;
}

/**
 * Admit one raw source-v1 JSON document in the normative trust-gate order.
 *
 * Raw text is intentional: parsing to `unknown` first would irreversibly round
 * unsafe integer tokens before RFC 8785 canonicalization could reject them.
 */
export async function admitSourceSurfaceJson(
	rawJson: string,
	options: SourceAdmissionOptions,
): Promise<SourceAdmissionResult> {
	if (Buffer.byteLength(rawJson, "utf8") > MAX_SOURCE_SURFACE_BYTES) {
		return failure("bounds", `source response exceeds ${MAX_SOURCE_SURFACE_BYTES} bytes`);
	}
	const parsed = parseJcsJson(rawJson);
	if (!parsed.ok) return failure("json", parsed.reason);
	const complexity = inspectSourceComplexity(parsed.value, options.limits);
	if (complexity !== null) return failure("bounds", complexity);
	const envelope = validateSourceEnvelope(parsed.value);
	if (!envelope.ok) return failure("envelope", envelope.reason);
	const artifact = envelope.value;

	if (artifact.issuer !== options.expectedIssuer) {
		return failure("identity", "source issuer does not match the expected issuer");
	}
	// Defense in depth (KRA-777): the generated schema's `surface_id` pattern already
	// rejected a malformed id at the envelope gate above, but re-assert the grammar here so
	// the family-mode comparison can never key off a `<source>:<pane>:…` collapse even if a
	// future schema regression let one through.
	if (!isValidSurfaceId(artifact.surface_id)) {
		return failure("grammar", "surface_id does not parse under the family grammar");
	}
	const gateMode = options.surfaceIdMatch ?? DEFAULT_SURFACE_ID_GATE;
	const surfaceIdReason = surfaceIdGateReason(
		artifact.surface_id,
		options.expectedSurfaceId,
		gateMode,
	);
	if (surfaceIdReason !== null) return failure("identity", surfaceIdReason);

	let evidence: Awaited<ReturnType<typeof computeSourceEvidence>>;
	try {
		evidence = await computeSourceEvidence(artifact);
	} catch (error) {
		return failure(
			"seal",
			`source evidence is outside the RFC 8785 domain: ${
				error instanceof Error ? error.message : "unknown canonicalization error"
			}`,
		);
	}
	const sealResult = sealsMatch(artifact, evidence);
	if (!sealResult.ok) return failure("seal", sealResult.reason);
	const publicKey = publicKeyFor(options.publicKeys, artifact.issuer, artifact.attestation.key_id);
	if (publicKey === undefined) {
		return failure("key", "no trusted public key matches issuer and key_id");
	}
	const attestation = await verifyEd25519Attestation(artifact, evidence, publicKey);
	if (!attestation.ok) return failure("signature", attestation.reason);

	const stale = freshnessReason(artifact, options);
	if (stale !== null) return failure("freshness", stale);
	if (options.replayGuard !== undefined) {
		const accepted = await options.replayGuard({
			issuer: artifact.issuer,
			surfaceId: artifact.surface_id,
			sourceRevision: artifact.source_revision,
			testimonySha256: evidence.testimonySha256,
			producedAt: artifact.produced_at,
			validUntil: artifact.valid_until,
		});
		if (!accepted) return failure("replay", "source revision was rejected by replay policy");
	}

	const schemaData = validateAuthenticatedSchemaData(
		artifact.schema,
		artifact.data,
		options.limits,
	);
	if (!schemaData.ok) return failure("schema", schemaData.reason);
	const unsupported = unsupportedCapability(
		artifact,
		options.supportedCapabilities ?? new Set<string>(),
	);
	if (unsupported !== null) {
		return failure("capability", `source requires unsupported capability ${unsupported}`);
	}

	return {
		ok: true,
		value: admittedSnapshot(artifact, evidence.testimonySha256, gateMode),
	};
}

/** Structural helper for compiler code that only needs the admitted projection fields. */
export interface AdmittedSourceSurface {
	readonly schema: JsonObject;
	readonly data: JsonValue;
	readonly diagnostics: readonly Diagnostic[];
	readonly sourceTestimonySha256: Sha256;
}

// Keep generated source types reachable for consumers of this focused module.
export type { SourceSurfaceArtifactV1 };
