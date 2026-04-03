import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  // No root override — outDir resolves relative to this file's directory (apps/support/)
  build: {
    outDir:      'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        chat:    resolve(__dirname, 'src/pages/chat.html'),
        control: resolve(__dirname, 'src/pages/control.html'),
      },
    },
  },

  // ---------------------------------------------------------------------------
  // Env vars (VITE_* prefix auto-exposed by Vite)
  // Required:
  //   VITE_SUPPORT_WORKER_URL   — Cloudflare Worker URL
  //   VITE_SUPABASE_URL         — Supabase project URL
  //   VITE_SUPABASE_ANON_KEY    — Supabase anon key
  //   VITE_DEMO_MODE            — "true" to skip live API calls
  //   VITE_AI_PROVIDER          — "openai" | "anthropic"
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Dev server
  // ---------------------------------------------------------------------------
  server: {
    port: 5173,
    open: '/src/pages/chat.html',
  },

  // ---------------------------------------------------------------------------
  // Resolve aliases
  // ---------------------------------------------------------------------------
  resolve: {
    alias: {
      '@':         resolve(__dirname, 'src'),
      '@types':    resolve(__dirname, 'src/types'),
      '@services': resolve(__dirname, 'src/services'),
    },
  },
});
