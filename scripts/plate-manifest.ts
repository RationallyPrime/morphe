/**
 * plate-manifest.ts — the PURE half of the plate derivative pipeline (KRA-325).
 *
 * Filenames in, derivative plan out: no sharp, no filesystem, no clock — so the
 * exclusion law and the output file-set are unit-testable without encoding a
 * single pixel. `derive-plates.ts` is the impure runner that executes the plan.
 *
 * The exclusion law is load-bearing: investor-private working files (the `t1-*`
 * trajectory plates and any `*.raw.png` / `*-raw.png` original) must NEVER reach
 * `assets/` or `static/`. If one is present in the input dir the pipeline THROWS
 * — a silent skip would let a stray copy sit in the repo unnoticed.
 */

/** Responsive rungs emitted per plate, in ascending order (srcset `w` descriptors). */
export const PLATE_WIDTHS = [640, 960, 1440] as const;

/** Modern formats emitted per rung; first in the list is preferred by `<picture>`. */
export const PLATE_FORMATS = ["avif", "webp"] as const;

/** The single universal-fallback rung (`<img src>` PNG). */
export const FALLBACK_WIDTH = 960;

export type PlateWidth = (typeof PLATE_WIDTHS)[number];
export type PlateFormat = (typeof PLATE_FORMATS)[number];

/** One planned derivative file: `<slug>-<width>.<format>`. */
export interface PlateDerivative {
	readonly width: number;
	readonly format: PlateFormat | "png";
	/** Output basename, e.g. `b1-boot-on-premises-960.avif`. */
	readonly file: string;
}

/** The full derivative plan for one source plate. */
export interface PlateEntry {
	/** Source basename inside the input dir, e.g. `b1-boot-on-premises.png`. */
	readonly source: string;
	/** Source basename without extension; the derivative name stem. */
	readonly slug: string;
	readonly derivatives: readonly PlateDerivative[];
}

/**
 * Patterns that mark a file as PRIVATE working material. Matched against the
 * bare basename, case-insensitively — a rename to `.PNG` or `T1-` must not
 * slip through.
 */
const PRIVATE_PATTERNS: readonly RegExp[] = [/^t1-/i, /\.raw\.png$/i, /-raw\.png$/i];

/** Whether a basename names private working material (never to be derived or committed). */
export function isPrivatePlate(filename: string): boolean {
	return PRIVATE_PATTERNS.some((pattern) => pattern.test(filename));
}

/**
 * THROW if any input basename is private working material. Called on the FULL
 * input-dir listing (every extension), before any plan is built.
 */
export function assertPublicPlates(filenames: readonly string[]): void {
	const offenders = filenames.filter(isPrivatePlate).sort((a, b) => a.localeCompare(b));
	if (offenders.length > 0) {
		throw new Error(
			`Private working files in the plate input dir (remove them; they must never be committed): ${offenders.join(", ")}`,
		);
	}
}

/**
 * Build the derivative plan for a directory listing: every `.png` source maps to
 * 3 widths x 2 modern formats + one PNG fallback rung (7 files per plate).
 * Non-PNG entries are ignored; private entries make the WHOLE plan throw via
 * `assertPublicPlates`. Output order is stable (sorted by slug) so the runner's
 * log — and the encode order — is deterministic.
 */
export function plateManifest(filenames: readonly string[]): readonly PlateEntry[] {
	assertPublicPlates(filenames);
	return filenames
		.filter((name) => /\.png$/i.test(name))
		.map((source) => {
			const slug = source.replace(/\.png$/i, "");
			const modern: PlateDerivative[] = PLATE_WIDTHS.flatMap((width) =>
				PLATE_FORMATS.map((format) => ({ width, format, file: `${slug}-${width}.${format}` })),
			);
			const fallback: PlateDerivative = {
				width: FALLBACK_WIDTH,
				format: "png",
				file: `${slug}-${FALLBACK_WIDTH}.png`,
			};
			return { source, slug, derivatives: [...modern, fallback] };
		})
		.sort((a, b) => a.slug.localeCompare(b.slug));
}
