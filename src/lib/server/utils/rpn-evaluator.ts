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
        // Check if it's an operation or a literal value
        if (isOperation(operation)) {
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

    if (stack.length !== 1) {
      return {
        success: false,
        error: `Expected single value on stack, got ${stack.length}`,
        stackTrace
      };
    }

    return {
      success: true,
      value: stack[0],
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
    'get_json_value', 'literal',
    // Comparisons
    'eq', 'ne', 'gt', 'lt', 'gte', 'lte',
    // Logic
    'and', 'or', 'not',
    // Arithmetic
    'add', 'sub', 'mul', 'div', 'mod',
    // String operations
    'concat', 'contains', 'matches_regex',
    // Aggregation
    'count', 'sum', 'avg', 'min', 'max'
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
    case 'get_json_value':
      {
        // Next token in expression should be the path
        const path = expression[currentIndex + 1];
        if (path === undefined) throw new Error('get_json_value requires a path parameter');

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
      if (stack.length < 2) throw new Error('Stack underflow for eq');
      {
        const b = stack.pop();
        const a = stack.pop();
        stack.push(a === b);
      }
      return 1;

    case 'ne':
      if (stack.length < 2) throw new Error('Stack underflow for ne');
      {
        const b = stack.pop();
        const a = stack.pop();
        stack.push(a !== b);
      }
      return 1;

    case 'gt':
      if (stack.length < 2) throw new Error('Stack underflow for gt');
      {
        const b = stack.pop() as number;
        const a = stack.pop() as number;
        stack.push(a > b);
      }
      return 1;

    case 'lt':
      if (stack.length < 2) throw new Error('Stack underflow for lt');
      {
        const b = stack.pop() as number;
        const a = stack.pop() as number;
        stack.push(a < b);
      }
      return 1;

    case 'gte':
      if (stack.length < 2) throw new Error('Stack underflow for gte');
      {
        const b = stack.pop() as number;
        const a = stack.pop() as number;
        stack.push(a >= b);
      }
      return 1;

    case 'lte':
      if (stack.length < 2) throw new Error('Stack underflow for lte');
      {
        const b = stack.pop() as number;
        const a = stack.pop() as number;
        stack.push(a <= b);
      }
      return 1;

    // Logic
    case 'and':
      if (stack.length < 2) throw new Error('Stack underflow for and');
      {
        const b = stack.pop() as boolean;
        const a = stack.pop() as boolean;
        stack.push(a && b);
      }
      return 1;

    case 'or':
      if (stack.length < 2) throw new Error('Stack underflow for or');
      {
        const b = stack.pop() as boolean;
        const a = stack.pop() as boolean;
        stack.push(a || b);
      }
      return 1;

    case 'not':
      if (stack.length < 1) throw new Error('Stack underflow for not');
      {
        const a = stack.pop() as boolean;
        stack.push(!a);
      }
      return 1;

    // Arithmetic
    case 'add':
      if (stack.length < 2) throw new Error('Stack underflow for add');
      {
        const b = stack.pop() as number;
        const a = stack.pop() as number;
        stack.push(a + b);
      }
      return 1;

    case 'sub':
      if (stack.length < 2) throw new Error('Stack underflow for sub');
      {
        const b = stack.pop() as number;
        const a = stack.pop() as number;
        stack.push(a - b);
      }
      return 1;

    case 'mul':
      if (stack.length < 2) throw new Error('Stack underflow for mul');
      {
        const b = stack.pop() as number;
        const a = stack.pop() as number;
        stack.push(a * b);
      }
      return 1;

    case 'div':
      if (stack.length < 2) throw new Error('Stack underflow for div');
      {
        const b = stack.pop() as number;
        const a = stack.pop() as number;
        if (b === 0) throw new Error('Division by zero');
        stack.push(a / b);
      }
      return 1;

    case 'mod':
      if (stack.length < 2) throw new Error('Stack underflow for mod');
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

    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
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
