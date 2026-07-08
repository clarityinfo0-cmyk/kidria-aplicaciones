import { createRequire } from 'module';

const require = createRequire(import.meta.url);

function tryRequire(paths: string[]) {
	for (const p of paths) {
		try {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			const mod = require(p);
			return mod && mod.default ? mod.default : mod;
		} catch (err) {
			// continue to next path
		}
	}
	throw new Error('Could not locate server module in any known path. Tried: ' + paths.join(', '));
}

const app = tryRequire([
	'../server',
	'../server.js',
	'../server.cjs',
	'../dist/server',
	'../dist/server.js',
	'../dist/server.cjs',
	'./server',
	'./server.js',
]);

export default app;
