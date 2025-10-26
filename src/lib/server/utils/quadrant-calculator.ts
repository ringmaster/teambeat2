// Quadrant calculation utilities

export interface QuadrantConfig {
	grid_size: "2x2" | "3x3" | "2x3" | "3x2";
	x_axis_label: string;
	y_axis_label: string;
	x_axis_values: string[];
	y_axis_values: string[];
	template_id?: string;
}

export interface QuadrantPosition {
	id: string;
	cardId: string;
	userId: string;
	sceneId: string;
	xValue: number;
	yValue: number;
	createdAt: string;
	updatedAt: string;
}

/**
 * Calculate consensus position from multiple user placements
 * Returns the mean x and y coordinates, plus consensus quality metrics
 */
export function calculateConsensusPosition(positions: QuadrantPosition[]): {
	consensus_x: number;
	consensus_y: number;
	std_dev: number;
	consensus_score: number;
	spread: string;
} {
	if (positions.length === 0) {
		throw new Error("Cannot calculate consensus with no positions");
	}

	// Calculate mean position
	const sum_x = positions.reduce((sum, p) => sum + p.xValue, 0);
	const sum_y = positions.reduce((sum, p) => sum + p.yValue, 0);
	const mean_x = sum_x / positions.length;
	const mean_y = sum_y / positions.length;

	// Calculate variance (sum of squared distances from mean)
	const variance = positions.reduce((sum, p) => {
		return (
			sum +
			Math.pow(p.xValue - mean_x, 2) +
			Math.pow(p.yValue - mean_y, 2)
		);
	}, 0) / positions.length;

	const std_dev = Math.sqrt(variance);

	// Normalize to 0-100 scale (assuming 0-96 coordinate range)
	// std_dev of 0 = 100% consensus, std_dev of ~40 = 0% consensus
	const consensus_score = Math.max(0, Math.min(100, 100 - std_dev * 2.5));

	// Categorize spread
	let spread: string;
	if (std_dev < 15) {
		spread = "tight";
	} else if (std_dev < 30) {
		spread = "moderate";
	} else {
		spread = "dispersed";
	}

	return {
		consensus_x: Math.round(mean_x),
		consensus_y: Math.round(mean_y),
		std_dev: Math.round(std_dev * 10) / 10, // Round to 1 decimal
		consensus_score: Math.round(consensus_score),
		spread,
	};
}

/**
 * Determine the mode quadrant (most common quadrant among user placements)
 */
export function getModeQuadrant(
	positions: QuadrantPosition[],
	config: QuadrantConfig,
): string {
	const quadrantCounts = new Map<string, number>();

	for (const position of positions) {
		const label = getQuadrantLabel(position.xValue, position.yValue, config);
		quadrantCounts.set(label, (quadrantCounts.get(label) || 0) + 1);
	}

	let maxCount = 0;
	let modeQuadrant = "";

	for (const [quadrant, count] of quadrantCounts) {
		if (count > maxCount) {
			maxCount = count;
			modeQuadrant = quadrant;
		}
	}

	return modeQuadrant;
}

/**
 * Get quadrant label for given x,y coordinates
 * Format: "{y_label} {y_axis}/{x_label} {x_axis}"
 * Example: "High Effort/Low Impact"
 */
export function getQuadrantLabel(
	x: number,
	y: number,
	config: QuadrantConfig,
): string {
	const xBoundaries = getGridBoundaries(config.grid_size[0] as "2" | "3");
	const yBoundaries = getGridBoundaries(config.grid_size[2] as "2" | "3");

	const xIndex = xBoundaries.findIndex((b) => x <= b);
	const yIndex = yBoundaries.findIndex((b) => y <= b);

	const xLabel =
		config.x_axis_values[
			xIndex === -1 ? config.x_axis_values.length - 1 : xIndex
		];
	const yLabel =
		config.y_axis_values[
			yIndex === -1 ? config.y_axis_values.length - 1 : yIndex
		];

	return `${yLabel} ${config.y_axis_label}/${xLabel} ${config.x_axis_label}`;
}

/**
 * Get grid boundaries for a dimension (2 or 3 divisions)
 * 2 divisions: [48] (midpoint)
 * 3 divisions: [32, 64] (thirds)
 */
function getGridBoundaries(gridDimension: "2" | "3"): number[] {
	if (gridDimension === "2") {
		return [48]; // Midpoint at 48 divides range 1-96 in half
	}
	return [32, 64]; // Thirds at 32 and 64 divide range 1-96 into three parts
}

/**
 * Get all unique quadrant labels for a given grid configuration
 * Useful for UI rendering and validation
 */
export function getAllQuadrantLabels(config: QuadrantConfig): string[] {
	const labels: string[] = [];

	for (const yLabel of config.y_axis_values) {
		for (const xLabel of config.x_axis_values) {
			labels.push(`${yLabel} ${config.y_axis_label}/${xLabel} ${config.x_axis_label}`);
		}
	}

	return labels;
}

/**
 * Validate that x and y values are within the valid range (1-96)
 */
export function validatePositionValues(x: number, y: number): boolean {
	return x >= 1 && x <= 96 && y >= 1 && y <= 96;
}

/**
 * Get quadrant index (0-based) for given coordinates
 * Returns [xIndex, yIndex] where each index is 0, 1, or 2
 */
export function getQuadrantIndices(
	x: number,
	y: number,
	config: QuadrantConfig,
): [number, number] {
	const xBoundaries = getGridBoundaries(config.grid_size[0] as "2" | "3");
	const yBoundaries = getGridBoundaries(config.grid_size[2] as "2" | "3");

	let xIndex = xBoundaries.findIndex((b) => x <= b);
	let yIndex = yBoundaries.findIndex((b) => y <= b);

	// If not found, it's in the last bucket
	if (xIndex === -1) xIndex = xBoundaries.length;
	if (yIndex === -1) yIndex = yBoundaries.length;

	return [xIndex, yIndex];
}
