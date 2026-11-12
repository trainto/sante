// @vitest-environment node
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it.each(['basic.tsx', 'immer.tsx', 'persistence.ts'])(
  'keeps the README example %s in sync with typechecked code',
  (name) => {
    const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
    const example = readFileSync(new URL(`../docs/${name}`, import.meta.url), 'utf8').trim();
    const marker = `<!-- example:${name} -->`;
    const section = readme.split(marker)[1];
    expect(section).toBeDefined();
    const code = section
      .split('```')[1]
      .replace(/^tsx?\n/, '')
      .trim();
    expect(code).toBe(example);
  },
);
