const fullDate = new Intl.DateTimeFormat('en-US', {month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'});
const monthDate = new Intl.DateTimeFormat('en-US', {month: 'short', year: 'numeric', timeZone: 'UTC'});
const dayDate = new Intl.DateTimeFormat('en-US', {month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'});
const DAY = 86400000;
export function formatDate(value) {
  const timestamp = parseDate(value);
  return timestamp === null ? (value ? `Invalid date: ${value}` : 'Date not provided') : fullDate.format(timestamp);
}
function monthStart(year, month) {
  const date = new Date(0);
  date.setUTCFullYear(year, month, 1);
  return date.getTime();
}
export function timelineAxis(rows) {
  const valid = rows.filter(row => row.timelineValid);
  if (!valid.length) return null;
  const first = new Date(Math.min(...valid.map(row => row.start)));
  const last = new Date(Math.max(...valid.map(row => row.end)));
  const min = monthStart(first.getUTCFullYear(), first.getUTCMonth());
  const max = monthStart(last.getUTCFullYear(), last.getUTCMonth() + 1);
  const count = (last.getUTCFullYear() - first.getUTCFullYear()) * 12 + last.getUTCMonth() - first.getUTCMonth() + 1;
  const step = Math.max(1, Math.ceil(count / 24));
  const ticks = [];
  for (let offset = 0; offset < count; offset += step) {
    const start = monthStart(first.getUTCFullYear(), first.getUTCMonth() + offset);
    const end = Math.min(max, monthStart(first.getUTCFullYear(), first.getUTCMonth() + offset + step));
    ticks.push({start, left: (start - min) / (max - min) * 100, width: (end - start) / (max - min) * 100, label: monthDate.format(start)});
  }
  const weeks = [];
  let week = fiscalWeekAt(min);
  while (week.start < max) {
    const visibleStart = Math.max(min, week.start), visibleEnd = Math.min(max, week.end);
    weeks.push({...week, left: (visibleStart - min) / (max - min) * 100, width: (visibleEnd - visibleStart) / (max - min) * 100,
      accessibleLabel: `${week.label}: ${dayDate.format(week.start)} to ${dayDate.format(week.end - DAY)}`});
    week = fiscalWeekAt(week.end);
  }
  const labelStep = Math.max(1, Math.ceil(weeks.length / 26));
  weeks.forEach((item, index) => { item.showLabel = index % labelStep === 0; });
  return {min, max, ticks, weeks, coarse: step > 1, label: `${monthDate.format(min)} – ${monthDate.format(max - 1)}`};
}

export function fiscalWeekAt(timestamp) {
  const date = new Date(timestamp);
  const calendarYear = date.getUTCFullYear();
  const startYear = date.getUTCMonth() >= 9 ? calendarYear : calendarYear - 1;
  const fiscalStart = monthStart(startYear, 9);
  const fiscalEnd = monthStart(startYear + 1, 9);
  const index = Math.floor((timestamp - fiscalStart) / (7 * DAY));
  const start = fiscalStart + index * 7 * DAY;
  const end = Math.min(start + 7 * DAY, fiscalEnd);
  return {label: `FY${String(startYear + 1).slice(-2)}-W${String(index + 1).padStart(2, '0')}`, start, end};
}

export function todayMarker(axis, now = new Date()) {
  if (!axis) return null;
  const timestamp = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  if (timestamp < axis.min || timestamp >= axis.max) return null;
  return {timestamp, left: (timestamp - axis.min) / (axis.max - axis.min) * 100, label: 'Today', accessibleLabel: `Today: ${dayDate.format(timestamp)}`};
}
export function barPosition(row, axis) {
  return {left: (row.start - axis.min) / (axis.max - axis.min) * 100, width: (row.end - row.start) / (axis.max - axis.min) * 100};
}
export function filterRows(rows, filters) {
  return rows.filter(row => (!filters.project || JSON.stringify(row.project) === filters.project) && ['workstream', 'status', 'owner'].every(key => !filters[key] || row[key] === filters[key]))
    .sort((a, b) => (a.start ?? Infinity) - (b.start ?? Infinity) || a.id.localeCompare(b.id) || a.key.localeCompare(b.key));
}

/** One project lane, with non-overlapping visual tracks for its activities. */
export function projectLanes(rows, axis) {
  if (!axis) return [];
  const groups = new Map();
  for (const row of rows.filter(row => row.timelineValid)) {
    if (!groups.has(row.project)) groups.set(row.project, []);
    groups.get(row.project).push(row);
  }
  return [...groups].sort(([a], [b]) => a ? (b ? a.localeCompare(b) : -1) : (b ? 1 : 0)).map(([project, activities]) => {
    const ends = [];
    const placed = [...activities].sort((a, b) => a.start - b.start || a.end - b.end || a.id.localeCompare(b.id) || a.key.localeCompare(b.key)).map(row => {
      const position = barPosition(row, axis);
      // Reserve marker/minimum-bar hit area at the minimum supported track width.
      // Wider timelines only create more room; adjacent points never cover each other.
      const start = position.left * 4.2 - (row.point ? 10 : 0);
      const end = row.point ? start + 20 : start + Math.max(3, position.width * 4.2);
      let track = ends.findIndex(previous => previous + 4 <= start);
      if (track === -1) track = ends.length;
      ends[track] = end;
      return {row, ...position, track};
    });
    return {key: JSON.stringify(project), project, label: project || 'Unassigned project', activities: placed, trackCount: ends.length};
  });
}
export function pageFromLocation({hash, search}) {
  const pages = ['overview', 'roadmap'];
  const page = hash.replace(/^#/, '');
  if (pages.includes(page)) return page;
  const legacy = new URLSearchParams(search).get('tab');
  return legacy === 'layout_overview' ? 'overview' : 'roadmap';
}
export function safeEditorUrl(value, base) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value, base);
    return ['https:', 'http:'].includes(url.protocol) && url.origin === new URL(base).origin && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export const LIMIT = 1000;
export const STATUSES = ['Planned', 'In progress', 'At risk', 'Blocked', 'Complete'];
export const STATUS_CLASS = {Planned: 'planned', 'In progress': 'progress', 'At risk': 'risk', Blocked: 'blocked', Complete: 'complete'};
const FIELDS = ['id', 'project', 'workstream', 'milestone', 'timeline_label', 'start_date', 'end_date', 'status', 'owner', 'dependency_ids', 'acceptance_criteria', 'validation'];
const text = value => Array.isArray(value) ? value.map(text).join('; ') : typeof value === 'string' || typeof value === 'number' ? String(value) : '';

export function prepareData(input) {
  if (!Array.isArray(input)) throw new TypeError('The data adapter must return an array of entries.');
  const bounded = input.slice(0, LIMIT);
  const ids = new Map();
  // Inspect only the bounded read; include the overflow sentinel in duplicate detection.
  input.slice(0, LIMIT + 1).forEach(row => { const id = text(row?.id); ids.set(id, (ids.get(id) || 0) + 1); });
  const rows = bounded.map((raw, index) => {
    const row = Object.fromEntries(FIELDS.map(field => [field, text(raw?.[field])]));
    row.project = row.project.trim();
    row.timeline_label = row.timeline_label.trim();
    const start = parseDate(row.start_date), end = parseDate(row.end_date);
    const issues = [];
    if (row.validation !== 'OK') issues.push(row.validation || 'Validation unavailable');
    if (['id', 'workstream', 'milestone', 'owner'].some(field => !row[field].trim())) issues.push('Missing required text');
    if (ids.get(row.id) > 1) issues.push('Duplicate ID');
    if (start === null || end === null) issues.push('Invalid date');
    else if (end < start) issues.push('End precedes start');
    if (!STATUSES.includes(row.status)) issues.push('Unsupported status');
    return {...row, key: `${index}:${row.id}`, start, end, issues: [...new Set(issues)], timelineValid: issues.length === 0, point: start !== null && start === end && issues.length === 0};
  });
  return {rows, overflow: input.length > LIMIT, invalidCount: rows.filter(row => !row.timelineValid).length, unassignedCount: rows.filter(row => !row.project).length};
}

/** Date-only values are parsed independently of the browser/Splunk timezone. */
export function parseDate(value) {
  if (typeof value !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value) || value.startsWith('0000')) return null;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value ? timestamp : null;
}
