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

// Neutral demo plates only (ADR-0011): consumer brand/story assets live in the consumer
// repo and run this same pipeline there. The committed source is rasterized from the
// playground's own neutral demo SVG set.
export const PLATES: readonly PlateSpec[] = [
	{
		slug: "signal-map",
		source: "signal-map.png",
		alt: "Abstract demo plate: a signal map of nodes and routed connections on a dark field.",
	},
] as const;

const DEFAULT_SOURCE_DIR = "assets/plates";
const DEFAULT_OUTPUT_DIR = "static/images/plates";
const DEFAULT_WIDTHS = [640, 960] as const;
const DEFAULT_FALLBACK_WIDTH = 960;
const FORBIDDEN_SOURCE_PATTERNS = [/(^|[-._])raw([-._]|$)/i, /^t1-/i, /flywheel/i];

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
