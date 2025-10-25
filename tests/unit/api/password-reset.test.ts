import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	generatePasswordResetToken,
	validatePasswordResetToken,
} from "../../../src/lib/server/auth/password-reset";
import { DELETE as DeleteUser } from "../../../src/routes/api/admin/users/[userId]/+server";
import { POST as GenerateResetToken } from "../../../src/routes/api/admin/users/generate-reset-token/+server";
import { POST as ResetPassword } from "../../../src/routes/api/auth/reset-password/+server";
import { createMockRequestEvent } from "../helpers/mock-request";

// Mock user repository
vi.mock("../../../src/lib/server/repositories/user", () => ({
	findUserById: vi.fn(),
	updateUserPassword: vi.fn(),
	deleteUserById: vi.fn(),
}));

// Mock session repository
vi.mock("../../../src/lib/server/repositories/session", () => ({
	getSessionFromCookie: vi.fn(),
}));

// Mock database
vi.mock("../../../src/lib/server/db", () => ({
	db: {
		select: vi.fn(() => ({
			from: vi.fn(() => ({
				where: vi.fn(() => ({
					limit: vi.fn(() => Promise.resolve([])),
				})),
			})),
		})),
		delete: vi.fn(() => ({
			where: vi.fn(() => Promise.resolve()),
		})),
	},
}));

vi.mock("../../../src/lib/server/db/schema", () => ({
	users: {
		id: "id",
		is_admin: "is_admin",
	},
}));

import { db } from "../../../src/lib/server/db";
import { getSessionFromCookie } from "../../../src/lib/server/repositories/session";
// Import mocked modules
import {
	deleteUserById,
	findUserById,
	updateUserPassword,
} from "../../../src/lib/server/repositories/user";

describe("Password Reset Token Generation and Validation", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("generatePasswordResetToken", () => {
		it("should generate a valid token with userId, timestamp, and signature", () => {
			const userId = "user-123";
			const passwordHash = "hashed-password";

			const token = generatePasswordResetToken(userId, passwordHash);
			const parts = token.split(":");

			expect(parts).toHaveLength(3);
			expect(parts[0]).toBe(userId);
			expect(parseInt(parts[1])).toBeGreaterThan(Date.now());
			expect(parts[2]).toBeTruthy(); // Signature exists
		});

		it("should generate different signatures for different password hashes", () => {
			const userId = "user-123";
			const passwordHash1 = "hash1";
			const passwordHash2 = "hash2";

			const token1 = generatePasswordResetToken(userId, passwordHash1);
			const token2 = generatePasswordResetToken(userId, passwordHash2);

			expect(token1).not.toBe(token2);
		});

		it("should generate URL-safe tokens", () => {
			const userId = "user-123";
			const passwordHash = "hashed-password";

			const token = generatePasswordResetToken(userId, passwordHash);

			// Check that token doesn't contain URL-unsafe characters
			expect(token).not.toMatch(/[+/=]/);
		});
	});

	describe("validatePasswordResetToken", () => {
		it("should validate a correct token", async () => {
			const userId = "user-123";
			const passwordHash = "hashed-password";
			const mockUser = { id: userId, passwordHash, email: "test@example.com" };

			vi.mocked(findUserById).mockResolvedValue(mockUser as any);

			const token = generatePasswordResetToken(userId, passwordHash);
			const result = await validatePasswordResetToken(token);

			expect(result.valid).toBe(true);
			if (result.valid) {
				expect(result.userId).toBe(userId);
			}
		});

		it("should reject token with invalid format", async () => {
			const result = await validatePasswordResetToken("invalid-token");

			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toBe("Invalid token format");
			}
		});

		it("should reject expired token", async () => {
			const userId = "user-123";
			const expiredTimestamp = Date.now() - 1000; // 1 second ago
			const signature = "fake-signature";
			const expiredToken = `${userId}:${expiredTimestamp}:${signature}`;

			const result = await validatePasswordResetToken(expiredToken);

			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toBe("Token has expired");
			}
		});

		it("should reject token for non-existent user", async () => {
			vi.mocked(findUserById).mockResolvedValue(undefined);

			const futureTimestamp = Date.now() + 3600000; // 1 hour from now
			const token = `user-999:${futureTimestamp}:fake-signature`;

			const result = await validatePasswordResetToken(token);

			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toBe("Invalid token");
			}
		});

		it("should reject token with invalid signature", async () => {
			const userId = "user-123";
			const passwordHash = "hashed-password";
			const mockUser = { id: userId, passwordHash, email: "test@example.com" };

			vi.mocked(findUserById).mockResolvedValue(mockUser as any);

			const futureTimestamp = Date.now() + 3600000;
			const invalidToken = `${userId}:${futureTimestamp}:invalid-signature`;

			const result = await validatePasswordResetToken(invalidToken);

			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toBe("Invalid token");
			}
		});

		it("should reject token after password change (auto-revocation)", async () => {
			const userId = "user-123";
			const oldPasswordHash = "old-hash";
			const newPasswordHash = "new-hash";

			// Generate token with old password hash
			const token = generatePasswordResetToken(userId, oldPasswordHash);

			// Simulate password change - user now has new hash
			const mockUser = {
				id: userId,
				passwordHash: newPasswordHash,
				email: "test@example.com",
			};
			vi.mocked(findUserById).mockResolvedValue(mockUser as any);

			// Token should now be invalid
			const result = await validatePasswordResetToken(token);

			expect(result.valid).toBe(false);
		});
	});
});

describe("POST /api/auth/reset-password", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should reset password with valid token", async () => {
		const userId = "user-123";
		const passwordHash = "hashed-password";
		const newPassword = "new-secure-password";
		const mockUser = { id: userId, passwordHash, email: "test@example.com" };

		vi.mocked(findUserById).mockResolvedValue(mockUser as any);
		vi.mocked(updateUserPassword).mockResolvedValue(mockUser as any);

		const token = generatePasswordResetToken(userId, passwordHash);

		const event = createMockRequestEvent({
			method: "POST",
			body: { token, newPassword },
		});

		const response = await ResetPassword(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.success).toBe(true);
		expect(updateUserPassword).toHaveBeenCalledWith(userId, newPassword);
	});

	it("should reject request with invalid token", async () => {
		const event = createMockRequestEvent({
			method: "POST",
			body: { token: "invalid-token", newPassword: "new-password" },
		});

		const response = await ResetPassword(event);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.error).toBeTruthy();
	});

	it("should reject request with expired token", async () => {
		const expiredTimestamp = Date.now() - 1000;
		const token = `user-123:${expiredTimestamp}:fake-signature`;

		const event = createMockRequestEvent({
			method: "POST",
			body: { token, newPassword: "new-password" },
		});

		const response = await ResetPassword(event);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.error).toBe("Token has expired");
	});

	it("should reject request with short password", async () => {
		const event = createMockRequestEvent({
			method: "POST",
			body: { token: "valid-token", newPassword: "short" },
		});

		const response = await ResetPassword(event);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.error).toBe("Invalid input");
	});
});

describe("POST /api/admin/users/generate-reset-token", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should generate reset token for admin user", async () => {
		const adminUserId = "admin-123";
		const targetUserId = "user-456";
		const targetUser = {
			id: targetUserId,
			email: "target@example.com",
			passwordHash: "hashed-password",
		};

		// Mock admin session
		vi.mocked(getSessionFromCookie).mockResolvedValue({
			userId: adminUserId,
		} as any);

		// Mock admin user
		vi.mocked(db.select).mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					limit: vi
						.fn()
						.mockResolvedValue([{ id: adminUserId, isAdmin: true }]),
				}),
			}),
		} as any);

		// Mock target user
		vi.mocked(findUserById).mockResolvedValue(targetUser as any);

		const cookies = new Map([["session", "valid-session-cookie"]]);

		const event = createMockRequestEvent({
			method: "POST",
			url: "http://localhost:5173/api/admin/users/generate-reset-token",
			body: { userId: targetUserId },
			cookies,
		});

		const response = await GenerateResetToken(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.success).toBe(true);
		expect(data.resetUrl).toContain("/reset-password?token=");
		expect(data.resetUrl).toContain(targetUserId);
	});

	it("should reject request from non-admin user", async () => {
		const userId = "user-123";

		vi.mocked(getSessionFromCookie).mockResolvedValue({ userId } as any);

		// Mock non-admin user
		vi.mocked(db.select).mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					limit: vi.fn().mockResolvedValue([{ id: userId, isAdmin: false }]),
				}),
			}),
		} as any);

		const cookies = new Map([["session", "valid-session-cookie"]]);

		const event = createMockRequestEvent({
			method: "POST",
			body: { userId: "target-user" },
			cookies,
		});

		await expect(GenerateResetToken(event)).rejects.toThrow();
	});

	it("should reject request without authentication", async () => {
		vi.mocked(getSessionFromCookie).mockResolvedValue(null);

		const event = createMockRequestEvent({
			method: "POST",
			body: { userId: "target-user" },
		});

		await expect(GenerateResetToken(event)).rejects.toThrow();
	});

	it("should reject request for non-existent user", async () => {
		const adminUserId = "admin-123";

		vi.mocked(getSessionFromCookie).mockResolvedValue({
			userId: adminUserId,
		} as any);

		vi.mocked(db.select).mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					limit: vi
						.fn()
						.mockResolvedValue([{ id: adminUserId, isAdmin: true }]),
				}),
			}),
		} as any);

		vi.mocked(findUserById).mockResolvedValue(undefined);

		const cookies = new Map([["session", "valid-session-cookie"]]);

		const event = createMockRequestEvent({
			method: "POST",
			body: { userId: "non-existent-user" },
			cookies,
		});

		await expect(GenerateResetToken(event)).rejects.toThrow();
	});
});

describe("DELETE /api/admin/users/[userId]", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should delete non-admin user as admin", async () => {
		const adminUserId = "admin-123";
		const targetUserId = "user-456";

		vi.mocked(getSessionFromCookie).mockResolvedValue({
			userId: adminUserId,
		} as any);

		// Mock admin user
		vi.mocked(db.select).mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					limit: vi
						.fn()
						.mockResolvedValue([{ id: adminUserId, isAdmin: true }]),
				}),
			}),
		} as any);

		// Mock target user (non-admin)
		vi.mocked(findUserById).mockResolvedValue({
			id: targetUserId,
			email: "user@example.com",
			is_admin: false,
		} as any);

		vi.mocked(deleteUserById).mockResolvedValue(undefined);

		const cookies = new Map([["session", "valid-session-cookie"]]);

		const event = createMockRequestEvent({
			method: "DELETE",
			params: { userId: targetUserId },
			cookies,
		});

		const response = await DeleteUser(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.success).toBe(true);
		expect(deleteUserById).toHaveBeenCalledWith(targetUserId);
	});

	it("should prevent admin from deleting themselves", async () => {
		const adminUserId = "admin-123";

		vi.mocked(getSessionFromCookie).mockResolvedValue({
			userId: adminUserId,
		} as any);

		vi.mocked(db.select).mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					limit: vi
						.fn()
						.mockResolvedValue([{ id: adminUserId, isAdmin: true }]),
				}),
			}),
		} as any);

		const cookies = new Map([["session", "valid-session-cookie"]]);

		const event = createMockRequestEvent({
			method: "DELETE",
			params: { userId: adminUserId },
			cookies,
		});

		await expect(DeleteUser(event)).rejects.toThrow();
	});

	it("should prevent deletion of other admin users", async () => {
		const adminUserId = "admin-123";
		const otherAdminId = "admin-456";

		vi.mocked(getSessionFromCookie).mockResolvedValue({
			userId: adminUserId,
		} as any);

		vi.mocked(db.select).mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					limit: vi
						.fn()
						.mockResolvedValue([{ id: adminUserId, isAdmin: true }]),
				}),
			}),
		} as any);

		// Mock other admin user
		vi.mocked(findUserById).mockResolvedValue({
			id: otherAdminId,
			email: "other-admin@example.com",
			is_admin: true,
		} as any);

		const cookies = new Map([["session", "valid-session-cookie"]]);

		const event = createMockRequestEvent({
			method: "DELETE",
			params: { userId: otherAdminId },
			cookies,
		});

		await expect(DeleteUser(event)).rejects.toThrow();
	});

	it("should reject deletion from non-admin user", async () => {
		const userId = "user-123";

		vi.mocked(getSessionFromCookie).mockResolvedValue({ userId } as any);

		vi.mocked(db.select).mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					limit: vi.fn().mockResolvedValue([{ id: userId, isAdmin: false }]),
				}),
			}),
		} as any);

		const cookies = new Map([["session", "valid-session-cookie"]]);

		const event = createMockRequestEvent({
			method: "DELETE",
			params: { userId: "target-user" },
			cookies,
		});

		await expect(DeleteUser(event)).rejects.toThrow();
	});

	it("should reject deletion without authentication", async () => {
		vi.mocked(getSessionFromCookie).mockResolvedValue(null);

		const event = createMockRequestEvent({
			method: "DELETE",
			params: { userId: "target-user" },
		});

		await expect(DeleteUser(event)).rejects.toThrow();
	});
});
