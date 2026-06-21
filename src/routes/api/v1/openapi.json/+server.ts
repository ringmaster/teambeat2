import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = () => {
	const spec = {
		openapi: "3.1.0",
		info: {
			title: "Teambeat API",
			version: "1.0.0",
			description:
				"Programmatic access to Teambeat boards, series, health data, and scorecards. Intended for AI and automation clients.",
		},
		servers: [{ url: "/api/v1", description: "Teambeat v1 API" }],
		security: [{ BearerAuth: [] }],
		components: {
			securitySchemes: {
				BearerAuth: {
					type: "http",
					scheme: "bearer",
					description: "API token obtained from your Teambeat profile page (prefix: tb_). Valid for 90 days.",
				},
			},
			schemas: {
				Error: {
					type: "object",
					properties: {
						success: { type: "boolean", example: false },
						error: { type: "string" },
						details: { type: "array", items: { type: "object" } },
					},
					required: ["success", "error"],
				},
				Token: {
					type: "object",
					properties: {
						id: { type: "string", format: "uuid" },
						label: { type: "string" },
						expiresAt: { type: "integer", description: "Unix milliseconds" },
						lastUsedAt: { type: "integer", nullable: true },
						createdAt: { type: "integer" },
					},
				},
				Series: {
					type: "object",
					properties: {
						id: { type: "string", format: "uuid" },
						name: { type: "string" },
						slug: { type: "string", nullable: true },
						description: { type: "string", nullable: true },
						role: { type: "string", enum: ["admin", "facilitator", "member"] },
						createdAt: { type: "string", format: "date-time" },
					},
				},
				BoardSummary: {
					type: "object",
					properties: {
						id: { type: "string", format: "uuid" },
						name: { type: "string" },
						status: { type: "string", enum: ["draft", "active", "completed", "archived"] },
						meetingDate: { type: "string", format: "date", nullable: true },
						createdAt: { type: "string", format: "date-time" },
						sceneCount: { type: "integer" },
						cardCount: { type: "integer" },
						agreementCount: { type: "integer" },
					},
				},
				Board: {
					type: "object",
					properties: {
						id: { type: "string", format: "uuid" },
						seriesId: { type: "string", format: "uuid" },
						name: { type: "string" },
						status: { type: "string", enum: ["draft", "active", "completed", "archived"] },
						meetingDate: { type: "string", format: "date", nullable: true },
						blameFreeMode: { type: "boolean" },
						votingAllocation: { type: "integer" },
						votingEnabled: { type: "boolean" },
						currentSceneId: { type: "string", nullable: true },
						columns: { type: "array", items: { "$ref": "#/components/schemas/Column" } },
						scenes: { type: "array", items: { "$ref": "#/components/schemas/Scene" } },
						cards: { type: "array", items: { "$ref": "#/components/schemas/CardSummary" } },
						createdAt: { type: "string", format: "date-time" },
					},
				},
				Column: {
					type: "object",
					properties: {
						id: { type: "string", format: "uuid" },
						title: { type: "string" },
						seq: { type: "integer" },
					},
				},
				Scene: {
					type: "object",
					properties: {
						id: { type: "string", format: "uuid" },
						title: { type: "string" },
						mode: { type: "string", enum: ["columns", "present", "review", "agreements", "scorecard", "static", "survey", "quadrant"] },
						seq: { type: "integer" },
						flags: { type: "array", items: { type: "string" } },
					},
				},
				CardSummary: {
					type: "object",
					properties: {
						id: { type: "string", format: "uuid" },
						columnId: { type: "string", format: "uuid" },
						columnTitle: { type: "string" },
						content: { type: "string" },
						notes: { type: "string", nullable: true },
						voteCount: { type: "integer" },
						commentCount: { type: "integer" },
						groupId: { type: "string", nullable: true },
						isGroupLead: { type: "boolean" },
						seq: { type: "integer" },
						createdAt: { type: "string", format: "date-time" },
					},
				},
				Agreement: {
					type: "object",
					properties: {
						id: { type: "string", format: "uuid" },
						content: { type: "string" },
						completed: { type: "boolean" },
						boardId: { type: "string", format: "uuid" },
						boardName: { type: "string" },
						meetingDate: { type: "string", format: "date", nullable: true },
						createdAt: { type: "string", format: "date-time" },
						completedAt: { type: "string", nullable: true },
						completedByName: { type: "string", nullable: true },
					},
				},
				ScorecardResult: {
					type: "object",
					properties: {
						sceneScorecardId: { type: "string", format: "uuid" },
						sceneId: { type: "string", format: "uuid" },
						sceneTitle: { type: "string" },
						scorecardName: { type: "string" },
						datasourceName: { type: "string" },
						section: { type: "string" },
						title: { type: "string" },
						primaryValue: { type: "string", nullable: true },
						secondaryValues: { type: "object", nullable: true, additionalProperties: { type: "string" } },
						severity: { type: "string", enum: ["info", "warning", "critical"] },
						seq: { type: "integer" },
					},
				},
			},
		},
		paths: {
			"/tokens": {
				get: {
					summary: "List API tokens",
					operationId: "listTokens",
					tags: ["Tokens"],
					responses: {
						200: { description: "Token list", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, tokens: { type: "array", items: { "$ref": "#/components/schemas/Token" } } } } } } },
						401: { description: "Unauthorized" },
					},
				},
				post: {
					summary: "Create an API token",
					operationId: "createToken",
					tags: ["Tokens"],
					requestBody: {
						required: true,
						content: { "application/json": { schema: { type: "object", required: ["label"], properties: { label: { type: "string", minLength: 1, maxLength: 100, description: "Human-readable label for this token" } } } } },
					},
					responses: {
						201: { description: "Token created — raw token shown only once", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, token: { type: "string", description: "Raw token value — store this securely" }, tokenInfo: { "$ref": "#/components/schemas/Token" } } } } } },
						400: { description: "Validation error" },
						401: { description: "Unauthorized" },
					},
				},
			},
			"/tokens/{id}": {
				delete: {
					summary: "Revoke a token",
					operationId: "revokeToken",
					tags: ["Tokens"],
					parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
					responses: {
						200: { description: "Token revoked" },
						401: { description: "Unauthorized" },
						404: { description: "Token not found" },
					},
				},
			},
			"/series": {
				get: {
					summary: "List series",
					operationId: "listSeries",
					tags: ["Series"],
					description: "Returns all series the authenticated user is a member of.",
					responses: {
						200: { description: "Series list", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, series: { type: "array", items: { "$ref": "#/components/schemas/Series" } } } } } } },
						401: { description: "Unauthorized" },
					},
				},
			},
			"/series/{id}/boards": {
				get: {
					summary: "List boards in a series",
					operationId: "listBoards",
					tags: ["Series", "Boards"],
					parameters: [
						{ name: "id", in: "path", required: true, schema: { type: "string" } },
						{ name: "status", in: "query", schema: { type: "string", enum: ["draft", "active", "completed", "archived"] } },
						{ name: "limit", in: "query", schema: { type: "integer", default: 20, minimum: 1, maximum: 100 } },
						{ name: "offset", in: "query", schema: { type: "integer", default: 0 } },
					],
					responses: {
						200: { description: "Board list with summary counts" },
						401: { description: "Unauthorized" },
						403: { description: "Access denied" },
						404: { description: "Series not found" },
					},
				},
				post: {
					summary: "Create a board (optionally pre-populated)",
					operationId: "createBoard",
					tags: ["Series", "Boards"],
					description: "Creates a board with optional columns, scenes, and seed cards in a single atomic operation. Ideal for AI clients that want to scaffold a meeting from prior data.",
					parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
					requestBody: {
						required: true,
						content: {
							"application/json": {
								schema: {
									type: "object",
									required: ["name"],
									properties: {
										name: { type: "string", minLength: 1, maxLength: 100 },
										meetingDate: { type: "string", format: "date" },
										blameFreeMode: { type: "boolean", default: false },
										votingAllocation: { type: "integer", minimum: 0, maximum: 10, default: 3 },
										columns: { type: "array", maxItems: 20, items: { type: "object", required: ["title"], properties: { title: { type: "string" }, description: { type: "string" }, seq: { type: "integer" } } } },
										scenes: { type: "array", maxItems: 20, items: { type: "object", required: ["title", "mode"], properties: { title: { type: "string" }, mode: { type: "string", enum: ["columns", "present", "review", "agreements", "scorecard", "static", "survey", "quadrant"] }, seq: { type: "integer" }, flags: { type: "array", items: { type: "string" } } } } },
										cards: { type: "array", items: { type: "object", required: ["columnTitle", "content"], properties: { columnTitle: { type: "string", description: "Must match a column title in this request" }, content: { type: "string" }, notes: { type: "string" } } } },
									},
								},
							},
						},
					},
					responses: {
						201: { description: "Board created" },
						400: { description: "Validation error or unknown column reference" },
						401: { description: "Unauthorized" },
						403: { description: "Access denied" },
						404: { description: "Series not found" },
					},
				},
			},
			"/series/{id}/agreements": {
				get: {
					summary: "All action items across a series",
					operationId: "listSeriesAgreements",
					tags: ["Series", "Agreements"],
					parameters: [
						{ name: "id", in: "path", required: true, schema: { type: "string" } },
						{ name: "completed", in: "query", schema: { type: "boolean" } },
						{ name: "limit", in: "query", schema: { type: "integer", default: 50, minimum: 1, maximum: 200 } },
						{ name: "offset", in: "query", schema: { type: "integer", default: 0 } },
					],
					responses: {
						200: { description: "Agreement list with board context" },
						401: { description: "Unauthorized" },
						403: { description: "Access denied" },
						404: { description: "Series not found" },
					},
				},
			},
			"/series/{id}/health-summary": {
				get: {
					summary: "Health check trends over time",
					operationId: "healthSummary",
					tags: ["Series", "Health"],
					description: "Returns survey question response distributions across recent boards, grouped by threadId for longitudinal tracking.",
					parameters: [
						{ name: "id", in: "path", required: true, schema: { type: "string" } },
						{ name: "limit", in: "query", schema: { type: "integer", default: 10, minimum: 1, maximum: 50, description: "Number of most-recent boards to include" } },
					],
					responses: {
						200: { description: "Health trends per question thread" },
						401: { description: "Unauthorized" },
						403: { description: "Access denied" },
						404: { description: "Series not found" },
					},
				},
			},
			"/boards/{id}": {
				get: {
					summary: "Get full board detail",
					operationId: "getBoard",
					tags: ["Boards"],
					parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
					responses: {
						200: { description: "Board with columns, scenes, cards" },
						401: { description: "Unauthorized" },
						403: { description: "Access denied" },
						404: { description: "Board not found" },
					},
				},
			},
			"/boards/{id}/cards": {
				get: {
					summary: "Get all cards in a board",
					operationId: "getBoardCards",
					tags: ["Boards", "Cards"],
					parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
					responses: {
						200: { description: "Cards with vote and comment counts" },
						401: { description: "Unauthorized" },
						403: { description: "Access denied" },
						404: { description: "Board not found" },
					},
				},
			},
			"/boards/{id}/agreements": {
				get: {
					summary: "Get action items for a board",
					operationId: "getBoardAgreements",
					tags: ["Boards", "Agreements"],
					parameters: [
						{ name: "id", in: "path", required: true, schema: { type: "string" } },
						{ name: "completed", in: "query", schema: { type: "boolean" } },
					],
					responses: {
						200: { description: "Agreements list" },
						401: { description: "Unauthorized" },
						403: { description: "Access denied" },
						404: { description: "Board not found" },
					},
				},
			},
			"/boards/{id}/scorecard-results": {
				get: {
					summary: "Get processed scorecard results for a board",
					operationId: "getScorecardResults",
					tags: ["Boards", "Scorecards"],
					parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
					responses: {
						200: { description: "Scorecard results with scene and datasource context" },
						401: { description: "Unauthorized" },
						403: { description: "Access denied" },
						404: { description: "Board not found" },
					},
				},
			},
			"/datasources/{id}/inject": {
				post: {
					summary: "Push AI-generated findings into a datasource",
					operationId: "injectDatasource",
					tags: ["Scorecards", "AI"],
					description: "Push pre-processed scorecard results from an AI client. The datasource must have sourceType='ai'. Results are immediately visible in any active scene scorecard.",
					parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
					requestBody: {
						required: true,
						content: {
							"application/json": {
								schema: {
									type: "object",
									required: ["data"],
									properties: {
										data: {
											type: "array",
											minItems: 1,
											maxItems: 500,
											items: {
												type: "object",
												required: ["section", "title"],
												properties: {
													section: { type: "string", maxLength: 100 },
													title: { type: "string", maxLength: 200 },
													primaryValue: { type: "string", nullable: true },
													secondaryValues: { type: "object", nullable: true, additionalProperties: { type: "string" } },
													severity: { type: "string", enum: ["info", "warning", "critical"], default: "info" },
													sourceData: { nullable: true, description: "Raw evidence object" },
												},
											},
										},
									},
								},
							},
						},
					},
					responses: {
						200: { description: "Injection successful", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, injected: { type: "integer", description: "Number of results written" } } } } } },
						400: { description: "Validation error" },
						401: { description: "Unauthorized" },
						403: { description: "Access denied or datasource is not type 'ai'" },
						404: { description: "Datasource not found" },
					},
				},
			},
		},
	};

	return json(spec, {
		headers: {
			"Access-Control-Allow-Origin": "*",
			"Cache-Control": "public, max-age=3600",
		},
	});
};
