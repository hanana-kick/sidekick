import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  // One artifact works at a custom-domain root and a GitHub Pages project path.
  // An explicit override is still available for deployments with a fixed base.
  base: process.env.SIDEKICK_BASE ?? './',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./playground', import.meta.url)) } },
  server: { host: process.env.HOST ?? '127.0.0.1', port: Number(process.env.PORT ?? 5173) },
  build: {
    outDir: 'dist', emptyOutDir: false,
    rolldownOptions: { input: { main: 'index.html', playground: 'playground/index.html', api: 'api-playground.html' } },
  },
});
