import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { derivePlates, type PlateSpec } from "./derive-plates.js";

const PLATE: PlateSpec = {
	slug: "demo-plate",
	source: "demo-plate.png",
	alt: "Neutral demo plate.",
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
				slug: "demo-plate",
				source: "demo-plate.png",
				width: 80,
				height: 120,
				outputs: [
					"demo-plate-32.avif",
					"demo-plate-32.webp",
					"demo-plate-64.avif",
					"demo-plate-64.webp",
					"demo-plate-64.png",
				],
			},
		]);
		await expect(readdir(dirs.outputDir)).resolves.toEqual([
			"demo-plate-32.avif",
			"demo-plate-32.webp",
			"demo-plate-64.avif",
			"demo-plate-64.png",
			"demo-plate-64.webp",
		]);
	});

	it("rejects private trajectory and raw working assets before writing output", async () => {
		const forbidden = ["t1-flywheel.png", "b1-raw.png", "plate.raw.png", "raw-export.png"];
		for (const name of forbidden) {
			const dirs = await fixtureDirs(`forbidden-${name}`);
			await writeFixturePng(path.join(dirs.sourceDir, name));

			await expect(
				derivePlates({
					sourceDir: dirs.sourceDir,
					outputDir: dirs.outputDir,
					plates: [PLATE],
					widths: [32],
				}),
			).rejects.toThrow("private or working plate asset");
		}
	});

	it("does not reject legitimate names merely containing the raw substring", async () => {
		const dirs = await fixtureDirs("legit-raw-substring");
		const plate: PlateSpec = { slug: "strawberry", source: "strawberry.png", alt: "Berry." };
		await writeFixturePng(path.join(dirs.sourceDir, plate.source));

		await expect(
			derivePlates({
				sourceDir: dirs.sourceDir,
				outputDir: dirs.outputDir,
				plates: [plate],
				widths: [32],
			}),
		).resolves.toHaveLength(1);
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
