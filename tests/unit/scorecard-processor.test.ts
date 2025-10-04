import { describe, it, expect } from 'vitest';
import { processRule, processAllRules } from '$lib/server/utils/scorecard-processor';
import type { ScorecardRule } from '$lib/types/scorecard';

describe('Scorecard Processor', () => {
  describe('Aggregate Rules (iterate_over: null)', () => {
    it('should process simple count aggregate', () => {
      const rule: ScorecardRule = {
        id: 'rule-1',
        section: 'Metrics',
        iterate_over: null,
        condition: ['get_json_value', 'tickets', 'count'],
        title_template: 'Open Tickets',
        value_template: '{result}',
        severity: 'info'
      };

      const data = {
        tickets: [
          { id: 1, title: 'Bug A' },
          { id: 2, title: 'Bug B' },
          { id: 3, title: 'Bug C' }
        ]
      };

      const results = processRule(rule, data, 'datasource-1');

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        section: 'Metrics',
        title: 'Open Tickets',
        primaryValue: '3',
        severity: 'info'
      });
    });

    it('should process aggregate with fixed severity', () => {
      const rule: ScorecardRule = {
        id: 'rule-2',
        section: 'Critical',
        iterate_over: null,
        condition: ['get_json_value', 'error_count', 'literal', 100, 'gt'],
        title_template: 'High Error Count',
        value_template: '{error_count} errors',
        severity: 'critical'
      };

      const data = {
        error_count: 150
      };

      const results = processRule(rule, data, 'datasource-1');

      expect(results).toHaveLength(1);
      expect(results[0].severity).toBe('critical');
      expect(results[0].primaryValue).toBe('150 errors');
    });

    it('should process aggregate with severity from field', () => {
      const rule: ScorecardRule = {
        id: 'rule-3',
        section: 'Status',
        iterate_over: null,
        condition: ['literal', true],
        title_template: 'System Status',
        value_template: '{status}',
        severity_from_field: 'alert_level'
      };

      const data = {
        status: 'degraded',
        alert_level: 'warning'
      };

      const results = processRule(rule, data, 'datasource-1');

      expect(results).toHaveLength(1);
      expect(results[0].severity).toBe('warning');
    });

    it('should use threshold rules for severity', () => {
      const rule: ScorecardRule = {
        id: 'rule-4',
        section: 'Performance',
        iterate_over: null,
        condition: ['get_json_value', 'error_rate'],
        title_template: 'Error Rate',
        value_template: '{result}%',
        threshold_rules: [
          {
            condition: ['get_json_value', 'result', 'literal', 0.1, 'gt'],
            severity: 'critical'
          },
          {
            condition: ['get_json_value', 'result', 'literal', 0.05, 'gt'],
            severity: 'warning'
          }
        ]
      };

      const data = {
        error_rate: 0.08
      };

      const results = processRule(rule, data, 'datasource-1');

      expect(results).toHaveLength(1);
      expect(results[0].severity).toBe('warning');
    });

    it('should default to info when no threshold matches', () => {
      const rule: ScorecardRule = {
        id: 'rule-5',
        section: 'Performance',
        iterate_over: null,
        condition: ['get_json_value', 'error_rate'],
        title_template: 'Error Rate',
        value_template: '{result}%',
        threshold_rules: [
          {
            condition: ['get_json_value', 'result', 'literal', 0.1, 'gt'],
            severity: 'critical'
          }
        ]
      };

      const data = {
        error_rate: 0.02
      };

      const results = processRule(rule, data, 'datasource-1');

      expect(results).toHaveLength(1);
      expect(results[0].severity).toBe('info');
    });

    it('should handle failed RPN evaluation', () => {
      const rule: ScorecardRule = {
        id: 'rule-6',
        section: 'Metrics',
        iterate_over: null,
        condition: ['get_json_value', 'nonexistent', 'add'], // Stack underflow
        title_template: 'Test',
        value_template: '{result}',
        severity: 'info'
      };

      const data = {};

      const results = processRule(rule, data, 'datasource-1');

      expect(results).toHaveLength(0);
    });

    it('should interpolate multiple fields in templates', () => {
      const rule: ScorecardRule = {
        id: 'rule-7',
        section: 'Summary',
        iterate_over: null,
        condition: ['get_json_value', 'total'],
        title_template: '{service_name} Total',
        value_template: '{result} requests ({service_name})',
        severity: 'info'
      };

      const data = {
        service_name: 'API Gateway',
        total: 1500
      };

      const results = processRule(rule, data, 'datasource-1');

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('API Gateway Total');
      expect(results[0].primaryValue).toBe('1500 requests (API Gateway)');
    });
  });

  describe('Detail Rules (with iteration)', () => {
    it('should filter and process array items', () => {
      const rule: ScorecardRule = {
        id: 'rule-8',
        section: 'High Priority',
        iterate_over: 'tickets',
        condition: ['get_json_value', 'ticket.priority', 'literal', 'P0', 'eq'],
        title_template: '{ticket.id}: {ticket.title}',
        value_template: '{ticket.priority}',
        severity: 'critical'
      };

      const data = {
        tickets: [
          { id: 'T-1', title: 'Critical Bug', priority: 'P0' },
          { id: 'T-2', title: 'Minor Issue', priority: 'P2' },
          { id: 'T-3', title: 'Database Down', priority: 'P0' },
          { id: 'T-4', title: 'UI Tweak', priority: 'P3' }
        ]
      };

      const results = processRule(rule, data, 'datasource-1');

      expect(results).toHaveLength(2);
      expect(results[0].title).toBe('T-1: Critical Bug');
      expect(results[0].primaryValue).toBe('P0');
      expect(results[0].severity).toBe('critical');
      expect(results[1].title).toBe('T-3: Database Down');
    });

    it('should handle numeric comparisons in iteration', () => {
      const rule: ScorecardRule = {
        id: 'rule-9',
        section: 'SLE Alerts',
        iterate_over: 'tickets',
        condition: ['get_json_value', 'ticket.days_remaining', 'literal', 5, 'lt'],
        title_template: '{ticket.id} - {ticket.days_remaining} days',
        value_template: '{ticket.title}',
        severity: 'warning'
      };

      const data = {
        tickets: [
          { id: 'T-1', title: 'Migration', days_remaining: 2 },
          { id: 'T-2', title: 'Refactor', days_remaining: 10 },
          { id: 'T-3', title: 'Security Fix', days_remaining: 4 }
        ]
      };

      const results = processRule(rule, data, 'datasource-1');

      expect(results).toHaveLength(2);
      expect(results[0].title).toBe('T-1 - 2 days');
      expect(results[1].title).toBe('T-3 - 4 days');
    });

    it('should use severity from item field', () => {
      const rule: ScorecardRule = {
        id: 'rule-10',
        section: 'Alerts',
        iterate_over: 'alerts',
        condition: ['literal', true],
        title_template: '{alert.name}',
        value_template: '{alert.message}',
        severity_from_field: 'alert.severity'
      };

      const data = {
        alerts: [
          { name: 'CPU High', message: '95% usage', severity: 'warning' },
          { name: 'Disk Full', message: 'No space', severity: 'critical' },
          { name: 'Memory OK', message: '50% usage', severity: 'info' }
        ]
      };

      const results = processRule(rule, data, 'datasource-1');

      expect(results).toHaveLength(3);
      expect(results[0].severity).toBe('warning');
      expect(results[1].severity).toBe('critical');
      expect(results[2].severity).toBe('info');
    });

    it('should handle nested array paths', () => {
      const rule: ScorecardRule = {
        id: 'rule-11',
        section: 'Deployments',
        iterate_over: 'data.deployments',
        condition: ['get_json_value', 'deployment.status', 'literal', 'failed', 'eq'],
        title_template: '{deployment.service}',
        value_template: '{deployment.status}',
        severity: 'critical'
      };

      const data = {
        data: {
          deployments: [
            { service: 'api', status: 'success' },
            { service: 'frontend', status: 'failed' },
            { service: 'worker', status: 'failed' }
          ]
        }
      };

      const results = processRule(rule, data, 'datasource-1');

      expect(results).toHaveLength(2);
      expect(results[0].title).toBe('frontend');
      expect(results[1].title).toBe('worker');
    });

    it('should handle invalid iterate path gracefully', () => {
      const rule: ScorecardRule = {
        id: 'rule-12',
        section: 'Test',
        iterate_over: 'nonexistent.array',
        condition: ['literal', true],
        title_template: 'Test',
        value_template: 'Value',
        severity: 'info'
      };

      const data = {
        other: 'value'
      };

      const results = processRule(rule, data, 'datasource-1');

      expect(results).toHaveLength(0);
    });

    it('should handle non-array iterate path gracefully', () => {
      const rule: ScorecardRule = {
        id: 'rule-13',
        section: 'Test',
        iterate_over: 'value',
        condition: ['literal', true],
        title_template: 'Test',
        value_template: 'Value',
        severity: 'info'
      };

      const data = {
        value: 'not an array'
      };

      const results = processRule(rule, data, 'datasource-1');

      expect(results).toHaveLength(0);
    });

    it('should include sourceData in detail results', () => {
      const rule: ScorecardRule = {
        id: 'rule-14',
        section: 'Items',
        iterate_over: 'items',
        condition: ['literal', true],
        title_template: '{item.name}',
        value_template: '{item.value}',
        severity: 'info'
      };

      const data = {
        items: [
          { name: 'Item 1', value: 100 },
          { name: 'Item 2', value: 200 }
        ]
      };

      const results = processRule(rule, data, 'datasource-1');

      expect(results).toHaveLength(2);
      expect(results[0].sourceData).toEqual({ name: 'Item 1', value: 100 });
      expect(results[1].sourceData).toEqual({ name: 'Item 2', value: 200 });
    });

    it('should handle threshold rules in iteration', () => {
      const rule: ScorecardRule = {
        id: 'rule-15',
        section: 'Services',
        iterate_over: 'services',
        condition: ['get_json_value', 'service.uptime'],
        title_template: '{service.name}',
        value_template: '{service.uptime}% uptime',
        threshold_rules: [
          {
            condition: ['get_json_value', 'result', 'literal', 95, 'lt'],
            severity: 'critical'
          },
          {
            condition: ['get_json_value', 'result', 'literal', 99, 'lt'],
            severity: 'warning'
          }
        ]
      };

      const data = {
        services: [
          { name: 'API', uptime: 99.9 },
          { name: 'DB', uptime: 98.5 },
          { name: 'Cache', uptime: 92.0 }
        ]
      };

      const results = processRule(rule, data, 'datasource-1');

      expect(results).toHaveLength(3);
      expect(results[0].severity).toBe('info'); // 99.9 - no threshold matches
      expect(results[1].severity).toBe('warning'); // 98.5 < 99
      expect(results[2].severity).toBe('critical'); // 92.0 < 95
    });
  });

  describe('Multiple Rules Processing', () => {
    it('should process multiple rules and assign sequential numbers', () => {
      const rules: ScorecardRule[] = [
        {
          id: 'rule-1',
          section: 'Metrics',
          iterate_over: null,
          condition: ['get_json_value', 'total'],
          title_template: 'Total Count',
          value_template: '{result}',
          severity: 'info'
        },
        {
          id: 'rule-2',
          section: 'Metrics',
          iterate_over: null,
          condition: ['get_json_value', 'active'],
          title_template: 'Active Count',
          value_template: '{result}',
          severity: 'info'
        },
        {
          id: 'rule-3',
          section: 'Alerts',
          iterate_over: 'alerts',
          condition: ['literal', true],
          title_template: '{alert.name}',
          value_template: '{alert.value}',
          severity: 'warning'
        }
      ];

      const data = {
        total: 100,
        active: 75,
        alerts: [
          { name: 'Alert 1', value: 'High' },
          { name: 'Alert 2', value: 'Medium' }
        ]
      };

      const results = processAllRules(rules, data, 'datasource-1');

      expect(results).toHaveLength(4);

      // Check sequential numbering within sections
      const metricsResults = results.filter(r => r.section === 'Metrics');
      const alertsResults = results.filter(r => r.section === 'Alerts');

      expect(metricsResults[0].seq).toBe(0);
      expect(metricsResults[1].seq).toBe(1);
      expect(alertsResults[0].seq).toBe(0);
      expect(alertsResults[1].seq).toBe(1);
    });

    it('should handle rules with different sections', () => {
      const rules: ScorecardRule[] = [
        {
          id: 'rule-1',
          section: 'Section A',
          iterate_over: null,
          condition: ['literal', 1],
          title_template: 'A1',
          value_template: '{result}',
          severity: 'info'
        },
        {
          id: 'rule-2',
          section: 'Section B',
          iterate_over: null,
          condition: ['literal', 2],
          title_template: 'B1',
          value_template: '{result}',
          severity: 'info'
        },
        {
          id: 'rule-3',
          section: 'Section A',
          iterate_over: null,
          condition: ['literal', 3],
          title_template: 'A2',
          value_template: '{result}',
          severity: 'info'
        }
      ];

      const results = processAllRules(rules, {}, 'datasource-1');

      expect(results).toHaveLength(3);

      const sectionA = results.filter(r => r.section === 'Section A');
      const sectionB = results.filter(r => r.section === 'Section B');

      expect(sectionA).toHaveLength(2);
      expect(sectionB).toHaveLength(1);
      expect(sectionA[0].seq).toBe(0);
      expect(sectionA[1].seq).toBe(1);
      expect(sectionB[0].seq).toBe(0);
    });

    it('should handle empty rules array', () => {
      const results = processAllRules([], { data: 'test' }, 'datasource-1');
      expect(results).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle invalid severity from field gracefully', () => {
      const rule: ScorecardRule = {
        id: 'rule-16',
        section: 'Test',
        iterate_over: null,
        condition: ['literal', true],
        title_template: 'Test',
        value_template: 'Value',
        severity_from_field: 'invalid_severity'
      };

      const data = {
        invalid_severity: 'not-a-severity'
      };

      const results = processRule(rule, data, 'datasource-1');

      expect(results).toHaveLength(1);
      expect(results[0].severity).toBe('info'); // Fallback to default
    });

    it('should handle missing severity field', () => {
      const rule: ScorecardRule = {
        id: 'rule-17',
        section: 'Test',
        iterate_over: null,
        condition: ['literal', true],
        title_template: 'Test',
        value_template: 'Value',
        severity_from_field: 'missing.field'
      };

      const data = {};

      const results = processRule(rule, data, 'datasource-1');

      expect(results).toHaveLength(1);
      expect(results[0].severity).toBe('info');
    });

    it('should handle complex nested data', () => {
      const rule: ScorecardRule = {
        id: 'rule-18',
        section: 'Complex',
        iterate_over: null,
        condition: ['get_json_value', 'data.metrics.users.active'],
        title_template: 'Active Users',
        value_template: '{result}',
        severity: 'info'
      };

      const data = {
        data: {
          metrics: {
            users: {
              active: 1250,
              total: 2000
            }
          }
        }
      };

      const results = processRule(rule, data, 'datasource-1');

      expect(results).toHaveLength(1);
      expect(results[0].primaryValue).toBe('1250');
    });

    it('should skip items where condition is false', () => {
      const rule: ScorecardRule = {
        id: 'rule-19',
        section: 'Filtered',
        iterate_over: 'items',
        condition: ['get_json_value', 'item.active', 'literal', true, 'eq'],
        title_template: '{item.name}',
        value_template: '{item.value}',
        severity: 'info'
      };

      const data = {
        items: [
          { name: 'Item 1', active: true, value: 100 },
          { name: 'Item 2', active: false, value: 200 },
          { name: 'Item 3', active: true, value: 300 }
        ]
      };

      const results = processRule(rule, data, 'datasource-1');

      expect(results).toHaveLength(2);
      expect(results[0].title).toBe('Item 1');
      expect(results[1].title).toBe('Item 3');
    });
  });
});
