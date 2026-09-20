import test from 'node:test';
import assert from 'node:assert/strict';
import {readTheme, saveTheme} from './theme.mjs';

function browser() {
  const values = new Map();
  return {values, localStorage: {getItem: key => values.get(key), setItem: (key, value) => values.set(key, value)}};
}

test('dark default, light persistence, and invalid values remain bounded', () => {
  const view = browser();
  assert.equal(readTheme(view), 'dark');
  saveTheme(view, 'light');
  assert.equal(readTheme(view), 'light');
  saveTheme(view, 'invalid');
  assert.equal(readTheme(view), 'light');
  view.values.set('cdp-schedule.theme.v1', '<script>');
  assert.equal(readTheme(view), 'dark');
  saveTheme(view, 'dark');
  assert.deepEqual([...view.values], [['cdp-schedule.theme.v1', 'dark']]);
});

test('preview preference is isolated from production preference', () => {
  const view = browser();
  saveTheme(view, 'light', true);
  assert.equal(readTheme(view, true), 'light');
  assert.equal(readTheme(view), 'dark');
  saveTheme(view, 'dark', true);
  saveTheme(view, 'light');
  assert.equal(readTheme(view, true), 'dark');
  assert.equal(readTheme(view), 'light');
});

test('blocked or missing browser storage is safe', () => {
  const denied = {get localStorage() { throw new Error('Denied'); }};
  assert.equal(readTheme(denied), 'dark');
  assert.doesNotThrow(() => saveTheme(denied, 'light'));
  assert.equal(readTheme({}), 'dark');
  assert.doesNotThrow(() => saveTheme({}, 'dark'));
});
