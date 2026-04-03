import { resolve } from 'path';
import { defineConfig } from 'vite';

const projectRoot = resolve(__dirname);
const pagesDir    = resolve(projectRoot, 'src/pages');
const distDir     = resolve(projectRoot, 'dist');

export default defineConfig({
  // root = pagesDir: HTML entry points are relative to src/pages/
  // → chat.html outputs to dist/chat.html (not dist/src/pages/chat.html)
  root:   pagesDir,
  // envDir must be absolute project root so .env is found next to vite.config.ts
  envDir: projectRoot,

  build: {
    // Absolute outDir so it always resolves to apps/support/dist/
    // regardless of the root override
    outDir:      distDir,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        chat:    resolve(pagesDir, 'chat.html'),
        control: resolve(pagesDir, 'control.html'),
      },
    },
  },

  server: {
    port: 5173,
    open: '/chat.html',
  },

  resolve: {
    alias: {
      '@':         resolve(projectRoot, 'src'),
      '@types':    resolve(projectRoot, 'src/types'),
      '@services': resolve(projectRoot, 'src/services'),
    },
  },
});
