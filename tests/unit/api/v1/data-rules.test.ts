import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../src/lib/server/auth/index", () => ({
	requireApiV1Auth: vi.fn(),
}));

vi.mock("../../../../src/lib/server/repositories/board-series", () => ({
	getUserRoleInSeries: vi.fn(),
}));

vi.mock("../../../../src/lib/server/db/index", () => ({
	db: { select: vi.fn() },
}));

vi.mock("../../../../src/lib/server/db/schema", () => ({
	scenes: {},
	boards: {},
}));

vi.mock("../../../../src/lib/server/repositories/data-scene-rules", () => ({
	getDataSceneRules: vi.fn(),
	replaceDataSceneRules: vi.fn(),
}));

import { requireApiV1Auth } from "../../../../src/lib/server/auth/index";
import { getUserRoleInSeries } from "../../../../src/lib/server/repositories/board-series";
import { getDataSceneRules, replaceDataSceneRules } from "../../../../src/lib/server/repositories/data-scene-rules";
import { db } from "../../../../src/lib/server/db/index";
import { GET, PUT } from "../../../../src/routes/api/v1/scenes/[id]/data-rules/+server";
import { createMockRequestEvent } from "../../helpers/mock-request";

const mockUser = { userId: "user-1", email: "test@example.com", expiresAt: 0 };

const mockRules = [
	{
		id: "rule-1",
		sceneId: "scene-1",
		seq: 0,
		section: "Sprint Summary",
		label: "Sprint",
		query: "sprint",
		panelSize: "medium",
		titleTemplate: "{name}",
		bodyTemplate: "Velocity: {velocity} of {planned} points",
		copyTemplate: null,
		emphasisPath: null,
		emphasisMap: null,
		builtinTemplate: null,
	},
];

function mockDbSceneLookup(seriesId: string | null) {
	const rows = seriesId ? [{ seriesId }] : [];
	const limit = vi.fn().mockResolvedValue(rows);
	const where = vi.fn().mockReturnValue({ limit });
	const innerJoin = vi.fn().mockReturnValue({ where });
	const from = vi.fn().mockReturnValue({ innerJoin });
	vi.mocked(db.select).mockReturnValue({ from } as any);
}

describe("GET /api/v1/scenes/:id/data-rules", () => {
	beforeEach(() => vi.clearAllMocks());

	it("returns 401 when not authenticated (does not throw)", async () => {
		vi.mocked(requireApiV1Auth).mockRejectedValue(
			new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { status: 401 }),
		);
		const event = createMockRequestEvent({
			url: "http://localhost/api/v1/scenes/scene-1/data-rules",
			params: { id: "scene-1" },
		});
		const response = await GET(event);
		expect(response.status).toBe(401);
		const data = await response.json();
		expect(data.success).toBe(false);
	});

	it("returns 404 when scene does not exist", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		mockDbSceneLookup(null);
		const event = createMockRequestEvent({
			url: "http://localhost/api/v1/scenes/bad-scene/data-rules",
			params: { id: "bad-scene" },
		});
		const response = await GET(event);
		expect(response.status).toBe(404);
		const data = await response.json();
		expect(data.error).toBe("Scene not found");
	});

	it("returns 403 when user is not a series member", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		mockDbSceneLookup("series-1");
		vi.mocked(getUserRoleInSeries).mockResolvedValue(null);
		const event = createMockRequestEvent({
			url: "http://localhost/api/v1/scenes/scene-1/data-rules",
			params: { id: "scene-1" },
		});
		const response = await GET(event);
		expect(response.status).toBe(403);
	});

	it("returns rules array for authenticated member", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		mockDbSceneLookup("series-1");
		vi.mocked(getUserRoleInSeries).mockResolvedValue("member");
		vi.mocked(getDataSceneRules).mockResolvedValue(mockRules as any);

		const event = createMockRequestEvent({
			url: "http://localhost/api/v1/scenes/scene-1/data-rules",
			params: { id: "scene-1" },
		});
		const response = await GET(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.success).toBe(true);
		expect(data.rules).toHaveLength(1);
		expect(data.rules[0].label).toBe("Sprint");
		expect(data.rules[0].query).toBe("sprint");
		expect(data.rules[0].panelSize).toBe("medium");
	});

	it("returns empty array when scene has no rules", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		mockDbSceneLookup("series-1");
		vi.mocked(getUserRoleInSeries).mockResolvedValue("member");
		vi.mocked(getDataSceneRules).mockResolvedValue([]);

		const event = createMockRequestEvent({
			url: "http://localhost/api/v1/scenes/scene-1/data-rules",
			params: { id: "scene-1" },
		});
		const response = await GET(event);
		const data = await response.json();
		expect(response.status).toBe(200);
		expect(data.rules).toEqual([]);
	});
});

describe("PUT /api/v1/scenes/:id/data-rules", () => {
	beforeEach(() => vi.clearAllMocks());

	it("returns 401 when not authenticated (does not throw)", async () => {
		vi.mocked(requireApiV1Auth).mockRejectedValue(
			new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { status: 401 }),
		);
		const event = createMockRequestEvent({
			method: "PUT",
			url: "http://localhost/api/v1/scenes/scene-1/data-rules",
			params: { id: "scene-1" },
			body: [],
		});
		const response = await PUT(event);
		expect(response.status).toBe(401);
	});

	it("returns 404 when scene does not exist", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		mockDbSceneLookup(null);
		const event = createMockRequestEvent({
			method: "PUT",
			url: "http://localhost/api/v1/scenes/bad-scene/data-rules",
			params: { id: "bad-scene" },
			body: [],
		});
		const response = await PUT(event);
		expect(response.status).toBe(404);
	});

	it("returns 403 for member role (facilitator required)", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		mockDbSceneLookup("series-1");
		vi.mocked(getUserRoleInSeries).mockResolvedValue("member");
		const event = createMockRequestEvent({
			method: "PUT",
			url: "http://localhost/api/v1/scenes/scene-1/data-rules",
			params: { id: "scene-1" },
			body: [],
		});
		const response = await PUT(event);
		expect(response.status).toBe(403);
		const data = await response.json();
		expect(data.error).toBe("Facilitator or admin required");
	});

	it("replaces rules and returns saved set for admin", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		mockDbSceneLookup("series-1");
		vi.mocked(getUserRoleInSeries).mockResolvedValue("admin");
		vi.mocked(replaceDataSceneRules).mockResolvedValue(mockRules as any);

		const newRules = [
			{
				seq: 0,
				section: "Sprint Summary",
				label: "Sprint",
				query: "sprint",
				panelSize: "medium",
				titleTemplate: "{name}",
				bodyTemplate: "Velocity: {velocity}",
			},
		];

		const event = createMockRequestEvent({
			method: "PUT",
			url: "http://localhost/api/v1/scenes/scene-1/data-rules",
			params: { id: "scene-1" },
			body: newRules,
		});
		const response = await PUT(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.success).toBe(true);
		expect(data.rules).toHaveLength(1);
		expect(replaceDataSceneRules).toHaveBeenCalledWith("scene-1", newRules);
	});

	it("replaces rules for facilitator role", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		mockDbSceneLookup("series-1");
		vi.mocked(getUserRoleInSeries).mockResolvedValue("facilitator");
		vi.mocked(replaceDataSceneRules).mockResolvedValue([]);

		const event = createMockRequestEvent({
			method: "PUT",
			url: "http://localhost/api/v1/scenes/scene-1/data-rules",
			params: { id: "scene-1" },
			body: [],
		});
		const response = await PUT(event);
		expect(response.status).toBe(200);
	});

	it("returns 400 for invalid rule shape", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		mockDbSceneLookup("series-1");
		vi.mocked(getUserRoleInSeries).mockResolvedValue("admin");

		const event = createMockRequestEvent({
			method: "PUT",
			url: "http://localhost/api/v1/scenes/scene-1/data-rules",
			params: { id: "scene-1" },
			body: [{ panelSize: "invalid-size" }],
		});
		const response = await PUT(event);
		expect(response.status).toBe(400);
		const data = await response.json();
		expect(data.error).toBe("Invalid input");
	});
});
