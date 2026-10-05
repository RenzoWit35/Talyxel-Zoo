/** Starts the production server on a fresh, throwaway data directory for the browser tests. */
import { rmSync } from 'node:fs';

rmSync(process.env.DATA_DIR ?? '.e2e-data', { recursive: true, force: true });
await import('../server/index');
