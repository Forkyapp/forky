import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

/**
 * SQLite database client for Timmy
 * Optimized for Raspberry Pi 5 - lightweight, crash-resistant, WAL mode
 */
export class SQLiteClient {
  private db: Database.Database;
  private dbPath: string;

  constructor(dbPath: string = 'data/timmy.db') {
    this.dbPath = dbPath;

    // Ensure data directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Open database connection
    this.db = new Database(dbPath);

    // Enable WAL mode for better concurrency and crash resistance
    this.enableWAL();

    // Optimize for Pi 5
    this.optimizeForPi();
  }

  /**
   * Enable Write-Ahead Logging (WAL) mode
   * Benefits:
   * - Better concurrency (readers don't block writers)
   * - Crash resistance (atomic commits)
   * - Faster writes
   */
  private enableWAL(): void {
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL'); // Faster, still safe with WAL
  }

  /**
   * Optimize database for Raspberry Pi 5
   */
  private optimizeForPi(): void {
    // Cache size: 8MB (Pi 5 has 8GB RAM, be conservative)
    this.db.pragma('cache_size = -8000');

    // Memory-mapped I/O: 64MB
    this.db.pragma('mmap_size = 67108864');

    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');

    // Auto-vacuum to prevent DB bloat
    this.db.pragma('auto_vacuum = INCREMENTAL');
  }

  /**
   * Initialize database schema
   */
  initSchema(): void {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    this.db.exec(schema);
  }

  /**
   * Get raw database instance for complex queries
   */
  getDB(): Database.Database {
    return this.db;
  }

  /**
   * Execute a transaction (atomic operation)
   */
  transaction<T>(fn: () => T): T {
    const tx = this.db.transaction(fn);
    return tx();
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }

  /**
   * Run VACUUM to optimize database file
   */
  vacuum(): void {
    this.db.exec('VACUUM');
  }

  /**
   * Get database statistics
   */
  getStats(): {
    size: number;
    pageCount: number;
    pageSize: number;
    walMode: boolean;
  } {
    const stats = this.db.pragma('page_count', { simple: true }) as number;
    const pageSize = this.db.pragma('page_size', { simple: true }) as number;
    const journalMode = this.db.pragma('journal_mode', { simple: true }) as string;

    return {
      size: fs.statSync(this.dbPath).size,
      pageCount: stats,
      pageSize: pageSize,
      walMode: journalMode === 'wal'
    };
  }
}

// Singleton instance
let instance: SQLiteClient | null = null;

/**
 * Get or create SQLite client instance
 */
export function getSQLiteClient(dbPath?: string): SQLiteClient {
  if (!instance) {
    instance = new SQLiteClient(dbPath);
    instance.initSchema();
  }
  return instance;
}

/**
 * Close SQLite connection
 */
export function closeSQLiteClient(): void {
  if (instance) {
    instance.close();
    instance = null;
  }
}
