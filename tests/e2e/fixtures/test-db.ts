import { v4 as uuid } from 'uuid';
import bcrypt from 'bcryptjs';
import { eq, and, sql } from 'drizzle-orm';
import { existsSync, unlinkSync } from 'fs';
import { execSync } from 'child_process';
import * as schema from '../../../src/lib/server/db/schema.js';

export class TestDatabase {
  private testDbPath: string;

  constructor(customPath?: string) {
    if (customPath) {
      this.testDbPath = customPath;
    } else {
      // Create unique test database file path
      this.testDbPath = `/tmp/teambeat-test-${Date.now()}-${uuid().slice(0, 8)}.db`;
    }
    console.log('Test database path:', this.testDbPath);
  }

  async setup() {
    try {
      // Set environment variable for both Drizzle and application
      process.env.DATABASE_URL = this.testDbPath;

      // Run actual Drizzle migrations using the CLI
      console.log('Running Drizzle migrations on test database...');
      execSync('npm run db:migrate', {
        stdio: 'inherit',
        env: {
          ...process.env,
          DATABASE_URL: this.testDbPath
        }
      });

      console.log('✓ Applied Drizzle migrations to test database');

      // Verify schema was applied correctly
      await this.verifySchema();

    } catch (error) {
      console.error('Failed to setup test database:', error);
      throw error;
    }
  }

  private async verifySchema() {
    try {
      // Import the application's database instance (now using our test DB)
      const { db } = await import('../../../src/lib/server/db/index.js');

      // Check user count (should be 0 in fresh database)
      const userCountResult = db.select({ count: sql`count(*)` }).from(schema.users).all();
      const userCount = userCountResult[0].count;
      console.log('  User count:', userCount, '(expected: 0)');

      // Check that user_authenticators table exists from migration 0003
      const authCountResult = db.select({ count: sql`count(*)` }).from(schema.userAuthenticators).all();
      const authCount = authCountResult[0].count;
      console.log('  user_authenticators count:', authCount, '(table exists: ✓)');

      // Test other key tables exist
      db.select().from(schema.boardSeries).limit(0).all();
      db.select().from(schema.boards).limit(0).all();

      console.log('✓ Test database schema verified');
    } catch (error) {
      throw new Error(`Schema verification failed: ${error.message}`);
    }
  }

  async cleanup() {
    // Clean up test database file and related files
    const filesToClean = [
      this.testDbPath,
      this.testDbPath + '-shm',
      this.testDbPath + '-wal'
    ];

    for (const file of filesToClean) {
      if (existsSync(file)) {
        try {
          unlinkSync(file);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    }

    // Clear environment variable
    delete process.env.DATABASE_URL;

    console.log('✓ Test database cleaned up');
  }

  // Test data factory methods
  async createTestUser(email: string = 'test@example.com', password: string = 'password123', name?: string) {
    const { db } = await import('../../../src/lib/server/db/index.js');
    const { hashPassword } = await import('../../../src/lib/server/auth/password.js');
    const userId = `usr_${uuid()}`;
    const passwordHash = hashPassword(password);

    const [user] = await db.insert(schema.users).values({
      id: userId,
      email,
      name: name || email.split('@')[0],
      passwordHash
    }).returning();

    return { ...user, password }; // Return password for test login
  }

  async createTestSeries(name: string = 'Test Series', createdByUserId?: string) {
    const { db } = await import('../../../src/lib/server/db/index.js');
    const seriesId = `srs_${uuid()}`;
    const slug = `${name.toLowerCase().replace(/\s+/g, '-')}-${uuid().slice(0, 8)}`;

    const [series] = await db.insert(schema.boardSeries).values({
      id: seriesId,
      name,
      slug,
      description: `Test series: ${name}`
    }).returning();

    // If user provided, add them as admin
    if (createdByUserId) {
      await db.insert(schema.seriesMembers).values({
        seriesId,
        userId: createdByUserId,
        role: 'admin'
      });
    }

    return series;
  }

  async createTestBoard(seriesId: string, name: string = 'Test Board') {
    const { db } = await import('../../../src/lib/server/db/index.js');
    const boardId = `brd_${uuid()}`;

    const [board] = await db.insert(schema.boards).values({
      id: boardId,
      seriesId,
      name,
      status: 'active',
      votingAllocation: 3,
      votingEnabled: true,
      blameFreeMode: false
    }).returning();

    // Create default columns
    const whatWentWellId = `col_${uuid()}`;
    const whatCanImproveId = `col_${uuid()}`;
    const actionItemsId = `col_${uuid()}`;

    await db.insert(schema.columns).values([
      {
        id: whatWentWellId,
        boardId,
        title: 'What Went Well',
        description: 'Things that worked well',
        seq: 1,
        defaultAppearance: 'shown'
      },
      {
        id: whatCanImproveId,
        boardId,
        title: 'What Can We Improve',
        description: 'Areas for improvement',
        seq: 2,
        defaultAppearance: 'shown'
      },
      {
        id: actionItemsId,
        boardId,
        title: 'Action Items',
        description: 'Things to do',
        seq: 3,
        defaultAppearance: 'shown'
      }
    ]);

    // Create default scenes
    const brainstormSceneId = `scn_${uuid()}`;
    const reviewSceneId = `scn_${uuid()}`;

    await db.insert(schema.scenes).values([
      {
        id: brainstormSceneId,
        boardId,
        title: 'Brainstorm',
        description: 'Add cards and ideas',
        mode: 'columns',
        seq: 1,
        allowAddCards: true,
        allowEditCards: true,
        allowObscureCards: false,
        allowMoveCards: true,
        allowGroupCards: false,
        showVotes: false,
        allowVoting: false,
        showComments: true,
        allowComments: true
      },
      {
        id: reviewSceneId,
        boardId,
        title: 'Review & Vote',
        description: 'Review cards and vote',
        mode: 'columns',
        seq: 2,
        allowAddCards: false,
        allowEditCards: false,
        allowObscureCards: false,
        allowMoveCards: false,
        allowGroupCards: true,
        showVotes: true,
        allowVoting: true,
        showComments: true,
        allowComments: true
      }
    ]);

    // Link scenes to columns
    for (const columnId of [whatWentWellId, whatCanImproveId, actionItemsId]) {
      await db.insert(schema.scenesColumns).values([
        { sceneId: brainstormSceneId, columnId, state: 'visible' },
        { sceneId: reviewSceneId, columnId, state: 'visible' }
      ]);
    }

    // Set current scene
    await db.update(schema.boards)
      .set({ currentSceneId: brainstormSceneId })
      .where(eq(schema.boards.id, boardId));

    return {
      ...board,
      currentSceneId: brainstormSceneId,
      columns: [
        { id: whatWentWellId, title: 'What Went Well', seq: 1 },
        { id: whatCanImproveId, title: 'What Can We Improve', seq: 2 },
        { id: actionItemsId, title: 'Action Items', seq: 3 }
      ],
      scenes: [
        { id: brainstormSceneId, title: 'Brainstorm', seq: 1 },
        { id: reviewSceneId, title: 'Review & Vote', seq: 2 }
      ]
    };
  }

  async addUserToSeries(userId: string, seriesId: string, role: 'admin' | 'facilitator' | 'member' = 'member') {
    const { db } = await import('../../../src/lib/server/db/index.js');
    await db.insert(schema.seriesMembers).values({
      userId,
      seriesId,
      role
    });
  }

  async clearAllData() {
    const { db } = await import('../../../src/lib/server/db/index.js');

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

    console.log('✓ Cleared all test data');
  }

  // Complete test scenario setup
  async setupBasicScenario() {
    // Use predefined test users (should already exist from global setup)
    const { getAllTestUsers } = await import('./auth-helpers.js');
    const testUsers = await getAllTestUsers();

    const facilitator = testUsers.facilitator;
    const participant1 = testUsers.participant1;
    const participant2 = testUsers.participant2;

    // Create series and board
    const series = await this.createTestSeries('Retro Series', facilitator.id);
    const board = await this.createTestBoard(series.id, 'Sprint 1 Retro');

    // Add users to series
    await this.addUserToSeries(facilitator.id, series.id, 'facilitator');
    await this.addUserToSeries(participant1.id, series.id, 'member');
    await this.addUserToSeries(participant2.id, series.id, 'member');

    return {
      users: { facilitator, participant1, participant2 },
      series,
      board
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
