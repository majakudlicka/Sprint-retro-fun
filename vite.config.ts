import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin } from 'vite';

function retroSockets(): Plugin {
	return {
		name: 'retro-sockets',
		configureServer(server) {
			const httpServer = server.httpServer;
			if (!httpServer) return;
			const start = () => {
				void server
					.ssrLoadModule('/src/lib/server/socket.ts')
					.then((mod) => {
						mod.attachRetroSockets(httpServer);
					})
					.catch((error) => {
						console.error('WebSocket setup failed', error);
					});
			};
			if (httpServer.listening) start();
			else httpServer.once('listening', start);
		}
	};
}

export default defineConfig({
	plugins: [sveltekit(), retroSockets()]
});
