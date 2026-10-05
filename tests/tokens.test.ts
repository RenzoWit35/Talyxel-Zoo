import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildTokensCss, TOKENS_CSS } from '../scripts/tokens';

const styles = path.resolve('src/styles');
const read = (file: string) => readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? sourceFiles(path.join(dir, e.name)) : /\.(css|tsx?)$/.test(e.name) ? [path.join(dir, e.name)] : [],
  );
}

describe('design tokens', () => {
  it('match the generated stylesheet (run `npm run tokens` after editing design/tokens)', () => {
    expect(read(TOKENS_CSS)).toBe(buildTokensCss());
  });

  it('define every CSS variable the app uses', () => {
    const files = sourceFiles(path.resolve('src'));
    const defined = new Set<string>();
    for (const file of files) {
      const text = read(file);
      for (const m of text.matchAll(/(--[\w-]+)\s*:/g)) defined.add(m[1]); // CSS declarations
      for (const m of text.matchAll(/'(--[\w-]+)'/g)) defined.add(m[1]); // style={{ ['--c' as string]: … }}
    }
    const missing = new Set<string>();
    for (const file of files.filter((f) => f.endsWith('.css'))) {
      for (const m of read(file).matchAll(/var\((--[\w-]+)/g)) if (!defined.has(m[1])) missing.add(`${m[1]} in ${path.basename(file)}`);
    }
    expect([...missing]).toEqual([]);
  });

  it('keep the stylesheets free of hard-coded theme colours', () => {
    // White text and dark overlays on photos are fine in both themes; surfaces and text must use tokens.
    const offenders: string[] = [];
    for (const file of readdirSync(styles).filter((f) => f.endsWith('.css') && f !== 'tokens.css')) {
      read(path.join(styles, file))
        .split('\n')
        .forEach((line, i) => {
          if (line.includes('same in both themes')) return;
          if (/^\s*(background|background-color|color|border-color|fill)\s*:\s*(#(f4f1e8|faf8f2|ffffff|1c2a21|4b5a50|85918a)|rgba\(255, 255, 255, 0\.9)/i.test(line)) {
            offenders.push(`${file}:${i + 1}: ${line.trim()}`);
          }
        });
    }
    expect(offenders).toEqual([]);
  });
});
