import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

describe('index layout shell', () => {
  it('keeps the compact workspace structure and all interactive anchors', () => {
    expect(html).toContain('<header class="hero">');
    expect(html).toContain('<main class="experience">');
    expect(html).toContain('class="panel stage-panel"');
    expect(html).toContain('class="panel info-rail"');
    expect(html).toContain('Buffon’s Needle, in motion.');
    expect(html).toContain('aria-label="Key Buffon formulas"');

    for (const id of [
      'simulation-stage',
      'convergence-plot',
      'reset-button',
      'drop-one-button',
      'drop-hundred-button',
      'toggle-auto-button',
      'auto-indicator',
      'total-throws',
      'intersection-count',
      'experimental-probability',
      'theoretical-probability',
      'pi-estimate',
      'estimate-note',
    ]) {
      expect(html).toContain(`id="${id}"`);
    }
  });
});
