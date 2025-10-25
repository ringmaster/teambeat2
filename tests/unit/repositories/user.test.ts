import { beforeEach, describe, expect, it, vi } from "vitest";
import { ensureEmailVerificationSecret } from "../../../src/lib/server/repositories/user";

// Mock the database
vi.mock("../../../src/lib/server/db/index", () => ({
	db: {
		select: vi.fn(),
		update: vi.fn(),
	},
}));

// Mock the schema
vi.mock("../../../src/lib/server/db/schema", () => ({
	users: {
		id: "id",
		email: "email",
		emailVerificationSecret: "emailVerificationSecret",
		updatedAt: "updatedAt",
	},
}));

// Mock uuid
vi.mock("uuid", () => ({
	v4: vi.fn(),
}));

import { v4 as uuidv4 } from "uuid";
// Import mocked modules
import { db } from "../../../src/lib/server/db/index";

describe("ensureEmailVerificationSecret", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should return existing secret if user already has one", async () => {
		const mockUser = {
			id: "user-1",
			email: "test@example.com",
			emailVerificationSecret: "existing-secret-123",
			emailVerified: false,
			name: "Test User",
			passwordHash: "hash",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			is_admin: false,
			role: "user",
		};

		// Mock findUserById behavior (select query)
		const mockLimit = vi.fn().mockResolvedValue([mockUser]);
		const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
		const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
		vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

		const result = await ensureEmailVerificationSecret("user-1");

		expect(result).toBe("existing-secret-123");
		expect(db.select).toHaveBeenCalled();
		expect(db.update).not.toHaveBeenCalled(); // Should not update if secret exists
	});

	it("should generate and save new secret if user has no secret", async () => {
		const mockUserWithoutSecret = {
			id: "user-1",
			email: "test@example.com",
			emailVerificationSecret: null, // No secret
			emailVerified: false,
			name: "Test User",
			passwordHash: "hash",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			is_admin: false,
			role: "user",
		};

		const newSecret = "newly-generated-uuid-secret";
		vi.mocked(uuidv4).mockReturnValue(newSecret);

		// Mock findUserById behavior (select query)
		const mockLimit = vi.fn().mockResolvedValue([mockUserWithoutSecret]);
		const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
		const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
		vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

		// Mock update query
		const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
		const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
		vi.mocked(db.update).mockReturnValue({ set: mockSet } as any);

		const result = await ensureEmailVerificationSecret("user-1");

		expect(result).toBe(newSecret);
		expect(uuidv4).toHaveBeenCalled();
		expect(db.update).toHaveBeenCalled();
		expect(mockSet).toHaveBeenCalledWith(
			expect.objectContaining({
				emailVerificationSecret: newSecret,
			}),
		);
	});

	it("should throw error if user is not found", async () => {
		// Mock findUserById returning no user
		const mockLimit = vi.fn().mockResolvedValue([]); // Empty array = no user found
		const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
		const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
		vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

		await expect(
			ensureEmailVerificationSecret("nonexistent-user"),
		).rejects.toThrow("User not found");
		expect(db.update).not.toHaveBeenCalled();
	});
});
