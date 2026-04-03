import { resolve } from 'path';
import { defineConfig } from 'vite';

// Setting root to src/pages so HTML files build to dist/ root (not dist/src/pages/).
// outDir must be absolute when root is overridden, or it resolves relative to root.
const projectRoot = resolve(__dirname);
const pagesDir    = resolve(projectRoot, 'src/pages');
const distDir     = resolve(projectRoot, 'dist');

export default defineConfig({
  // Root = where the HTML files live — Vite/Rollup uses this as the base path
  // for HTML entry points, so they output to dist/chat.html, not dist/src/pages/chat.html.
  root: pagesDir,

  build: {
    outDir:      distDir,   // absolute path — always resolves to apps/support/dist/
    emptyOutDir: true,
    rollupOptions: {
      input: {
        chat:    resolve(pagesDir, 'chat.html'),
        control: resolve(pagesDir, 'control.html'),
      },
    },
  },

  // ---------------------------------------------------------------------------
  // Env vars (VITE_* auto-exposed)
  // envDir must point to project root so .env is found next to vite.config.ts
  // ---------------------------------------------------------------------------
  envDir: projectRoot,

  // ---------------------------------------------------------------------------
  // Dev server
  // ---------------------------------------------------------------------------
  server: {
    port: 5173,
    open: '/chat.html',
  },

  // ---------------------------------------------------------------------------
  // Resolve aliases
  // ---------------------------------------------------------------------------
  resolve: {
    alias: {
      '@':         resolve(projectRoot, 'src'),
      '@types':    resolve(projectRoot, 'src/types'),
      '@services': resolve(projectRoot, 'src/services'),
    },
  },
});
