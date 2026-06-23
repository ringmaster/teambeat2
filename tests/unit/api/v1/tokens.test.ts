import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../src/lib/server/auth/index", () => ({
	requireApiV1Auth: vi.fn(),
}));

vi.mock("../../../../src/lib/server/repositories/api-tokens", () => ({
	createApiToken: vi.fn(),
	listApiTokens: vi.fn(),
	revokeApiToken: vi.fn(),
}));

import { requireApiV1Auth } from "../../../../src/lib/server/auth/index";
import {
	createApiToken,
	listApiTokens,
	revokeApiToken,
} from "../../../../src/lib/server/repositories/api-tokens";
import { GET, POST } from "../../../../src/routes/api/v1/tokens/+server";
import { DELETE } from "../../../../src/routes/api/v1/tokens/[id]/+server";
import { createMockRequestEvent } from "../../helpers/mock-request";

const mockUser = { userId: "user-1", email: "test@example.com", expiresAt: 0 };

describe("GET /api/v1/tokens", () => {
	beforeEach(() => vi.clearAllMocks());

	it("returns 401 response when not authenticated (does not throw)", async () => {
		vi.mocked(requireApiV1Auth).mockRejectedValue(
			new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { status: 401 }),
		);

		const event = createMockRequestEvent({ url: "http://localhost/api/v1/tokens" });

		// Must return a 401 Response — throwing causes SvelteKit to 500
		const response = await GET(event);
		expect(response.status).toBe(401);
		const data = await response.json();
		expect(data.success).toBe(false);
	});

	it("returns token list for authenticated user", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		const mockTokens = [{ id: "tok-1", label: "Agent", expiresAt: Date.now() + 1000000, lastUsedAt: null, createdAt: Date.now() }];
		vi.mocked(listApiTokens).mockResolvedValue(mockTokens as any);

		const event = createMockRequestEvent({ url: "http://localhost/api/v1/tokens" });
		const response = await GET(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.success).toBe(true);
		expect(data.tokens).toEqual(mockTokens);
		expect(listApiTokens).toHaveBeenCalledWith("user-1");
	});
});

describe("POST /api/v1/tokens", () => {
	beforeEach(() => vi.clearAllMocks());

	it("returns 201 with raw token on success", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(createApiToken).mockResolvedValue({
			rawToken: "tb_abc123",
			tokenInfo: { id: "tok-1", label: "My agent", expiresAt: Date.now() + 1000000, lastUsedAt: null, createdAt: Date.now() },
		} as any);

		const event = createMockRequestEvent({
			method: "POST",
			url: "http://localhost/api/v1/tokens",
			body: { label: "My agent" },
		});

		const response = await POST(event);
		const data = await response.json();

		expect(response.status).toBe(201);
		expect(data.success).toBe(true);
		expect(data.token).toBe("tb_abc123");
		expect(data.tokenInfo.label).toBe("My agent");
		expect(createApiToken).toHaveBeenCalledWith("user-1", "My agent");
	});

	it("returns 400 when label is empty", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);

		const event = createMockRequestEvent({
			method: "POST",
			url: "http://localhost/api/v1/tokens",
			body: { label: "" },
		});

		const response = await POST(event);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.success).toBe(false);
		expect(data.error).toBe("Invalid input");
		expect(createApiToken).not.toHaveBeenCalled();
	});

	it("returns 400 when label exceeds 100 chars", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);

		const event = createMockRequestEvent({
			method: "POST",
			url: "http://localhost/api/v1/tokens",
			body: { label: "x".repeat(101) },
		});

		const response = await POST(event);
		const data = await response.json();
		expect(response.status).toBe(400);
		expect(data.success).toBe(false);
		expect(data.error).toBe("Invalid input");
	});
});

describe("DELETE /api/v1/tokens/:id", () => {
	beforeEach(() => vi.clearAllMocks());

	it("returns 200 when token is successfully revoked", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(revokeApiToken).mockResolvedValue(true);

		const event = createMockRequestEvent({
			method: "DELETE",
			url: "http://localhost/api/v1/tokens/tok-1",
			params: { id: "tok-1" },
		});

		const response = await DELETE(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.success).toBe(true);
		expect(revokeApiToken).toHaveBeenCalledWith("tok-1", "user-1");
	});

	it("returns 404 when token does not exist or belongs to another user", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(revokeApiToken).mockResolvedValue(false);

		const event = createMockRequestEvent({
			method: "DELETE",
			url: "http://localhost/api/v1/tokens/unknown",
			params: { id: "unknown" },
		});

		const response = await DELETE(event);
		const data = await response.json();

		expect(response.status).toBe(404);
		expect(data.success).toBe(false);
	});
});
