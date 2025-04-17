import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

// https://vite.dev/config/
export default defineConfig({
  build: {
    lib: {
      entry: ['src/index.ts'],
      name: 'Sante',
      fileName: 'sante',
    },
    rollupOptions: {
      external: ['react'],
      output: {
        globals: {
          react: 'React',
        },
      },
    },
  },
  plugins: [dts({ tsconfigPath: './tsconfig.lib.json' })],
});
