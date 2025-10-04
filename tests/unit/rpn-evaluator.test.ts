import { describe, it, expect } from 'vitest';
import { evaluateRPN } from '$lib/server/utils/rpn-evaluator';
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
      expect(result.error).toContain('Expected single value');
    });

    it('should fail with multiple values on stack', () => {
      const expr: RPNExpression = [1, 2];
      const result = evaluateRPN(expr, {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('Expected single value');
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
      const expr: RPNExpression = ['get_json_value', 'count'];
      const result = evaluateRPN(expr, context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(42);
    });

    it('should get nested property value', () => {
      const context: EvaluationContext = {
        user: {
          profile: {
            age: 30
          }
        }
      };
      const expr: RPNExpression = ['get_json_value', 'user.profile.age'];
      const result = evaluateRPN(expr, context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(30);
    });

    it('should return undefined for missing property', () => {
      const context: EvaluationContext = {
        name: 'John'
      };
      const expr: RPNExpression = ['get_json_value', 'age'];
      const result = evaluateRPN(expr, context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(undefined);
    });

    it('should handle null in path', () => {
      const context: EvaluationContext = {
        user: null
      };
      const expr: RPNExpression = ['get_json_value', 'user.name'];
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
      const expr: RPNExpression = ['get_json_value'];
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
      const expr: RPNExpression = ['get_json_value', 'items', 'count'];
      const result = evaluateRPN(expr, context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(5);
    });

    it('should sum array elements', () => {
      const context: EvaluationContext = {
        numbers: [10, 20, 30]
      };
      const expr: RPNExpression = ['get_json_value', 'numbers', 'sum'];
      const result = evaluateRPN(expr, context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(60);
    });

    it('should calculate average', () => {
      const context: EvaluationContext = {
        scores: [80, 90, 100]
      };
      const expr: RPNExpression = ['get_json_value', 'scores', 'avg'];
      const result = evaluateRPN(expr, context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(90);
    });

    it('should find minimum', () => {
      const context: EvaluationContext = {
        values: [5, 2, 9, 1, 7]
      };
      const expr: RPNExpression = ['get_json_value', 'values', 'min'];
      const result = evaluateRPN(expr, context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(1);
    });

    it('should find maximum', () => {
      const context: EvaluationContext = {
        values: [5, 2, 9, 1, 7]
      };
      const expr: RPNExpression = ['get_json_value', 'values', 'max'];
      const result = evaluateRPN(expr, context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(9);
    });

    it('should fail count on non-array', () => {
      const context: EvaluationContext = {
        value: 42
      };
      const expr: RPNExpression = ['get_json_value', 'value', 'count'];
      const result = evaluateRPN(expr, context);
      expect(result.success).toBe(false);
      expect(result.error).toContain('requires an array');
    });

    it('should fail avg on empty array', () => {
      const context: EvaluationContext = {
        empty: []
      };
      const expr: RPNExpression = ['get_json_value', 'empty', 'avg'];
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
        'get_json_value', 'issues',
        'count',
        'get_json_value', 'threshold',
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
        'get_json_value', 'a',
        'get_json_value', 'b',
        'add',
        'get_json_value', 'c',
        'mul',
        'get_json_value', 'threshold',
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
        'get_json_value', 'error_rate',
        'literal', 0.1,
        'gt'
      ];
      const result = evaluateRPN(expr, context);
      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
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
