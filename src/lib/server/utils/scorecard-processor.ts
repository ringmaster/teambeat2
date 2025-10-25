/**
 * Scorecard Rule Processor
 *
 * Processes scorecard rules against collected data to generate results.
 * Handles both aggregate metrics and detail item filtering.
 */

import type {
	EvaluationContext,
	ProcessedResult,
	ScorecardRule,
	SeverityLevel,
} from "$lib/types/scorecard.js";
import { evaluateRPN } from "$lib/utils/rpn-evaluator.js";
import { interpolateTemplate } from "./template-interpolator.js";

export interface ProcessingError {
	ruleId: string;
	error: string;
	expression: any[];
	context: any;
	stackTrace?: any[];
	itemIndex?: number;
}

/**
 * Process a single rule against data
 */
export function processRule(
	rule: ScorecardRule,
	data: any,
	datasourceId: string,
	additionalContext?: {
		seriesId?: string;
		lastHealthCheckDate?: string | null;
	},
): { results: ProcessedResult[]; errors: ProcessingError[] } {
	const results: ProcessedResult[] = [];
	const errors: ProcessingError[] = [];

	// Check if this is an aggregate rule (no iteration) or detail filter
	if (rule.iterate_over === null) {
		// Aggregate metric - evaluate once
		const ruleResult = processAggregateRule(
			rule,
			data,
			datasourceId,
			additionalContext,
		);
		if (ruleResult.result) {
			results.push(ruleResult.result);
		}
		if (ruleResult.error) {
			errors.push(ruleResult.error);
		}
	} else {
		// Detail filter - iterate over array
		const detailResult = processDetailRule(
			rule,
			data,
			datasourceId,
			additionalContext,
		);
		results.push(...detailResult.results);
		errors.push(...detailResult.errors);
	}

	return { results, errors };
}

/**
 * Process an aggregate rule (iterate_over: null)
 */
function processAggregateRule(
	rule: ScorecardRule,
	data: any,
	datasourceId: string,
	additionalContext?: {
		seriesId?: string;
		lastHealthCheckDate?: string | null;
	},
): { result: ProcessedResult | null; error: ProcessingError | null } {
	// Build evaluation context with additional context
	// If data is an array (like CSV data), wrap it in $root property
	const evaluationContext = Array.isArray(data)
		? { $root: data, ...(additionalContext || {}) }
		: { ...data, ...(additionalContext || {}) };

	// Evaluate the condition to get the metric value
	const conditionResult = evaluateRPN(rule.condition, evaluationContext);

	if (!conditionResult.success) {
		console.error(
			`RPN evaluation failed for rule ${rule.id}:`,
			conditionResult.error,
		);
		console.error(`  Expression: ${JSON.stringify(rule.condition)}`);
		console.error(`  Input data: ${JSON.stringify(data, null, 2)}`);
		if (conditionResult.stackTrace) {
			console.error(`  Stack trace:`, conditionResult.stackTrace);
		}

		return {
			result: null,
			error: {
				ruleId: rule.id,
				error: conditionResult.error || "Unknown error",
				expression: rule.condition,
				context: data,
				stackTrace: conditionResult.stackTrace,
			},
		};
	}

	// Create context with result for template interpolation
	const context: EvaluationContext = Array.isArray(data)
		? { $root: data, result: conditionResult.value }
		: { ...data, result: conditionResult.value };

	// Interpolate section, title and value templates
	const section = interpolateTemplate(rule.section, context);
	const title = interpolateTemplate(rule.title_template, context);
	const primaryValue = interpolateTemplate(rule.value_template, context);

	// Determine severity
	const severity = determineSeverity(rule, context, conditionResult.value);

	return {
		result: {
			section,
			title,
			primaryValue,
			severity,
			seq: 0, // Will be set by caller
		},
		error: null,
	};
}

/**
 * Process a detail rule (with iteration)
 */
function processDetailRule(
	rule: ScorecardRule,
	data: any,
	datasourceId: string,
	additionalContext?: {
		seriesId?: string;
		lastHealthCheckDate?: string | null;
	},
): { results: ProcessedResult[]; errors: ProcessingError[] } {
	const results: ProcessedResult[] = [];
	const errors: ProcessingError[] = [];

	// Get the array to iterate over
	const arrayPath = rule.iterate_over!;
	const items = getValueByPath(data, arrayPath);

	if (!Array.isArray(items)) {
		console.error(
			`iterate_over path "${arrayPath}" did not resolve to an array for rule ${rule.id}`,
		);
		errors.push({
			ruleId: rule.id,
			error: `iterate_over path "${arrayPath}" did not resolve to an array`,
			expression: rule.condition,
			context: data,
		});
		return { results, errors };
	}

	// Get the item name from the path (e.g., "tickets" -> "ticket")
	const itemName = getItemName(arrayPath);

	// Process each item
	items.forEach((item, index) => {
		// Create context with current item and additional context
		const context: EvaluationContext = {
			...data,
			[itemName]: item,
			_index: index,
			...(additionalContext || {}),
		};

		// Evaluate condition
		const conditionResult = evaluateRPN(rule.condition, context);

		if (!conditionResult.success) {
			console.error(
				`RPN evaluation failed for rule ${rule.id}, item ${index}:`,
				conditionResult.error,
			);
			console.error(`  Expression: ${JSON.stringify(rule.condition)}`);
			console.error(`  Context data: ${JSON.stringify(context, null, 2)}`);
			if (conditionResult.stackTrace) {
				console.error(`  Stack trace:`, conditionResult.stackTrace);
			}

			errors.push({
				ruleId: rule.id,
				error: conditionResult.error || "Unknown error",
				expression: rule.condition,
				context,
				stackTrace: conditionResult.stackTrace,
				itemIndex: index,
			});
			return;
		}

		// Handle array results (multiple values on stack)
		// If result is an array, first element (top of stack) is the condition
		// Otherwise, the value itself is the condition
		const conditionValue = Array.isArray(conditionResult.value)
			? conditionResult.value[0]
			: conditionResult.value;

		// Only include items where condition is true (or truthy for non-boolean results)
		if (!conditionValue) {
			return;
		}

		// Add result to context for template interpolation
		context.result = conditionResult.value;

		// Interpolate templates
		const section = interpolateTemplate(rule.section, context);
		const title = interpolateTemplate(rule.title_template, context);
		const primaryValue = interpolateTemplate(rule.value_template, context);

		// Determine severity
		const severity = determineSeverity(rule, context, conditionResult.value);

		results.push({
			section,
			title,
			primaryValue,
			severity,
			sourceData: item,
			seq: index,
		});
	});

	return { results, errors };
}

/**
 * Determine severity for a result
 */
function determineSeverity(
	rule: ScorecardRule,
	context: EvaluationContext,
	conditionValue: any,
): SeverityLevel {
	// Method 1: Threshold rules (evaluated first, can override base severity)
	if (rule.threshold_rules && rule.threshold_rules.length > 0) {
		// Evaluate threshold rules in order, return first match
		for (const thresholdRule of rule.threshold_rules) {
			// Add result to context for threshold evaluation
			const thresholdContext = { ...context, result: conditionValue };
			const thresholdResult = evaluateRPN(
				thresholdRule.condition,
				thresholdContext,
			);

			if (thresholdResult.success && thresholdResult.value === true) {
				return thresholdRule.severity;
			}
		}

		// If no threshold matched, fall through to base severity or default
	}

	// Method 2: Severity from field
	if (rule.severity_from_field) {
		const severityValue = getValueByPath(context, rule.severity_from_field);
		if (isValidSeverity(severityValue)) {
			return severityValue as SeverityLevel;
		}
		console.warn(
			`Invalid severity value from field "${rule.severity_from_field}": ${severityValue}`,
		);
	}

	// Method 3: Base/fixed severity
	if (rule.severity) {
		return rule.severity;
	}

	// Default: info severity
	return "info";
}

/**
 * Check if a value is a valid severity level
 */
function isValidSeverity(value: any): boolean {
	return value === "info" || value === "warning" || value === "critical";
}

/**
 * Get value from object using dot notation path
 * Special case: "$" returns the root object itself (for root-level arrays)
 */
function getValueByPath(obj: any, path: string): any {
	// Special case: "$" represents the root object
	if (path === "$") {
		return obj;
	}

	const parts = path.split(".");
	let current = obj;

	for (const part of parts) {
		if (current === null || current === undefined) {
			return null;
		}
		current = current[part];
	}

	return current;
}

/**
 * Get singular item name from array path
 * Examples: "tickets" -> "ticket", "prs" -> "pr", "alerts" -> "alert"
 * Special case: "$" -> "$" (root array, item name is also "$")
 */
function getItemName(arrayPath: string): string {
	// Special case: root array
	if (arrayPath === "$") {
		return "$";
	}

	// Get the last part of the path
	const parts = arrayPath.split(".");
	const arrayName = parts[parts.length - 1];

	// Simple pluralization rules (English)
	if (arrayName.endsWith("s") && !arrayName.endsWith("ss")) {
		return arrayName.slice(0, -1);
	}

	// If it doesn't end in 's', just return as-is (user should use proper paths)
	return arrayName;
}

/**
 * Process all rules from a datasource against collected data
 */
export function processAllRules(
	rules: ScorecardRule[],
	data: any,
	datasourceId: string,
	additionalContext?: {
		seriesId?: string;
		lastHealthCheckDate?: string | null;
	},
): { results: ProcessedResult[]; errors: ProcessingError[] } {
	const allResults: ProcessedResult[] = [];
	const allErrors: ProcessingError[] = [];

	for (const rule of rules) {
		const { results, errors } = processRule(
			rule,
			data,
			datasourceId,
			additionalContext,
		);
		allResults.push(...results);
		allErrors.push(...errors);
	}

	// Assign sequential numbers within each section
	const sectionCounters: Record<string, number> = {};

	const numberedResults = allResults.map((result) => {
		if (!sectionCounters[result.section]) {
			sectionCounters[result.section] = 0;
		}
		return {
			...result,
			seq: sectionCounters[result.section]++,
		};
	});

	return { results: numberedResults, errors: allErrors };
}
