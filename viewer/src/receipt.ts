import { getDialect, type Node } from "$lib";
import type { Sha256 } from "$lib/artifacts/source-types.generated.js";
import { DIALECT_COMPOUND_CONSTRAINTS } from "$lib/dialects/constraints.generated.js";
import { canonicalJsonSha256 } from "$lib/surface-edge/attest.js";
import type { CompilationReceipt } from "$lib/surface-edge/spec.js";

/** Dialect-aware audit record created only after the exact delivered tree passes its gate. */
export interface DeliveryReceipt extends CompilationReceipt {
	readonly dialectId: string;
	readonly dialectPolicySha256: Sha256;
	/** Hash after host link rewriting or any other delivery-boundary transform. */
	readonly deliveredTreeSha256: Sha256;
}

export async function createDeliveryReceipt(
	compilation: CompilationReceipt,
	tree: Node,
	requestedDialectId: string,
): Promise<DeliveryReceipt> {
	const dialectId = getDialect(requestedDialectId).id;
	const policy =
		DIALECT_COMPOUND_CONSTRAINTS[dialectId as keyof typeof DIALECT_COMPOUND_CONSTRAINTS];
	const [dialectPolicySha256, deliveredTreeSha256] = await Promise.all([
		canonicalJsonSha256({ dialect_id: dialectId, policy }),
		canonicalJsonSha256(tree),
	]);
	return Object.freeze({
		...compilation,
		dialectId,
		dialectPolicySha256,
		deliveredTreeSha256,
	});
}
