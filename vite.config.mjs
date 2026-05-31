import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';

const repoRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: resolve(repoRoot, 'desktop'),
  base: './',
  resolve: {
    alias: {
      '@ps01': resolve(repoRoot, 'proof-slices/ps01'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 1420,
    strictPort: true,
    fs: {
      allow: [repoRoot],
    },
  },
  build: {
    outDir: resolve(repoRoot, 'desktop/dist'),
    emptyOutDir: true,
  },
});