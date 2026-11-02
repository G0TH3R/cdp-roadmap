import test from 'node:test';
import assert from 'node:assert/strict';
import * as data from './data.mjs';

const row = (extra = {}) => ({id: 'A', project: 'One', workstream: 'Delivery', milestone: 'A task', owner: 'Owner', start_date: '2026-10-01', end_date: '2026-11-01', status: 'Planned', validation: 'OK', ...extra});

test('project category taxonomy is explicit and legacy CSV rows remain valid', () => {
  assert.deepEqual(data.PROJECT_CATEGORIES, ['Observability', 'Security', 'Infrastructure', 'Automation & Analytics', 'OT/ICS']);
  const original = row();
  const model = data.prepareData([original]);
  assert.equal(model.rows[0].project_category, '');
  assert.equal(model.invalidCount, 0);
  assert.equal(original.project_category, undefined);
});

test('project categories trim, preserve canonical spelling and reject unsupported values', () => {
  assert.equal(data.prepareData([row({project_category: ' OT/ICS '})]).rows[0].project_category, 'OT/ICS');
  assert.equal(data.prepareData([row({project_category: 'Automation & Analytics'})]).invalidCount, 0);
  for (const value of ['security', '__all__', '<img src=x onerror=alert(1)>']) {
    const model = data.prepareData([row({project_category: value})]);
    assert.ok(model.rows[0].issues.includes('Unsupported project category'));
    assert.equal(model.rows[0].timelineValid, false);
  }
});

test('activities belonging to one named project must share one category', () => {
  for (const value of ['Observability', '']) {
    const model = data.prepareData([row({project_category: 'Security'}), row({id: 'B', project_category: value})]);
    assert.equal(model.invalidCount, 2);
    assert.ok(model.rows.every(r => r.issues.includes('Conflicting project categories')));
  }
  const valid = data.prepareData([row({project_category: 'Security'}), row({id: 'B', project_category: 'Security'})]);
  assert.equal(valid.invalidCount, 0);
  assert.equal(data.projectLanes(valid.rows, data.timelineAxis(valid.rows))[0].category, 'Security');
  assert.equal(data.prepareData([row({project: '', project_category: 'Security'}), row({id: 'B', project: '', project_category: 'OT/ICS'})]).invalidCount, 0);
});

test('blank-project lanes label distinct categories without changing their activities', () => {
  for (const second of ['OT/ICS', '']) {
    const model = data.prepareData([row({project: '', project_category: 'Security'}), row({id: 'B', project: '', project_category: second})]);
    assert.equal(model.invalidCount, 0);
    const [lane] = data.projectLanes(model.rows, data.timelineAxis(model.rows));
    assert.equal(lane.label, 'Unassigned project');
    assert.equal(lane.category, 'Mixed categories');
    assert.deepEqual(lane.activities.map(activity => activity.row.project_category), ['Security', second]);
  }
});

test('blank-project lane categories describe only valid rows in the filtered view', () => {
  const model = data.prepareData([
    row({project: '', project_category: 'Security'}),
    row({id: 'B', project: '', project_category: ''}),
    row({id: 'C', project: '', project_category: 'OT/ICS', end_date: ''}),
  ]);
  const original = structuredClone(model.rows);
  const axis = data.timelineAxis(model.rows);
  for (const category of ['Security', '']) {
    const visible = data.filterRows(model.rows, {project_category: JSON.stringify(category)});
    assert.equal(data.projectLanes(visible, axis)[0].category, category);
  }
  assert.equal(data.projectLanes(data.filterRows(model.rows, {search: 'A task'}), axis)[0].category, 'Mixed categories');
  assert.equal(data.projectLanes(data.filterRows(model.rows, {search: 'Security'}), axis)[0].category, 'Security');
  assert.equal(data.projectLanes(data.filterRows(model.rows, {project_category: JSON.stringify('OT/ICS')}), axis).length, 0);
  assert.deepEqual(model.rows, original);
});

test('category filtering composes with project, status, workstream, owner and literal search', () => {
  const model = data.prepareData([row({project_category: 'Automation & Analytics'}), row({id: 'B', project: 'Two', project_category: 'Security'}), row({id: 'C', project: 'Three'})]);
  assert.deepEqual(data.filterRows(model.rows, {project_category: JSON.stringify('Automation & Analytics'), search: '& analytics', status: 'Planned', project: JSON.stringify('One'), owner: 'Owner', workstream: 'Delivery'}).map(r => r.id), ['A']);
  assert.equal(data.filterRows(model.rows, {project_category: JSON.stringify('OT/ICS')}).length, 0);
  assert.deepEqual(data.filterRows(model.rows, {project_category: JSON.stringify('')}).map(r => r.id), ['C']);
  assert.equal(data.filterRows(model.rows, {}).length, 3);
});
