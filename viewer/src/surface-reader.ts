import { MAX_SOURCE_SURFACE_BYTES } from "$lib/surface-edge/source.js";

/** The sole Stage-1 source representation; negotiation is explicit and fail closed. */
export const SOURCE_SURFACE_V1_MEDIA_TYPE = "application/vnd.morphe.source-surface+json;v=1";

export type SourceBodyResult =
	| { readonly ok: true; readonly rawJson: string }
	| { readonly ok: false; readonly reason: string };

function hasExactSourceMediaType(response: Response): boolean {
	const value = response.headers.get("content-type");
	return value?.trim().toLowerCase() === SOURCE_SURFACE_V1_MEDIA_TYPE;
}

async function boundedResponseBytes(response: Response): Promise<Uint8Array | string> {
	const advertisedLength = response.headers.get("content-length");
	if (advertisedLength !== null) {
		const parsedLength = Number(advertisedLength);
		if (Number.isFinite(parsedLength) && parsedLength > MAX_SOURCE_SURFACE_BYTES) {
			return `source response exceeds ${MAX_SOURCE_SURFACE_BYTES} bytes`;
		}
	}

	if (!response.body) return new Uint8Array();
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let length = 0;
	while (true) {
		const next = await reader.read();
		if (next.done) break;
		length += next.value.byteLength;
		if (length > MAX_SOURCE_SURFACE_BYTES) {
			await reader.cancel();
			return `source response exceeds ${MAX_SOURCE_SURFACE_BYTES} bytes`;
		}
		chunks.push(next.value);
	}

	const bytes = new Uint8Array(length);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return bytes;
}

/** Bound and decode raw UTF-8 without first rounding JCS integer tokens. */
export async function readSourceSurfaceResponse(response: Response): Promise<SourceBodyResult> {
	if (!hasExactSourceMediaType(response)) {
		return {
			ok: false,
			reason: `source response Content-Type must be exactly ${SOURCE_SURFACE_V1_MEDIA_TYPE}`,
		};
	}
	const bytes = await boundedResponseBytes(response);
	if (typeof bytes === "string") return { ok: false, reason: bytes };
	try {
		return {
			ok: true,
			rawJson: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
		};
	} catch {
		return { ok: false, reason: "source response is not valid UTF-8" };
	}
}
