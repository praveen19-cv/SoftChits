import Database from 'better-sqlite3';

const MAX_RETRIES = 3;
const INITIAL_DELAY = 100; // ms

export async function withRetry<T>(
  operation: () => T,
  maxRetries: number = MAX_RETRIES,
  initialDelay: number = INITIAL_DELAY
): Promise<T> {
  let lastError: Error | null = null;
  let delay = initialDelay;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return operation();
    } catch (error: any) {
      lastError = error;
      if (error.code === 'SQLITE_BUSY') {
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
        // Exponential backoff
        delay *= 2;
        continue;
      }
      // For other errors, throw immediately
      throw error;
    }
  }

  throw lastError || new Error('Operation failed after maximum retries');
}

export async function executeTransaction<T>(
  db: Database.Database,
  operation: () => T
): Promise<T> {
  return withRetry(() => {
    db.prepare('BEGIN').run();
    try {
      const result = operation();
      db.prepare('COMMIT').run();
      return result;
    } catch (error) {
      db.prepare('ROLLBACK').run();
      throw error;
    }
  });
} 