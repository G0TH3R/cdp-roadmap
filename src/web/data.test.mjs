import test from 'node:test';
import assert from 'node:assert/strict';
const data = await import('./data.mjs').catch(() => ({}));
const row = (extra = {}) => ({ id: 'test', workstream: 'Work', milestone: 'Task', owner: 'Owner', status: 'Planned', start_date: '2024-02-01', end_date: '2024-03-01', validation: 'OK', ...extra });

test('bounded intake retains invalid register rows and separates validation from filters', () => {
  assert.equal(typeof data.prepareData, 'function');
  const result = data.prepareData(Array.from({length: 1001}, (_, i) => row({ id: String(i), ...(i === 1 ? {end_date: ''} : {}) })));
  assert.equal(result.rows.length, 1000);
  assert.equal(result.overflow, true);
  assert.equal(result.invalidCount, 1);
  assert.equal(result.rows[1].timelineValid, false);
  assert.equal(data.prepareData([row({validation: 'Duplicate ID'})]).rows[0].timelineValid, false);
  assert.equal(data.prepareData([row({start_date: '', end_date: ''})]).rows[0].point, false);
  assert.equal(data.prepareData([row({status: 'unexpected'})]).invalidCount, 1);
  assert.throws(() => data.prepareData({results: []}), /array/i);
  assert.deepEqual(data.prepareData([]).rows, []);
  const input = row({dependency_ids: ['a', 'b']});
  const normalized = data.prepareData([input]).rows[0];
  assert.equal(normalized.dependency_ids, 'a; b');
  assert.deepEqual(input.dependency_ids, ['a', 'b']);
});

test('timeline axes use proportional UTC months and remain bounded for extreme spans', () => {
  assert.equal(typeof data.timelineAxis, 'function');
  const rows = data.prepareData([row(), row({id: 'point', start_date: '2024-03-31', end_date: '2024-03-31'})]).rows;
  const axis = data.timelineAxis(rows);
  assert.equal(axis.min, Date.UTC(2024, 1, 1));
  assert.equal(axis.max, Date.UTC(2024, 3, 1));
  assert.equal(axis.ticks.length, 2);
  assert.ok(Math.abs(axis.ticks[0].width - 29 / 60 * 100) < 1e-8);
  assert.deepEqual(data.barPosition(rows[1], axis), {left: 59 / 60 * 100, width: 0});
  assert.equal(data.timelineAxis([]), null);
  assert.equal(data.timelineAxis(data.prepareData([row({validation: 'Duplicate ID'})]).rows), null);
  const extreme = data.timelineAxis(data.prepareData([row({start_date: '0001-01-01', end_date: '9999-12-31'})]).rows);
  assert.ok(extreme.ticks.length <= 24);
  assert.ok(Math.abs(extreme.ticks.reduce((sum, tick) => sum + tick.width, 0) - 100) < 1e-8);
});

test('federal fiscal weeks start October 1, span leap periods, and end with partial W53', () => {
  assert.equal(typeof data.fiscalWeekAt, 'function');
  assert.deepEqual(data.fiscalWeekAt(Date.UTC(2026, 8, 30)), {
    label: 'FY26-W53', start: Date.UTC(2026, 8, 30), end: Date.UTC(2026, 9, 1)
  });
  assert.deepEqual(data.fiscalWeekAt(Date.UTC(2026, 9, 1)), {
    label: 'FY27-W01', start: Date.UTC(2026, 9, 1), end: Date.UTC(2026, 9, 8)
  });
  assert.equal(data.fiscalWeekAt(Date.UTC(2024, 1, 29)).label, 'FY24-W22');
  assert.deepEqual(data.fiscalWeekAt(Date.UTC(2024, 8, 30)), {
    label: 'FY24-W53', start: Date.UTC(2024, 8, 29), end: Date.UTC(2024, 9, 1)
  });
  const axis = data.timelineAxis(data.prepareData([row({start_date: '2026-09-30', end_date: '2026-10-08'})]).rows);
  const rollover = axis.weeks.findIndex(week => week.label === 'FY26-W53');
  assert.deepEqual(axis.weeks.slice(rollover, rollover + 2).map(week => week.label), ['FY26-W53', 'FY27-W01']);
  assert.match(axis.weeks[rollover + 1].accessibleLabel, /FY27-W01: Oct 1, 2026 to Oct 7, 2026/);
  assert.ok(axis.weeks.every((week, index) => Number.isFinite(week.left) && Number.isFinite(week.width) && (index === 0 || week.left >= axis.weeks[index - 1].left)));
  const longAxis = data.timelineAxis(data.prepareData([row({start_date: '2020-01-01', end_date: '2030-12-31'})]).rows);
  assert.ok(longAxis.weeks.some(week => !week.showLabel));
  assert.ok(longAxis.weeks.every(week => week.width >= 0));
});

test('today marker uses the local calendar date and only appears inside the visible axis', () => {
  assert.equal(typeof data.todayMarker, 'function');
  const axis = {min: Date.UTC(2026, 9, 1), max: Date.UTC(2026, 10, 1)};
  const localOct1 = {getFullYear: () => 2026, getMonth: () => 9, getDate: () => 1};
  const localOct31 = {getFullYear: () => 2026, getMonth: () => 9, getDate: () => 31};
  const localNov1 = {getFullYear: () => 2026, getMonth: () => 10, getDate: () => 1};
  assert.deepEqual(data.todayMarker(axis, localOct1), {timestamp: axis.min, left: 0, label: 'Today', accessibleLabel: 'Today: Oct 1, 2026'});
  assert.equal(data.todayMarker(axis, localOct31).left, 30 / 31 * 100);
  assert.equal(data.todayMarker(axis, localNov1), null);
  assert.equal(data.todayMarker(null, localOct1), null);
});

test('timeline label is optional and normalized without changing the full milestone', () => {
  const rows = data.prepareData([
    row({id: 'short', milestone: 'Full milestone name', timeline_label: '  Short label  '}),
    row({id: 'blank', milestone: 'Blank fallback', timeline_label: '   '}),
    row({id: 'absent', milestone: 'Absent fallback'})
  ]).rows;
  assert.equal(rows[0].timeline_label, 'Short label');
  assert.equal(rows[0].milestone, 'Full milestone name');
  assert.equal(rows[1].timeline_label, '');
  assert.equal(rows[2].timeline_label, '');
});

test('filters, navigation and editor URLs never invent a data source or unsafe navigation', () => {
  assert.equal(typeof data.filterRows, 'function');
  const rows = data.prepareData([row(), row({id: 'other', status: 'Blocked'})]).rows;
  assert.equal(data.filterRows(rows, {status: 'Blocked'}).length, 1);
  assert.equal(data.filterRows(rows, {owner: 'missing'}).length, 0);
  assert.equal(data.pageFromLocation({hash: '#overview', search: '?tab=layout_roadmap'}), 'overview');
  assert.equal(data.pageFromLocation({hash: '', search: '?tab=layout_overview'}), 'overview');
  assert.equal(data.pageFromLocation({hash: '#bad', search: ''}), 'roadmap');
  for (const value of ['javascript:alert(1)', 'https://external.invalid/edit', '//external.invalid', 'data:text/html,hi', '']) {
    assert.equal(data.safeEditorUrl(value, 'https://splunk.invalid/en-US/app/cdp_roadmap/roadmap'), null);
  }
  assert.equal(data.safeEditorUrl('/en-US/app/lookup_editor/lookup_edit?namespace=cdp_roadmap', 'https://splunk.invalid/'), 'https://splunk.invalid/en-US/app/lookup_editor/lookup_edit?namespace=cdp_roadmap');
});

test('date-only parsing rejects invalid and normalized dates, including year zero', () => {
  assert.equal(typeof data.parseDate, 'function');
  for (const value of ['', null, '2026-2-01', '2026-02-29', '2024-02-30', '2026-01-01T00:00:00Z', '0000-01-01']) {
    assert.equal(data.parseDate(value), null, String(value));
  }
  assert.equal(data.parseDate('2024-02-29'), Date.UTC(2024, 1, 29));
  assert.equal(new Date(data.parseDate('0099-01-01')).getUTCFullYear(), 99);
});
