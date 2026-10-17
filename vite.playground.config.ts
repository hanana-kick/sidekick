import { defineConfig } from 'vite';

const src = (file: string) => new URL(`./src/${file}`, import.meta.url).pathname;

export default defineConfig({
  root: 'playground',
  resolve: {
    // Longest-first so `sidekick/avatar` is not eaten by the bare `sidekick` alias.
    alias: [
      { find: 'sidekick/avatar', replacement: src('avatar.ts') },
      { find: 'sidekick/theme', replacement: src('theme.ts') },
      { find: 'sidekick/elements', replacement: src('elements.ts') },
      { find: 'sidekick/react', replacement: src('react.tsx') },
      { find: 'sidekick', replacement: src('index.ts') },
    ],
  },
  server: { port: 5173 },
  preview: { port: 4173 },
});
