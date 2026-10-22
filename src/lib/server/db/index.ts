import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import '../load-env';
import * as schema from './schema';

type Database = ReturnType<typeof drizzle<typeof schema>>;

const globalDb = globalThis as unknown as { __retroDb?: Database; __retroSql?: ReturnType<typeof postgres> };

export function getDb(): Database {
	if (!globalDb.__retroDb) {
		const url = process.env.DATABASE_URL;
		if (!url) throw new Error('DATABASE_URL is not set');
		const sql = postgres(url, { max: 10 });
		globalDb.__retroSql = sql;
		globalDb.__retroDb = drizzle(sql, { schema });
	}
	return globalDb.__retroDb;
}
