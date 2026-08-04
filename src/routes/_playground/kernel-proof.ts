import type { Node } from "$lib";
import { validateNodeDocument } from "$lib/artifacts";
import apothekeExpiryTree from "../../../fixtures/krepis-proof/artifacts/apotheke-expiry/apotheke-expiry.node.json";
import chreosBreachedObligationsTree from "../../../fixtures/krepis-proof/artifacts/chreos-breached-obligations/chreos-breached-obligations.node.json";
import misthosRunSummaryTree from "../../../fixtures/krepis-proof/artifacts/misthos-run-summary/misthos-run-summary.node.json";
import obolosFinalityTree from "../../../fixtures/krepis-proof/artifacts/obolos-finality/obolos-finality.node.json";
import taxisRosterTree from "../../../fixtures/krepis-proof/artifacts/taxis-roster/taxis-roster.node.json";
import zygosPostedTransactionTree from "../../../fixtures/krepis-proof/artifacts/zygos-posted-transaction/zygos-posted-transaction.node.json";

export type KernelProofIssuer = "taxis" | "misthos" | "chreos" | "obolos" | "apotheke" | "zygos";

export interface KernelProofCase {
	readonly id: string;
	/** The owning kernel and signed source-v1 issuer are the same fixed identifier. */
	readonly issuer: KernelProofIssuer;
	readonly label: string;
	readonly operationId: string;
	readonly surfaceId: string;
	readonly sourceRevision: string;
	readonly testimonySha256: string;
	readonly treeSha256: string;
	readonly tree: Node;
}

type SixKernelProofCases = readonly [
	KernelProofCase,
	KernelProofCase,
	KernelProofCase,
	KernelProofCase,
	KernelProofCase,
	KernelProofCase,
];

function freezeTree<T>(value: T): T {
	if (value === null || typeof value !== "object") return value;
	if (Array.isArray(value)) {
		for (const child of value) freezeTree(child);
	} else {
		for (const child of Object.values(value)) freezeTree(child);
	}
	return Object.freeze(value) as T;
}

function fixedTree(caseId: string, document: unknown): Node {
	const validated = validateNodeDocument(structuredClone(document));
	if (!validated.ok) {
		throw new Error(
			`kernel proof ${caseId} has an invalid committed Node: ${validated.issues
				.map((issue) => issue.message)
				.join("; ")}`,
		);
	}
	return freezeTree(validated.value);
}

const CASES = [
	{
		id: "taxis-roster",
		issuer: "taxis",
		label: "Taxis roster",
		operationId: "get_surface_roster",
		surfaceId: "taxis.roster:2026-W30:as-of:2026-07-20",
		sourceRevision: "seq-13.cfg-e6ac417f1e79",
		testimonySha256: "sha256:5e3a5f2a073482f454c74736fed72064bdeb421bc54a298b7a7f9a66afc9a8dd",
		treeSha256: "sha256:b66b82403beed85f13b7bdfadb14afbe05592b2c1d196f01fa9a86d242399278",
		tree: fixedTree("taxis-roster", taxisRosterTree),
	},
	{
		id: "misthos-run-summary",
		issuer: "misthos",
		label: "Misthos run summary",
		operationId: "get_surface_run_summary",
		surfaceId: "misthos.run-summary:8fc48217-03b7-5132-b493-6cdb0081b237",
		sourceRevision: "seq-33.cfg-0984b7ef3651",
		testimonySha256: "sha256:153bdadf5598a32bc2916ced302564e1462344be0e18e6d3dac165a3cfc5c81b",
		treeSha256: "sha256:655d98a328896a970c95aaa3df5eb6c5f02e852a22987c69dc03c2817c69745b",
		tree: fixedTree("misthos-run-summary", misthosRunSummaryTree),
	},
	{
		id: "chreos-breached-obligations",
		issuer: "chreos",
		label: "Chreos breached obligations",
		operationId: "get_surface_obligations",
		surfaceId: "chreos.obligations:deployment:as-of:2026-09-01",
		sourceRevision: "seq-5.cfg-051fb6baac09",
		testimonySha256: "sha256:416701c69120316e51915d4670695403c77a64eef49eb6407058b7d4b47b8567",
		treeSha256: "sha256:0b05c97016dcc2b47396d709f4a07df9a8c869fb8db64a83a5cae8e7c96ebe8e",
		tree: fixedTree("chreos-breached-obligations", chreosBreachedObligationsTree),
	},
	{
		id: "obolos-finality",
		issuer: "obolos",
		label: "Obolos finality",
		operationId: "get_surface_finality",
		surfaceId: "obolos.finality:deployment:20260714T000000Z-20260801T000000Z:all:all:t3",
		sourceRevision: "seq-24.cfg-08e5b1e5d695.at-20260716T120000Z",
		testimonySha256: "sha256:f4191e91bf40f23c24f753596b3ad49d92ec25110414e17873aa2f9dab2c2f2b",
		treeSha256: "sha256:80bcd933363fab2178a299e12ac3726cfbb5bdfe543908d8f23eed5aa1447273",
		tree: fixedTree("obolos-finality", obolosFinalityTree),
	},
	{
		id: "apotheke-expiry",
		issuer: "apotheke",
		label: "Apotheke expiry",
		operationId: "get_surface_expiry",
		surfaceId: "apotheke.expiry:deployment:h90:as-of:2026-07-20",
		sourceRevision: "seq-8.cfg-8f3ec1bf2659.pin-5",
		testimonySha256: "sha256:093e2d5f8293455a98a413fed557e652f1d77e8fcf0a4b73ab10e1bfb7dbff44",
		treeSha256: "sha256:2485abecd6f26694685f283629ea0ec541b51205b64206830b12cd8736e0d83a",
		tree: fixedTree("apotheke-expiry", apothekeExpiryTree),
	},
	{
		id: "zygos-posted-transaction",
		issuer: "zygos",
		label: "Zygos posted transaction",
		operationId: "get_surface_transaction",
		surfaceId:
			"zygos.transaction:01927f3b-1234-7000-a000-0000000000aa:01927f3b-1234-7000-a000-000000000010",
		sourceRevision: "seq-4",
		testimonySha256: "sha256:acab17089bbb380d2c9345e9b1b8c9be589f6bd94d8f6d356e090db50517e6a2",
		treeSha256: "sha256:f3a33ef07c50b25988c485ca445341e567710ff2e5da32d3af342fa6679b692b",
		tree: fixedTree("zygos-posted-transaction", zygosPostedTransactionTree),
	},
] as const satisfies SixKernelProofCases;

export const KERNEL_PROOF_CASES: SixKernelProofCases = Object.freeze(CASES);
