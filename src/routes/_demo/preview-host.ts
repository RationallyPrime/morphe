import type {
	CompoundResolver,
	LiveVariationDescriptor,
	LiveVariationOccurrence,
	Node,
} from "$lib";
import { childrenOf, liveVariationIndex } from "$lib";

export interface PreviewChoiceOption {
	readonly value: number;
	readonly label: string;
}

interface PreviewVariationBase {
	readonly id: string;
	readonly defaultChoice: number;
	/** The integer interval canonical Delta admission can actually accept. */
	readonly range: readonly [number, number];
}

export interface PreviewVaryVariation extends PreviewVariationBase {
	readonly kind: "vary";
	/** Bounded by actual authored Vary option nodes. */
	readonly options: readonly PreviewChoiceOption[];
}

export interface PreviewNumericVariation extends PreviewVariationBase {
	/** A Within, or duplicate ids whose safe intersection is mixed. */
	readonly kind: "within" | "mixed";
}

/**
 * The native inspector representation of one resolver-authorized variation.
 *
 * The renderer owns visual interpretation. This host surface only exposes
 * bounded numeric choice authority for the sockets it can really render.
 */
export type PreviewVariation = PreviewVaryVariation | PreviewNumericVariation;

export interface PreviewHostContract {
	readonly actionIds: readonly string[];
	readonly variations: readonly PreviewVariation[];
}

export interface PreviewHostOptions {
	/** Must be the same dialect-restricted resolver supplied to MorpheRoot. */
	readonly resolver: CompoundResolver;
}

/**
 * Discover only the sockets the exact rendering resolver authorizes.
 *
 * Unknown, invisible, and malformed compounds render empty in `Node.svelte`.
 * They must therefore grant neither native action handlers nor choices here.
 */
export function inspectPreviewHost(tree: Node, options: PreviewHostOptions): PreviewHostContract {
	const actionIds = new Set<string>();
	const pending: Node[] = [tree];

	while (pending.length > 0) {
		const node = pending.pop();
		if (node === undefined) break;
		if (node.kind === "compound") {
			if (!options.resolver.has(node.name)) continue;
			try {
				pending.push(options.resolver.expand(node));
			} catch {
				// Match renderer recovery: a visible-but-invalid ref renders empty.
			}
			continue;
		}
		if (node.kind === "button" && node.action !== undefined) actionIds.add(node.action);
		pending.push(...childrenOf(node));
	}

	return Object.freeze({
		actionIds: Object.freeze([...actionIds].sort()),
		variations: Object.freeze(
			liveVariationIndex(tree, { resolver: options.resolver })
				.descriptors.map(previewVariationFor)
				.filter((variation): variation is PreviewVariation => variation !== undefined),
		),
	});
}

function previewVariationFor(descriptor: LiveVariationDescriptor): PreviewVariation | undefined {
	const range = admissibleIntegerRange(descriptor.occurrences);
	if (range === undefined) return undefined;
	const [lower, upper] = range;

	const first = descriptor.occurrences[0];
	if (first === undefined) return undefined;
	const kind = descriptor.occurrences.every((occurrence) => occurrence.kind === first.kind)
		? first.kind
		: "mixed";
	const defaultChoice = clampInteger(first.default, lower, upper);

	if (kind !== "vary") {
		return Object.freeze({
			id: descriptor.id,
			kind,
			defaultChoice,
			range: freezeRange(range),
		});
	}

	return Object.freeze({
		id: descriptor.id,
		kind,
		defaultChoice,
		range: freezeRange(range),
		options: Object.freeze(
			Array.from({ length: upper - lower + 1 }, (_, offset) => {
				const value = lower + offset;
				return Object.freeze({ value, label: `Branch ${value + 1}` });
			}),
		),
	});
}

/**
 * Canonical Delta requires an integer inside every authored occurrence. The
 * inspector must therefore use the integer intersection, including reversed
 * and fractional authored bounds, rather than merely copying a raw range.
 */
function admissibleIntegerRange(
	occurrences: readonly LiveVariationOccurrence[],
): readonly [number, number] | undefined {
	let lower = -Infinity;
	let upper = Infinity;
	for (const occurrence of occurrences) {
		const [first, second] = occurrence.bounds;
		lower = Math.max(lower, Math.min(first, second));
		upper = Math.min(upper, Math.max(first, second));
	}
	if (!Number.isFinite(lower) || !Number.isFinite(upper)) return undefined;

	const integerLower = Math.ceil(lower);
	const integerUpper = Math.floor(upper);
	return integerLower <= integerUpper ? [integerLower, integerUpper] : undefined;
}

function clampInteger(value: number, lower: number, upper: number): number {
	return Math.min(Math.max(Math.trunc(value), lower), upper);
}

function freezeRange(range: readonly [number, number]): readonly [number, number] {
	return Object.freeze([range[0], range[1]]) as readonly [number, number];
}
