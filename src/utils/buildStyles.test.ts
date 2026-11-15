import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import { loadConfigFromFile } from 'vite';

test('the configured HeroUI repair changes only the eight malformed motion selectors', async () => {
  const loaded = await loadConfigFromFile(
    { command: 'build', mode: 'production' },
    fileURLToPath(new URL('../../vite.config.ts', import.meta.url)),
  );
  const postcssConfig = loaded?.config.css?.postcss;
  assert.ok(postcssConfig && typeof postcssConfig === 'object');
  const plugin = postcssConfig.plugins?.find(
    plugin => 'postcssPlugin' in plugin && plugin.postcssPlugin === 'heroui-reduced-motion-selectors',
  );
  assert.ok(plugin, 'The Vite pipeline must include the scoped selector repair');
  const process = async (css: string) => (await postcss([plugin]).process(css, { from: undefined })).css;
  const motion = ':is([data-reduce-motion=true],[data-reduce-motion=true] *)';
  for (const [element, pseudo] of [
    ['.slider .slider__thumb', ':after'],
    ['.slider .slider__thumb[data-dragging=true]', ':after'],
    ['.checkbox__control', ':before'],
    ['.radio__indicator:empty', ':before'],
  ]) {
    for (const negate of [false, true]) {
      const malformed = negate ? ':not(:is())' : ':is()';
      const repaired = negate ? `:not(${motion})` : motion;
      const wrap = (selector: string) => {
        const rule = `${selector}{transition-property:none;--sentinel:unchanged}`;
        return negate ? `@media (prefers-reduced-motion:reduce){${rule}}` : rule;
      };
      const expected = wrap(`${element}${repaired}${pseudo}`);
      assert.equal(await process(wrap(`${element}${pseudo}${malformed}`)), expected);
      assert.equal(await process(expected), expected, 'Valid upstream selectors must be untouched');
    }
  }
  for (const selector of [
    '.unrelated:before:is()',
    '.prefix .checkbox__control:before:is()',
    '.checkbox__control:after:is()',
    '.slider .slider__thumb:before:is()',
    '.slider .slider__thumb[data-dragging=false]:after:is()',
    '.radio__indicator:before:is()',
    '.checkbox__control:before:is([data-reduce-motion=true])',
    '.checkbox__control:before:where()',
    '.checkbox__control:before:is(),.unrelated',
  ]) {
    const css = `${selector}{transition-property:none}`;
    assert.equal(await process(css), css, selector);
  }
});
