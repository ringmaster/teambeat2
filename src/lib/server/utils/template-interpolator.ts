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
 */
function getValueByPath(obj: any, path: string): any {
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
