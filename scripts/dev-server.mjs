import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

// Live UI Editor may launch the project as:
// npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
// This file ignores all CLI arguments and starts Vite programmatically,
// so duplicated/rewritten args from the extension cannot break Vite.
// Vite expects configFile to be a path string or false; never pass true.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const viteConfigPath = path.join(projectRoot, 'vite.config.js');

const host = '127.0.0.1';
const port = 5173;

try {
  const server = await createServer({
    root: projectRoot,
    configFile: viteConfigPath,
    server: {
      host,
      port,
      strictPort: true,
    },
  });

  await server.listen();
  server.printUrls();

  const shutdown = async () => {
    try {
      await server.close();
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Keep the process alive when launched by VS Code / Live UI Editor.
  process.stdin.resume();
} catch (error) {
  console.error('[dev-server] Failed to start Vite for Live UI Editor.');
  console.error(error?.stack || error?.message || error);
  process.exit(1);
}
