import { render } from "svelte/server";
import { describe, expect, it } from "vitest";
import type { Node } from "$lib";
import {
	GOLD_STANDARD_COMPOUND,
	getDialect,
	PROMOTED_COMPOUNDS,
	registry,
	validateNodeForDialect,
} from "$lib";
import { validateNodeDocument } from "$lib/artifacts";
import { MorpheRoot } from "$lib/components";
import {
	COMPOUND_MINT_FIXTURES,
	MINTED_COMPOUND_NAMES,
	presentCompoundMint,
} from "./compound-mint.js";
import { DIALECT_OPTIONS } from "./exhibits.js";
import { presentActionSummaryGold } from "./presenters.js";

type CompoundReference = Extract<Node, { readonly kind: "compound" }>;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function findCompound(value: unknown, name: string): CompoundReference | undefined {
	if (Array.isArray(value)) {
		for (const item of value) {
			const found = findCompound(item, name);
			if (found) return found;
		}
		return undefined;
	}
	if (!isRecord(value)) return undefined;
	if (value.kind === "compound" && value.name === name) {
		return value as unknown as CompoundReference;
	}
	for (const child of Object.values(value)) {
		const found = findCompound(child, name);
		if (found) return found;
	}
	return undefined;
}

function slotNames(value: unknown): readonly string[] {
	const names = new Set<string>();
	function walk(candidate: unknown): void {
		if (Array.isArray(candidate)) {
			for (const item of candidate) walk(item);
			return;
		}
		if (!isRecord(candidate)) return;
		if (candidate.kind === "slot" && typeof candidate.name === "string") {
			names.add(candidate.name);
		}
		for (const child of Object.values(candidate)) walk(child);
	}
	walk(value);
	return [...names].sort();
}

function everyFixture(): readonly {
	readonly name: string;
	readonly reference: CompoundReference;
}[] {
	const gold = findCompound(presentActionSummaryGold(), GOLD_STANDARD_COMPOUND);
	if (!gold) throw new Error("gold fixture must contain the machine-marked reference");
	return [{ name: GOLD_STANDARD_COMPOUND, reference: gold }, ...COMPOUND_MINT_FIXTURES];
}

describe("promoted compound evidence ledger", () => {
	it("covers the complete catalog while keeping one singular gold marker", () => {
		const fixtureNames = everyFixture()
			.map((fixture) => fixture.name)
			.sort();
		const catalogNames = PROMOTED_COMPOUNDS.map((definition) => definition.name).sort();

		expect(fixtureNames).toEqual(catalogNames);
		expect(new Set(fixtureNames).size).toBe(fixtureNames.length);
		expect(GOLD_STANDARD_COMPOUND).toBe("ActionSummary");
		expect(MINTED_COMPOUND_NAMES).toHaveLength(9);
	});

	it("fills every argument and slot and expands every promoted definition hygienically", () => {
		for (const fixture of everyFixture()) {
			const definition = PROMOTED_COMPOUNDS.find((candidate) => candidate.name === fixture.name);
			if (!definition) throw new Error(`missing definition for ${fixture.name}`);

			expect(Object.keys(fixture.reference.args).sort(), `${fixture.name} arguments`).toEqual(
				Object.keys(definition.params.properties).sort(),
			);
			expect(Object.keys(fixture.reference.slots ?? {}).sort(), `${fixture.name} slots`).toEqual(
				slotNames(definition.template),
			);
			for (const fills of Object.values(fixture.reference.slots ?? {})) {
				expect(fills.length, `${fixture.name} empty slot`).toBeGreaterThan(0);
			}

			const expanded = registry.expand(fixture.reference);
			expect(validateNodeDocument(expanded).ok, fixture.name).toBe(true);
			const document = JSON.stringify(expanded);
			expect(document, fixture.name).not.toContain('"kind":"slot"');
			expect(document, fixture.name).not.toContain('"kind":"param-ref"');
		}
	});

	it("keeps the minted definitions structural and free of host authority", () => {
		const forbiddenKinds = [
			"button",
			"link",
			"field",
			"select",
			"toggle",
			"range",
			"vary",
			"within",
		];
		for (const name of MINTED_COMPOUND_NAMES) {
			const definition = PROMOTED_COMPOUNDS.find((candidate) => candidate.name === name);
			if (!definition) throw new Error(`missing minted definition for ${name}`);
			expect(definition.version).toBe("1.0.0");
			expect(definition.template.kind, `${name} framing`).not.toBe("frame");
			const template = JSON.stringify(definition.template);
			for (const kind of forbiddenKinds) {
				expect(template, `${name} contains host kind ${kind}`).not.toContain(`"kind":"${kind}"`);
			}
		}
	});

	it("accepts and SSR-renders every complete fixture under all nine dialects", () => {
		for (const fixture of everyFixture()) {
			for (const dialectId of DIALECT_OPTIONS) {
				const validation = validateNodeForDialect(fixture.reference, dialectId, {
					validateNodeValue: (value) => validateNodeDocument(value).ok,
				});
				expect(validation, `${fixture.name}:${dialectId}`).toEqual({ ok: true });
				const html = render(MorpheRoot, {
					props: { tree: fixture.reference, dialect: getDialect(dialectId) },
				}).body;
				expect(html, `${fixture.name}:${dialectId}`).toContain(`data-mo-dialect="${dialectId}"`);
			}
		}
	});

	it("renders the complete non-gold mint as one deterministic workbench tree", () => {
		const first = presentCompoundMint();
		const second = presentCompoundMint();
		expect(second).toEqual(first);

		const html = render(MorpheRoot, { props: { tree: first } }).body;
		for (const fixture of COMPOUND_MINT_FIXTURES) {
			expect(html).toContain(`${fixture.name} · benchmark`);
		}
		expect(html).toContain('data-action="mint.record"');
	});
});
