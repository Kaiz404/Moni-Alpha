import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // What scripts/markdown-loader.cjs does for next build: an imported .md file is its text.
  plugins: [
    {
      name: 'markdown',
      transform: (code, id) => (id.endsWith('.md') ? `export default ${JSON.stringify(code)};` : undefined),
    },
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  esbuild: { jsx: 'automatic' },
  test: { include: ['src/**/*.test.{ts,tsx}'] },
});
