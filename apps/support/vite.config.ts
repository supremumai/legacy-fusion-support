import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // ---------------------------------------------------------------------------
  // Multi-page build
  // ---------------------------------------------------------------------------
  build: {
    rollupOptions: {
      input: {
        chat:    resolve(__dirname, 'src/pages/chat.html'),
        control: resolve(__dirname, 'src/pages/control.html'),
      },
    },
    outDir: 'dist',
    emptyOutDir: true,
  },

  // ---------------------------------------------------------------------------
  // Root — resolve relative to src/pages for dev server HTML files
  // ---------------------------------------------------------------------------
  root: resolve(__dirname, 'src/pages'),
  publicDir: resolve(__dirname, 'public'),

  // ---------------------------------------------------------------------------
  // Env var exposure
  // All VITE_* vars are auto-exposed by Vite.
  // Listed here for documentation — set actual values in .env files.
  //
  // Required:
  //   VITE_SUPPORT_WORKER_URL   — URL of the deployed Cloudflare Worker proxy
  //   VITE_SUPABASE_URL         — Supabase project URL
  //   VITE_SUPABASE_ANON_KEY    — Supabase anon/public key
  //   VITE_DEMO_MODE            — "true" to enable demo data (no live API calls)
  //   VITE_AI_PROVIDER          — "openai" | "anthropic"
  // ---------------------------------------------------------------------------
  envDir: resolve(__dirname),

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
      '@':       resolve(__dirname, 'src'),
      '@types':  resolve(__dirname, 'src/types'),
      '@services': resolve(__dirname, 'src/services'),
    },
  },
});
