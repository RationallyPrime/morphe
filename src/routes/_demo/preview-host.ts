import type { Node } from "$lib";
import { childrenOf, registry } from "$lib";

export interface PreviewVariation {
	readonly id: string;
	readonly defaultChoice: number;
	readonly optionCount: number;
}

export interface PreviewHostContract {
	readonly actionIds: readonly string[];
	readonly variations: readonly PreviewVariation[];
}

function isAuthoredNode(value: unknown): value is Node {
	return (
		value !== null && typeof value === "object" && typeof Reflect.get(value, "kind") === "string"
	);
}

function compoundValues(node: Extract<Node, { readonly kind: "compound" }>): readonly Node[] {
	const values: Node[] = [];
	for (const value of Object.values(node.args)) {
		if (isAuthoredNode(value)) values.push(value);
		if (Array.isArray(value)) {
			for (const item of value) if (isAuthoredNode(item)) values.push(item);
		}
	}
	for (const fill of Object.values(node.slots ?? {})) values.push(...fill);
	return values;
}

/** Discover only the live sockets a preview host can safely own. */
export function inspectPreviewHost(tree: Node): PreviewHostContract {
	const actionIds = new Set<string>();
	const variations = new Map<string, PreviewVariation>();
	const pending: Node[] = [tree];

	while (pending.length > 0) {
		const node = pending.pop();
		if (node === undefined) break;
		if (node.kind === "button" && node.action !== undefined) actionIds.add(node.action);
		if (node.kind === "vary" && node.options.length > 0 && !variations.has(node.id)) {
			variations.set(node.id, {
				id: node.id,
				defaultChoice: Math.min(
					Math.max(Math.trunc(node.default ?? 0), 0),
					node.options.length - 1,
				),
				optionCount: node.options.length,
			});
		}
		if (node.kind === "compound") {
			if (registry.has(node.name)) {
				try {
					pending.push(registry.expand(node));
					continue;
				} catch {
					// A trusted ingress gate reports malformed references. Keep this
					// inspector total and still expose any sockets in authored fills.
				}
			}
			pending.push(...compoundValues(node));
			continue;
		}
		pending.push(...childrenOf(node));
	}

	return {
		actionIds: [...actionIds].sort(),
		variations: [...variations.values()].sort((a, b) => a.id.localeCompare(b.id)),
	};
}
