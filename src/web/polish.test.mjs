import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareData, filterRows, timelineWidth} from './data.mjs';

const make = (id, overrides = {}) => ({id, project:'Example', milestone:'Activity', timeline_label:'', owner:'Owner', workstream:'Planning', status:'Planned', start_date:'2026-11-01', end_date:'2026-12-01', dependency_ids:'', acceptance_criteria:'', validation:'OK', ...overrides});

test('activity search is case-insensitive literal text combined with existing filters', () => {
  const model = prepareData([make('A', {milestone:'Review [access]', owner:'Blue team'}), make('B', {project:'Other', milestone:'Deploy connector', status:'Blocked'})]);
  assert.deepEqual(filterRows(model.rows, {search:' BLUE TEAM '}).map(row=>row.id), ['A']);
  assert.deepEqual(filterRows(model.rows, {search:'[access]'}).map(row=>row.id), ['A']);
  assert.deepEqual(filterRows(model.rows, {search:'connector',status:'Planned'}), []);
  assert.deepEqual(filterRows(model.rows, {search:'Other',status:'Blocked'}).map(row=>row.id), ['B']);
  assert.equal(filterRows(model.rows, {search:'  '}).length, 2);
  assert.deepEqual(filterRows(model.rows, {search:'<script>'}), []);
});

test('timeline scales remain bounded and fit does not force a desktop overflow', () => {
  assert.equal(timelineWidth(null, 'fit'), 640);
  assert.equal(timelineWidth({ticks:[1,2,3], weeks:Array(14)}, 'fit'), 640);
  assert.equal(timelineWidth({ticks:[1,2,3], weeks:Array(14)}, 'months'), 760);
  assert.equal(timelineWidth({ticks:[1,2,3], weeks:Array(14)}, 'weeks'), 1032);
  assert.ok(timelineWidth({ticks:Array(24), weeks:Array(100000)}, 'weeks') <= 16000);
});
