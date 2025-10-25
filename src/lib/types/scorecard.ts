/**
 * Type definitions for the Scorecard feature
 *
 * Scorecards allow teams to review metrics and data from external sources during meetings,
 * with the ability to flag items for discussion.
 */

// ============================================================================
// Database Model Types
// ============================================================================

export interface Scorecard {
	id: string;
	seriesId: string;
	name: string;
	description: string | null;
	createdByUserId: string;
	createdAt: string;
	updatedAt: string;
}

export interface ScorecardDatasource {
	id: string;
	scorecardId: string;
	name: string;
	seq: number;
	sourceType: "paste" | "api";
	apiConfig: string | null; // JSON: {url, auth_type, credentials_encrypted}
	dataSchema: string | null; // JSON: describes expected data shape
	rules: string; // JSON: array of rule objects
	createdAt: string;
	updatedAt: string;
}

export interface SceneScorecard {
	id: string;
	sceneId: string;
	scorecardId: string;
	collectedData: string | null; // JSON: all datasource data combined
	processedAt: string | null;
	createdAt: string;
}

export interface SceneScorecardResult {
	id: string;
	sceneScorecardId: string;
	datasourceId: string;
	section: string;
	title: string;
	primaryValue: string | null;
	secondaryValues: string | null; // JSON: additional fields
	severity: "info" | "warning" | "critical";
	sourceData: string | null; // JSON: full original record
	seq: number;
}

// ============================================================================
// RPN Rule Types
// ============================================================================

export type RPNOperation =
	// Stack manipulation
	| "dup"
	| "swap"
	| "drop"
	// Data access
	| "get_json_value"
	| "literal"
	// Comparisons
	| "eq"
	| "ne"
	| "gt"
	| "lt"
	| "gte"
	| "lte"
	// Logic
	| "and"
	| "or"
	| "not"
	// Arithmetic
	| "add"
	| "sub"
	| "mul"
	| "div"
	| "mod"
	// String operations
	| "concat"
	| "contains"
	| "matches_regex"
	// Aggregation
	| "count"
	| "sum"
	| "avg"
	| "min"
	| "max";

export type RPNValue = string | number | boolean | null;
export type RPNExpression = Array<RPNOperation | RPNValue>;

export interface ThresholdRule {
	condition: RPNExpression;
	severity: "info" | "warning" | "critical";
}

export interface ScorecardRule {
	id: string;
	section: string;
	iterate_over: string | null; // JSONPath to array, or null for single evaluation
	condition: RPNExpression; // RPN expression for filtering/calculation
	title_template: string; // Template with {path.to.field} interpolation
	value_template: string; // Template with {path.to.field} or {result}
	// Severity (one of):
	severity?: "info" | "warning" | "critical"; // Fixed severity
	severity_from_field?: string; // JSONPath to read severity from source
	threshold_rules?: ThresholdRule[]; // Conditional severity based on rules
}

export interface ParsedDatasource extends ScorecardDatasource {
	rulesArray: ScorecardRule[]; // Parsed rules from JSON
	dataSchemaObj: any; // Parsed data schema from JSON
}

// ============================================================================
// API Request/Response Types
// ============================================================================

// Scorecard Management
export interface CreateScorecardRequest {
	name: string;
	description?: string;
}

export interface UpdateScorecardRequest {
	name?: string;
	description?: string;
}

export interface ScorecardWithDatasources extends Scorecard {
	datasources: ParsedDatasource[];
}

// Datasource Management
export interface CreateDatasourceRequest {
	name: string;
	source_type: "paste" | "api";
	data_schema?: any; // Will be JSON stringified
	rules: ScorecardRule[]; // Will be JSON stringified
	api_config?: {
		url: string;
		auth_type: string;
		credentials_encrypted?: string;
	};
}

export interface UpdateDatasourceRequest {
	name?: string;
	data_schema?: any;
	rules?: ScorecardRule[];
	api_config?: {
		url: string;
		auth_type: string;
		credentials_encrypted?: string;
	};
}

export interface ReorderDatasourcesRequest {
	datasource_ids: string[]; // Ordered array of datasource IDs
}

// Scene Scorecard Management
export interface AttachScorecardRequest {
	scorecard_id: string;
}

export interface CollectDataRequest {
	datasource_data: Record<
		string,
		{
			format: "json" | "csv" | "yaml";
			content: any; // Parsed JSON object or string content
		}
	>;
}

export interface FlagResultRequest {
	column_id: string;
}

// Results Display
export interface ScorecardResultDisplay extends SceneScorecardResult {
	sourceDataObj?: any; // Parsed source_data from JSON
	secondaryValuesObj?: any; // Parsed secondary_values from JSON
}

export interface ScorecardResultsResponse {
	sections: Record<string, ScorecardResultDisplay[]>;
}

// ============================================================================
// RPN Evaluation Types
// ============================================================================

export interface EvaluationContext {
	[key: string]: any; // Can include item data, result value, etc.
}

export interface RPNEvaluationResult {
	success: boolean;
	value?: any;
	error?: string;
	stackTrace?: Array<{ step: number; operation: string; stack: any[] }>;
}

export interface ProcessedResult {
	section: string;
	title: string;
	primaryValue: string | null;
	secondaryValues?: Record<string, any>;
	severity: "info" | "warning" | "critical";
	sourceData?: any;
	seq: number;
}

// ============================================================================
// Utility Types
// ============================================================================

export type SeverityLevel = "info" | "warning" | "critical";

export interface ScorecardUsageCount {
	scorecardId: string;
	usageCount: number; // Number of boards using this scorecard
}
