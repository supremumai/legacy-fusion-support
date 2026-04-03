import { defineConfig } from 'vite';
import { resolve } from 'path';

// Project root = apps/support/ (directory this file lives in)
const projectRoot = resolve(__dirname);

export default defineConfig({
  // ---------------------------------------------------------------------------
  // Root — HTML entry files live in src/pages/
  // ---------------------------------------------------------------------------
  root:      resolve(projectRoot, 'src/pages'),
  publicDir: resolve(projectRoot, 'public'),

  // ---------------------------------------------------------------------------
  // Multi-page build
  // outDir is absolute so it always resolves to apps/support/dist/
  // regardless of the root override above.
  // ---------------------------------------------------------------------------
  build: {
    outDir:    resolve(projectRoot, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        chat:    resolve(projectRoot, 'src/pages/chat.html'),
        control: resolve(projectRoot, 'src/pages/control.html'),
      },
    },
  },

  // ---------------------------------------------------------------------------
  // Env vars (VITE_* prefix auto-exposed by Vite)
  // envDir points to project root so .env is found next to vite.config.ts
  // Required:
  //   VITE_SUPPORT_WORKER_URL   — Cloudflare Worker URL
  //   VITE_SUPABASE_URL         — Supabase project URL
  //   VITE_SUPABASE_ANON_KEY    — Supabase anon key
  //   VITE_DEMO_MODE            — "true" to skip live API calls
  //   VITE_AI_PROVIDER          — "openai" | "anthropic"
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
