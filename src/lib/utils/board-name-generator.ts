/**
 * Board Name Generator
 * Generates random but deterministic board names based on a seed
 */

const colors = [
	"Amber",
	"Azure",
	"Crimson",
	"Emerald",
	"Golden",
	"Indigo",
	"Jade",
	"Lavender",
	"Magenta",
	"Navy",
	"Olive",
	"Pearl",
	"Quartz",
	"Ruby",
	"Sage",
	"Teal",
	"Violet",
	"White",
	"Coral",
	"Ebony",
	"Frost",
	"Gray",
	"Ivory",
	"Lime",
	"Mint",
	"Onyx",
	"Pink",
	"Rose",
	"Sand",
	"Tan",
	"Aqua",
	"Beige",
	"Cyan",
	"Dusk",
	"Fire",
	"Gold",
	"Kiwi",
	"Lava",
	"Moss",
	"Opal",
	"Plum",
	"Rain",
	"Snow",
	"Tusk",
	"Wine",
	"Zinc",
	"Bone",
	"Clay",
	"Dawn",
];

const objects = [
	"Bridge",
	"Tower",
	"Compass",
	"Arrow",
	"Shield",
	"Anchor",
	"Crown",
	"Hammer",
	"Lantern",
	"Mirror",
	"Pyramid",
	"River",
	"Stone",
	"Thread",
	"Vault",
	"Wheel",
	"Beacon",
	"Canyon",
	"Dagger",
	"Engine",
	"Falcon",
	"Garden",
	"Harbor",
	"Island",
	"Journey",
	"Kettle",
	"Ladder",
	"Mountain",
	"Needle",
	"Ocean",
	"Palace",
	"Quill",
	"Ribbon",
	"Summit",
	"Temple",
	"Umbrella",
	"Valley",
	"Waterfall",
	"Axe",
	"Blade",
	"Canvas",
	"Door",
	"Eagle",
	"Forge",
	"Gate",
	"Horizon",
	"Iron",
	"Jewel",
	"Key",
	"Lock",
];

/**
 * Generates a deterministic board name based on a seed string
 * @param seed - A string used to generate the name (e.g., seriesId + boardCount)
 * @returns A name in the format "Color Object" (e.g., "Amber Bridge")
 */
export function generateBoardName(seed: string): string {
	// Improved hash function with better distribution
	// Uses a larger prime multiplier and incorporates position
	let hash1 = 5381;
	let hash2 = 2166136261;

	for (let i = 0; i < seed.length; i++) {
		const char = seed.charCodeAt(i);
		// Mix character with its position for more entropy
		const positionMix = char * (i + 1) * 31;

		// Two different hash calculations for better distribution
		hash1 = ((hash1 << 5) + hash1) ^ positionMix;
		hash2 = (hash2 * 16777619) ^ positionMix;
	}

	// Ensure positive values
	hash1 = Math.abs(hash1);
	hash2 = Math.abs(hash2);

	const colorIndex = hash1 % colors.length;
	const objectIndex = hash2 % objects.length;

	return `${colors[colorIndex]} ${objects[objectIndex]}`;
}
