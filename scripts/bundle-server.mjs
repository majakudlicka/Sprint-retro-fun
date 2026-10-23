import { build } from 'esbuild';

await build({
	entryPoints: ['server-entry.ts'],
	bundle: true,
	platform: 'node',
	format: 'esm',
	outfile: 'build/retro-server.js',
	packages: 'external',
	plugins: [
		{
			name: 'external-handler',
			setup(build) {
				build.onResolve({ filter: /^\.\/handler\.js$/ }, (args) => ({
					path: args.path,
					external: true
				}));
			}
		}
	]
});
