import type { Node } from "$lib";
import { GRAMMAR_VERSION, hasDialect, validateNodeForDialect } from "$lib";
import { formatArtifactValidationIssue, validateNodeDocument } from "$lib/artifacts";

export interface LocalCompiledTree {
	readonly tree: Node;
	readonly dialectId: string;
}

export type LocalCompiledTreeResult =
	| { readonly ok: true; readonly value: LocalCompiledTree }
	| { readonly ok: false; readonly reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseLocalCompiledTree(
	document: unknown,
	expectedArtifactId: string,
	expectedRevisionId: string,
): LocalCompiledTreeResult {
	if (!isRecord(document)) return { ok: false, reason: "compiled artifact is not an object" };
	if (document.artifact_id !== expectedArtifactId) {
		return { ok: false, reason: "compiled artifact id does not match its path" };
	}
	if (document.revision_id !== expectedRevisionId) {
		return { ok: false, reason: "compiled revision id does not match its path" };
	}
	if (document.grammar_version !== GRAMMAR_VERSION) {
		return { ok: false, reason: "compiled artifact grammar version is unsupported" };
	}
	if (!isRecord(document.render_hints)) {
		return { ok: false, reason: "compiled artifact has an unknown dialect" };
	}
	const dialectId = document.render_hints.dialect;
	if (typeof dialectId !== "string" || !hasDialect(dialectId)) {
		return { ok: false, reason: "compiled artifact has an unknown dialect" };
	}
	const tree = validateNodeDocument(document.tree);
	if (!tree.ok) {
		const issue = tree.issues[0];
		return {
			ok: false,
			reason: issue ? formatArtifactValidationIssue(issue) : "compiled tree is invalid",
		};
	}
	const dialectValidation = validateNodeForDialect(tree.value, dialectId, {
		validateNodeValue: (value) => validateNodeDocument(value).ok,
	});
	if (!dialectValidation.ok) {
		return {
			ok: false,
			reason:
				dialectValidation.issues[0]?.message ?? "compiled tree violates its dialect constraint",
		};
	}
	return { ok: true, value: { tree: tree.value, dialectId } };
}
