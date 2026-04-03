// root:   apps/support/src/pages
// outDir: apps/support/dist
import { resolve } from 'path';
import { defineConfig } from 'vite';

const root   = resolve(__dirname, 'src/pages');
const outDir = resolve(__dirname, 'dist');

export default defineConfig({
  root,
  envDir: __dirname,
  build: {
    outDir,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        chat:    resolve(root, 'chat.html'),
        control: resolve(root, 'control.html'),
      },
    },
  },
});
