// backend/drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
    schema: './src/db/schema.ts',
    out: './migrations',
    dialect: 'sqlite', // D1 нь SQLite ашигладаг
    dbCredentials: {
        wranglerConfigPath: 'wrangler.jsonc',
        dbName: 'standoff-db',
    } as any,
});