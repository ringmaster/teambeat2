import { execSync } from "child_process";
import { eq, sql } from "drizzle-orm";
import { existsSync, unlinkSync } from "fs";
import { v4 as uuid } from "uuid";
import * as schema from "../../../src/lib/server/db/schema.js";

export class TestDatabase {
	private testDbPath: string;

	constructor(customPath?: string) {
		if (customPath) {
			this.testDbPath = customPath;
		} else {
			// Create unique test database file path
			this.testDbPath = `/tmp/teambeat-test-${Date.now()}-${uuid().slice(0, 8)}.db`;
		}
		console.log("Test database path:", this.testDbPath);
	}

	async setup() {
		try {
			// Set environment variable for both Drizzle and application
			process.env.DATABASE_URL = this.testDbPath;

			// Run actual Drizzle migrations using the CLI
			console.log("Running Drizzle migrations on test database...");
			execSync("npm run db:migrate:sqlite", {
				stdio: "inherit",
				env: {
					...process.env,
					DATABASE_URL: this.testDbPath,
				},
			});

			console.log("✓ Applied Drizzle migrations to test database");

			// Verify schema was applied correctly
			await this.verifySchema();
		} catch (error) {
			console.error("Failed to setup test database:", error);
			throw error instanceof Error ? error : new Error(String(error));
		}
	}

	private async verifySchema() {
		try {
			// Import the application's database instance (now using our test DB)
			const { db } = await import("../../../src/lib/server/db/index.js");

			// Check user count (should be 0 in fresh database)
			const userCountResult = db
				.select({ count: sql`count(*)` })
				.from(schema.users)
				.all();
			const userCount = userCountResult[0].count;
			console.log("  User count:", userCount, "(expected: 0)");

			// Check that user_authenticators table exists from migration 0003
			const authCountResult = db
				.select({ count: sql`count(*)` })
				.from(schema.userAuthenticators)
				.all();
			const authCount = authCountResult[0].count;
			console.log(
				"  user_authenticators count:",
				authCount,
				"(table exists: ✓)",
			);

			// Test other key tables exist
			db.select().from(schema.boardSeries).limit(0).all();
			db.select().from(schema.boards).limit(0).all();

			console.log("✓ Test database schema verified");
		} catch (error) {
			throw new Error(
				`Schema verification failed: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	async cleanup() {
		// For in-memory databases, no file cleanup needed
		if (this.testDbPath === ":memory:" || this.testDbPath.startsWith("file::memory:")) {
			console.log("✓ Test database cleaned up (in-memory, no files to remove)");
			return;
		}

		// Clean up test database file and related files (for file-based tests)
		const filesToClean = [
			this.testDbPath,
			this.testDbPath + "-shm",
			this.testDbPath + "-wal",
		];

		for (const file of filesToClean) {
			if (existsSync(file)) {
				try {
					unlinkSync(file);
				} catch {
					// Ignore cleanup errors
				}
			}
		}

		console.log("✓ Test database cleaned up");
	}

	// Test data factory methods

	/**
	 * Create a test user and return the database-generated ID.
	 * In the future, this will work with auto-generated IDs.
	 */
	async createTestUser(
		email: string = "test@example.com",
		password: string = "password123",
		name?: string,
	): Promise<string> {
		const { db } = await import("../../../src/lib/server/db/index.js");
		const { hashPassword } = await import(
			"../../../src/lib/server/auth/password.js"
		);

		// For now we still generate the ID, but this could be removed if schema changes to auto-generated IDs
		const userId = `usr_${uuid()}`;
		const passwordHash = hashPassword(password);

		const [user] = await db
			.insert(schema.users)
			.values({
				id: userId,
				email,
				name: name || email.split("@")[0],
				passwordHash,
			})
			.returning();

		return user.id;
	}

	/**
	 * Get a test user from the database by email.
	 * This allows us to retrieve user info without relying on in-memory caching.
	 */
	async getTestUserByEmail(email: string): Promise<{
		id: string;
		email: string;
		name: string;
		password?: string;
	} | null> {
		const { db } = await import("../../../src/lib/server/db/index.js");

		const [user] = await db
			.select()
			.from(schema.users)
			.where(eq(schema.users.email, email))
			.limit(1);

		if (!user) {
			return null;
		}

		return {
			id: user.id,
			email: user.email,
			name: user.name || "",
			// Note: we don't return the actual password hash, but tests can use known password
		};
	}

	/**
	 * Get a test user from the database by ID.
	 */
	async getTestUserById(
		id: string,
	): Promise<{ id: string; email: string; name: string } | null> {
		const { db } = await import("../../../src/lib/server/db/index.js");

		const [user] = await db
			.select()
			.from(schema.users)
			.where(eq(schema.users.id, id))
			.limit(1);

		if (!user) {
			return null;
		}

		return {
			id: user.id,
			email: user.email,
			name: user.name || "",
		};
	}

	async createTestSeries(
		name: string = "Test Series",
		createdByUserEmail?: string,
	): Promise<any> {
		const { db } = await import("../../../src/lib/server/db/index.js");
		const seriesId = `srs_${uuid()}`;
		const slug = `${name.toLowerCase().replace(/\s+/g, "-")}-${uuid().slice(0, 8)}`;

		const [series] = await db
			.insert(schema.boardSeries)
			.values({
				id: seriesId,
				name,
				slug,
				description: `Test series: ${name}`,
			})
			.returning();

		// If user email provided, look up their ID and add them as admin
		if (createdByUserEmail) {
			const user = await this.getTestUserByEmail(createdByUserEmail);
			if (!user) {
				throw new Error(
					`Cannot find user with email: ${createdByUserEmail}. Make sure to call createTestUser first.`,
				);
			}

			await db.insert(schema.seriesMembers).values({
				seriesId,
				userId: user.id,
				role: "admin",
			});
		}

		return series;
	}

	async createTestBoard(
		seriesId: string,
		name: string = "Test Board",
	): Promise<any> {
		const { db } = await import("../../../src/lib/server/db/index.js");
		const boardId = `brd_${uuid()}`;

		const [board] = await db
			.insert(schema.boards)
			.values({
				id: boardId,
				seriesId,
				name,
				status: "active",
				votingAllocation: 3,
				votingEnabled: true,
				blameFreeMode: false,
			})
			.returning();

		// Create default columns (use plain UUIDs to match API validation)
		const whatWentWellId = uuid();
		const whatCanImproveId = uuid();
		const actionItemsId = uuid();

		await db.insert(schema.columns).values([
			{
				id: whatWentWellId,
				boardId,
				title: "What Went Well",
				description: "Things that worked well",
				seq: 1,
				defaultAppearance: "shown",
			},
			{
				id: whatCanImproveId,
				boardId,
				title: "What Can We Improve",
				description: "Areas for improvement",
				seq: 2,
				defaultAppearance: "shown",
			},
			{
				id: actionItemsId,
				boardId,
				title: "Action Items",
				description: "Things to do",
				seq: 3,
				defaultAppearance: "shown",
			},
		]);

		// Create default scenes
		const brainstormSceneId = `scn_${uuid()}`;
		const reviewSceneId = `scn_${uuid()}`;

		await db.insert(schema.scenes).values([
			{
				id: brainstormSceneId,
				boardId,
				title: "Brainstorm",
				description: "Add cards and ideas",
				mode: "columns",
				seq: 1,
			},
			{
				id: reviewSceneId,
				boardId,
				title: "Review & Vote",
				description: "Review cards and vote",
				mode: "columns",
				seq: 2,
			},
		]);

		// Add scene flags for Brainstorm
		await db.insert(schema.sceneFlags).values([
			{ sceneId: brainstormSceneId, flag: "allow_add_cards" },
			{ sceneId: brainstormSceneId, flag: "allow_edit_cards" },
			{ sceneId: brainstormSceneId, flag: "allow_move_cards" },
			{ sceneId: brainstormSceneId, flag: "show_comments" },
			{ sceneId: brainstormSceneId, flag: "allow_comments" },
		]);

		// Add scene flags for Review & Vote
		await db.insert(schema.sceneFlags).values([
			{ sceneId: reviewSceneId, flag: "allow_group_cards" },
			{ sceneId: reviewSceneId, flag: "show_votes" },
			{ sceneId: reviewSceneId, flag: "allow_voting" },
			{ sceneId: reviewSceneId, flag: "show_comments" },
			{ sceneId: reviewSceneId, flag: "allow_comments" },
		]);

		// Link scenes to columns
		for (const columnId of [whatWentWellId, whatCanImproveId, actionItemsId]) {
			await db.insert(schema.scenesColumns).values([
				{ sceneId: brainstormSceneId, columnId, state: "visible" },
				{ sceneId: reviewSceneId, columnId, state: "visible" },
			]);
		}

		// Set current scene
		await db
			.update(schema.boards)
			.set({ currentSceneId: brainstormSceneId })
			.where(eq(schema.boards.id, boardId));

		return {
			...board,
			currentSceneId: brainstormSceneId,
			columns: [
				{ id: whatWentWellId, title: "What Went Well", seq: 1 },
				{ id: whatCanImproveId, title: "What Can We Improve", seq: 2 },
				{ id: actionItemsId, title: "Action Items", seq: 3 },
			],
			scenes: [
				{ id: brainstormSceneId, title: "Brainstorm", seq: 1 },
				{ id: reviewSceneId, title: "Review & Vote", seq: 2 },
			],
		};
	}

	async addUserToSeries(
		userEmail: string,
		seriesId: string,
		role: "admin" | "facilitator" | "member" = "member",
	): Promise<void> {
		const user = await this.getTestUserByEmail(userEmail);
		if (!user) {
			throw new Error(
				`Cannot find user with email: ${userEmail}. Make sure to call createTestUser first.`,
			);
		}

		const { db } = await import("../../../src/lib/server/db/index.js");
		await db.insert(schema.seriesMembers).values({
			userId: user.id,
			seriesId,
			role,
		});
	}

	async clearAllData() {
		const { db } = await import("../../../src/lib/server/db/index.js");

		// Delete in reverse order to respect foreign key constraints
		await db.delete(schema.votes);
		await db.delete(schema.comments);
		await db.delete(schema.cards);
		await db.delete(schema.scenesColumns);
		await db.delete(schema.scenes);
		await db.delete(schema.columns);
		await db.delete(schema.boards);
		await db.delete(schema.seriesMembers);
		await db.delete(schema.boardSeries);
		await db.delete(schema.userAuthenticators);
		await db.delete(schema.users);

		console.log("✓ Cleared all test data");
	}

	// Complete test scenario setup
	async setupBasicScenario() {
		// Create test users
		await this.createTestUser(
			"facilitator@test.com",
			"password123",
			"Test Facilitator",
		);
		await this.createTestUser(
			"participant1@test.com",
			"password123",
			"Participant One",
		);
		await this.createTestUser(
			"participant2@test.com",
			"password123",
			"Participant Two",
		);

		// Get user data from database
		const facilitator = await this.getTestUserByEmail("facilitator@test.com");
		const participant1 = await this.getTestUserByEmail("participant1@test.com");
		const participant2 = await this.getTestUserByEmail("participant2@test.com");

		if (!facilitator || !participant1 || !participant2) {
			throw new Error("Failed to create or retrieve test users");
		}

		// Add known passwords for test login
		facilitator.password = "password123";
		participant1.password = "password123";
		participant2.password = "password123";

		// Create series and board
		const series = await this.createTestSeries(
			"Retro Series",
			"facilitator@test.com",
		);
		const board = await this.createTestBoard(series.id, "Sprint 1 Retro");

		// Add users to series
		await this.addUserToSeries(
			"facilitator@test.com",
			series.id,
			"facilitator",
		);
		await this.addUserToSeries("participant1@test.com", series.id, "member");
		await this.addUserToSeries("participant2@test.com", series.id, "member");

		return {
			users: { facilitator, participant1, participant2 },
			series,
			board,
		};
	}
}

// Global test database instance
let globalTestDb: TestDatabase | null = null;

export function getTestDb(): TestDatabase {
	if (!globalTestDb) {
		globalTestDb = new TestDatabase();
	}
	return globalTestDb;
}

export async function setupTestDb(): Promise<TestDatabase> {
	const testDb = getTestDb();
	await testDb.setup();
	return testDb;
}

export async function cleanupTestDb(): Promise<void> {
	if (globalTestDb) {
		await globalTestDb.cleanup();
		globalTestDb = null;
	}
}
