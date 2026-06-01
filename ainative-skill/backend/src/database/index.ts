/**
 * Database layer
 * Exports repositories and database utilities
 */

export {
  // getPrismaClient, // Not exported from client.ts
  connectDatabase,
  disconnectDatabase,
  checkDatabaseConnection,
} from './client';

export * from './repositories';
