/**
 * Data Parser Utility
 *
 * Parses various data formats (JSON, CSV, YAML) into JSON objects
 * for use with scorecard data collection.
 */

import yaml from "js-yaml";
import Papa from "papaparse";

export type DataFormat = "json" | "csv" | "yaml" | "unknown";

export interface ParseResult {
	success: boolean;
	data?: any;
	error?: string;
	format?: DataFormat;
}

/**
 * Detect the format of data based on content
 */
export function detectFormat(content: string, filename?: string): DataFormat {
	// Try filename extension first if provided
	if (filename) {
		const ext = filename.toLowerCase().split(".").pop();
		if (ext === "json") return "json";
		if (ext === "csv") return "csv";
		if (ext === "yaml" || ext === "yml") return "yaml";
	}

	// Trim whitespace for content detection
	const trimmed = content.trim();

	// Check for JSON (starts with { or [)
	if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
		return "json";
	}

	// Check for YAML (contains : but not comma-separated like CSV)
	// YAML typically has key: value patterns
	if (trimmed.includes(":") && !trimmed.split("\n")[0].includes(",")) {
		return "yaml";
	}

	// Check for CSV (has commas and appears to be tabular)
	const firstLine = trimmed.split("\n")[0];
	if (firstLine && firstLine.includes(",")) {
		return "csv";
	}

	return "unknown";
}

/**
 * Parse JSON string
 */
function parseJSON(content: string): ParseResult {
	try {
		const data = JSON.parse(content);
		return { success: true, data, format: "json" };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Invalid JSON format",
			format: "json",
		};
	}
}

/**
 * Parse CSV string
 * Returns array of row objects directly
 */
function parseCSV(content: string): ParseResult {
	try {
		const result = Papa.parse(content, {
			header: true,
			dynamicTyping: true,
			skipEmptyLines: true,
			transformHeader: (header: string) => header.trim(),
		});

		if (result.errors.length > 0) {
			return {
				success: false,
				error: `CSV parsing errors: ${result.errors.map((e) => e.message).join(", ")}`,
				format: "csv",
			};
		}

		// Return array directly at root
		return { success: true, data: result.data, format: "csv" };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Invalid CSV format",
			format: "csv",
		};
	}
}

/**
 * Parse YAML string
 */
function parseYAML(content: string): ParseResult {
	try {
		const data = yaml.load(content);
		return { success: true, data, format: "yaml" };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Invalid YAML format",
			format: "yaml",
		};
	}
}

/**
 * Parse data in any supported format
 * Automatically detects format if not specified
 */
export function parseData(
	content: string,
	options: {
		format?: DataFormat;
		filename?: string;
	} = {},
): ParseResult {
	const { format, filename } = options;

	// Detect format if not provided
	const detectedFormat = format || detectFormat(content, filename);

	switch (detectedFormat) {
		case "json":
			return parseJSON(content);
		case "csv":
			return parseCSV(content);
		case "yaml":
			return parseYAML(content);
		default: {
			// Try JSON first, then YAML, then CSV
			const jsonResult = parseJSON(content);
			if (jsonResult.success) return jsonResult;

			const yamlResult = parseYAML(content);
			if (yamlResult.success) return yamlResult;

			const csvResult = parseCSV(content);
			if (csvResult.success) return csvResult;

			return {
				success: false,
				error:
					"Could not detect data format. Please specify format or check your data.",
				format: "unknown",
			};
		}
	}
}

/**
 * Check if data is a root-level array and needs wrapping
 */
export function needsArrayWrapping(data: any): boolean {
	return Array.isArray(data);
}

/**
 * Wrap a root-level array in an object with specified key
 */
export function wrapArray(
	data: any[],
	key: string = "data",
): Record<string, any> {
	return { [key]: data };
}

/**
 * Read file content from File object
 */
export function readFileContent(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();

		reader.onload = (event) => {
			const content = event.target?.result;
			if (typeof content === "string") {
				resolve(content);
			} else {
				reject(new Error("Failed to read file as text"));
			}
		};

		reader.onerror = () => {
			reject(new Error("Failed to read file"));
		};

		reader.readAsText(file);
	});
}

/**
 * Parse file and return parsed data
 */
export async function parseFile(file: File): Promise<ParseResult> {
	try {
		// Check file size (10 MB limit as per spec)
		const maxSize = 10 * 1024 * 1024; // 10 MB
		if (file.size > maxSize) {
			return {
				success: false,
				error: "File size exceeds 10 MB limit",
			};
		}

		const content = await readFileContent(file);
		return parseData(content, {
			filename: file.name,
		});
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to parse file",
		};
	}
}
