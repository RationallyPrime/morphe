import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { derivePlates, type PlateSpec } from "./derive-plates.js";

const PLATE: PlateSpec = {
	slug: "b1-boot-on-premises",
	source: "b1-boot-on-premises.png",
	alt: "Timaeus plate B1.",
};

describe("derivePlates", () => {
	it("emits deterministic AVIF/WebP candidates and a PNG fallback", async ({ task }) => {
		const dirs = await fixtureDirs(task.id);
		await writeFixturePng(path.join(dirs.sourceDir, PLATE.source));

		const derivatives = await derivePlates({
			sourceDir: dirs.sourceDir,
			outputDir: dirs.outputDir,
			plates: [PLATE],
			widths: [32, 64],
			fallbackWidth: 64,
		});

		expect(derivatives).toEqual([
			{
				slug: "b1-boot-on-premises",
				source: "b1-boot-on-premises.png",
				width: 80,
				height: 120,
				outputs: [
					"b1-boot-on-premises-32.avif",
					"b1-boot-on-premises-32.webp",
					"b1-boot-on-premises-64.avif",
					"b1-boot-on-premises-64.webp",
					"b1-boot-on-premises-64.png",
				],
			},
		]);
		await expect(readdir(dirs.outputDir)).resolves.toEqual([
			"b1-boot-on-premises-32.avif",
			"b1-boot-on-premises-32.webp",
			"b1-boot-on-premises-64.avif",
			"b1-boot-on-premises-64.png",
			"b1-boot-on-premises-64.webp",
		]);
	});

	it("rejects private trajectory and raw working assets before writing output", async ({
		task,
	}) => {
		const dirs = await fixtureDirs(task.id);
		await writeFixturePng(path.join(dirs.sourceDir, "t1-flywheel.png"));

		await expect(
			derivePlates({
				sourceDir: dirs.sourceDir,
				outputDir: dirs.outputDir,
				plates: [PLATE],
				widths: [32],
			}),
		).rejects.toThrow("private or working plate asset");
	});
});

async function fixtureDirs(testId: string): Promise<{ sourceDir: string; outputDir: string }> {
	const root = path.join(".vitest-tmp", sanitize(testId));
	const sourceDir = path.join(root, "assets");
	const outputDir = path.join(root, "static");
	await mkdir(sourceDir, { recursive: true });
	return { sourceDir, outputDir };
}

function sanitize(value: string): string {
	return value.replaceAll(/\W+/g, "-");
}

async function writeFixturePng(filename: string): Promise<void> {
	await sharp({
		create: {
			width: 80,
			height: 120,
			channels: 3,
			background: "#111827",
		},
	})
		.png()
		.toFile(filename);
}
