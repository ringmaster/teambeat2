import { db } from './index.js';
import * as schema from './schema.js';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';

// Detect database type from environment
const DATABASE_URL = process.env.DATABASE_URL || './teambeat.db';
const isPostgres = DATABASE_URL.startsWith('postgres://') || DATABASE_URL.startsWith('postgresql://');

export type DatabaseType = 'postgresql' | 'sqlite';

export interface DatabaseInfo {
  type: DatabaseType;
  version: string;
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string | null;
  isPrimaryKey: boolean;
}

export interface IndexInfo {
  name: string;
  columns: string[];
  unique: boolean;
}

export interface TableInfo {
  name: string;
  columns: ColumnInfo[];
  indexes: IndexInfo[];
}

export interface SchemaIssue {
  severity: 'error' | 'warning';
  table: string;
  column?: string;
  index?: string;
  issue: string;
  expected?: string;
  actual?: string;
}

export interface TableSummary {
  name: string;
  columnCount: number;
  indexCount: number;
}

export interface SchemaCheckResult {
  database: DatabaseInfo;
  conformant: boolean;
  issues: SchemaIssue[];
  tables: {
    expected: TableSummary[];
    actual: TableSummary[];
    missing: string[];
    extra: string[];
  };
}

/**
 * Get database type and version information
 */
export async function getDatabaseInfo(): Promise<DatabaseInfo> {
  if (isPostgres) {
    const pgDb = db as PostgresJsDatabase<typeof schema>;
    const result: any = await pgDb.execute(sql`SELECT version()`);
    // Drizzle execute returns an array directly for postgres-js
    const versionString = (result[0]?.version || result.rows?.[0]?.version) || 'unknown';
    // Extract just the version number (e.g., "PostgreSQL 16.1" -> "16.1")
    const match = versionString.match(/PostgreSQL ([\d.]+)/);
    const version = match ? match[1] : versionString;

    return {
      type: 'postgresql',
      version
    };
  } else {
    const sqliteDb = db as BetterSQLite3Database<typeof schema>;
    const result = await sqliteDb.all<{ sqlite_version: string }>(sql`SELECT sqlite_version() as sqlite_version`);
    return {
      type: 'sqlite',
      version: result[0]?.sqlite_version || 'unknown'
    };
  }
}

/**
 * Introspect PostgreSQL schema
 */
async function introspectPostgres(): Promise<TableInfo[]> {
  const pgDb = db as PostgresJsDatabase<typeof schema>;

  // Get all tables in public schema
  const tablesResult: any = await pgDb.execute(sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  const tables: TableInfo[] = [];
  const tableRows = tablesResult.rows || tablesResult;

  for (const tableRow of tableRows) {
    const tableName = tableRow.table_name;

    // Get columns for this table
    const columnsResult: any = await pgDb.execute(sql`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ${tableName}
      ORDER BY ordinal_position
    `);

    // Get primary key columns
    const pkResult: any = await pgDb.execute(sql`
      SELECT c.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage AS ccu USING (constraint_schema, constraint_name)
      JOIN information_schema.columns AS c ON c.table_schema = tc.constraint_schema
        AND tc.table_name = c.table_name AND ccu.column_name = c.column_name
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_name = ${tableName}
        AND tc.table_schema = 'public'
    `);

    const pkRows = pkResult.rows || pkResult;
    const pkColumns = new Set(pkRows.map((row: any) => row.column_name));

    const columnRows = columnsResult.rows || columnsResult;
    const columns: ColumnInfo[] = columnRows.map((col: any) => ({
      name: col.column_name,
      type: col.data_type,
      nullable: col.is_nullable === 'YES',
      defaultValue: col.column_default,
      isPrimaryKey: pkColumns.has(col.column_name)
    }));

    // Get indexes for this table
    const indexResult: any = await pgDb.execute(sql`
      SELECT
        i.relname as index_name,
        array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) as column_names,
        ix.indisunique as is_unique
      FROM pg_class t
      JOIN pg_index ix ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
      WHERE t.relname = ${tableName}
        AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
        AND NOT ix.indisprimary
      GROUP BY i.relname, ix.indisunique
      ORDER BY i.relname
    `);

    const indexRows = indexResult.rows || indexResult;
    const indexes: IndexInfo[] = indexRows.map((idx: any) => ({
      name: idx.index_name,
      columns: idx.column_names,
      unique: idx.is_unique
    }));

    tables.push({
      name: tableName,
      columns,
      indexes
    });
  }

  return tables;
}

/**
 * Introspect SQLite schema
 */
async function introspectSqlite(): Promise<TableInfo[]> {
  const sqliteDb = db as BetterSQLite3Database<typeof schema>;

  // Get all tables
  const tablesResult = await sqliteDb.all<{ name: string }>(sql`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
      AND name NOT LIKE '__drizzle_%'
    ORDER BY name
  `);

  const tables: TableInfo[] = [];

  for (const tableRow of tablesResult) {
    const tableName = tableRow.name;

    // Get table info
    const columnsResult = await sqliteDb.all<{
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
      pk: number;
    }>(sql.raw(`PRAGMA table_info(${tableName})`));

    const columns: ColumnInfo[] = columnsResult.map(col => ({
      name: col.name,
      type: col.type.toLowerCase(),
      nullable: col.notnull === 0,
      defaultValue: col.dflt_value,
      isPrimaryKey: col.pk > 0
    }));

    // Get indexes for this table
    const indexListResult = await sqliteDb.all<{ name: string }>(
      sql.raw(`PRAGMA index_list(${tableName})`)
    );

    const indexes: IndexInfo[] = [];
    for (const indexRow of indexListResult) {
      const indexName = indexRow.name;

      // Skip auto-created indexes (like those for unique constraints)
      if (indexName.startsWith('sqlite_autoindex_')) continue;

      const indexInfoResult = await sqliteDb.all<{ name: string }>(
        sql.raw(`PRAGMA index_info(${indexName})`)
      );

      // Check if index is unique
      const indexDetailsResult = await sqliteDb.all<{ unique: number }>(
        sql.raw(`PRAGMA index_list(${tableName})`)
      );
      const indexDetails = indexDetailsResult.find((idx: any) => idx.name === indexName);
      const isUnique = indexDetails ? (indexDetails as any).unique === 1 : false;

      indexes.push({
        name: indexName,
        columns: indexInfoResult.map(info => info.name),
        unique: isUnique
      });
    }

    tables.push({
      name: tableName,
      columns,
      indexes
    });
  }

  return tables;
}

/**
 * Get actual database schema
 */
export async function introspectDatabase(): Promise<TableInfo[]> {
  return isPostgres ? await introspectPostgres() : await introspectSqlite();
}

/**
 * Get expected schema from Drizzle definitions
 */
export function getExpectedSchema(): { name: string; tableName: string }[] {
  const tables: { name: string; tableName: string }[] = [];

  for (const [exportName, table] of Object.entries(schema)) {
    // Skip non-table exports
    if (!table || typeof table !== 'object') continue;

    const tableAny = table as any;

    // Try different ways to access the table name
    let tableName: string | undefined;

    // Check all Symbol properties for Drizzle metadata
    const symbols = Object.getOwnPropertySymbols(tableAny);
    for (const sym of symbols) {
      const symName = sym.toString();
      if (symName.includes('Name') || symName.includes('Table')) {
        const value = tableAny[sym];
        if (typeof value === 'string') {
          tableName = value;
          break;
        } else if (value?.name && typeof value.name === 'string') {
          tableName = value.name;
          break;
        }
      }
    }

    // Drizzle ORM table structure check
    if (!tableName && tableAny._ && typeof tableAny._ === 'object') {
      const tableConfig = tableAny._;
      if (tableConfig.name) {
        tableName = tableConfig.name;
      } else if (tableConfig.config?.name) {
        tableName = tableConfig.config.name;
      }
    }

    // Fallback checks
    if (!tableName && tableAny.dbName) {
      tableName = tableAny.dbName;
    }

    if (tableName) {
      tables.push({
        name: exportName,
        tableName
      });
    } else {
      // Debug log for exports that don't resolve to tables
      console.log(`Schema export "${exportName}" did not resolve to a table`);
    }
  }

  console.log(`Found ${tables.length} expected tables:`, tables.map(t => t.tableName));
  return tables;
}

/**
 * Normalize database type names for comparison
 */
function normalizeType(type: string, dbType: DatabaseType): string {
  type = type.toLowerCase();

  if (dbType === 'sqlite') {
    // SQLite uses simplified types
    if (type.includes('int')) return 'integer';
    if (type.includes('char') || type.includes('text')) return 'text';
    if (type.includes('real') || type.includes('float') || type.includes('double')) return 'real';
    if (type.includes('blob')) return 'blob';
    return type;
  } else {
    // PostgreSQL
    if (type === 'character varying') return 'text';
    if (type === 'bigint') return 'bigint';
    if (type === 'double precision') return 'real';
    return type;
  }
}

/**
 * Check if database schema conforms to code schema
 */
export async function checkSchemaConformance(): Promise<SchemaCheckResult> {
  const dbInfo = await getDatabaseInfo();
  const actualTables = await introspectDatabase();
  const expectedTables = getExpectedSchema();

  const actualTableNames = new Set(actualTables.map(t => t.name));
  const expectedTableNames = new Set(expectedTables.map(t => t.tableName));

  const missing = expectedTables
    .filter(t => !actualTableNames.has(t.tableName))
    .map(t => t.tableName);

  const extra = actualTables
    .filter(t => !expectedTableNames.has(t.name))
    .map(t => t.name);

  const issues: SchemaIssue[] = [];

  // Build expected table summaries with column counts
  const expectedTableSummaries: TableSummary[] = [];
  for (const expectedTable of expectedTables) {
    const schemaTable = (schema as any)[expectedTable.name];
    if (!schemaTable) continue;

    // Find the columns
    let expectedColumns: any = null;
    const symbols = Object.getOwnPropertySymbols(schemaTable);
    for (const sym of symbols) {
      const symName = sym.toString();
      if (symName.includes('Columns') || symName.includes('columns')) {
        expectedColumns = schemaTable[sym];
        break;
      }
    }

    if (!expectedColumns && schemaTable._) {
      if (schemaTable._.config?.columns) {
        expectedColumns = schemaTable._.config.columns;
      } else if (schemaTable._.columns) {
        expectedColumns = schemaTable._.columns;
      }
    }

    // Get expected indexes from Drizzle schema
    let expectedIndexes: IndexInfo[] = [];

    // Look for indexes in the ExtraConfigBuilder Symbol
    const tableSymbols = Object.getOwnPropertySymbols(schemaTable);

    for (const sym of tableSymbols) {
      const symName = sym.toString();
      if (symName.includes('ExtraConfigBuilder')) {
        const extraConfigBuilder = schemaTable[sym];

        // The ExtraConfigBuilder is a function - call it with the table to get the config
        if (typeof extraConfigBuilder === 'function') {
          try {
            const extraConfig = extraConfigBuilder(schemaTable);

            if (extraConfig && typeof extraConfig === 'object') {
              const entries = Object.entries(extraConfig);
              for (const [key, value] of entries) {
                const valueAny = value as any;

                // Check if this looks like an index definition
                if (valueAny && typeof valueAny === 'object' && valueAny.config) {
                  const config = valueAny.config;
                  if (config.name) {
                    const indexName = config.name;
                    const indexColumns = (config.columns || []).map((col: any) => {
                      const colSymbols = Object.getOwnPropertySymbols(col);
                      for (const colSym of colSymbols) {
                        if (colSym.toString().includes('Name')) {
                          return col[colSym];
                        }
                      }
                      return col.name || '';
                    }).filter(Boolean);

                    expectedIndexes.push({
                      name: indexName,
                      columns: indexColumns,
                      unique: config.unique || false
                    });
                  }
                }
              }
            }
          } catch (err) {
            // Ignore errors from calling the builder
            console.log(`Could not call ExtraConfigBuilder for ${expectedTable.tableName}:`, err);
          }
        }
      }
    }

    expectedTableSummaries.push({
      name: expectedTable.tableName,
      columnCount: expectedColumns ? Object.keys(expectedColumns).length : 0,
      indexCount: expectedIndexes.length
    });
  }

  // Build actual table summaries with column and index counts
  const actualTableSummaries: TableSummary[] = actualTables.map(t => ({
    name: t.name,
    columnCount: t.columns.length,
    indexCount: t.indexes.length
  }));

  // Check for missing tables
  for (const tableName of missing) {
    issues.push({
      severity: 'error',
      table: tableName,
      issue: 'Table is defined in code but missing from database'
    });
  }

  // Note extra tables as warnings (might be from migrations or other tools)
  for (const tableName of extra) {
    issues.push({
      severity: 'warning',
      table: tableName,
      issue: 'Table exists in database but not defined in code schema'
    });
  }

  // For tables that exist in both, check columns
  for (const actualTable of actualTables) {
    if (!expectedTableNames.has(actualTable.name)) continue;

    const expectedTable = expectedTables.find(t => t.tableName === actualTable.name);
    if (!expectedTable) continue;

    // Get the schema definition
    const schemaTable = (schema as any)[expectedTable.name];
    if (!schemaTable) continue;

    // Find the columns - try different ways to access them
    let expectedColumns: any = null;

    // Try the Symbol-based approach
    const symbols = Object.getOwnPropertySymbols(schemaTable);
    for (const sym of symbols) {
      const symName = sym.toString();
      if (symName.includes('Columns') || symName.includes('columns')) {
        expectedColumns = schemaTable[sym];
        break;
      }
    }

    // Try underscore property if Symbol approach didn't work
    if (!expectedColumns && schemaTable._) {
      if (schemaTable._.config?.columns) {
        expectedColumns = schemaTable._.config.columns;
      } else if (schemaTable._.columns) {
        expectedColumns = schemaTable._.columns;
      }
    }

    // If we still can't find columns, skip this table
    if (!expectedColumns) {
      console.log(`Could not find columns for table ${actualTable.name}`);
      continue;
    }

    const actualColumnNames = new Set(actualTable.columns.map(c => c.name));

    // Extract actual database column names from Drizzle column definitions
    const expectedDbColumnNames = new Set<string>();
    for (const [jsPropertyName, colDef] of Object.entries(expectedColumns)) {
      // Try to get the database column name from the column definition
      const colDefAny = colDef as any;

      // Drizzle stores the column name in various places depending on the version
      let dbColumnName: string | undefined;

      // Try Symbol properties first
      const symbols = Object.getOwnPropertySymbols(colDefAny);
      for (const sym of symbols) {
        const symName = sym.toString();
        if (symName.includes('Name') || symName.includes('name')) {
          const value = colDefAny[sym];
          if (typeof value === 'string') {
            dbColumnName = value;
            break;
          }
        }
      }

      // Try common property paths
      if (!dbColumnName) {
        dbColumnName = colDefAny.name || colDefAny.columnName || colDefAny.config?.name;
      }

      // Fallback to JS property name if we can't find the DB column name
      if (!dbColumnName) {
        dbColumnName = jsPropertyName;
      }

      expectedDbColumnNames.add(dbColumnName);
    }

    // Debug logging
    console.log(`Table ${actualTable.name}:`);
    console.log(`  Expected columns:`, Array.from(expectedDbColumnNames).sort());
    console.log(`  Actual columns:`, Array.from(actualColumnNames).sort());

    // Check for columns in schema but missing in DB
    for (const dbColumnName of expectedDbColumnNames) {
      if (!actualColumnNames.has(dbColumnName)) {
        issues.push({
          severity: 'error',
          table: actualTable.name,
          column: dbColumnName,
          issue: 'Column is defined in code but missing from database table'
        });
      }
    }

    // Get expected indexes for this table
    const expectedTableDef = expectedTables.find(t => t.tableName === actualTable.name);
    if (expectedTableDef) {
      const schemaTable = (schema as any)[expectedTableDef.name];
      let expectedIndexes: IndexInfo[] = [];

      // Look for indexes in the ExtraConfigBuilder Symbol
      const symbols = Object.getOwnPropertySymbols(schemaTable);

      for (const sym of symbols) {
        const symName = sym.toString();
        if (symName.includes('ExtraConfigBuilder')) {
          const extraConfigBuilder = schemaTable[sym];

          if (typeof extraConfigBuilder === 'function') {
            try {
              const extraConfig = extraConfigBuilder(schemaTable);

              if (extraConfig && typeof extraConfig === 'object') {
                const entries = Object.entries(extraConfig);
                for (const [key, value] of entries) {
                  const valueAny = value as any;

                  if (valueAny && typeof valueAny === 'object' && valueAny.config) {
                    const config = valueAny.config;
                    if (config.name) {
                      const indexName = config.name;
                      const indexColumns = (config.columns || []).map((col: any) => {
                        const colSymbols = Object.getOwnPropertySymbols(col);
                        for (const colSym of colSymbols) {
                          if (colSym.toString().includes('Name')) {
                            return col[colSym];
                          }
                        }
                        return col.name || '';
                      }).filter(Boolean);

                      expectedIndexes.push({
                        name: indexName,
                        columns: indexColumns,
                        unique: config.unique || false
                      });
                    }
                  }
                }
              }
            } catch (err) {
              // Ignore errors from calling the builder
            }
          }
        }
      }

      // Compare indexes
      const actualIndexNames = new Set(actualTable.indexes.map(idx => idx.name));
      const expectedIndexNames = new Set(expectedIndexes.map(idx => idx.name));

      console.log(`  Expected indexes:`, Array.from(expectedIndexNames).sort());
      console.log(`  Actual indexes:`, Array.from(actualIndexNames).sort());

      // Check for missing indexes
      for (const expectedIndex of expectedIndexes) {
        if (!actualIndexNames.has(expectedIndex.name)) {
          issues.push({
            severity: 'warning',
            table: actualTable.name,
            index: expectedIndex.name,
            issue: 'Index is defined in code but missing from database table',
            expected: `Index on columns: ${expectedIndex.columns.join(', ')}`
          });
        }
      }

      // Check for extra indexes (less critical, so just info)
      for (const actualIndex of actualTable.indexes) {
        if (!expectedIndexNames.has(actualIndex.name)) {
          issues.push({
            severity: 'warning',
            table: actualTable.name,
            index: actualIndex.name,
            issue: 'Index exists in database but not defined in code schema',
            actual: `Index on columns: ${actualIndex.columns.join(', ')}`
          });
        }
      }
    }
  }

  return {
    database: dbInfo,
    conformant: issues.filter(i => i.severity === 'error').length === 0,
    issues,
    tables: {
      expected: expectedTableSummaries.sort((a, b) => a.name.localeCompare(b.name)),
      actual: actualTableSummaries.sort((a, b) => a.name.localeCompare(b.name)),
      missing,
      extra
    }
  };
}
