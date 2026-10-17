import { resolve } from 'node:path';
import { defineConfig } from 'vite';

/** Single-file CDN build that self-registers every custom element. */
export default defineConfig({
  build: {
    target: 'es2020',
    lib: {
      entry: resolve(import.meta.dirname, 'src/elements/auto.ts'),
      name: 'Sidekick',
      formats: ['iife'],
      fileName: () => 'sidekick.bundle.js',
    },
    minify: true,
    emptyOutDir: false,
    modulePreload: { polyfill: false },
    cssCodeSplit: false,
  },
});
