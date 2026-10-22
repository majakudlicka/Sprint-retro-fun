import type { IncomingMessage, Server } from 'node:http';
import { getToken } from '@auth/core/jwt';
import './load-env';
import { WebSocketServer, type WebSocket } from 'ws';
import { requestOriginAllowed } from '../domain/origin';
import { ClientMessageSchema } from '../domain/schemas';
import { subscribe } from './hub';
import { buildRetroView } from './retro-view';

const ATTACHED = Symbol.for('sprint-retro-fun.sockets');

function secureCookie(req: IncomingMessage): boolean {
	const forwarded = req.headers['x-forwarded-proto'];
	if (forwarded === 'https') return true;
	const origin = req.headers.origin;
	return typeof origin === 'string' && origin.startsWith('https://');
}

async function userIdFrom(req: IncomingMessage): Promise<string | null> {
	const secret = process.env.AUTH_SECRET;
	if (!secret) return null;
	const headers = new Headers();
	if (typeof req.headers.cookie === 'string') headers.set('cookie', req.headers.cookie);
	const token = await getToken({
		req: { headers },
		secret,
		secureCookie: secureCookie(req)
	});
	if (!token || typeof token !== 'object' || !('userId' in token)) return null;
	return typeof token.userId === 'string' ? token.userId : null;
}

function send(ws: WebSocket, payload: unknown) {
	if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
}

export function attachRetroSockets(server: Server) {
	const g = globalThis as unknown as Record<symbol, boolean>;
	if (g[ATTACHED]) return;
	g[ATTACHED] = true;

	const wss = new WebSocketServer({ noServer: true });
	const connections = new Map<string, number>();

	server.on('upgrade', async (req, socket, head) => {
		try {
			const host = req.headers.host ?? 'localhost';
			const url = new URL(req.url ?? '/', `http://${host}`);
			if (url.pathname !== '/ws') return;

			const origin = typeof req.headers.origin === 'string' ? req.headers.origin : null;
			if (!requestOriginAllowed(origin, req.headers.host, process.env.ORIGIN)) {
				socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
				socket.destroy();
				return;
			}
			const userId = await userIdFrom(req);
			if (!userId) {
				socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
				socket.destroy();
				return;
			}
			const open = connections.get(userId) ?? 0;
			if (open >= 8) {
				socket.write('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n');
				socket.destroy();
				return;
			}
			connections.set(userId, open + 1);
			wss.handleUpgrade(req, socket, head, (ws) => {
				ws.once('close', () => {
					const next = (connections.get(userId) ?? 1) - 1;
					if (next <= 0) connections.delete(userId);
					else connections.set(userId, next);
				});
				bindSocket(ws, userId);
			});
		} catch {
			console.error('websocket upgrade failed');
			socket.destroy();
		}
	});
}

function bindSocket(ws: WebSocket, userId: string) {
	let unsubscribe: (() => void) | null = null;
	let currentRetro: string | null = null;

	const push = async (retroId: string) => {
		const view = await buildRetroView(retroId, userId);
		if (!view) {
			send(ws, { type: 'error', message: 'Not found' });
			unsubscribe?.();
			unsubscribe = null;
			currentRetro = null;
			return;
		}
		send(ws, { type: 'state', retro: view });
	};

	ws.on('message', async (data, isBinary) => {
		if (isBinary) {
			send(ws, { type: 'error', message: 'Bad message' });
			return;
		}
		const text = data.toString();
		if (text.length > 2000) {
			send(ws, { type: 'error', message: 'Message too large' });
			return;
		}
		let json: unknown;
		try {
			json = JSON.parse(text);
		} catch {
			send(ws, { type: 'error', message: 'Bad message' });
			return;
		}
		const parsed = ClientMessageSchema.safeParse(json);
		if (!parsed.success) {
			send(ws, { type: 'error', message: 'Bad message' });
			return;
		}
		if (parsed.data.type === 'ping') {
			send(ws, { type: 'pong' });
			return;
		}
		const view = await buildRetroView(parsed.data.retroId, userId);
		if (!view) {
			send(ws, { type: 'error', message: 'Not found' });
			return;
		}
		unsubscribe?.();
		currentRetro = parsed.data.retroId;
		unsubscribe = subscribe(currentRetro, (id) => {
			void push(id);
		});
		send(ws, { type: 'state', retro: view });
	});

	ws.on('close', () => {
		unsubscribe?.();
	});

	ws.on('error', () => {
		unsubscribe?.();
	});
}
