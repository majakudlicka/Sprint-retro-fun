import { existsSync, readFileSync } from 'node:fs';

let loaded = false;

/** Fill any unset variables from a local .env file. Existing process env wins. */
export function loadLocalEnv() {
	if (loaded) return;
	loaded = true;
	if (!existsSync('.env')) return;
	for (const line of readFileSync('.env', 'utf8').split('\n')) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const eq = trimmed.indexOf('=');
		if (eq <= 0) continue;
		const key = trimmed.slice(0, eq).trim();
		if (!/^[A-Z0-9_]+$/.test(key)) continue;
		if (process.env[key]) continue;
		let value = trimmed.slice(eq + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		process.env[key] = value;
	}
}

loadLocalEnv();
