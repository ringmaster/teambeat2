/**
 * RPN String Parser
 *
 * Parses RPN notation strings into arrays for storage and execution.
 * Examples:
 *   "literal \"Hello world\"" => ["literal", "Hello world"]
 *   "get_json_value data.count 10 gt" => ["get_json_value", "data.count", 10, "gt"]
 *   "true" => [true]
 */

import type { RPNExpression } from '$lib/types/scorecard';

/**
 * Parse an RPN string into an array expression
 */
export function parseRPNString(input: string): RPNExpression {
  if (!input || input.trim() === '') {
    return [];
  }

  const tokens: Array<string | number | boolean | null> = [];
  let current = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '"') {
      if (inString) {
        // End of string - add it as a token
        tokens.push(current);
        current = '';
        inString = false;
      } else {
        // Start of string
        inString = true;
      }
      continue;
    }

    if (inString) {
      current += char;
      continue;
    }

    // Not in string - whitespace is a separator
    if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
      if (current.length > 0) {
        tokens.push(parseToken(current));
        current = '';
      }
      continue;
    }

    current += char;
  }

  // Add final token if any
  if (current.length > 0) {
    if (inString) {
      throw new Error('Unclosed string in RPN expression');
    }
    tokens.push(parseToken(current));
  }

  return tokens as RPNExpression;
}

/**
 * Parse a single token (non-string)
 */
function parseToken(token: string): string | number | boolean | null {
  // Boolean
  if (token === 'true') return true;
  if (token === 'false') return false;

  // Null
  if (token === 'null') return null;

  // Number
  const num = Number(token);
  if (!isNaN(num) && token !== '') {
    return num;
  }

  // Otherwise it's a string (operation or identifier)
  return token;
}

/**
 * Serialize an RPN expression array back to a string for display/editing
 */
export function serializeRPNExpression(expression: RPNExpression): string {
  if (!expression || expression.length === 0) {
    return '';
  }

  return expression.map(token => {
    if (typeof token === 'string') {
      // Check if the string contains spaces or special characters - if so, quote it
      // Operations/identifiers generally don't need quotes
      if (token.includes(' ') || token.includes('"') || token.includes('\\')) {
        // Escape quotes and backslashes
        const escaped = token.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        return `"${escaped}"`;
      }
      return token;
    }
    if (typeof token === 'number') {
      return String(token);
    }
    if (typeof token === 'boolean') {
      return token ? 'true' : 'false';
    }
    if (token === null) {
      return 'null';
    }
    return String(token);
  }).join(' ');
}
