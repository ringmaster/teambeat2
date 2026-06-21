import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/lib/server/db/index", () => ({
	db: {
		insert: vi.fn(),
		select: vi.fn(),
		delete: vi.fn(),
		update: vi.fn(),
	},
}));

vi.mock("../../../src/lib/server/db/schema", () => ({
	apiTokens: {
		id: "id",
		userId: "user_id",
		tokenHash: "token_hash",
		label: "label",
		expiresAt: "expires_at",
		lastUsedAt: "last_used_at",
		createdAt: "created_at",
	},
}));

vi.mock("uuid", () => ({ v4: vi.fn(() => "mock-uuid-1234") }));

vi.mock("../../../src/lib/server/auth/api-token", () => ({
	generateToken: vi.fn(() => ({ token: "tb_rawtoken123", hash: "hashvalue123" })),
	TOKEN_TTL_MS: 90 * 24 * 60 * 60 * 1000,
}));

import { db } from "../../../src/lib/server/db/index";
import {
	cleanupExpiredTokens,
	createApiToken,
	listApiTokens,
	revokeApiToken,
} from "../../../src/lib/server/repositories/api-tokens";

describe("createApiToken", () => {
	beforeEach(() => vi.clearAllMocks());

	it("inserts a token and returns the raw token + info", async () => {
		const mockValues = vi.fn().mockResolvedValue(undefined);
		const mockInsert = { values: mockValues };
		vi.mocked(db.insert).mockReturnValue(mockInsert as any);

		const result = await createApiToken("user-1", "My AI agent");

		expect(db.insert).toHaveBeenCalled();
		expect(mockValues).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "mock-uuid-1234",
				userId: "user-1",
				label: "My AI agent",
				tokenHash: "hashvalue123",
			}),
		);
		expect(result.rawToken).toBe("tb_rawtoken123");
		expect(result.tokenInfo.label).toBe("My AI agent");
		expect(result.tokenInfo.id).toBe("mock-uuid-1234");
		expect(result.tokenInfo.expiresAt).toBeGreaterThan(Date.now());
	});
});

describe("listApiTokens", () => {
	beforeEach(() => vi.clearAllMocks());

	it("queries tokens for the given user and excludes expired ones", async () => {
		const mockTokens = [
			{ id: "tok-1", label: "Agent", expiresAt: Date.now() + 1000000, lastUsedAt: null, createdAt: Date.now() },
		];
		const mockWhere = vi.fn().mockReturnValue({ orderBy: vi.fn().mockResolvedValue(mockTokens) });
		const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
		vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

		const result = await listApiTokens("user-1");

		expect(db.select).toHaveBeenCalled();
		expect(result).toEqual(mockTokens);
	});
});

describe("revokeApiToken", () => {
	beforeEach(() => vi.clearAllMocks());

	it("returns true when a token is deleted", async () => {
		const mockWhere = vi.fn().mockResolvedValue({ rowsAffected: 1 });
		const mockDelete = { where: mockWhere };
		vi.mocked(db.delete).mockReturnValue(mockDelete as any);

		const result = await revokeApiToken("tok-1", "user-1");

		expect(result).toBe(true);
		expect(mockWhere).toHaveBeenCalled();
	});

	it("returns false when no token is deleted (wrong user or id)", async () => {
		const mockWhere = vi.fn().mockResolvedValue({ rowsAffected: 0 });
		const mockDelete = { where: mockWhere };
		vi.mocked(db.delete).mockReturnValue(mockDelete as any);

		const result = await revokeApiToken("nonexistent", "user-1");

		expect(result).toBe(false);
	});
});

describe("cleanupExpiredTokens", () => {
	beforeEach(() => vi.clearAllMocks());

	it("calls delete with a timestamp filter", async () => {
		const mockWhere = vi.fn().mockResolvedValue(undefined);
		vi.mocked(db.delete).mockReturnValue({ where: mockWhere } as any);

		await cleanupExpiredTokens();

		expect(db.delete).toHaveBeenCalled();
		expect(mockWhere).toHaveBeenCalled();
	});
});
