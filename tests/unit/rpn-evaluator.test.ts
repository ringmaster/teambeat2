import { describe, it, expect } from 'vitest';
import { evaluateRPN } from '$lib/utils/rpn-evaluator';
import type { RPNExpression, EvaluationContext } from '$lib/types/scorecard';

describe('RPN Evaluator', () => {
  describe('Basic Operations', () => {
    it('should evaluate a simple number', () => {
      const expr: RPNExpression = [42];
      const result = evaluateRPN(expr, {});
      expect(result.success).toBe(true);
      expect(result.value).toBe(42);
    });

    it('should evaluate boolean values', () => {
      const expr: RPNExpression = [true];
      const result = evaluateRPN(expr, {});
      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });

    it('should evaluate null', () => {
      const expr: RPNExpression = [null];
      const result = evaluateRPN(expr, {});
      expect(result.success).toBe(true);
      expect(result.value).toBe(null);
    });

    it('should fail with empty stack', () => {
      const expr: RPNExpression = [];
      const result = evaluateRPN(expr, {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('Expected at least one value');
    });

    it('should return array when multiple values on stack', () => {
      const expr: RPNExpression = [1, 2];
      const result = evaluateRPN(expr, {});
      expect(result.success).toBe(true);
      expect(result.value).toEqual([2, 1]); // Reversed: top to bottom
    });
  });

  describe('Arithmetic Operations', () => {
    it('should add two numbers', () => {
      const expr: RPNExpression = [5, 3, 'add'];
      const result = evaluateRPN(expr, {});
      expect(result.success).toBe(true);
      expect(result.value).toBe(8);
    });

    it('should subtract two numbers', () => {
      const expr: RPNExpression = [10, 4, 'sub'];
      const result = evaluateRPN(expr, {});
      expect(result.success).toBe(true);
      expect(result.value).toBe(6);
    });

    it('should multiply two numbers', () => {
      const expr: RPNExpression = [6, 7, 'mul'];
      const result = evaluateRPN(expr, {});
      expect(result.success).toBe(true);
      expect(result.value).toBe(42);
    });

    it('should divide two numbers', () => {
      const expr: RPNExpression = [20, 4, 'div'];
      const result = evaluateRPN(expr, {});
      expect(result.success).toBe(true);
      expect(result.value).toBe(5);
    });

    it('should calculate modulo', () => {
      const expr: RPNExpression = [17, 5, 'mod'];
      const result = evaluateRPN(expr, {});
      expect(result.success).toBe(true);
      expect(result.value).toBe(2);
    });

    it('should fail on division by zero', () => {
      const expr: RPNExpression = [10, 0, 'div'];
      const result = evaluateRPN(expr, {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('Division by zero');
    });

    it('should evaluate complex arithmetic', () => {
      // (5 + 3) * 2 = 16
      // RPN: 5 3 add 2 mul
      const expr: RPNExpression = [5, 3, 'add', 2, 'mul'];
      const result = evaluateRPN(expr, {});
      expect(result.success).toBe(true);
      expect(result.value).toBe(16);
    });

    it('should fail on arithmetic with stack underflow', () => {
      const expr: RPNExpression = [5, 'add'];
      const result = evaluateRPN(expr, {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('Stack underflow');
    });
  });

  describe('Comparison Operations', () => {
    it('should compare equality (true)', () => {
      const expr: RPNExpression = [5, 5, 'eq'];
      const result = evaluateRPN(expr, {});
      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });

    it('should compare equality (false)', () => {
      const expr: RPNExpression = [5, 3, 'eq'];
      const result = evaluateRPN(expr, {});
      expect(result.success).toBe(true);
      expect(result.value).toBe(false);
    });

    it('should compare inequality', () => {
      const expr: RPNExpression = [5, 3, 'ne'];
      const result = evaluateRPN(expr, {});
      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });

    it('should compare greater than', () => {
      const expr: RPNExpression = [10, 5, 'gt'];
      const result = evaluateRPN(expr, {});
      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });

    it('should compare less than', () => {
      const expr: RPNExpression = [3, 8, 'lt'];
      const result = evaluateRPN(expr, {});
      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });

    it('should compare greater than or equal', () => {
      const expr: RPNExpression = [5, 5, 'gte'];
      const result = evaluateRPN(expr, {});
      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });

    it('should compare less than or equal', () => {
      const expr: RPNExpression = [5, 5, 'lte'];
      const result = evaluateRPN(expr, {});
      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });
  });

  describe('Logical Operations', () => {
    it('should perform AND (true && true)', () => {
      const expr: RPNExpression = [true, true, 'and'];
      const result = evaluateRPN(expr, {});
      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });

    it('should perform AND (true && false)', () => {
      const expr: RPNExpression = [true, false, 'and'];
      const result = evaluateRPN(expr, {});
      expect(result.success).toBe(true);
      expect(result.value).toBe(false);
    });

    it('should perform OR (false || true)', () => {
      const expr: RPNExpression = [false, true, 'or'];
      const result = evaluateRPN(expr, {});
      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });

    it('should perform OR (false || false)', () => {
      const expr: RPNExpression = [false, false, 'or'];
      const result = evaluateRPN(expr, {});
      expect(result.success).toBe(true);
      expect(result.value).toBe(false);
    });

    it('should perform NOT (true)', () => {
      const expr: RPNExpression = [true, 'not'];
      const result = evaluateRPN(expr, {});
      expect(result.success).toBe(true);
      expect(result.value).toBe(false);
    });

    it('should perform NOT (false)', () => {
      const expr: RPNExpression = [false, 'not'];
      const result = evaluateRPN(expr, {});
      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });

    it('should evaluate complex logical expression', () => {
      // (true AND false) OR true = true
      // RPN: true false and true or
      const expr: RPNExpression = [true, false, 'and', true, 'or'];
      const result = evaluateRPN(expr, {});
      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });
  });

  describe('Stack Manipulation', () => {
    it('should duplicate top value', () => {
      const expr: RPNExpression = [5, 'dup', 'add'];
      const result = evaluateRPN(expr, {});
      expect(result.success).toBe(true);
      expect(result.value).toBe(10);
    });

    it('should swap top two values', () => {
      // 3 5 swap sub = 5 - 3 = 2
      const expr: RPNExpression = [3, 5, 'swap', 'sub'];
      const result = evaluateRPN(expr, {});
      expect(result.success).toBe(true);
      expect(result.value).toBe(2);
    });

    it('should drop top value', () => {
      const expr: RPNExpression = [10, 5, 'drop'];
      const result = evaluateRPN(expr, {});
      expect(result.success).toBe(true);
      expect(result.value).toBe(10);
    });

    it('should fail dup on empty stack', () => {
      const expr: RPNExpression = ['dup'];
      const result = evaluateRPN(expr, {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('Stack underflow');
    });

    it('should fail swap with insufficient values', () => {
      const expr: RPNExpression = [5, 'swap'];
      const result = evaluateRPN(expr, {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('Stack underflow');
    });
  });

  describe('Data Access', () => {
    it('should get simple property value', () => {
      const context: EvaluationContext = {
        count: 42
      };
      const expr: RPNExpression = ['get', 'count'];
      const result = evaluateRPN(expr, context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(42);
    });

    it('should get property using $ shortcut', () => {
      const context: EvaluationContext = {
        count: 42
      };
      const expr: RPNExpression = ['$.count'];
      const result = evaluateRPN(expr, context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(42);
    });

    it('should get root using $ shortcut', () => {
      const context: EvaluationContext = {
        name: 'test',
        value: 123
      };
      const expr: RPNExpression = ['$'];
      const result = evaluateRPN(expr, context);
      expect(result.success).toBe(true);
      expect(result.value).toEqual({ name: 'test', value: 123 });
    });

    it('should get nested property using $ shortcut', () => {
      const context: EvaluationContext = {
        user: {
          profile: {
            age: 30
          }
        }
      };
      const expr: RPNExpression = ['$.user.profile.age'];
      const result = evaluateRPN(expr, context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(30);
    });

    it('should get nested property value', () => {
      const context: EvaluationContext = {
        user: {
          profile: {
            age: 30
          }
        }
      };
      const expr: RPNExpression = ['get', 'user.profile.age'];
      const result = evaluateRPN(expr, context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(30);
    });

    it('should return undefined for missing property', () => {
      const context: EvaluationContext = {
        name: 'John'
      };
      const expr: RPNExpression = ['get', 'age'];
      const result = evaluateRPN(expr, context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(undefined);
    });

    it('should handle null in path', () => {
      const context: EvaluationContext = {
        user: null
      };
      const expr: RPNExpression = ['get', 'user.name'];
      const result = evaluateRPN(expr, context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(null);
    });

    it('should push literal value', () => {
      const expr: RPNExpression = ['literal', 'hello'];
      const result = evaluateRPN(expr, {});
      expect(result.success).toBe(true);
      expect(result.value).toBe('hello');
    });

    it('should push literal number', () => {
      const expr: RPNExpression = ['literal', 99];
      const result = evaluateRPN(expr, {});
      expect(result.success).toBe(true);
      expect(result.value).toBe(99);
    });

    it('should fail get_json_value without path', () => {
      const expr: RPNExpression = ['get'];
      const result = evaluateRPN(expr, {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('requires a path parameter');
    });

    it('should fail literal without value', () => {
      const expr: RPNExpression = ['literal'];
      const result = evaluateRPN(expr, {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('requires a value parameter');
    });
  });

  describe('String Operations', () => {
    it('should concatenate strings', () => {
      const expr: RPNExpression = ['literal', 'Hello', 'literal', ' World', 'concat'];
      const result = evaluateRPN(expr, {});
      expect(result.success).toBe(true);
      expect(result.value).toBe('Hello World');
    });

    it('should check if string contains substring', () => {
      const expr: RPNExpression = ['literal', 'Hello World', 'literal', 'World', 'contains'];
      const result = evaluateRPN(expr, {});
      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });

    it('should check if string does not contain substring', () => {
      const expr: RPNExpression = ['literal', 'Hello World', 'literal', 'xyz', 'contains'];
      const result = evaluateRPN(expr, {});
      expect(result.success).toBe(true);
      expect(result.value).toBe(false);
    });

    it('should match regex pattern', () => {
      const expr: RPNExpression = ['literal', 'test123', 'literal', '^test\\d+$', 'matches_regex'];
      const result = evaluateRPN(expr, {});
      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });

    it('should not match regex pattern', () => {
      const expr: RPNExpression = ['literal', 'test', 'literal', '^\\d+$', 'matches_regex'];
      const result = evaluateRPN(expr, {});
      expect(result.success).toBe(true);
      expect(result.value).toBe(false);
    });
  });

  describe('Aggregation Operations', () => {
    it('should count array elements', () => {
      const context: EvaluationContext = {
        items: [1, 2, 3, 4, 5]
      };
      const expr: RPNExpression = ['get', 'items', 'count'];
      const result = evaluateRPN(expr, context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(5);
    });

    it('should sum array elements', () => {
      const context: EvaluationContext = {
        numbers: [10, 20, 30]
      };
      const expr: RPNExpression = ['get', 'numbers', 'sum'];
      const result = evaluateRPN(expr, context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(60);
    });

    it('should calculate average', () => {
      const context: EvaluationContext = {
        scores: [80, 90, 100]
      };
      const expr: RPNExpression = ['get', 'scores', 'avg'];
      const result = evaluateRPN(expr, context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(90);
    });

    it('should find minimum', () => {
      const context: EvaluationContext = {
        values: [5, 2, 9, 1, 7]
      };
      const expr: RPNExpression = ['get', 'values', 'min'];
      const result = evaluateRPN(expr, context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(1);
    });

    it('should find maximum', () => {
      const context: EvaluationContext = {
        values: [5, 2, 9, 1, 7]
      };
      const expr: RPNExpression = ['get', 'values', 'max'];
      const result = evaluateRPN(expr, context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(9);
    });

    it('should fail count on non-array', () => {
      const context: EvaluationContext = {
        value: 42
      };
      const expr: RPNExpression = ['get', 'value', 'count'];
      const result = evaluateRPN(expr, context);
      expect(result.success).toBe(false);
      expect(result.error).toContain('requires an array');
    });

    it('should fail avg on empty array', () => {
      const context: EvaluationContext = {
        empty: []
      };
      const expr: RPNExpression = ['get', 'empty', 'avg'];
      const result = evaluateRPN(expr, context);
      expect(result.success).toBe(false);
      expect(result.error).toContain('non-empty array');
    });
  });

  describe('Complex Expressions', () => {
    it('should evaluate scorecard-style rule', () => {
      // Rule: count of issues where severity > 5
      // Data has issues array, we want to check if count > 10
      const context: EvaluationContext = {
        issues: [
          { severity: 3 },
          { severity: 7 },
          { severity: 8 },
          { severity: 2 }
        ],
        threshold: 2
      };

      // Check if count of issues is greater than threshold
      // RPN: get_json_value issues count get_json_value threshold gt
      const expr: RPNExpression = [
        'get', 'issues',
        'count',
        'get', 'threshold',
        'gt'
      ];
      const result = evaluateRPN(expr, context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(true); // 4 > 2
    });

    it('should combine multiple operations', () => {
      // Calculate: (a + b) * c > threshold
      const context: EvaluationContext = {
        a: 5,
        b: 10,
        c: 2,
        threshold: 25
      };

      // RPN: get_json_value a get_json_value b add get_json_value c mul get_json_value threshold gt
      const expr: RPNExpression = [
        'get', 'a',
        'get', 'b',
        'add',
        'get', 'c',
        'mul',
        'get', 'threshold',
        'gt'
      ];
      const result = evaluateRPN(expr, context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(true); // (5 + 10) * 2 = 30 > 25
    });

    it('should handle threshold comparison with literals', () => {
      const context: EvaluationContext = {
        error_rate: 0.15
      };

      // Check if error_rate > 0.1
      const expr: RPNExpression = [
        'get', 'error_rate',
        'literal', 0.1,
        'gt'
      ];
      const result = evaluateRPN(expr, context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });
  });

  describe('$ Shortcut in Iteration Context', () => {
    it('should access $ property when context has $ key', () => {
      // Simulates iteration context where item is stored in $ property
      const context = {
        '0': { name: 'item0' },
        '1': { name: 'item1' },
        '$': { name: 'current', field: 'value' },
        '_index': 1
      };

      const expr: RPNExpression = ['$.field'];
      const result = evaluateRPN(expr, context);

      expect(result.success).toBe(true);
      expect(result.value).toBe('value');
    });

    it('should access nested properties in $ context using get', () => {
      const context = {
        '$': {
          'Status Category Changed': '02/Oct/25 11:49 AM',
          'Issue key': 'SREC-1234'
        },
        '_index': 0
      };

      const expr: RPNExpression = ['get', '$.Status Category Changed'];
      const result = evaluateRPN(expr, context);

      expect(result.success).toBe(true);
      expect(result.value).toBe('02/Oct/25 11:49 AM');
    });

    it('should access fields with spaces in $ context using get', () => {
      const context = {
        '$': {
          'Status Category Changed': '02/Oct/25 11:49 AM',
          'Issue key': 'SREC-1234'
        },
        '_index': 5
      };

      const expr: RPNExpression = ['get', '$.Status Category Changed', 'days_since_uk'];
      const result = evaluateRPN(expr, context);

      expect(result.success).toBe(true);
      expect(typeof result.value).toBe('number');
      expect(result.value).toBeGreaterThanOrEqual(0);
    });

    it('should fall back to root when $ property does not exist', () => {
      const context = {
        count: 42,
        name: 'test'
      };

      const expr: RPNExpression = ['$.count'];
      const result = evaluateRPN(expr, context);

      expect(result.success).toBe(true);
      expect(result.value).toBe(42);
    });
  });

  describe('Date Operations', () => {
    it('should calculate days since ISO date', () => {
      // Create a date 5 days ago in ISO format
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
      const isoDate = fiveDaysAgo.toISOString().split('T')[0]; // YYYY-MM-DD

      const expr: RPNExpression = ['literal', isoDate, 'days_since'];
      const result = evaluateRPN(expr, {});

      expect(result.success).toBe(true);
      expect(result.value).toBe(5);
    });

    it('should calculate days since UK formatted date', () => {
      // Create a date 3 days ago in UK format
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const day = String(threeDaysAgo.getDate()).padStart(2, '0');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = months[threeDaysAgo.getMonth()];
      const year = String(threeDaysAgo.getFullYear()).slice(-2);
      const hours = threeDaysAgo.getHours();
      const minutes = String(threeDaysAgo.getMinutes()).padStart(2, '0');
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;

      const ukDate = `${day}/${month}/${year} ${displayHours}:${minutes} ${period}`;

      const expr: RPNExpression = ['literal', ukDate, 'days_since_uk'];
      const result = evaluateRPN(expr, {});

      expect(result.success).toBe(true);
      expect(result.value).toBe(3);
    });

    it('should handle UK date from context', () => {
      const context = {
        updated: '02/Oct/25 11:49 AM'
      };

      // This would be about 2 days ago if run on Oct 4, 2025
      const expr: RPNExpression = ['get', 'updated', 'days_since_uk'];
      const result = evaluateRPN(expr, context);

      expect(result.success).toBe(true);
      expect(typeof result.value).toBe('number');
      expect(result.value).toBeGreaterThanOrEqual(0);
    });

    it('should fail on invalid date format for days_since', () => {
      const expr: RPNExpression = ['literal', 'not-a-date', 'days_since'];
      const result = evaluateRPN(expr, {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('days_since failed to parse date');
    });

    it('should fail on invalid UK date format', () => {
      const expr: RPNExpression = ['literal', 'invalid-uk-date', 'days_since_uk'];
      const result = evaluateRPN(expr, {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('days_since_uk failed to parse date');
    });

    it('should use days_since with $ shortcut', () => {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const isoDate = twoDaysAgo.toISOString().split('T')[0];

      const context = [
        { date: isoDate, title: 'Task 1' }
      ];

      const expr: RPNExpression = ['$.date', 'days_since'];
      const result = evaluateRPN(expr, context[0]);

      expect(result.success).toBe(true);
      expect(result.value).toBe(2);
    });
  });

  describe('Multi-Value Stack Results', () => {
    it('should return single value for single item on stack', () => {
      const expr: RPNExpression = [42];
      const result = evaluateRPN(expr, {});
      expect(result.success).toBe(true);
      expect(result.value).toBe(42);
      expect(Array.isArray(result.value)).toBe(false);
    });

    it('should return array for multiple items on stack (reversed)', () => {
      const expr: RPNExpression = ['literal', 'one', 'literal', 'two', 'literal', 'three'];
      const result = evaluateRPN(expr, {});
      expect(result.success).toBe(true);
      expect(Array.isArray(result.value)).toBe(true);
      expect(result.value).toEqual(['three', 'two', 'one']); // top to bottom
    });

    it('should handle dup gte pattern for age checking', () => {
      const context = {
        days: 30
      };
      // get days, dup, 4, gte -> [30, true]
      const expr: RPNExpression = ['get', 'days', 'dup', 4, 'gte'];
      const result = evaluateRPN(expr, context);

      expect(result.success).toBe(true);
      expect(Array.isArray(result.value)).toBe(true);
      expect(result.value).toEqual([true, 30]); // [condition, days]
    });

    it('should handle date calculation with condition', () => {
      const context = {
        '$': {
          'Status Category Changed': '02/Oct/25 11:49 AM'
        }
      };
      // Calculate days, dup, compare with 4
      // Stack will be: [days, days, 4] -> [days, condition]
      const expr: RPNExpression = ['get', '$.Status Category Changed', 'days_since_uk', 'dup', 4, 'gte'];
      const result = evaluateRPN(expr, context);

      expect(result.success).toBe(true);
      expect(Array.isArray(result.value)).toBe(true);
      // result[0] is top of stack (condition), result[1] is days
      expect(typeof result.value[0]).toBe('boolean'); // Condition (>= 4 days)
      expect(typeof result.value[1]).toBe('number'); // Days value
      expect(result.value[1]).toBeGreaterThanOrEqual(0);
    });

    it('should handle three values on stack', () => {
      const expr: RPNExpression = [10, 20, 30];
      const result = evaluateRPN(expr, {});
      expect(result.success).toBe(true);
      expect(result.value).toEqual([30, 20, 10]); // top to bottom
    });
  });

  describe('Stack Trace', () => {
    it('should provide stack trace on success', () => {
      const expr: RPNExpression = [5, 3, 'add'];
      const result = evaluateRPN(expr, {});
      expect(result.success).toBe(true);
      expect(result.stackTrace).toBeDefined();
      expect(result.stackTrace!.length).toBeGreaterThan(0);
    });

    it('should provide stack trace on error', () => {
      const expr: RPNExpression = [5, 'add'];
      const result = evaluateRPN(expr, {});
      expect(result.success).toBe(false);
      expect(result.stackTrace).toBeDefined();
    });
  });
});
