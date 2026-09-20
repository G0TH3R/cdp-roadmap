import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source = await readFile(new URL('./entry.jsx', import.meta.url), 'utf8').catch(() => '');
const css = await readFile(new URL('./style.css', import.meta.url), 'utf8');

test('entry exports the mount adapter and isolates styles in Shadow DOM', () => {
  assert.match(source, /export function mount\(/);
  assert.match(source, /attachShadow\(\{mode: 'open'\}\)/);
  assert.match(source, /import css from '\.\/style\.css'/);
  assert.match(source, /from 'react-dom\/client'/);
  assert.match(css, /:host\{display:block/);
  assert.doesNotMatch(css, /body\.canvas|:root/);
});

test('production UI is read-only with explicit loading, errors, overflow and details', () => {
  assert.match(source, /Edit entries/);
  assert.match(source, /Reload/);
  assert.match(source, /showModal\(/);
  assert.match(source, /onCancel=/);
  assert.match(source, /role="alert"/);
  assert.match(source, /Loading entries/);
  assert.match(source, /1,000/);
  assert.doesNotMatch(source, /dangerouslySetInnerHTML|innerHTML|localStorage|sessionStorage|window\.require|Apply to preview|CDP-001|fetch\(/);
  assert.match(source, /loadData\(\)/);
});
