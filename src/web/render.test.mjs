import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {transform} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as data from './data.mjs';
import * as theme from './theme.mjs';

// Exercise actual JSX entirely in memory; no build output or browser fixture is written.
const source = await readFile(new URL('./entry.jsx', import.meta.url), 'utf8');
const css = await readFile(new URL('./style.css', import.meta.url), 'utf8');
const compiled = await transform(`${source}\nexport {Overview, Roadmap, App};`, {loader: 'jsx', format: 'cjs', sourcefile: 'entry.jsx'});
assert.equal(compiled.warnings.length, 0);
const localRequire = createRequire(import.meta.url);
const mod = {exports: {}};
const resolve = name => name === './style.css' ? css : name === './data.mjs' ? data : name === './theme.mjs' ? theme : localRequire(name);
new Function('require', 'module', 'exports', compiled.code)(resolve, mod, mod.exports);
const {Overview, Roadmap, App} = mod.exports;
const props = {openEntry() {}, navigate() {}, filtered: false};
const input = (overrides = {}) => ({id: 'test', milestone: '<img src=x onerror=alert(1)>', workstream: 'Work', owner: 'Owner', start_date: '2024-02-01', end_date: '2024-03-01', status: 'Planned', validation: 'OK', ...overrides});
const render = (Component, values) => renderToStaticMarkup(React.createElement(Component, values));

test('actual React register escapes data and retains invalid entries', () => {
  const model = data.prepareData([input(), input({id: 'bad', end_date: ''})]);
  const html = render(Overview, {...props, model, rows: model.rows});
  assert.match(html, /&lt;img/);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /Invalid date/);
  assert.match(html, /Date not provided/);
  assert.match(html, /Entries need review/);
  assert.equal((html.match(/class="entry-link"/g) || []).length, 2);
});

test('actual React timeline omits invalid rows, renders all semantic colors and a point', () => {
  const model = data.prepareData([...data.STATUSES.map((status, index) => input({id: String(index), status})), input({id: 'point', start_date: '2024-03-01', end_date: '2024-03-01'}), input({id: 'bad', end_date: ''})]);
  const html = render(Roadmap, {...props, rows: model.rows, allRows: model.rows});
  assert.equal((html.match(/class="timeline-row project-row"/g) || []).length, 1);
  assert.equal((html.match(/class="bar /g) || []).length, 6);
  assert.match(html, /Unassigned project/);
  assert.match(html, /bar planned milestone/);
  assert.match(html, /1 invalid/);
  for (const status of Object.values(data.STATUS_CLASS)) assert.match(html, new RegExp(`bar ${status}`));
  assert.doesNotMatch(html, /NaN|Infinity/);
  const firstWidth = Number(html.match(/class="month" style="left:0%;width:([0-9.]+)%"/)[1]);
  const leapFebruaryShare = (Date.UTC(2024, 2, 1) - Date.UTC(2024, 1, 1)) / (Date.UTC(2024, 3, 1) - Date.UTC(2024, 1, 1)) * 100;
  assert.ok(Math.abs(firstWidth - leapFebruaryShare) < 1e-9);
});

test('timeline bars use optional short labels while preserving full accessible milestone text', () => {
  const model = data.prepareData([
    input({id: 'short', milestone: 'Full & accessible milestone', timeline_label: '<Short & safe>'}),
    input({id: 'blank', milestone: 'Blank fallback', timeline_label: '  '}),
    input({id: 'absent', milestone: 'Absent fallback'})
  ]);
  const html = render(Roadmap, {...props, rows: model.rows, allRows: model.rows});
  assert.match(html, /&lt;Short &amp; safe&gt;/);
  assert.doesNotMatch(html, /<Short/);
  assert.match(html, /Blank fallback/);
  assert.match(html, /Absent fallback/);
  assert.match(html, /aria-label="Unassigned project — Full &amp; accessible milestone/);
  assert.doesNotMatch(html, /&lt;Short &amp; safe&gt; · Planned/);
});

test('timeline renders fiscal week axis and bounded accessible Today marker without footer copy', () => {
  const model = data.prepareData([input({start_date: '2026-09-30', end_date: '2026-10-08'})]);
  const html = render(Roadmap, {...props, rows: model.rows, allRows: model.rows, now: {getFullYear: () => 2026, getMonth: () => 9, getDate: () => 1}});
  assert.match(html, /FY26-W53/);
  assert.match(html, /FY27-W01/);
  assert.match(html, /aria-label="FY27-W01: Oct 1, 2026 to Oct 7, 2026"/);
  assert.match(html, /class="today-marker"/);
  assert.match(html, /aria-label="Today: Oct 1, 2026"/);
  assert.doesNotMatch(html, /timeline-foot|<footer|automatic dependency scheduler|Read-only view of cdp_roadmap.csv|Designed for clarity|Author: G0TH3R/);
});

test('actual React handles empty views and never turns an initial load into seed data', () => {
  const model = data.prepareData([]);
  assert.match(render(Overview, {...props, rows: [], model}), /No entries yet/);
  assert.match(render(Roadmap, {...props, rows: [], allRows: []}), /No entries yet/);
  const html = render(App, {loadData: async () => [], editorUrl: '/edit', view: {location: {href: 'https://splunk.invalid/app', hash: '#overview', search: ''}}});
  assert.match(html, /Loading entries/);
  assert.doesNotMatch(html, /No entries yet|CDP-001|Delivery register/);
});

test('requested branding and heading replace instructional UI, including old guide routes', () => {
  for (const hash of ['#roadmap', '#guide']) {
    const location = {href: 'https://splunk.invalid/app', hash, search: ''};
    assert.equal(data.pageFromLocation(location), 'roadmap');
    const html = render(App, {loadData: async () => [], editorUrl: '/edit', view: {location}});
    assert.match(html, /CDP Program Management/);
    assert.match(html, /Projects Scheulde/);
    assert.doesNotMatch(html, /CDP Schedule|Project timeline|Editing guide|>Guide<|Maintain entries|Designed for clarity/);
    assert.match(html, /Color theme/);
  }
  assert.doesNotMatch(source, /function Guide|Click any activity|After saving there|Add the project column|not an automatic dependency scheduler/);
});

test('actual JSX and CSS parse without warnings', async () => {
  const result = await transform(css, {loader: 'css', sourcefile: 'style.css'});
  assert.deepEqual(result.warnings, []);
});
