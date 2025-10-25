/**
 * JSON Path Extractor
 *
 * Extracts all iterable paths from sample JSON data for use in scorecard rules.
 * Returns paths that point to arrays or primitive values that could be iterated.
 */

/**
 * Extract all JSON paths from sample data that can be iterated over
 * Returns an array of path strings like "cards", "users.admins", etc.
 * If the root is an array, returns "$" to represent the root.
 */
export function extractIterablePaths(data: any): string[] {
	if (!data || typeof data !== "object") {
		return [];
	}

	const paths: string[] = [];

	function traverse(obj: any, currentPath: string = "") {
		if (obj === null || obj === undefined) {
			return;
		}

		if (Array.isArray(obj)) {
			// This path points to an array - it's iterable
			if (currentPath) {
				paths.push(currentPath);
			} else {
				// Root level array - use "$" to represent it
				paths.push("$");
			}
			// Don't traverse into array elements for path extraction
			return;
		}

		if (typeof obj === "object") {
			// Traverse object properties
			for (const key in obj) {
				if (Object.hasOwn(obj, key)) {
					const newPath = currentPath ? `${currentPath}.${key}` : key;
					traverse(obj[key], newPath);
				}
			}
		}
	}

	traverse(data);
	return paths.sort();
}

/**
 * Parse JSON string safely and extract paths
 * Returns empty array if JSON is invalid
 */
export function extractPathsFromJSON(jsonString: string): string[] {
	if (!jsonString || !jsonString.trim()) {
		return [];
	}

	try {
		const data = JSON.parse(jsonString);
		return extractIterablePaths(data);
	} catch (e) {
		// Invalid JSON - return empty array
		return [];
	}
}
