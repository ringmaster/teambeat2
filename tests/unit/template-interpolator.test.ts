import { describe, it, expect } from 'vitest';
import { interpolateTemplate } from '$lib/server/utils/template-interpolator';
import type { EvaluationContext } from '$lib/types/scorecard';

describe('Template Interpolator', () => {
  describe('Simple Field Interpolation', () => {
    it('should interpolate a simple field', () => {
      const context: EvaluationContext = {
        name: 'John'
      };
      const template = 'Hello, {name}!';
      const result = interpolateTemplate(template, context);
      expect(result).toBe('Hello, John!');
    });

    it('should interpolate a number field', () => {
      const context: EvaluationContext = {
        count: 42
      };
      const template = 'Count: {count}';
      const result = interpolateTemplate(template, context);
      expect(result).toBe('Count: 42');
    });

    it('should interpolate a boolean field', () => {
      const context: EvaluationContext = {
        active: true
      };
      const template = 'Active: {active}';
      const result = interpolateTemplate(template, context);
      expect(result).toBe('Active: true');
    });

    it('should handle template without placeholders', () => {
      const context: EvaluationContext = {
        name: 'John'
      };
      const template = 'Hello, World!';
      const result = interpolateTemplate(template, context);
      expect(result).toBe('Hello, World!');
    });
  });

  describe('Nested Field Interpolation', () => {
    it('should interpolate nested fields', () => {
      const context: EvaluationContext = {
        user: {
          profile: {
            name: 'Alice'
          }
        }
      };
      const template = 'User: {user.profile.name}';
      const result = interpolateTemplate(template, context);
      expect(result).toBe('User: Alice');
    });

    it('should interpolate deeply nested fields', () => {
      const context: EvaluationContext = {
        data: {
          level1: {
            level2: {
              level3: {
                value: 'deep'
              }
            }
          }
        }
      };
      const template = 'Value: {data.level1.level2.level3.value}';
      const result = interpolateTemplate(template, context);
      expect(result).toBe('Value: deep');
    });
  });

  describe('Multiple Field Interpolation', () => {
    it('should interpolate multiple fields', () => {
      const context: EvaluationContext = {
        ticket: {
          id: 'JIRA-1234',
          title: 'Migration'
        }
      };
      const template = 'Approaching SLE: {ticket.id} - {ticket.title}';
      const result = interpolateTemplate(template, context);
      expect(result).toBe('Approaching SLE: JIRA-1234 - Migration');
    });

    it('should interpolate the same field multiple times', () => {
      const context: EvaluationContext = {
        name: 'Bob'
      };
      const template = '{name} is {name}';
      const result = interpolateTemplate(template, context);
      expect(result).toBe('Bob is Bob');
    });

    it('should interpolate mixed simple and nested fields', () => {
      const context: EvaluationContext = {
        count: 5,
        user: {
          name: 'Charlie'
        }
      };
      const template = '{user.name} has {count} items';
      const result = interpolateTemplate(template, context);
      expect(result).toBe('Charlie has 5 items');
    });
  });

  describe('Special Values', () => {
    it('should interpolate result value', () => {
      const context: EvaluationContext = {
        result: 47
      };
      const template = 'Open Tickets: {result}';
      const result = interpolateTemplate(template, context);
      expect(result).toBe('Open Tickets: 47');
    });

    it('should interpolate result as boolean', () => {
      const context: EvaluationContext = {
        result: true
      };
      const template = 'Condition met: {result}';
      const result = interpolateTemplate(template, context);
      expect(result).toBe('Condition met: true');
    });
  });

  describe('Missing and Invalid Fields', () => {
    it('should replace missing field with empty string', () => {
      const context: EvaluationContext = {
        name: 'John'
      };
      const template = 'Hello, {missing}!';
      const result = interpolateTemplate(template, context);
      expect(result).toBe('Hello, !');
    });

    it('should handle null field value', () => {
      const context: EvaluationContext = {
        value: null
      };
      const template = 'Value: {value}';
      const result = interpolateTemplate(template, context);
      expect(result).toBe('Value: ');
    });

    it('should handle undefined field value', () => {
      const context: EvaluationContext = {
        value: undefined
      };
      const template = 'Value: {value}';
      const result = interpolateTemplate(template, context);
      expect(result).toBe('Value: ');
    });

    it('should handle null in nested path', () => {
      const context: EvaluationContext = {
        user: null
      };
      const template = 'Name: {user.name}';
      const result = interpolateTemplate(template, context);
      expect(result).toBe('Name: ');
    });

    it('should handle undefined in nested path', () => {
      const context: EvaluationContext = {
        data: {
          user: undefined
        }
      };
      const template = 'Name: {data.user.name}';
      const result = interpolateTemplate(template, context);
      expect(result).toBe('Name: ');
    });
  });

  describe('Complex Data Types', () => {
    it('should convert array to string', () => {
      const context: EvaluationContext = {
        items: [1, 2, 3]
      };
      const template = 'Items: {items}';
      const result = interpolateTemplate(template, context);
      expect(result).toBe('Items: 1,2,3');
    });

    it('should convert object to string', () => {
      const context: EvaluationContext = {
        data: { key: 'value' }
      };
      const template = 'Data: {data}';
      const result = interpolateTemplate(template, context);
      expect(result).toBe('Data: [object Object]');
    });

    it('should handle zero value', () => {
      const context: EvaluationContext = {
        count: 0
      };
      const template = 'Count: {count}';
      const result = interpolateTemplate(template, context);
      expect(result).toBe('Count: 0');
    });

    it('should handle empty string', () => {
      const context: EvaluationContext = {
        text: ''
      };
      const template = 'Text: {text}';
      const result = interpolateTemplate(template, context);
      expect(result).toBe('Text: ');
    });
  });

  describe('Whitespace Handling', () => {
    it('should trim whitespace in placeholder', () => {
      const context: EvaluationContext = {
        name: 'John'
      };
      const template = 'Hello, { name }!';
      const result = interpolateTemplate(template, context);
      expect(result).toBe('Hello, John!');
    });

    it('should handle multiple spaces in placeholder', () => {
      const context: EvaluationContext = {
        user: {
          name: 'Alice'
        }
      };
      const template = 'User: {  user.name  }';
      const result = interpolateTemplate(template, context);
      expect(result).toBe('User: Alice');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty template', () => {
      const context: EvaluationContext = {
        name: 'John'
      };
      const template = '';
      const result = interpolateTemplate(template, context);
      expect(result).toBe('');
    });

    it('should handle empty context', () => {
      const context: EvaluationContext = {};
      const template = 'Hello, {name}!';
      const result = interpolateTemplate(template, context);
      expect(result).toBe('Hello, !');
    });

    it('should handle malformed placeholder (unclosed)', () => {
      const context: EvaluationContext = {
        name: 'John'
      };
      const template = 'Hello, {name!';
      const result = interpolateTemplate(template, context);
      expect(result).toBe('Hello, {name!');
    });

    it('should NOT handle nested braces correctly (known limitation)', () => {
      const context: EvaluationContext = {
        name: 'John'
      };
      // This is a known limitation of the simple regex-based approach
      // The regex will match from the first { to the first }, not correctly handling nesting
      const template = 'JSON: {"name": "{name}"}';
      const result = interpolateTemplate(template, context);
      // The result is not correct, but this documents the limitation
      // The regex matches {"name": "{name} and replaces it with empty string, leaving "}
      expect(result).toBe('JSON: "}');
    });

    it('should handle consecutive placeholders', () => {
      const context: EvaluationContext = {
        first: 'Hello',
        second: 'World'
      };
      const template = '{first}{second}';
      const result = interpolateTemplate(template, context);
      expect(result).toBe('HelloWorld');
    });
  });

  describe('Real-World Scorecard Examples', () => {
    it('should format ticket approaching SLE', () => {
      const context: EvaluationContext = {
        ticket: {
          id: 'JIRA-5678',
          title: 'Database Migration',
          days_remaining: 2
        }
      };
      const template = 'Approaching SLE: {ticket.id} - {ticket.title} ({ticket.days_remaining} days)';
      const result = interpolateTemplate(template, context);
      expect(result).toBe('Approaching SLE: JIRA-5678 - Database Migration (2 days)');
    });

    it('should format aggregate metric', () => {
      const context: EvaluationContext = {
        result: 15
      };
      const template = 'Open P0 Tickets: {result}';
      const result = interpolateTemplate(template, context);
      expect(result).toBe('Open P0 Tickets: 15');
    });

    it('should format deployment info', () => {
      const context: EvaluationContext = {
        deployment: {
          service: 'api-gateway',
          error_rate: 0.025,
          version: 'v2.3.1'
        }
      };
      const template = '{deployment.service} ({deployment.version}) - Error rate: {deployment.error_rate}';
      const result = interpolateTemplate(template, context);
      expect(result).toBe('api-gateway (v2.3.1) - Error rate: 0.025');
    });
  });
});
