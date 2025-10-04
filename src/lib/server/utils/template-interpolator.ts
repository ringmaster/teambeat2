/**
 * Template Interpolation Utility
 *
 * Supports {path.to.field} syntax for accessing data from evaluation context.
 * Used in scorecard title and value templates.
 */

import type { EvaluationContext } from '$lib/types/scorecard.js';

/**
 * Interpolate a template string with values from context
 *
 * Template syntax: "{path.to.field}" or "{result}" for condition output
 *
 * Examples:
 * - "Approaching SLE: {ticket.id} - {ticket.title}" with context {ticket: {id: "JIRA-1234", title: "Migration"}}
 *   -> "Approaching SLE: JIRA-1234 - Migration"
 * - "Open Tickets: {result}" with context {result: 47}
 *   -> "Open Tickets: 47"
 */
export function interpolateTemplate(template: string, context: EvaluationContext): string {
  // Match {path.to.field} patterns
  const pattern = /\{([^}]+)\}/g;

  return template.replace(pattern, (match, path) => {
    const value = getValueByPath(context, path.trim());

    // Handle null/undefined
    if (value === null || value === undefined) {
      return '';
    }

    // Convert to string
    return String(value);
  });
}

/**
 * Get a value from an object using dot notation path
 * Supports array indexing with bracket syntax: result[0], result[1], etc.
 */
function getValueByPath(obj: any, path: string): any {
  // Handle array indexing: result[0] -> result, index 0
  const arrayIndexMatch = path.match(/^([^[]+)\[(\d+)\]$/);
  if (arrayIndexMatch) {
    const [, basePath, indexStr] = arrayIndexMatch;
    const index = parseInt(indexStr, 10);

    // Get the base value
    const baseValue = basePath === '' ? obj : getValueByPath(obj, basePath);

    // If it's an array, return the indexed value
    if (Array.isArray(baseValue)) {
      return baseValue[index];
    }

    // If base path is 'result' and value is not an array, treat result as result[0]
    if (basePath === 'result' && index === 0) {
      return baseValue;
    }

    return null;
  }

  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return null;
    }
    current = current[part];
  }

  return current;
}
