// backend/src/db/schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const players = sqliteTable('players', {
    id: text('id').primaryKey(), // Discord ID
    username: text('username').notNull(),
    standoffId: text('standoff_id'),
    mmr: integer('mmr').default(1000),
    isVerified: integer('is_verified', { mode: 'boolean' }).default(false),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});