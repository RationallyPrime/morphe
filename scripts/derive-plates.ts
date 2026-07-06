import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export type PlateSpec = {
	readonly slug: string;
	readonly source: string;
	readonly alt: string;
};

export type PlateDerivative = {
	readonly slug: string;
	readonly source: string;
	readonly width: number;
	readonly height: number;
	readonly outputs: readonly string[];
};

type DeriveOptions = {
	readonly sourceDir?: string;
	readonly outputDir?: string;
	readonly plates?: readonly PlateSpec[];
	readonly widths?: readonly number[];
	readonly fallbackWidth?: number;
};

export const PLATES: readonly PlateSpec[] = [
	{
		slug: "b1-boot-on-premises",
		source: "b1-boot-on-premises.png",
		alt: "Timaeus plate B1 showing the customer appliance booting on premises.",
	},
	{
		slug: "b2-bind-the-sources",
		source: "b2-bind-the-sources.png",
		alt: "Timaeus plate B2 showing operational sources bound to the appliance.",
	},
	{
		slug: "b3-information-flows-in",
		source: "b3-information-flows-in.png",
		alt: "Timaeus plate B3 showing information flowing into the local system.",
	},
	{
		slug: "b4-aristotle-authors",
		source: "b4-aristotle-authors.png",
		alt: "Timaeus plate B4 showing Aristotle authoring the operational law.",
	},
	{
		slug: "b5-plato-smiths",
		source: "b5-plato-smiths.png",
		alt: "Timaeus plate B5 showing Plato smithing a capability from the law.",
	},
	{
		slug: "b6-a-trigger",
		source: "b6-a-trigger.png",
		alt: "Timaeus plate B6 showing a trigger entering the governed workflow.",
	},
	{
		slug: "b7-philosopher-king-reasons",
		source: "b7-philosopher-king-reasons.png",
		alt: "Timaeus plate B7 showing the philosopher king reasoning over evidence.",
	},
	{
		slug: "b8-governed-workflow",
		source: "b8-governed-workflow.png",
		alt: "Timaeus plate B8 showing a governed workflow executing on the record.",
	},
	{
		slug: "b9-on-the-record",
		source: "b9-on-the-record.png",
		alt: "Timaeus plate B9 showing the completed act on the record.",
	},
] as const;

const DEFAULT_SOURCE_DIR = "assets/plates";
const DEFAULT_OUTPUT_DIR = "static/images/plates";
const DEFAULT_WIDTHS = [640, 960] as const;
const DEFAULT_FALLBACK_WIDTH = 960;
const FORBIDDEN_SOURCE_PATTERNS = [/\.raw\./i, /^t1-/i, /flywheel/i];

export async function derivePlates(options: DeriveOptions = {}): Promise<PlateDerivative[]> {
	const sourceDir = path.resolve(options.sourceDir ?? DEFAULT_SOURCE_DIR);
	const outputDir = path.resolve(options.outputDir ?? DEFAULT_OUTPUT_DIR);
	const plates = options.plates ?? PLATES;
	const widths = [...(options.widths ?? DEFAULT_WIDTHS)];
	const fallbackWidth = options.fallbackWidth ?? DEFAULT_FALLBACK_WIDTH;

	await assertAllowedSourceDirectory(sourceDir);
	await rm(outputDir, { force: true, recursive: true });
	await mkdir(outputDir, { recursive: true });

	const derivatives: PlateDerivative[] = [];
	for (const plate of plates) {
		assertAllowedSourceName(plate.source);
		const input = path.join(sourceDir, plate.source);
		const image = sharp(input);
		const metadata = await image.metadata();
		if (!metadata.width || !metadata.height) {
			throw new Error(`plate source lacks dimensions: ${plate.source}`);
		}

		const outputWidths = widths.filter((width) => width <= metadata.width);
		if (outputWidths.length === 0) {
			throw new Error(`plate source is narrower than every target width: ${plate.source}`);
		}

		const outputs: string[] = [];
		for (const width of outputWidths) {
			outputs.push(await writeAvif(input, outputDir, plate.slug, width));
			outputs.push(await writeWebp(input, outputDir, plate.slug, width));
		}
		const pngWidth = Math.min(fallbackWidth, metadata.width);
		outputs.push(await writePng(input, outputDir, plate.slug, pngWidth));

		derivatives.push({
			slug: plate.slug,
			source: plate.source,
			width: metadata.width,
			height: metadata.height,
			outputs,
		});
	}

	return derivatives;
}

async function assertAllowedSourceDirectory(sourceDir: string): Promise<void> {
	const entries = await readdir(sourceDir);
	for (const entry of entries) {
		assertAllowedSourceName(entry);
	}
}

function assertAllowedSourceName(filename: string): void {
	if (FORBIDDEN_SOURCE_PATTERNS.some((pattern) => pattern.test(filename))) {
		throw new Error(
			`private or working plate asset must not enter the public pipeline: ${filename}`,
		);
	}
}

async function writeAvif(
	input: string,
	outputDir: string,
	slug: string,
	width: number,
): Promise<string> {
	const filename = `${slug}-${width}.avif`;
	await sharp(input)
		.resize({ width, withoutEnlargement: true })
		.avif({ effort: 1, quality: 50 })
		.toFile(path.join(outputDir, filename));
	return filename;
}

async function writeWebp(
	input: string,
	outputDir: string,
	slug: string,
	width: number,
): Promise<string> {
	const filename = `${slug}-${width}.webp`;
	await sharp(input)
		.resize({ width, withoutEnlargement: true })
		.webp({ effort: 6, quality: 72 })
		.toFile(path.join(outputDir, filename));
	return filename;
}

async function writePng(
	input: string,
	outputDir: string,
	slug: string,
	width: number,
): Promise<string> {
	const filename = `${slug}-${width}.png`;
	await sharp(input)
		.resize({ width, withoutEnlargement: true })
		.png({
			adaptiveFiltering: true,
			colors: 128,
			compressionLevel: 9,
			effort: 10,
			palette: true,
			quality: 80,
		})
		.toFile(path.join(outputDir, filename));
	return filename;
}

if (import.meta.main) {
	const derivatives = await derivePlates();
	const count = derivatives.reduce((total, derivative) => total + derivative.outputs.length, 0);
	process.stdout.write(`derived ${count} plate assets from ${derivatives.length} sources\n`);
}
