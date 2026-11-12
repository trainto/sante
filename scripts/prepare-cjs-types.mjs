import { readFile, writeFile } from 'node:fs/promises';

// Both runtime formats expose the same API. A self-contained declaration
// must use .d.cts for CommonJS consumers under NodeNext resolution.
const declaration = await readFile(new URL('../dist/index.d.ts', import.meta.url), 'utf8');
if (/\b(?:from\s*|(?:import|require)\s*\(\s*|import\s*)['"]\./.test(declaration)) {
  throw new Error(
    'Expected bundled declarations without relative imports. Keep rollupTypes enabled.',
  );
}
await writeFile(new URL('../dist/index.d.cts', import.meta.url), declaration);
