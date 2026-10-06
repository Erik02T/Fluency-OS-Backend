import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    include: ['tests/grammar/**/*.{test,spec}.ts'],
    environment: 'node',
  },
  resolve: {
    alias: {
      src: path.resolve(root, 'src'),
    },
  },
});
