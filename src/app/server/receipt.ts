/**
 * Intake receipt minting (KRA-372) — the accession id of a sealed record.
 *
 * The server is the only party that can witness receipt, so the server mints.
 * Format: K-YYYYMMDD-XXXX (UTC date + four characters from a no-confusables
 * alphabet — 0/O, 1/I/L and U/V collisions removed, so the id survives being
 * read aloud over a phone). The clock and the randomness are injected
 * (StoreOptions.now precedent) so tests pin the format deterministically;
 * the defaults are the wall clock and Math.random, read at call time.
 */

const ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
const SUFFIX_LENGTH = 4;

/** The shape every minted receipt matches (exported for tests + client guards). */
export const RECEIPT_RE = /^K-\d{8}-[A-HJ-KM-NP-TV-Z2-9]{4}$/;

/** Mint one accession id for a received intake. */
export function mintReceiptId(now: Date = new Date(), random: () => number = Math.random): string {
	const y = now.getUTCFullYear();
	const m = String(now.getUTCMonth() + 1).padStart(2, "0");
	const d = String(now.getUTCDate()).padStart(2, "0");
	let suffix = "";
	for (let i = 0; i < SUFFIX_LENGTH; i++) {
		const index = Math.min(Math.floor(random() * ALPHABET.length), ALPHABET.length - 1);
		suffix += ALPHABET[index];
	}
	return `K-${y}${m}${d}-${suffix}`;
}
