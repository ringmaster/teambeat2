// TypeScript types for quadrant scene feature

export interface QuadrantConfig {
	grid_size: "2x2" | "3x3" | "2x3" | "3x2";
	x_axis_label: string;
	y_axis_label: string;
	x_axis_values: string[];
	y_axis_values: string[];
	selected_column_ids?: string[]; // Optional: filter cards to only these columns
}

export interface QuadrantPosition {
	id: string;
	card_id: string;
	x_value: number;
	y_value: number;
	created_at: string;
	updated_at: string;
}

export interface QuadrantMetadata {
	scene_id: string;
	consensus_x: number;
	consensus_y: number;
	facilitator_x?: number;
	facilitator_y?: number;
	mode_quadrant: string;
	quadrant_label: string;
	participant_count: number;
	timestamp: string;
}

export interface PresentModeFilter {
	type: "votes" | "quadrant";
	scene_id?: string;
	quadrant_label?: string;
}

export interface CardWithQuadrantData {
	id: string;
	content: string;
	column_id: string;
	user_id: string | null;
	quadrant_metadata?: QuadrantMetadata[];
	// ...other card fields
}
