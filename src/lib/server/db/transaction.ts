/**
 * Transaction abstraction for multi-database support
 *
 * Some database drivers don't support async transactions (e.g., better-sqlite3),
 * while others require them (e.g., postgres-js). This abstraction provides a
 * unified interface that works with all supported databases.
 */

import { db, dbSupportsAsyncTransactions } from './index.js';

/**
 * Execute a function within a transaction (if database supports async transactions)
 * or sequentially (for databases that don't support async transactions)
 *
 * @param fn - Function to execute. Receives db instance as parameter.
 * @returns Promise resolving to the function's return value
 *
 * @example
 * ```typescript
 * await withTransaction(async (tx) => {
 *   await tx.insert(boardSeries).values(series);
 *   await tx.insert(seriesMembers).values({ seriesId, userId, role: 'admin' });
 *   return series;
 * });
 * ```
 */
export async function withTransaction<T>(
  fn: (tx: typeof db) => Promise<T>
): Promise<T> {
  if (dbSupportsAsyncTransactions) {
    // Database supports async transactions - use them for ACID guarantees
    return await db.transaction(async (tx) => {
      return await fn(tx);
    });
  } else {
    // Database doesn't support async transactions
    // Execute directly without transaction wrapper
    // Foreign key constraints still provide data integrity
    return await fn(db);
  }
}

/**
 * Execute a batch of operations that should be atomic (when possible)
 *
 * For databases with async transaction support: Wraps in a transaction
 * For databases without: Executes sequentially (relies on foreign key constraints)
 *
 * @param operations - Array of async functions to execute
 * @returns Promise resolving when all operations complete
 *
 * @example
 * ```typescript
 * await withBatchOperations([
 *   async (tx) => tx.insert(table1).values(data1),
 *   async (tx) => tx.insert(table2).values(data2),
 *   async (tx) => tx.update(table3).set(data3).where(condition)
 * ]);
 * ```
 */
export async function withBatchOperations(
  operations: Array<(tx: typeof db) => Promise<any>>
): Promise<void> {
  await withTransaction(async (tx) => {
    for (const operation of operations) {
      await operation(tx);
    }
  });
}
