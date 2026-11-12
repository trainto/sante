import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    environmentOptions: { jsdom: { url: 'https://sante.test' } },
    include: ['tests/**/*.test.{ts,tsx}'],
    restoreMocks: true,
  },
});
