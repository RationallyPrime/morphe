/**
 * derive-plates.ts — the plate derivative pipeline (KRA-325).
 *
 * Reads the committed Timaeus plate ORIGINALS from `assets/plates/*.png` (the
 * non-served source dir; SvelteKit serves only `static/`) and emits the web
 * derivatives into `static/images/plates/`:
 *
 *   <slug>-{640,960,1440}.avif   <slug>-{640,960,1440}.webp   <slug>-960.png
 *
 * DETERMINISM IS LOAD-BEARING (the same ethos as the schema byte-stability
 * gate): fixed quality/effort settings, metadata stripped (sharp's default),
 * no timestamps, `sharp.concurrency(1)` so AVIF encoding is thread-stable, and
 * a stable slug-sorted encode order. Running the script twice must leave
 * `git status` clean — that is the acceptance check.
 *
 * The EXCLUSION LAW lives in `plate-manifest.ts` and is enforced before any
 * encode: a `t1-*` or `*.raw.png` / `*-raw.png` file anywhere in the input dir
 * makes the run THROW. Private working material never reaches `static/`.
 *
 * Run: bun run plates   (or: just plates)
 */

import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import { type PlateEntry, plateManifest } from "./plate-manifest.js";

const ASSETS_DIR = resolve(import.meta.dirname, "..", "assets", "plates");
const OUT_DIR = resolve(import.meta.dirname, "..", "static", "images", "plates");

/*
 * Fixed encoder settings, tuned for the plates (dark wireframe constellations,
 * large flat fields): the 300 KB per-file budget holds with margin on every
 * rung. Never derive a setting from the clock, the host, or the run count.
 */
const AVIF = { quality: 55, effort: 4 } as const;
const WEBP = { quality: 78, effort: 6 } as const;
/**
 * Palette PNG: the fallback rung only — every `<picture>`-capable browser takes
 * AVIF/WebP, so the PNG can quantize hard (quality 40 keeps the worst plate
 * under ~280 KB; the engravings dither cleanly at that depth).
 */
const PNG = { palette: true, quality: 40, compressionLevel: 9, effort: 10 } as const;

async function derive(entry: PlateEntry): Promise<void> {
	const input = resolve(ASSETS_DIR, entry.source);
	for (const derivative of entry.derivatives) {
		const image = sharp(input).resize({ width: derivative.width });
		const encoded =
			derivative.format === "avif"
				? image.avif(AVIF)
				: derivative.format === "webp"
					? image.webp(WEBP)
					: image.png(PNG);
		const buffer = await encoded.toBuffer();
		const outPath = resolve(OUT_DIR, derivative.file);
		writeFileSync(outPath, buffer);
		const kb = (statSync(outPath).size / 1024).toFixed(1);
		// biome-ignore lint/suspicious/noConsole: build script progress output.
		console.log(`  ${derivative.file}  ${kb} KB`);
	}
}

async function main(): Promise<void> {
	// Thread-stable encodes: one libvips worker, so AVIF output is byte-stable.
	sharp.concurrency(1);

	const listing = readdirSync(ASSETS_DIR);
	const entries = plateManifest(listing);
	if (entries.length === 0) {
		throw new Error(`No plate sources found in ${ASSETS_DIR}`);
	}

	mkdirSync(OUT_DIR, { recursive: true });
	for (const entry of entries) {
		// biome-ignore lint/suspicious/noConsole: build script progress output.
		console.log(`${entry.slug}:`);
		await derive(entry);
	}
	// biome-ignore lint/suspicious/noConsole: build script progress output.
	console.log(`wrote ${entries.length * 7} derivatives for ${entries.length} plates to ${OUT_DIR}`);
}

main().catch((err: unknown) => {
	console.error(err);
	process.exit(1);
});
