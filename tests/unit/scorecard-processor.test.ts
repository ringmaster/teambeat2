import { describe, expect, it } from "vitest";
import {
	processAllRules,
	processRule,
} from "$lib/server/utils/scorecard-processor";
import type { ScorecardRule } from "$lib/types/scorecard";

describe("Scorecard Processor", () => {
	describe("Aggregate Rules (iterate_over: null)", () => {
		it("should process simple count aggregate", () => {
			const rule: ScorecardRule = {
				id: "rule-1",
				section: "Metrics",
				iterate_over: null,
				condition: ["get", "tickets", "count"],
				title_template: "Open Tickets",
				value_template: "{result}",
				severity: "info",
			};

			const data = {
				tickets: [
					{ id: 1, title: "Bug A" },
					{ id: 2, title: "Bug B" },
					{ id: 3, title: "Bug C" },
				],
			};

			const { results } = processRule(rule, data, "datasource-1");

			expect(results).toHaveLength(1);
			expect(results[0]).toMatchObject({
				section: "Metrics",
				title: "Open Tickets",
				primaryValue: "3",
				severity: "info",
			});
		});

		it("should process aggregate with fixed severity", () => {
			const rule: ScorecardRule = {
				id: "rule-2",
				section: "Critical",
				iterate_over: null,
				condition: ["get", "error_count", "literal", 100, "gt"],
				title_template: "High Error Count",
				value_template: "{error_count} errors",
				severity: "critical",
			};

			const data = {
				error_count: 150,
			};

			const { results } = processRule(rule, data, "datasource-1");

			expect(results).toHaveLength(1);
			expect(results[0].severity).toBe("critical");
			expect(results[0].primaryValue).toBe("150 errors");
		});

		it("should process aggregate with severity from field", () => {
			const rule: ScorecardRule = {
				id: "rule-3",
				section: "Status",
				iterate_over: null,
				condition: ["literal", true],
				title_template: "System Status",
				value_template: "{status}",
				severity_from_field: "alert_level",
			};

			const data = {
				status: "degraded",
				alert_level: "warning",
			};

			const results = processRule(rule, data, "datasource-1");

			expect(results.results).toHaveLength(1);
			expect(results.results[0].severity).toBe("warning");
		});

		it("should use threshold rules for severity", () => {
			const rule: ScorecardRule = {
				id: "rule-4",
				section: "Performance",
				iterate_over: null,
				condition: ["get", "error_rate"],
				title_template: "Error Rate",
				value_template: "{result}%",
				threshold_rules: [
					{
						condition: ["get", "result", "literal", 0.1, "gt"],
						severity: "critical",
					},
					{
						condition: ["get", "result", "literal", 0.05, "gt"],
						severity: "warning",
					},
				],
			};

			const data = {
				error_rate: 0.08,
			};

			const results = processRule(rule, data, "datasource-1");

			expect(results.results).toHaveLength(1);
			expect(results.results[0].severity).toBe("warning");
		});

		it("should default to info when no threshold matches", () => {
			const rule: ScorecardRule = {
				id: "rule-5",
				section: "Performance",
				iterate_over: null,
				condition: ["get", "error_rate"],
				title_template: "Error Rate",
				value_template: "{result}%",
				threshold_rules: [
					{
						condition: ["get", "result", "literal", 0.1, "gt"],
						severity: "critical",
					},
				],
			};

			const data = {
				error_rate: 0.02,
			};

			const results = processRule(rule, data, "datasource-1");

			expect(results.results).toHaveLength(1);
			expect(results.results[0].severity).toBe("info");
		});

		it("should handle failed RPN evaluation", () => {
			const rule: ScorecardRule = {
				id: "rule-6",
				section: "Metrics",
				iterate_over: null,
				condition: ["get", "nonexistent", "add"], // Stack underflow
				title_template: "Test",
				value_template: "{result}",
				severity: "info",
			};

			const data = {};

			const { results } = processRule(rule, data, "datasource-1");

			expect(results).toHaveLength(0);
		});

		it("should interpolate multiple fields in templates", () => {
			const rule: ScorecardRule = {
				id: "rule-7",
				section: "Summary",
				iterate_over: null,
				condition: ["get", "total"],
				title_template: "{service_name} Total",
				value_template: "{result} requests ({service_name})",
				severity: "info",
			};

			const data = {
				service_name: "API Gateway",
				total: 1500,
			};

			const results = processRule(rule, data, "datasource-1");

			expect(results.results).toHaveLength(1);
			expect(results.results[0].title).toBe("API Gateway Total");
			expect(results.results[0].primaryValue).toBe(
				"1500 requests (API Gateway)",
			);
		});
	});

	describe("Detail Rules (with iteration)", () => {
		it("should filter and process array items", () => {
			const rule: ScorecardRule = {
				id: "rule-8",
				section: "High Priority",
				iterate_over: "tickets",
				condition: ["get", "ticket.priority", "literal", "P0", "eq"],
				title_template: "{ticket.id}: {ticket.title}",
				value_template: "{ticket.priority}",
				severity: "critical",
			};

			const data = {
				tickets: [
					{ id: "T-1", title: "Critical Bug", priority: "P0" },
					{ id: "T-2", title: "Minor Issue", priority: "P2" },
					{ id: "T-3", title: "Database Down", priority: "P0" },
					{ id: "T-4", title: "UI Tweak", priority: "P3" },
				],
			};

			const results = processRule(rule, data, "datasource-1");

			expect(results.results).toHaveLength(2);
			expect(results.results[0].title).toBe("T-1: Critical Bug");
			expect(results.results[0].primaryValue).toBe("P0");
			expect(results.results[0].severity).toBe("critical");
			expect(results.results[1].title).toBe("T-3: Database Down");
		});

		it("should handle numeric comparisons in iteration", () => {
			const rule: ScorecardRule = {
				id: "rule-9",
				section: "SLE Alerts",
				iterate_over: "tickets",
				condition: ["get", "ticket.days_remaining", "literal", 5, "lt"],
				title_template: "{ticket.id} - {ticket.days_remaining} days",
				value_template: "{ticket.title}",
				severity: "warning",
			};

			const data = {
				tickets: [
					{ id: "T-1", title: "Migration", days_remaining: 2 },
					{ id: "T-2", title: "Refactor", days_remaining: 10 },
					{ id: "T-3", title: "Security Fix", days_remaining: 4 },
				],
			};

			const results = processRule(rule, data, "datasource-1");

			expect(results.results).toHaveLength(2);
			expect(results.results[0].title).toBe("T-1 - 2 days");
			expect(results.results[1].title).toBe("T-3 - 4 days");
		});

		it("should use severity from item field", () => {
			const rule: ScorecardRule = {
				id: "rule-10",
				section: "Alerts",
				iterate_over: "alerts",
				condition: ["literal", true],
				title_template: "{alert.name}",
				value_template: "{alert.message}",
				severity_from_field: "alert.severity",
			};

			const data = {
				alerts: [
					{ name: "CPU High", message: "95% usage", severity: "warning" },
					{ name: "Disk Full", message: "No space", severity: "critical" },
					{ name: "Memory OK", message: "50% usage", severity: "info" },
				],
			};

			const { results } = processRule(rule, data, "datasource-1");

			expect(results).toHaveLength(3);
			expect(results[0].severity).toBe("warning");
			expect(results[1].severity).toBe("critical");
			expect(results[2].severity).toBe("info");
		});

		it("should handle nested array paths", () => {
			const rule: ScorecardRule = {
				id: "rule-11",
				section: "Deployments",
				iterate_over: "data.deployments",
				condition: ["get", "deployment.status", "literal", "failed", "eq"],
				title_template: "{deployment.service}",
				value_template: "{deployment.status}",
				severity: "critical",
			};

			const data = {
				data: {
					deployments: [
						{ service: "api", status: "success" },
						{ service: "frontend", status: "failed" },
						{ service: "worker", status: "failed" },
					],
				},
			};

			const { results } = processRule(rule, data, "datasource-1");

			expect(results).toHaveLength(2);
			expect(results[0].title).toBe("frontend");
			expect(results[1].title).toBe("worker");
		});

		it("should handle invalid iterate path gracefully", () => {
			const rule: ScorecardRule = {
				id: "rule-12",
				section: "Test",
				iterate_over: "nonexistent.array",
				condition: ["literal", true],
				title_template: "Test",
				value_template: "Value",
				severity: "info",
			};

			const data = {
				other: "value",
			};

			const { results } = processRule(rule, data, "datasource-1");

			expect(results).toHaveLength(0);
		});

		it("should handle non-array iterate path gracefully", () => {
			const rule: ScorecardRule = {
				id: "rule-13",
				section: "Test",
				iterate_over: "value",
				condition: ["literal", true],
				title_template: "Test",
				value_template: "Value",
				severity: "info",
			};

			const data = {
				value: "not an array",
			};

			const { results } = processRule(rule, data, "datasource-1");

			expect(results).toHaveLength(0);
		});

		it("should include sourceData in detail results", () => {
			const rule: ScorecardRule = {
				id: "rule-14",
				section: "Items",
				iterate_over: "items",
				condition: ["literal", true],
				title_template: "{item.name}",
				value_template: "{item.value}",
				severity: "info",
			};

			const data = {
				items: [
					{ name: "Item 1", value: 100 },
					{ name: "Item 2", value: 200 },
				],
			};

			const results = processRule(rule, data, "datasource-1");

			expect(results.results).toHaveLength(2);
			expect(results.results[0].sourceData).toEqual({
				name: "Item 1",
				value: 100,
			});
			expect(results.results[1].sourceData).toEqual({
				name: "Item 2",
				value: 200,
			});
		});

		it("should handle threshold rules in iteration", () => {
			const rule: ScorecardRule = {
				id: "rule-15",
				section: "Services",
				iterate_over: "services",
				condition: ["get", "service.uptime"],
				title_template: "{service.name}",
				value_template: "{service.uptime}% uptime",
				threshold_rules: [
					{
						condition: ["get", "result", "literal", 95, "lt"],
						severity: "critical",
					},
					{
						condition: ["get", "result", "literal", 99, "lt"],
						severity: "warning",
					},
				],
			};

			const data = {
				services: [
					{ name: "API", uptime: 99.9 },
					{ name: "DB", uptime: 98.5 },
					{ name: "Cache", uptime: 92.0 },
				],
			};

			const results = processRule(rule, data, "datasource-1");

			expect(results.results).toHaveLength(3);
			expect(results.results[0].severity).toBe("info"); // 99.9 - no threshold matches
			expect(results.results[1].severity).toBe("warning"); // 98.5 < 99
			expect(results.results[2].severity).toBe("critical"); // 92.0 < 95
		});
	});

	describe("Multiple Rules Processing", () => {
		it("should process multiple rules and assign sequential numbers", () => {
			const rules: ScorecardRule[] = [
				{
					id: "rule-1",
					section: "Metrics",
					iterate_over: null,
					condition: ["get", "total"],
					title_template: "Total Count",
					value_template: "{result}",
					severity: "info",
				},
				{
					id: "rule-2",
					section: "Metrics",
					iterate_over: null,
					condition: ["get", "active"],
					title_template: "Active Count",
					value_template: "{result}",
					severity: "info",
				},
				{
					id: "rule-3",
					section: "Alerts",
					iterate_over: "alerts",
					condition: ["literal", true],
					title_template: "{alert.name}",
					value_template: "{alert.value}",
					severity: "warning",
				},
			];

			const data = {
				total: 100,
				active: 75,
				alerts: [
					{ name: "Alert 1", value: "High" },
					{ name: "Alert 2", value: "Medium" },
				],
			};

			const { results } = processAllRules(rules, data, "datasource-1");

			expect(results).toHaveLength(4);

			// Check sequential numbering within sections
			const metricsResults = results.filter((r) => r.section === "Metrics");
			const alertsResults = results.filter((r) => r.section === "Alerts");

			expect(metricsResults[0].seq).toBe(0);
			expect(metricsResults[1].seq).toBe(1);
			expect(alertsResults[0].seq).toBe(0);
			expect(alertsResults[1].seq).toBe(1);
		});

		it("should handle rules with different sections", () => {
			const rules: ScorecardRule[] = [
				{
					id: "rule-1",
					section: "Section A",
					iterate_over: null,
					condition: ["literal", 1],
					title_template: "A1",
					value_template: "{result}",
					severity: "info",
				},
				{
					id: "rule-2",
					section: "Section B",
					iterate_over: null,
					condition: ["literal", 2],
					title_template: "B1",
					value_template: "{result}",
					severity: "info",
				},
				{
					id: "rule-3",
					section: "Section A",
					iterate_over: null,
					condition: ["literal", 3],
					title_template: "A2",
					value_template: "{result}",
					severity: "info",
				},
			];

			const { results } = processAllRules(rules, {}, "datasource-1");

			expect(results).toHaveLength(3);

			const sectionA = results.filter((r) => r.section === "Section A");
			const sectionB = results.filter((r) => r.section === "Section B");

			expect(sectionA).toHaveLength(2);
			expect(sectionB).toHaveLength(1);
			expect(sectionA[0].seq).toBe(0);
			expect(sectionA[1].seq).toBe(1);
			expect(sectionB[0].seq).toBe(0);
		});

		it("should handle empty rules array", () => {
			const { results } = processAllRules([], { data: "test" }, "datasource-1");
			expect(results).toHaveLength(0);
		});
	});

	describe('Root Array Processing (iterate_over: "$")', () => {
		it("should process root-level array with $ path", () => {
			const rule: ScorecardRule = {
				id: "rule-root-1",
				section: "Issues",
				iterate_over: "$",
				condition: ["get", "$.priority", "literal", "high", "eq"],
				title_template: "{$.id}: {$.title}",
				value_template: "{$.status}",
				severity: "warning",
			};

			const data = [
				{
					id: "ISS-1",
					title: "Security vulnerability",
					priority: "high",
					status: "open",
				},
				{ id: "ISS-2", title: "Minor bug", priority: "low", status: "open" },
				{
					id: "ISS-3",
					title: "Performance issue",
					priority: "high",
					status: "in progress",
				},
				{
					id: "ISS-4",
					title: "UI tweak",
					priority: "medium",
					status: "closed",
				},
			];

			const { results, errors } = processRule(rule, data, "datasource-1");

			expect(errors).toHaveLength(0);
			expect(results).toHaveLength(2);
			expect(results[0].title).toBe("ISS-1: Security vulnerability");
			expect(results[0].primaryValue).toBe("open");
			expect(results[0].severity).toBe("warning");
			expect(results[1].title).toBe("ISS-3: Performance issue");
			expect(results[1].primaryValue).toBe("in progress");
		});

		it("should handle root array with no filtering", () => {
			const rule: ScorecardRule = {
				id: "rule-root-2",
				section: "All Items",
				iterate_over: "$",
				condition: ["literal", true],
				title_template: "{$.name}",
				value_template: "{$.value}",
				severity: "info",
			};

			const data = [
				{ name: "Item A", value: 100 },
				{ name: "Item B", value: 200 },
				{ name: "Item C", value: 300 },
			];

			const { results, errors } = processRule(rule, data, "datasource-1");

			expect(errors).toHaveLength(0);
			expect(results).toHaveLength(3);
			expect(results[0].title).toBe("Item A");
			expect(results[1].title).toBe("Item B");
			expect(results[2].title).toBe("Item C");
		});

		it("should handle root array with numeric comparisons", () => {
			const rule: ScorecardRule = {
				id: "rule-root-3",
				section: "High Values",
				iterate_over: "$",
				condition: ["get", "$.score", "literal", 80, "gt"],
				title_template: "{$.name}",
				value_template: "{$.score}",
				severity: "info",
			};

			const data = [
				{ name: "Test 1", score: 95 },
				{ name: "Test 2", score: 65 },
				{ name: "Test 3", score: 88 },
				{ name: "Test 4", score: 72 },
			];

			const { results, errors } = processRule(rule, data, "datasource-1");

			expect(errors).toHaveLength(0);
			expect(results).toHaveLength(2);
			expect(results[0].title).toBe("Test 1");
			expect(results[0].primaryValue).toBe("95");
			expect(results[1].title).toBe("Test 3");
			expect(results[1].primaryValue).toBe("88");
		});

		it("should handle root array with threshold rules", () => {
			const rule: ScorecardRule = {
				id: "rule-root-4",
				section: "Metrics",
				iterate_over: "$",
				condition: ["get", "$.count"],
				title_template: "{$.service}",
				value_template: "{result} requests",
				threshold_rules: [
					{
						condition: ["get", "result", "literal", 1000, "gt"],
						severity: "critical",
					},
					{
						condition: ["get", "result", "literal", 500, "gt"],
						severity: "warning",
					},
				],
			};

			const data = [
				{ service: "API", count: 1200 },
				{ service: "Web", count: 750 },
				{ service: "Worker", count: 300 },
			];

			const { results, errors } = processRule(rule, data, "datasource-1");

			expect(errors).toHaveLength(0);
			expect(results).toHaveLength(3);
			expect(results[0].severity).toBe("critical"); // 1200 > 1000
			expect(results[1].severity).toBe("warning"); // 750 > 500
			expect(results[2].severity).toBe("info"); // 300, no threshold matches
		});

		it("should handle root array with sourceData", () => {
			const rule: ScorecardRule = {
				id: "rule-root-5",
				section: "Items",
				iterate_over: "$",
				condition: ["literal", true],
				title_template: "{$.id}",
				value_template: "{$.status}",
				severity: "info",
			};

			const data = [
				{ id: "A", status: "active", meta: { created: "2024-01-01" } },
				{ id: "B", status: "pending", meta: { created: "2024-01-02" } },
			];

			const { results } = processRule(rule, data, "datasource-1");

			expect(results).toHaveLength(2);
			expect(results[0].sourceData).toEqual({
				id: "A",
				status: "active",
				meta: { created: "2024-01-01" },
			});
			expect(results[1].sourceData).toEqual({
				id: "B",
				status: "pending",
				meta: { created: "2024-01-02" },
			});
		});

		it("should handle non-array root gracefully", () => {
			const rule: ScorecardRule = {
				id: "rule-root-6",
				section: "Test",
				iterate_over: "$",
				condition: ["literal", true],
				title_template: "Test",
				value_template: "Value",
				severity: "info",
			};

			const data = { not: "an array" };

			const { results, errors } = processRule(rule, data, "datasource-1");

			expect(results).toHaveLength(0);
			expect(errors).toHaveLength(1);
			expect(errors[0].error).toContain("did not resolve to an array");
		});

		it("should handle empty root array", () => {
			const rule: ScorecardRule = {
				id: "rule-root-7",
				section: "Test",
				iterate_over: "$",
				condition: ["literal", true],
				title_template: "Test",
				value_template: "Value",
				severity: "info",
			};

			const data: any[] = [];

			const { results, errors } = processRule(rule, data, "datasource-1");

			expect(results).toHaveLength(0);
			expect(errors).toHaveLength(0);
		});

		it("should support interpolated section names from data", () => {
			const rule: ScorecardRule = {
				id: "rule-root-8",
				section: "{$.section}",
				iterate_over: "$",
				condition: ["literal", true],
				title_template: "{$.name}",
				value_template: "{$.status}",
				severity: "info",
			};

			const data = [
				{ name: "Item A", status: "active", section: "Section A" },
				{ name: "Item B", status: "pending", section: "Section B" },
				{ name: "Item C", status: "active", section: "Section A" },
			];

			const { results, errors } = processRule(rule, data, "datasource-1");

			expect(errors).toHaveLength(0);
			expect(results).toHaveLength(3);
			expect(results[0].section).toBe("Section A");
			expect(results[1].section).toBe("Section B");
			expect(results[2].section).toBe("Section A");
		});
	});

	describe("CSV Array Length Counting", () => {
		it("should count records in root-level array using count operator", () => {
			const rule: ScorecardRule = {
				id: "rule-csv-1",
				section: "Summary",
				iterate_over: null,
				condition: ["$", "count"],
				title_template: "Total Records",
				value_template: "{result}",
				severity: "info",
			};

			// CSV data parsed as root-level array (as returned by parseCSV)
			const data = [
				{ name: "Alice", age: 30, city: "New York" },
				{ name: "Bob", age: 25, city: "Los Angeles" },
				{ name: "Charlie", age: 35, city: "Chicago" },
				{ name: "Diana", age: 28, city: "Houston" },
				{ name: "Eve", age: 32, city: "Phoenix" },
			];

			const { results, errors } = processRule(rule, data, "datasource-1");

			expect(errors).toHaveLength(0);
			expect(results).toHaveLength(1);
			expect(results[0].title).toBe("Total Records");
			expect(results[0].primaryValue).toBe("5");
			expect(results[0].severity).toBe("info");
		});

		it("should count records with threshold-based severity", () => {
			const rule: ScorecardRule = {
				id: "rule-csv-2",
				section: "Data Quality",
				iterate_over: null,
				condition: ["$", "count"],
				title_template: "Record Count",
				value_template: "{result} records",
				threshold_rules: [
					{
						condition: ["get", "result", "literal", 1000, "gt"],
						severity: "critical",
					},
					{
						condition: ["get", "result", "literal", 100, "gt"],
						severity: "warning",
					},
				],
			};

			const smallData = Array.from({ length: 50 }, (_, i) => ({
				id: i,
				value: i * 10,
			}));
			const mediumData = Array.from({ length: 150 }, (_, i) => ({
				id: i,
				value: i * 10,
			}));
			const largeData = Array.from({ length: 1500 }, (_, i) => ({
				id: i,
				value: i * 10,
			}));

			// Small dataset - should be info
			const smallResults = processRule(rule, smallData, "datasource-1");
			expect(smallResults.results[0].primaryValue).toBe("50 records");
			expect(smallResults.results[0].severity).toBe("info");

			// Medium dataset - should be warning
			const mediumResults = processRule(rule, mediumData, "datasource-1");
			expect(mediumResults.results[0].primaryValue).toBe("150 records");
			expect(mediumResults.results[0].severity).toBe("warning");

			// Large dataset - should be critical
			const largeResults = processRule(rule, largeData, "datasource-1");
			expect(largeResults.results[0].primaryValue).toBe("1500 records");
			expect(largeResults.results[0].severity).toBe("critical");
		});

		it("should handle empty CSV array", () => {
			const rule: ScorecardRule = {
				id: "rule-csv-3",
				section: "Summary",
				iterate_over: null,
				condition: ["$", "count"],
				title_template: "Total Records",
				value_template: "{result}",
				severity: "info",
			};

			const data: any[] = [];

			const { results, errors } = processRule(rule, data, "datasource-1");

			expect(errors).toHaveLength(0);
			expect(results).toHaveLength(1);
			expect(results[0].primaryValue).toBe("0");
		});

		it("should combine count with filtering on root array", () => {
			const countRule: ScorecardRule = {
				id: "rule-csv-4a",
				section: "Statistics",
				iterate_over: null,
				condition: ["$", "count"],
				title_template: "Total Users",
				value_template: "{result}",
				severity: "info",
			};

			const filterRule: ScorecardRule = {
				id: "rule-csv-4b",
				section: "Statistics",
				iterate_over: "$",
				condition: ["get", "$.age", "literal", 30, "gt"],
				title_template: "{$.name}",
				value_template: "Age: {$.age}",
				severity: "info",
			};

			const data = [
				{ name: "Alice", age: 35 },
				{ name: "Bob", age: 25 },
				{ name: "Charlie", age: 40 },
				{ name: "Diana", age: 28 },
			];

			// Count all records
			const countResults = processRule(countRule, data, "datasource-1");
			expect(countResults.results).toHaveLength(1);
			expect(countResults.results[0].primaryValue).toBe("4");

			// Filter records over 30
			const filterResults = processRule(filterRule, data, "datasource-1");
			expect(filterResults.results).toHaveLength(2);
			expect(filterResults.results[0].title).toBe("Alice");
			expect(filterResults.results[1].title).toBe("Charlie");
		});
	});

	describe("Edge Cases", () => {
		it("should handle invalid severity from field gracefully", () => {
			const rule: ScorecardRule = {
				id: "rule-16",
				section: "Test",
				iterate_over: null,
				condition: ["literal", true],
				title_template: "Test",
				value_template: "Value",
				severity_from_field: "invalid_severity",
			};

			const data = {
				invalid_severity: "not-a-severity",
			};

			const { results } = processRule(rule, data, "datasource-1");

			expect(results).toHaveLength(1);
			expect(results[0].severity).toBe("info"); // Fallback to default
		});

		it("should handle missing severity field", () => {
			const rule: ScorecardRule = {
				id: "rule-17",
				section: "Test",
				iterate_over: null,
				condition: ["literal", true],
				title_template: "Test",
				value_template: "Value",
				severity_from_field: "missing.field",
			};

			const data = {};

			const { results } = processRule(rule, data, "datasource-1");

			expect(results).toHaveLength(1);
			expect(results[0].severity).toBe("info");
		});

		it("should handle complex nested data", () => {
			const rule: ScorecardRule = {
				id: "rule-18",
				section: "Complex",
				iterate_over: null,
				condition: ["get", "data.metrics.users.active"],
				title_template: "Active Users",
				value_template: "{result}",
				severity: "info",
			};

			const data = {
				data: {
					metrics: {
						users: {
							active: 1250,
							total: 2000,
						},
					},
				},
			};

			const results = processRule(rule, data, "datasource-1");

			expect(results.results).toHaveLength(1);
			expect(results.results[0].primaryValue).toBe("1250");
		});

		it("should skip items where condition is false", () => {
			const rule: ScorecardRule = {
				id: "rule-19",
				section: "Filtered",
				iterate_over: "items",
				condition: ["get", "item.active", "literal", true, "eq"],
				title_template: "{item.name}",
				value_template: "{item.value}",
				severity: "info",
			};

			const data = {
				items: [
					{ name: "Item 1", active: true, value: 100 },
					{ name: "Item 2", active: false, value: 200 },
					{ name: "Item 3", active: true, value: 300 },
				],
			};

			const results = processRule(rule, data, "datasource-1");

			expect(results.results).toHaveLength(2);
			expect(results.results[0].title).toBe("Item 1");
			expect(results.results[1].title).toBe("Item 3");
		});
	});

	describe("Multi-Value Stack Results", () => {
		it("should handle multi-value stack with dup gte pattern", () => {
			const rule: ScorecardRule = {
				id: "rule-multi-1",
				section: "Aging Items",
				iterate_over: "items",
				condition: ["get", "item.days", "dup", "literal", 4, "gte"],
				title_template: "Item {item.name}",
				value_template: "{result[1]} days old",
				severity: "warning",
			};

			const data = {
				items: [
					{ name: "Item A", days: 10 },
					{ name: "Item B", days: 2 },
					{ name: "Item C", days: 30 },
				],
			};

			const { results } = processRule(rule, data, "datasource-1");

			// Should only include items where days >= 4
			expect(results).toHaveLength(2);
			expect(results[0].title).toBe("Item Item A");
			expect(results[0].primaryValue).toBe("10 days old");
			expect(results[1].title).toBe("Item Item C");
			expect(results[1].primaryValue).toBe("30 days old");
		});

		it("should use last value as condition with multi-value stack", () => {
			const rule: ScorecardRule = {
				id: "rule-multi-2",
				section: "Test",
				iterate_over: "items",
				// Stack: [value, false] - should not show because condition (last value) is false
				condition: ["get", "item.value", "dup", "literal", 100, "gt"],
				title_template: "Item {item.name}",
				value_template: "{result[1]}",
				severity: "info",
			};

			const data = {
				items: [
					{ name: "Low", value: 50 },
					{ name: "High", value: 150 },
				],
			};

			const { results } = processRule(rule, data, "datasource-1");

			// Only High should show (value > 100)
			expect(results).toHaveLength(1);
			expect(results[0].title).toBe("Item High");
			expect(results[0].primaryValue).toBe("150");
		});

		it("should handle three values on stack", () => {
			const rule: ScorecardRule = {
				id: "rule-multi-3",
				section: "Complex",
				iterate_over: "items",
				// Stack: [name, value, condition]
				condition: [
					"get",
					"item.name",
					"get",
					"item.value",
					"dup",
					"literal",
					10,
					"gt",
				],
				title_template: "{result[2]}",
				value_template: "Value: {result[1]}",
				severity: "info",
			};

			const data = {
				items: [
					{ name: "Alpha", value: 5 },
					{ name: "Beta", value: 20 },
				],
			};

			const { results } = processRule(rule, data, "datasource-1");

			// Only Beta should show (value > 10)
			expect(results).toHaveLength(1);
			expect(results[0].title).toBe("Beta");
			expect(results[0].primaryValue).toBe("Value: 20");
		});
	});
});
