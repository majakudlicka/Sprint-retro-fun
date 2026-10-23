import { createServer } from 'node:http';
import { attachRetroSockets } from './src/lib/server/socket.ts';
import { runMigrations } from './src/lib/server/migrate.ts';

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';

if (process.env.MIGRATE_ON_START === 'true') {
	await runMigrations();
}

const { handler } = await import('./handler.js');
const server = createServer((req, res) => {
	handler(req, res);
});

attachRetroSockets(server);
server.listen(port, host, () => {
	console.log(`Sprint retro fun listening on ${host}:${port}`);
});
