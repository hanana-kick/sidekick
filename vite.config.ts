import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2022',
    lib: {
      entry: {
        sidekick: resolve(import.meta.dirname, 'src/index.ts'),
        avatar: resolve(import.meta.dirname, 'src/avatar.ts'),
        theme: resolve(import.meta.dirname, 'src/theme.ts'),
        elements: resolve(import.meta.dirname, 'src/elements.ts'),
        react: resolve(import.meta.dirname, 'src/react.tsx'),
      },
      formats: ['es'],
    },
    minify: false,
    rollupOptions: {
      external: ['react', 'react/jsx-runtime', 'react-dom'],
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
      },
    },
    modulePreload: { polyfill: false },
    cssCodeSplit: false,
  },
});
