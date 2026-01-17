/**
 * Short code utilities for generating shareable URLs.
 * Converts UUID series IDs to short, URL-safe codes using base62 encoding.
 */

const ALPHABET =
	"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/**
 * Convert a series UUID to a short code.
 * Uses first 12 hex characters (48 bits) for ~8 character codes.
 */
export function seriesIdToShortCode(seriesId: string): string {
	const hex = seriesId.replace(/-/g, "").substring(0, 12);
	const num = BigInt("0x" + hex);
	return toBase62(num);
}

/**
 * Convert a short code back to a series ID prefix (12 hex chars).
 * The prefix can be used to find the series with a LIKE query.
 */
export function shortCodeToSeriesIdPrefix(code: string): string {
	const num = fromBase62(code);
	return num.toString(16).padStart(12, "0");
}

function toBase62(num: bigint): string {
	if (num === 0n) return "0";
	let result = "";
	while (num > 0n) {
		result = ALPHABET[Number(num % 62n)] + result;
		num = num / 62n;
	}
	return result;
}

function fromBase62(str: string): bigint {
	let result = 0n;
	for (const char of str) {
		const index = ALPHABET.indexOf(char);
		if (index === -1) {
			throw new Error(`Invalid character in short code: ${char}`);
		}
		result = result * 62n + BigInt(index);
	}
	return result;
}
