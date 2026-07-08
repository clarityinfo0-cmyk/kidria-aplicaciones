import fs from 'fs';
import path from 'path';

// This script creates an ESM wrapper at dist/server.js which re-exports the
// CommonJS bundle dist/server.cjs produced by esbuild. This allows runtime
// imports like `import server from '/var/task/server'` to resolve correctly.

const outDir = path.join(process.cwd(), 'dist');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const wrapperContent = `import { createRequire } from "module";
const require = createRequire(import.meta.url);
const srv = require('./server.cjs');
export default (srv && srv.default) ? srv.default : srv;
`;

fs.writeFileSync(path.join(outDir, 'server.js'), wrapperContent, 'utf8');
console.log('✓ dist/server.js wrapper written');
