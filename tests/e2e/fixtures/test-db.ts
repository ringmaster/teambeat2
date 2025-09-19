import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../../../src/lib/server/db/schema.js';
import { v4 as uuid } from 'uuid';
import bcrypt from 'bcryptjs';
import { eq, and, sql } from 'drizzle-orm';
import { readFileSync, readdirSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';

export class TestDatabase {
  private db: any;
  private sqlite: Database.Database;
  private dbPath: string;

  constructor() {
    // Use the same test database file that the application will use
    this.dbPath = 'teambeat-test.db';

    // Clean up any existing test database
    if (existsSync(this.dbPath)) {
      unlinkSync(this.dbPath);
    }

    this.sqlite = new Database(this.dbPath);
    this.sqlite.pragma('journal_mode = WAL');
    this.db = drizzle(this.sqlite, { schema });
  }

  async setup() {
    try {
      // Use actual Drizzle migrations instead of manual schema creation
      await migrate(this.db, { migrationsFolder: './drizzle' });
      console.log('✓ Applied Drizzle migrations to test database');
    } catch (error) {
      // If migration fails, fall back to applying SQL files directly
      console.warn('Migration via Drizzle failed, applying SQL files directly:', error);
      this.applyMigrationsManually();
    }

    // Verify the schema was applied correctly
    this.verifySchema();
  }

  private applyMigrationsManually() {
    try {
      const migrationsDir = './drizzle';
      const migrationFiles = readdirSync(migrationsDir)
        .filter(file => file.endsWith('.sql'))
        .sort(); // Apply migrations in order

      if (migrationFiles.length === 0) {
        throw new Error(`No migration files found in ${migrationsDir}`);
      }

      for (const file of migrationFiles) {
        const migrationPath = join(migrationsDir, file);
        const migrationSQL = readFileSync(migrationPath, 'utf8');

        console.log(`✓ Applying migration: ${file}`);
        // Split on statement breakpoints and execute each statement separately
        const statements = migrationSQL.split('--> statement-breakpoint').filter(stmt => stmt.trim());

        for (const statement of statements) {
          const cleanStatement = statement.trim();
          if (cleanStatement) {
            this.sqlite.exec(cleanStatement);
          }
        }
      }
      console.log(`✓ Applied ${migrationFiles.length} migration files manually`);
    } catch (error) {
      console.error('Failed to apply migrations:', error);
      throw new Error(`Could not set up test database: ${error.message}`);
    }
  }

  // Verify that the schema was applied correctly
  private verifySchema() {
    try {
      // Test that key tables exist by running a simple query
      this.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
      this.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='board_series'").get();
      this.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='boards'").get();
      console.log('✓ Test database schema verified');
    } catch (error) {
      throw new Error(`Schema verification failed: ${error.message}`);
    }
  }

  async cleanup() {
    this.sqlite.close();

    // Clean up test database file
    if (existsSync(this.dbPath)) {
      try {
        unlinkSync(this.dbPath);
        console.log('✓ Test database file cleaned up');
      } catch (error) {
        console.warn(`Warning: Could not clean up test database file: ${error.message}`);
      }
    }
  }

  getDb() {
    return this.db;
  }

  // Test data factory methods
  async createTestUser(email: string = 'test@example.com', password: string = 'password123') {
    const userId = `usr_${uuid()}`;
    const passwordHash = await bcrypt.hash(password, 10);

    const [user] = await this.db.insert(schema.users).values({
      id: userId,
      email,
      name: email.split('@')[0],
      passwordHash
    }).returning();

    return { ...user, password }; // Return password for test login
  }

  async createTestSeries(name: string = 'Test Series', createdByUserId?: string) {
    const seriesId = `srs_${uuid()}`;
    const slug = `${name.toLowerCase().replace(/\s+/g, '-')}-${uuid().slice(0, 8)}`;

    const [series] = await this.db.insert(schema.boardSeries).values({
      id: seriesId,
      name,
      slug,
      description: `Test series: ${name}`
    }).returning();

    // If user provided, add them as admin
    if (createdByUserId) {
      await this.db.insert(schema.seriesMembers).values({
        seriesId,
        userId: createdByUserId,
        role: 'admin'
      });
    }

    return series;
  }

  async createTestBoard(seriesId: string, name: string = 'Test Board') {
    const boardId = `brd_${uuid()}`;

    const [board] = await this.db.insert(schema.boards).values({
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

    await this.db.insert(schema.columns).values([
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

    await this.db.insert(schema.scenes).values([
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
      await this.db.insert(schema.scenesColumns).values([
        { sceneId: brainstormSceneId, columnId, state: 'visible' },
        { sceneId: reviewSceneId, columnId, state: 'visible' }
      ]);
    }

    // Set current scene
    await this.db.update(schema.boards)
      .set({ currentSceneId: brainstormSceneId })
      .where({ id: boardId });

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

  async createTestCard(columnId: string, userId: string, content: string = 'Test card content') {
    const cardId = `crd_${uuid()}`;

    const [card] = await this.db.insert(schema.cards).values({
      id: cardId,
      columnId,
      userId,
      content
    }).returning();

    return card;
  }

  async addUserToSeries(userId: string, seriesId: string, role: 'admin' | 'facilitator' | 'member' = 'member') {
    await this.db.insert(schema.seriesMembers).values({
      userId,
      seriesId,
      role
    });
  }

  // Complete test scenario setup
  async setupBasicScenario() {
    // Create users
    const facilitator = await this.createTestUser('facilitator@test.com', 'password123');
    const participant1 = await this.createTestUser('participant1@test.com', 'password123');
    const participant2 = await this.createTestUser('participant2@test.com', 'password123');

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

  // Helper methods for test verification
  async getCardCount(columnId: string): Promise<number> {
    const result = await this.db
      .select({ count: sql`count(*)` })
      .from(schema.cards)
      .where(eq(schema.cards.columnId, columnId));
    return result[0].count;
  }

  async getVoteCount(cardId: string): Promise<number> {
    const result = await this.db
      .select({ count: sql`count(*)` })
      .from(schema.votes)
      .where(eq(schema.votes.cardId, cardId));
    return result[0].count;
  }

  async getUserVoteCount(userId: string, boardId: string): Promise<number> {
    const result = await this.db
      .select({ count: sql`count(*)` })
      .from(schema.votes)
      .innerJoin(schema.cards, eq(schema.votes.cardId, schema.cards.id))
      .innerJoin(schema.columns, eq(schema.cards.columnId, schema.columns.id))
      .where(and(
        eq(schema.votes.userId, userId),
        eq(schema.columns.boardId, boardId)
      ));
    return result[0].count;
  }
}

// Helper functions are now imported at the top

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
