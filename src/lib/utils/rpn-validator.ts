/**
 * RPN Validator
 *
 * Validates RPN expressions against sample data to catch errors before runtime.
 * Simulates the scorecard processor logic to provide immediate feedback.
 */

import { parseRPNString } from "./rpn-parser";

export interface ValidationResult {
	valid: boolean;
	error?: string;
	details?: string;
}

/**
 * Get value by path from object (simplified version of scorecard processor)
 */
function getValueByPath(obj: any, path: string): any {
	if (!path) return obj;

	const parts = path.split(".");
	let current = obj;

	for (const part of parts) {
		if (current === null || current === undefined) {
			return undefined;
		}
		current = current[part];
	}

	return current;
}

/**
 * Get singular item name from array path (matches scorecard processor)
 */
function getItemName(arrayPath: string): string {
	if (arrayPath === "$") return "item";

	const parts = arrayPath.split(".");
	const arrayName = parts[parts.length - 1];

	// Simple pluralization rules
	if (arrayName.endsWith("s") && !arrayName.endsWith("ss")) {
		return arrayName.slice(0, -1);
	}

	return arrayName;
}

/**
 * Validate an RPN condition string against sample data
 */
export function validateRPNCondition(
	conditionString: string,
	sampleDataString: string,
	iterateOver: string | null,
): ValidationResult {
	// Empty condition is invalid
	if (!conditionString || !conditionString.trim()) {
		return {
			valid: false,
			error: "Condition is required",
		};
	}

	// Parse the RPN string
	let rpnArray;
	try {
		rpnArray = parseRPNString(conditionString);
	} catch (e) {
		return {
			valid: false,
			error: "Invalid RPN syntax",
			details: e instanceof Error ? e.message : String(e),
		};
	}

	if (rpnArray.length === 0) {
		return {
			valid: false,
			error: "Empty RPN expression",
		};
	}

	// Parse sample data if provided
	let sampleData;
	if (sampleDataString && sampleDataString.trim()) {
		try {
			sampleData = JSON.parse(sampleDataString);
		} catch (e) {
			// Invalid sample data - can't validate against it, but RPN itself might be valid
			return {
				valid: true,
				error: "Note: Sample data is invalid JSON, cannot validate context",
			};
		}
	} else {
		// No sample data - can only validate RPN syntax
		return {
			valid: true,
			error: "Note: No sample data provided, cannot validate context",
		};
	}

	// If iterating, check that the path exists and is an array
	if (iterateOver !== null) {
		let items;
		if (iterateOver === "$") {
			items = sampleData;
		} else {
			items = getValueByPath(sampleData, iterateOver);
		}

		if (!Array.isArray(items)) {
			return {
				valid: false,
				error: `Iterate path "${iterateOver}" is not an array`,
				details:
					items === undefined
						? "Path does not exist in sample data"
						: `Found: ${typeof items}`,
			};
		}

		// Check if array is empty
		if (items.length === 0) {
			return {
				valid: true,
				error: "Warning: Array is empty in sample data",
			};
		}

		// Test RPN against first item
		const itemName = getItemName(iterateOver);
		const testContext = {
			...sampleData,
			[itemName]: items[0],
			_index: 0,
		};

		return validateRPNWithContext(rpnArray, testContext);
	} else {
		// No iteration - test against full data
		return validateRPNWithContext(rpnArray, sampleData);
	}
}

/**
 * Validate RPN expression with a specific context
 * Checks for common errors like missing fields
 */
function validateRPNWithContext(
	rpnArray: any[],
	context: any,
): ValidationResult {
	// Check for get_json_value operations and verify paths exist
	for (let i = 0; i < rpnArray.length; i++) {
		const token = rpnArray[i];

		if (token === "get_json_value") {
			const path = rpnArray[i + 1];
			if (path === undefined) {
				return {
					valid: false,
					error: "get_json_value requires a path parameter",
				};
			}

			const value = getValueByPath(context, String(path));
			if (value === undefined) {
				return {
					valid: false,
					error: `Field "${path}" not found in sample data`,
					details: "Available fields: " + Object.keys(context).join(", "),
				};
			}
		}

		if (token === "literal") {
			const value = rpnArray[i + 1];
			if (value === undefined) {
				return {
					valid: false,
					error: "literal requires a value parameter",
				};
			}
		}
	}

	// Basic syntax validation passed
	return {
		valid: true,
	};
}
