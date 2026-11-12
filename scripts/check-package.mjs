import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const manifest = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'));
const fixture = await mkdtemp(join(tmpdir(), 'sante-package-check-'));

try {
  // Copy the shipped files into an independent consumer. No source paths,
  // aliases, or development dependencies participate in package resolution.
  const installedPackage = join(fixture, 'node_modules', manifest.name);
  await mkdir(installedPackage, { recursive: true });
  await cp(join(packageRoot, 'dist'), join(installedPackage, 'dist'), { recursive: true });
  await cp(join(packageRoot, 'package.json'), join(installedPackage, 'package.json'));
  await symlink(
    dirname(require.resolve('react/package.json')),
    join(fixture, 'node_modules/react'),
    'junction',
  );
  await writeFile(join(fixture, 'package.json'), JSON.stringify({ private: true, type: 'module' }));

  const runtime = `
const store = createSante({ count: 0 });
store.dispatch('count', prev => prev + 1);
if (store.getCached('count') !== 1) throw new Error('Package dispatch failed');
`;
  await writeFile(
    join(fixture, 'esm.mjs'),
    `import { createSante } from '${manifest.name}';\n${runtime}`,
  );
  await writeFile(
    join(fixture, 'cjs.cjs'),
    `const { createSante } = require('${manifest.name}');\n${runtime}
if (require('${manifest.name}/package.json').version !== '${manifest.version}') {
  throw new Error('Package metadata export failed');
}
`,
  );
  for (const file of ['esm.mjs', 'cjs.cjs']) {
    execFileSync(process.execPath, [join(fixture, file)], { cwd: fixture, stdio: 'inherit' });
  }

  const consumer = `
import { createSante } from '${manifest.name}';
const store = createSante({ count: 0, user: { name: '' } });
store.dispatch('count', prev => prev + 1);
store.dispatch('user', { name: 'next' });
const count: number = store.useSante('count').count;
void count;
// @ts-expect-error The published API must retain key-specific value types.
store.dispatch('count', 'wrong');
// @ts-expect-error The published API must reject unknown keys.
store.dispatch('missing', 1);
// @ts-expect-error A plain updater must return state, even for objects with a name property.
store.dispatch('user', prev => { prev.name = 'next'; });
`;
  for (const extension of ['mts', 'cts', 'ts']) {
    await writeFile(join(fixture, `consumer.${extension}`), consumer);
  }
  const compilerOptions = {
    noEmit: true,
    strict: true,
    target: 'ES2020',
    types: [],
    skipLibCheck: false,
  };
  const configs = {
    nodenext: {
      compilerOptions: { ...compilerOptions, module: 'NodeNext', moduleResolution: 'NodeNext' },
      files: ['consumer.mts', 'consumer.cts'],
    },
    bundler: {
      compilerOptions: { ...compilerOptions, module: 'ESNext', moduleResolution: 'Bundler' },
      files: ['consumer.ts'],
    },
  };
  for (const [mode, config] of Object.entries(configs)) {
    const configPath = join(fixture, `tsconfig.${mode}.json`);
    await writeFile(configPath, JSON.stringify(config));
    execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', configPath], {
      cwd: fixture,
      stdio: 'inherit',
    });
  }
  console.log('Package checks passed: ESM, CommonJS, NodeNext, and bundler types.');
} finally {
  await rm(fixture, { recursive: true, force: true });
}
