import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks must be declared before any imports that trigger them ---

vi.mock("../../../src/lib/server/db/index", () => ({
	db: {
		select: vi.fn(),
		update: vi.fn(),
	},
}));

vi.mock("../../../src/lib/server/db/schema", () => ({
	apiTokens: { id: "id", tokenHash: "token_hash", userId: "user_id", expiresAt: "expires_at" },
	users: { id: "id", email: "email" },
}));

import { db } from "../../../src/lib/server/db/index";
import { generateToken, hashToken, TOKEN_PREFIX, TOKEN_TTL_MS, validateApiToken } from "../../../src/lib/server/auth/api-token";

describe("generateToken", () => {
	it("produces a token with the tb_ prefix", () => {
		const { token } = generateToken();
		expect(token).toMatch(/^tb_[0-9a-f]{64}$/);
	});

	it("produces a different token on each call", () => {
		const { token: a } = generateToken();
		const { token: b } = generateToken();
		expect(a).not.toBe(b);
	});

	it("returns a hash alongside the raw token", () => {
		const { token, hash } = generateToken();
		expect(hash).toHaveLength(64); // SHA-256 hex
		expect(hash).not.toBe(token);
	});

	it("hash is deterministic for the same token", () => {
		const { token } = generateToken();
		expect(hashToken(token)).toBe(hashToken(token));
	});
});

describe("hashToken", () => {
	it("returns a 64-char hex string", () => {
		expect(hashToken("tb_abc")).toMatch(/^[0-9a-f]{64}$/);
	});

	it("produces different hashes for different inputs", () => {
		expect(hashToken("tb_aaa")).not.toBe(hashToken("tb_bbb"));
	});
});

describe("validateApiToken", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns null immediately for tokens without tb_ prefix", async () => {
		const result = await validateApiToken("some-other-token");
		expect(result).toBeNull();
		expect(db.select).not.toHaveBeenCalled();
	});

	it("returns null when no matching token record found", async () => {
		const mockLimit = vi.fn().mockResolvedValue([]);
		const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
		const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
		const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
		vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);
		mockFrom.mockReturnValue({ innerJoin: mockInnerJoin });
		mockInnerJoin.mockReturnValue({ where: mockWhere });

		const result = await validateApiToken("tb_" + "a".repeat(64));
		expect(result).toBeNull();
	});

	it("returns user data when a valid token is found", async () => {
		const mockRecord = { tokenId: "tok-1", userId: "user-1", userEmail: "test@example.com" };

		const mockLimit = vi.fn().mockResolvedValue([mockRecord]);
		const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
		const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
		const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
		vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

		// Mock update chain (fire-and-forget last-used update)
		const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
		const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
		vi.mocked(db.update).mockReturnValue({ set: mockSet } as any);

		const { token } = generateToken();
		const result = await validateApiToken(token);

		expect(result).toEqual({ userId: "user-1", email: "test@example.com" });
	});

	it("fires a last-used update after successful validation", async () => {
		const mockRecord = { tokenId: "tok-1", userId: "user-1", userEmail: "test@example.com" };

		const mockLimit = vi.fn().mockResolvedValue([mockRecord]);
		const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
		const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
		const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
		vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

		const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
		const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
		vi.mocked(db.update).mockReturnValue({ set: mockSet } as any);

		const { token } = generateToken();
		await validateApiToken(token);

		// Allow the fire-and-forget update to settle
		await new Promise((r) => setTimeout(r, 10));
		expect(db.update).toHaveBeenCalled();
	});
});
