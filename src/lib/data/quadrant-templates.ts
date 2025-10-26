// Quadrant templates for scene configuration

export interface QuadrantTemplate {
	id: string;
	name: string;
	description: string;
	grid_size: "2x2" | "3x3" | "2x3" | "3x2";
	x_axis_label: string;
	y_axis_label: string;
	x_axis_values: string[];
	y_axis_values: string[];
}

export const QUADRANT_TEMPLATES: QuadrantTemplate[] = [
	{
		id: "eisenhower",
		name: "Eisenhower Matrix",
		description: "Prioritize tasks by urgency and importance",
		grid_size: "2x2",
		x_axis_label: "Importance",
		y_axis_label: "Urgency",
		x_axis_values: ["Low", "High"],
		y_axis_values: ["Low", "High"],
	},
	{
		id: "impact-effort",
		name: "Impact/Effort Matrix",
		description: "Evaluate initiatives by impact and effort required",
		grid_size: "2x2",
		x_axis_label: "Impact",
		y_axis_label: "Effort",
		x_axis_values: ["Low", "High"],
		y_axis_values: ["Low", "High"],
	},
	{
		id: "impact-effort-3x3",
		name: "Impact/Effort Matrix (3×3)",
		description: "Detailed evaluation with medium options",
		grid_size: "3x3",
		x_axis_label: "Impact",
		y_axis_label: "Effort",
		x_axis_values: ["Low", "Medium", "High"],
		y_axis_values: ["Low", "Medium", "High"],
	},
	{
		id: "risk-value",
		name: "Risk/Value Matrix",
		description: "Assess opportunities by risk and value",
		grid_size: "2x3",
		x_axis_label: "Value",
		y_axis_label: "Risk",
		x_axis_values: ["Low", "Medium", "High"],
		y_axis_values: ["Low", "High"],
	},
	{
		id: "likelihood-severity",
		name: "Risk Assessment (Likelihood/Severity)",
		description: "Evaluate risks by likelihood and severity of impact",
		grid_size: "3x3",
		x_axis_label: "Severity",
		y_axis_label: "Likelihood",
		x_axis_values: ["Low", "Medium", "High"],
		y_axis_values: ["Low", "Medium", "High"],
	},
];
