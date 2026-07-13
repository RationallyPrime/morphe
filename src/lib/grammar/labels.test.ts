import { describe, expect, it } from "vitest";
import { hasVisibleLabelText, VISIBLE_LABEL_PATTERN } from "./labels.js";

const REQUIRED_INVISIBLE_CODE_POINTS = [
	0x0000, 0x0009, 0x001f, 0x0020, 0x007f, 0x0085, 0x009f, 0x00a0, 0x00ad, 0x034f, 0x0600, 0x0605,
	0x061c, 0x06dd, 0x070f, 0x0890, 0x0891, 0x08e2, 0x115f, 0x1160, 0x17b4, 0x17b5, 0x180b, 0x180f,
	0x2000, 0x200b, 0x200f, 0x2028, 0x202f, 0x205f, 0x206f, 0x2800, 0x3000, 0x3164, 0xfe00, 0xfe0f,
	0xfeff, 0xffa0, 0xfff9, 0xfffb,
] as const;

describe("generated visible-label contract", () => {
	it.each(REQUIRED_INVISIBLE_CODE_POINTS)("rejects invisible-only U+%s", (codePoint) => {
		const label = String.fromCodePoint(codePoint);
		expect(hasVisibleLabelText(label)).toBe(false);
		expect(new RegExp(VISIBLE_LABEL_PATTERN, "u").test(label)).toBe(false);
	});

	it.each(["Ísland", "東京", "©", "😀", "❤️"])("allows visible Unicode %s", (label) => {
		expect(hasVisibleLabelText(label)).toBe(true);
		expect(new RegExp(VISIBLE_LABEL_PATTERN, "u").test(label)).toBe(true);
	});

	it("keeps the generated predicate and JSON-Schema regex equivalent for mixtures", () => {
		const invisible = REQUIRED_INVISIBLE_CODE_POINTS.map((codePoint) =>
			String.fromCodePoint(codePoint),
		).join("");
		for (const label of [invisible, `${invisible}Evidence${invisible}`, `${invisible}😀`]) {
			expect(new RegExp(VISIBLE_LABEL_PATTERN, "u").test(label)).toBe(hasVisibleLabelText(label));
		}
	});
});
