import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const calendarConnections = sqliteTable('calendar_connections', {
  userId: text('user_id').primaryKey(), feedUrl: text('feed_url').notNull(), updatedAt: integer('updated_at').notNull(),
});
export const calendarCache = sqliteTable('calendar_cache', {
  userId: text('user_id').primaryKey(), events: text('events').notNull(), fetchedAt: integer('fetched_at').notNull(),
});
