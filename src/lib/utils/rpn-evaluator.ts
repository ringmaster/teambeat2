/**
 * RPN (Reverse Polish Notation) Evaluator
 *
 * A stack-based expression evaluator for scorecard rules.
 * Supports data access, comparisons, logic, arithmetic, strings, and aggregations.
 */

import type { RPNExpression, RPNValue, EvaluationContext, RPNEvaluationResult } from '$lib/types/scorecard.js';

type StackValue = RPNValue | any[] | Record<string, any>;

/**
 * Evaluate an RPN expression against a context
 */
export function evaluateRPN(expression: RPNExpression, context: EvaluationContext): RPNEvaluationResult {
  const stack: StackValue[] = [];
  const stackTrace: Array<{ step: number; operation: string; stack: any[] }> = [];

  try {
    let i = 0;
    while (i < expression.length) {
      const token = expression[i];
      const operation = String(token);

      // Numbers push themselves onto stack
      if (typeof token === 'number') {
        stack.push(token);
        stackTrace.push({ step: i + 1, operation: `push ${token}`, stack: [...stack] });
        i++;
        continue;
      }

      // Booleans and null push themselves
      if (typeof token === 'boolean' || token === null) {
        stack.push(token);
        stackTrace.push({ step: i + 1, operation: `push ${token}`, stack: [...stack] });
        i++;
        continue;
      }

      // String operations
      if (typeof token === 'string') {
        // Check for $ prefix (shortcut for get operation)
        if (operation.startsWith('$')) {
          let path: string;
          if (operation === '$') {
            // Check if context has a $ property (iteration context)
            if ('$' in context) {
              path = '$';
            } else {
              path = '$root';
            }
          } else if (operation.startsWith('$.')) {
            // Check if context has a $ property (iteration context)
            if ('$' in context) {
              // Access property on the $ object: $.field -> $.field
              path = operation;
            } else {
              // Remove $. prefix: $.count -> count
              path = operation.substring(2);
            }
          } else {
            // Just $, treat as root
            path = '$root';
          }
          const value = getValueByPath(context, path);
          stack.push(value);
          stackTrace.push({ step: i + 1, operation: `get ${path}`, stack: [...stack] });
          i++;
        }
        // Check if it's an operation or a literal value
        else if (isOperation(operation)) {
          const consumed = executeOperation(operation, stack, context, expression, i);
          stackTrace.push({ step: i + 1, operation, stack: [...stack] });
          i += consumed;
        } else {
          // It's a literal string value (for operations that aren't recognized)
          stack.push(token);
          stackTrace.push({ step: i + 1, operation: `push "${token}"`, stack: [...stack] });
          i++;
        }
      } else {
        i++;
      }
    }

    if (stack.length === 0) {
      return {
        success: false,
        error: `Expected at least one value on stack, got 0`,
        stackTrace
      };
    }

    // If multiple values on stack, return them in reverse order (top to bottom)
    // so result[0] is the top of stack (most recent value)
    const resultValue = stack.length === 1 ? stack[0] : [...stack].reverse();

    return {
      success: true,
      value: resultValue,
      stackTrace
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stackTrace
    };
  }
}

/**
 * Check if a string is an RPN operation
 */
function isOperation(token: string): boolean {
  const operations = [
    // Stack manipulation
    'dup', 'swap', 'drop',
    // Data access
    'get', 'literal',
    // Comparisons (word forms)
    'eq', 'ne', 'gt', 'lt', 'gte', 'lte',
    // Comparisons (symbol forms)
    '=', '!=', '<>', '>', '<', '>=', '<=',
    // Logic (word forms)
    'and', 'or', 'not',
    // Logic (symbol forms)
    '&&', '||', '!',
    // Arithmetic (word forms)
    'add', 'sub', 'mul', 'div', 'mod',
    // Arithmetic (symbol forms)
    '+', '-', '*', '/', '%',
    // String operations
    'concat', 'contains', 'matches_regex',
    // Aggregation
    'count', 'sum', 'avg', 'min', 'max',
    // Date operations
    'days_since', 'days_since_uk'
  ];
  return operations.includes(token);
}

/**
 * Execute an RPN operation
 * Returns the number of tokens consumed (including the operation itself)
 */
function executeOperation(
  operation: string,
  stack: StackValue[],
  context: EvaluationContext,
  expression: RPNExpression,
  currentIndex: number
): number {
  switch (operation) {
    // Stack manipulation
    case 'dup':
      if (stack.length < 1) throw new Error('Stack underflow for dup');
      stack.push(stack[stack.length - 1]);
      return 1;

    case 'swap':
      if (stack.length < 2) throw new Error('Stack underflow for swap');
      {
        const a = stack.pop()!;
        const b = stack.pop()!;
        stack.push(a);
        stack.push(b);
      }
      return 1;

    case 'drop':
      if (stack.length < 1) throw new Error('Stack underflow for drop');
      stack.pop();
      return 1;

    // Data access
    case 'get':
      {
        // Next token in expression should be the path
        const path = expression[currentIndex + 1];
        if (path === undefined) throw new Error('get requires a path parameter');

        const value = getValueByPath(context, String(path));
        stack.push(value);
        return 2; // Consumed operation + path
      }

    case 'literal':
      {
        // Next token in expression is the literal value
        const value = expression[currentIndex + 1];
        if (value === undefined) throw new Error('literal requires a value parameter');

        stack.push(value as StackValue);
        return 2; // Consumed operation + value
      }

    // Comparisons
    case 'eq':
    case '=':
      if (stack.length < 2) throw new Error('Stack underflow for eq/=');
      {
        const b = stack.pop();
        const a = stack.pop();
        stack.push(a === b);
      }
      return 1;

    case 'ne':
    case '!=':
    case '<>':
      if (stack.length < 2) throw new Error('Stack underflow for ne/!=/<>');
      {
        const b = stack.pop();
        const a = stack.pop();
        stack.push(a !== b);
      }
      return 1;

    case 'gt':
    case '>':
      if (stack.length < 2) throw new Error('Stack underflow for gt/>');
      {
        const b = stack.pop() as number;
        const a = stack.pop() as number;
        stack.push(a > b);
      }
      return 1;

    case 'lt':
    case '<':
      if (stack.length < 2) throw new Error('Stack underflow for lt/<');
      {
        const b = stack.pop() as number;
        const a = stack.pop() as number;
        stack.push(a < b);
      }
      return 1;

    case 'gte':
    case '>=':
      if (stack.length < 2) throw new Error('Stack underflow for gte/>=');
      {
        const b = stack.pop() as number;
        const a = stack.pop() as number;
        stack.push(a >= b);
      }
      return 1;

    case 'lte':
    case '<=':
      if (stack.length < 2) throw new Error('Stack underflow for lte/<=');
      {
        const b = stack.pop() as number;
        const a = stack.pop() as number;
        stack.push(a <= b);
      }
      return 1;

    // Logic
    case 'and':
    case '&&':
      if (stack.length < 2) throw new Error('Stack underflow for and/&&');
      {
        const b = stack.pop() as boolean;
        const a = stack.pop() as boolean;
        stack.push(a && b);
      }
      return 1;

    case 'or':
    case '||':
      if (stack.length < 2) throw new Error('Stack underflow for or/||');
      {
        const b = stack.pop() as boolean;
        const a = stack.pop() as boolean;
        stack.push(a || b);
      }
      return 1;

    case 'not':
    case '!':
      if (stack.length < 1) throw new Error('Stack underflow for not/!');
      {
        const a = stack.pop() as boolean;
        stack.push(!a);
      }
      return 1;

    // Arithmetic
    case 'add':
    case '+':
      if (stack.length < 2) throw new Error('Stack underflow for add/+');
      {
        const b = stack.pop() as number;
        const a = stack.pop() as number;
        stack.push(a + b);
      }
      return 1;

    case 'sub':
    case '-':
      if (stack.length < 2) throw new Error('Stack underflow for sub/-');
      {
        const b = stack.pop() as number;
        const a = stack.pop() as number;
        stack.push(a - b);
      }
      return 1;

    case 'mul':
    case '*':
      if (stack.length < 2) throw new Error('Stack underflow for mul/*');
      {
        const b = stack.pop() as number;
        const a = stack.pop() as number;
        stack.push(a * b);
      }
      return 1;

    case 'div':
    case '/':
      if (stack.length < 2) throw new Error('Stack underflow for div//');
      {
        const b = stack.pop() as number;
        const a = stack.pop() as number;
        if (b === 0) throw new Error('Division by zero');
        stack.push(a / b);
      }
      return 1;

    case 'mod':
    case '%':
      if (stack.length < 2) throw new Error('Stack underflow for mod/%');
      {
        const b = stack.pop() as number;
        const a = stack.pop() as number;
        stack.push(a % b);
      }
      return 1;

    // String operations
    case 'concat':
      if (stack.length < 2) throw new Error('Stack underflow for concat');
      {
        const b = String(stack.pop());
        const a = String(stack.pop());
        stack.push(a + b);
      }
      return 1;

    case 'contains':
      if (stack.length < 2) throw new Error('Stack underflow for contains');
      {
        const substring = String(stack.pop());
        const string = String(stack.pop());
        stack.push(string.includes(substring));
      }
      return 1;

    case 'matches_regex':
      if (stack.length < 2) throw new Error('Stack underflow for matches_regex');
      {
        const pattern = String(stack.pop());
        const string = String(stack.pop());
        const regex = new RegExp(pattern);
        stack.push(regex.test(string));
      }
      return 1;

    // Aggregation
    case 'count':
      if (stack.length < 1) throw new Error('Stack underflow for count');
      {
        const arr = stack.pop();
        if (!Array.isArray(arr)) throw new Error('count requires an array');
        stack.push(arr.length);
      }
      return 1;

    case 'sum':
      if (stack.length < 1) throw new Error('Stack underflow for sum');
      {
        const arr = stack.pop();
        if (!Array.isArray(arr)) throw new Error('sum requires an array');
        const sum = arr.reduce((acc, val) => acc + Number(val), 0);
        stack.push(sum);
      }
      return 1;

    case 'avg':
      if (stack.length < 1) throw new Error('Stack underflow for avg');
      {
        const arr = stack.pop();
        if (!Array.isArray(arr)) throw new Error('avg requires an array');
        if (arr.length === 0) throw new Error('avg requires non-empty array');
        const sum = arr.reduce((acc, val) => acc + Number(val), 0);
        stack.push(sum / arr.length);
      }
      return 1;

    case 'min':
      if (stack.length < 1) throw new Error('Stack underflow for min');
      {
        const arr = stack.pop();
        if (!Array.isArray(arr)) throw new Error('min requires an array');
        if (arr.length === 0) throw new Error('min requires non-empty array');
        stack.push(Math.min(...arr.map(v => Number(v))));
      }
      return 1;

    case 'max':
      if (stack.length < 1) throw new Error('Stack underflow for max');
      {
        const arr = stack.pop();
        if (!Array.isArray(arr)) throw new Error('max requires an array');
        if (arr.length === 0) throw new Error('max requires non-empty array');
        stack.push(Math.max(...arr.map(v => Number(v))));
      }
      return 1;

    // Date operations
    case 'days_since':
      if (stack.length < 1) throw new Error('Stack underflow for days_since');
      {
        const dateStr = stack.pop();
        if (typeof dateStr !== 'string') throw new Error('days_since requires a string');

        try {
          const date = new Date(dateStr);
          if (isNaN(date.getTime())) throw new Error('Invalid date format');

          const now = new Date();
          const diffMs = now.getTime() - date.getTime();
          const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

          stack.push(diffDays);
        } catch (error) {
          throw new Error(`days_since failed to parse date: ${dateStr}`);
        }
      }
      return 1;

    case 'days_since_uk':
      if (stack.length < 1) throw new Error('Stack underflow for days_since_uk');
      {
        const dateStr = stack.pop();
        if (typeof dateStr !== 'string') throw new Error('days_since_uk requires a string');

        try {
          // Parse UK format: "02/Oct/25 11:49 AM"
          // Format: DD/MMM/YY HH:mm AM/PM
          const ukDate = parseUKDate(dateStr);
          if (!ukDate) throw new Error('Invalid UK date format');

          const now = new Date();
          const diffMs = now.getTime() - ukDate.getTime();
          const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

          stack.push(diffDays);
        } catch (error) {
          throw new Error(`days_since_uk failed to parse date: ${dateStr}`);
        }
      }
      return 1;

    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
}

/**
 * Get a value from an object using dot notation path
 */
function getValueByPath(obj: any, path: string): any {
  // Empty path or '$root' returns the whole object
  if (path === '' || path === '$root') {
    return obj;
  }

  // Handle paths that reference the $ property (iteration context)
  // e.g., "$.field" should access obj["$"]["field"]
  if (path.startsWith('$.')) {
    // Check if obj has a $ property
    if ('$' in obj && obj['$'] !== undefined) {
      const fieldPath = path.substring(2); // Remove "$." prefix
      return getValueByPath(obj['$'], fieldPath);
    }
  }

  // Handle direct $ property access
  if (path === '$') {
    return obj['$'] !== undefined ? obj['$'] : obj;
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

/**
 * Parse UK date format: "02/Oct/25 11:49 AM"
 * Format: DD/MMM/YY HH:mm AM/PM
 */
function parseUKDate(dateStr: string): Date | null {
  try {
    // Example: "02/Oct/25 11:49 AM"
    // Pattern: DD/MMM/YY HH:mm AM/PM
    const pattern = /^(\d{1,2})\/(\w{3})\/(\d{2})\s+(\d{1,2}):(\d{2})\s+(AM|PM)$/i;
    const match = dateStr.match(pattern);

    if (!match) return null;

    const [, day, monthStr, year, hours, minutes, period] = match;

    // Map month abbreviations to month numbers (0-11)
    const monthMap: Record<string, number> = {
      'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
      'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
    };

    const month = monthMap[monthStr.toLowerCase()];
    if (month === undefined) return null;

    // Convert 2-digit year to 4-digit (assume 20xx for 00-99)
    const fullYear = 2000 + parseInt(year, 10);

    // Convert 12-hour to 24-hour format
    let hour = parseInt(hours, 10);
    if (period.toUpperCase() === 'PM' && hour !== 12) {
      hour += 12;
    } else if (period.toUpperCase() === 'AM' && hour === 12) {
      hour = 0;
    }

    const date = new Date(fullYear, month, parseInt(day, 10), hour, parseInt(minutes, 10));

    // Validate the date is valid
    if (isNaN(date.getTime())) return null;

    return date;
  } catch (error) {
    return null;
  }
}
