import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import css from './style.css';
import {readTheme, saveTheme} from './theme.mjs';
import {STATUSES, STATUS_CLASS, prepareData, filterRows, formatDate, timelineAxis, projectLanes, pageFromLocation, safeEditorUrl, todayMarker} from './data.mjs';

const EMPTY_FILTERS = {project: '', workstream: '', status: '', owner: ''};
const COPY = {
  overview: 'Projects',
  roadmap: 'Projects Scheulde',
};

function Icon({name, className}) {
  const paths = {
    road: <path d="M5 4v16M10 6h9M10 12h5M10 18h11"/>,

    close: <path d="m6 6 12 12M6 18 18 6"/>,
    check: <path d="m5 12 4 4L19 6"/>,
    warning: <><path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5M12 18h.01"/></>,
    edit: <><path d="m14 5 5 5M4 20l5-1L21 7l-5-5L4 14v6Z"/></>,
  };
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true">{paths[name]}</svg>;
}

function Status({value}) {
  const className = Object.hasOwn(STATUS_CLASS, value) ? STATUS_CLASS[value] : 'unknown';
  return <span className={`status ${className}`}>{value || 'Status not provided'}</span>;
}

function EditLink({url}) {
  return url ? <a className="primary" href={url} target="_blank" rel="noopener noreferrer" aria-label="Edit entries (opens Lookup Editor in a new tab)"><Icon name="edit"/>Edit entries</a>
    : <button className="primary" disabled title="An authorized same-origin Lookup Editor URL is required">Edit entries unavailable</button>;
}

function Filters({rows, filters, setFilters, count}) {
  const descriptors = [['project', 'Project', 'All projects'], ['workstream', 'Workstream', 'All workstreams'], ['status', 'Status', 'All statuses'], ['owner', 'Owner', 'All owners']];
  return <div className="filterbar" id="filters">
    {descriptors.map(([key, label, placeholder]) => {
      const options = key === 'project'
        ? [...new Set([...rows.map(row => JSON.stringify(row.project)), filters.project].filter(Boolean))].sort().map(value => ({value, label: JSON.parse(value) || 'Unassigned project'}))
        : [...new Set([...(key === 'status' ? STATUSES : []), ...rows.map(row => row[key]), filters[key]])].filter(Boolean).sort().map(value => ({value, label: value}));
      return <label className="select-wrap" key={key}><span>{label}</span><select aria-label={`Filter ${key}`} value={filters[key]} onChange={event => setFilters(previous => ({...previous, [key]: event.target.value}))}>
        <option value="">{placeholder}</option>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select></label>;
    })}
    <button className="clear" onClick={() => setFilters({...EMPTY_FILTERS})}>Reset</button>
    <span className="result-count" role="status">{count} of {rows.length} loaded activities</span>
  </div>;
}

function Empty({filtered = false}) {
  return <div className="empty"><strong>{filtered ? 'No matching entries.' : 'No entries yet.'}</strong></div>;
}

function Overview({rows, model, openEntry, navigate, filtered}) {
  const decision = rows.find(row => row.point);
  const cards = [
    ['Projects', new Set(rows.map(row => row.project).filter(Boolean)).size, 'Named projects in this view'],
    ['Activities', rows.length, 'Tasks and milestones'],
    ['In progress', rows.filter(row => row.status === 'In progress').length, 'Work underway'],
    ['Needs attention', rows.filter(row => ['At risk', 'Blocked'].includes(row.status)).length, 'At risk or blocked'],

  ];
  return <section id="overview" aria-label="Overview">
    <div className="stats">{cards.map(([label, count, hint]) => <div className="stat" key={label}><div className="label">{label}</div><div className="number">{count}</div><div className="hint">{hint}</div></div>)}</div>
    <div className="panel"><div className="panel-head"><h2>Project activity register</h2><button className="text-button" onClick={() => navigate('roadmap')}>Roadmap →</button></div>
      <div className="table-wrap" tabIndex="0" role="region" aria-label="Scrollable project activity register"><table><thead><tr><th scope="col">Project</th><th scope="col">Activity</th><th scope="col">Status</th><th scope="col">Owner</th><th scope="col">Target date</th></tr></thead><tbody>
        {rows.map(row => <tr key={row.key}><td>{row.project || 'Unassigned project'}</td><td><button className="entry-link" onClick={() => openEntry(row)}>{row.milestone || 'Untitled activity'}<small>{row.id || 'Missing ID'} · {row.workstream || 'Missing workstream'}</small>{row.issues.length > 0 && <span className="validation-note">Validation: {row.issues.join(' · ')}</span>}</button></td><td><Status value={row.status}/></td><td>{row.owner || 'Owner not provided'}</td><td>{formatDate(row.end_date)}</td></tr>)}
        {!rows.length && <tr><td colSpan="5"><Empty filtered={filtered}/></td></tr>}
      </tbody></table></div>
    </div>
    <div className="bottom-grid"><div className="panel"><div className="eyebrow">Decision milestone</div><div className="decision-date">{decision ? formatDate(decision.start_date) : 'No milestone'}</div>{decision && <><h3>{decision.milestone}</h3><p className="small">{decision.owner} · {decision.status}</p></>}</div>
      <div className="panel"><div className="health"><Icon name={model.invalidCount || model.overflow ? 'warning' : 'check'} className={`health-icon ${model.invalidCount || model.overflow ? 'warning' : ''}`}/><div><h3>{model.invalidCount ? 'Entries need review' : model.overflow ? 'Entry limit exceeded' : 'Lookup health'}</h3><div className="lookup-counts"><span><strong>{model.rows.length - model.invalidCount}</strong> valid</span><span><strong>{model.invalidCount}</strong> invalid</span></div></div></div></div>
    </div>
  </section>;
}

function ThemeToggle({theme, onChange}) {
  return <div className="theme-toggle" role="group" aria-label="Color theme">{['dark', 'light'].map(value => <button key={value} type="button" aria-pressed={theme === value} onClick={() => onChange(value)}>{value === 'dark' ? 'Dark' : 'Light'}</button>)}</div>;
}

function Roadmap({rows, allRows, openEntry, filtered, navigate, focused = false, toggleFocus, theme, changeTheme, now}) {
  // Keep axes stable when filters change so positions remain comparable.
  const axis = useMemo(() => timelineAxis(allRows), [allRows]);
  const valid = rows.filter(row => row.timelineValid);
  const projects = projectLanes(valid, axis);
  const today = todayMarker(axis, now);
  const omitted = rows.length - valid.length;
  return <section id="roadmap" aria-label="Roadmap"><div className="panel"><div className="panel-head"><div><h2>Delivery timeline</h2><p>{axis ? `${axis.label}${axis.coarse ? ' · Grouped month intervals' : ''}` : 'No validated dates to display'}</p></div><div className="timeline-tools"><div className="legend" aria-label="Status legend">{STATUSES.map(status => <span key={status} className={`legend-status ${STATUS_CLASS[status]}`}><i className="legend-dot" aria-hidden="true"/>{status}</span>)}</div>{focused && <ThemeToggle theme={theme} onChange={changeTheme}/>}<button className="secondary focus-toggle" aria-pressed={focused} onClick={toggleFocus}>{focused ? 'Exit focus' : 'Expand timeline'}</button></div></div>
    {omitted > 0 && <div className="timeline-omitted small">{omitted} invalid {omitted === 1 ? 'entry is' : 'entries are'} omitted. <button className="text-button" onClick={() => navigate('overview')}>Review in Overview →</button></div>}
    {axis && valid.length > 0 ? <div className="timeline-scroll" tabIndex="0" role="region" aria-label="Scrollable delivery timeline"><div className="timeline" style={{minWidth: `${Math.max(740, 310 + axis.weeks.length * 58)}px`}}>
      <div className="axis"><div className="axis-label">PROJECT / ACTIVITIES</div><div className="time-axis"><div className="months">{axis.ticks.map(tick => <div className="month" key={tick.start} style={{left: `${tick.left}%`, width: `${tick.width}%`}}>{tick.label}</div>)}</div><div className="weeks" aria-label="Federal fiscal weeks">{axis.weeks.map(week => <div className="week" key={week.start} style={{left: `${week.left}%`, width: `${week.width}%`}} aria-label={week.accessibleLabel}>{week.showLabel ? week.label : ''}</div>)}</div></div></div>
      {projects.map(project => <div className="timeline-row project-row" key={project.key} style={{minHeight: `${Math.max(88, project.trackCount * 40 + 24)}px`}}>
        <div className="lane-label project-label"><div className="lane-name"><strong>{project.label}</strong><small>{project.activities.length} {project.activities.length === 1 ? 'activity' : 'activities'} in view</small>
          <details className="project-activities"><summary>Activity list</summary>{project.activities.map(({row}) => <button className="project-activity-link" key={row.key} onClick={() => openEntry(row)}>{row.milestone}<small>{row.owner} · {row.status}</small></button>)}</details>
        </div></div>
        <div className="track project-track">
          {axis.weeks.map(week => <span className="gridline week-gridline" aria-hidden="true" key={week.start} style={{left: `${week.left}%`}}/>)}
          {today && <span className="today-marker" role="img" aria-label={today.accessibleLabel} style={{left: `${today.left}%`}}><span aria-hidden="true">{today.label}</span></span>}
          {project.activities.map(({row, left, width, track}) => {
            const description = `${project.label} — ${row.milestone} (${row.id}), ${row.owner}, ${row.status}, ${formatDate(row.start_date)}${row.point ? ', milestone' : ` to ${formatDate(row.end_date)}, end date exclusive`}.`;
            return <button key={row.key} className={`bar ${STATUS_CLASS[row.status]}${row.point ? ' milestone' : ''}`} style={{left: row.point ? `calc(${left}% - 9px)` : `${left}%`, width: row.point ? '18px' : `${width}%`, top: `${12 + track * 40 + (row.point ? 7 : 0)}px`}} aria-label={description} title={description} onClick={() => openEntry(row)}>{!row.point && <span aria-hidden="true">{row.timeline_label || row.milestone}</span>}</button>;
          })}
        </div>
      </div>)}
    </div></div> : rows.length ? <div className="empty"><strong>No validated entries in this view.</strong><button className="text-button" onClick={() => navigate('overview')}>Register →</button></div> : <Empty filtered={filtered}/>}
  </div></section>;
}

function DetailDialog({row, editorUrl, onClose, returnFocus}) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => {
      if (element.open) element.close();
      if (returnFocus?.isConnected) returnFocus.focus();
    };
  }, [returnFocus]);
  const fields = [
    ['Project', row.project || 'Unassigned project', true], ['Activity', row.milestone, true], ['Workstream', row.workstream], ['Owner', row.owner],
    ['Start date', formatDate(row.start_date)], ['End date · exclusive', formatDate(row.end_date)],
    ['Status', <Status value={row.status}/>], ['Entry ID', row.id], ['Dependency IDs', row.dependency_ids || 'None', true],
    ['Acceptance criteria', row.acceptance_criteria || 'Not provided', true],
    ['Validation', row.issues.length ? row.issues.join(' · ') : 'OK', true],
  ];
  return <dialog ref={dialog} aria-labelledby="entry-title" onCancel={event => {event.preventDefault(); onClose();}}>
    <div className="dialog-head"><div><h2 id="entry-title">Entry details</h2><small>{row.id || 'Missing ID'} · Read-only</small></div><button className="icon-button" aria-label="Close entry" onClick={onClose} autoFocus><Icon name="close"/></button></div>
    <dl className="detail-grid">{fields.map(([label, value, wide]) => <div key={label} className={wide ? 'wide' : ''}><dt>{label}</dt><dd>{value || 'Not provided'}</dd></div>)}</dl>
    <div className="dialog-actions"><button className="secondary" onClick={onClose}>Close</button><EditLink url={editorUrl}/></div>
  </dialog>;
}

function App({loadData, editorUrl, view, preview = false}) {
  const [page, setPage] = useState(() => pageFromLocation(view.location));
  const [filters, setFilters] = useState({...EMPTY_FILTERS});
  const [result, setResult] = useState({phase: 'loading', model: null, error: ''});
  const [selected, setSelected] = useState(null);
  const [focused, setFocused] = useState(false);
  const [theme, setTheme] = useState(() => readTheme(view, preview));
  const changeTheme = value => {
    setTheme(value);
    saveTheme(view, value, preview);
  };
  const generation = useRef(0);
  const mounted = useRef(false);
  const heading = useRef(null);
  const main = useRef(null);
  const returnFocus = useRef(null);
  const safeUrl = safeEditorUrl(editorUrl, view.location.href);
  const reload = useCallback(() => {
    const current = ++generation.current;
    setSelected(null);
    setResult({phase: 'loading', model: null, error: ''});
    Promise.resolve().then(() => loadData()).then(prepareData).then(model => {
      if (mounted.current && generation.current === current) setResult({phase: 'ready', model, error: ''});
    }).catch(error => {
      if (mounted.current && generation.current === current) setResult({phase: 'error', model: null, error: error instanceof Error ? error.message : 'The lookup could not be loaded.'});
    });
  }, [loadData]);
  useEffect(() => {
    mounted.current = true;
    reload();
    return () => {mounted.current = false; generation.current += 1;};
  }, [reload]);
  useEffect(() => {
    const exitFocus = event => {if (event.key === 'Escape') setFocused(false);};
    view.addEventListener('keydown', exitFocus);
    return () => view.removeEventListener('keydown', exitFocus);
  }, [view]);
  useEffect(() => {
    const onLocation = () => {setPage(pageFromLocation(view.location)); setSelected(null); heading.current?.focus();};
    view.addEventListener('hashchange', onLocation);
    view.addEventListener('popstate', onLocation);
    return () => {view.removeEventListener('hashchange', onLocation); view.removeEventListener('popstate', onLocation);};
  }, [view]);
  const navigate = next => {
    setPage(next);
    setSelected(null);
    try { if (view.location.hash !== `#${next}`) view.history.pushState(null, '', `#${next}`); } catch { /* Navigation remains usable if URL updates are restricted. */ }
    heading.current?.focus();
  };
  const openEntry = row => {
    returnFocus.current = main.current.getRootNode().activeElement;
    setSelected(row);
  };
  const rows = useMemo(() => result.model ? filterRows(result.model.rows, filters) : [], [result.model, filters]);
  const filtered = Object.values(filters).some(Boolean);
  return <div data-theme={theme} className={`canvas${page === 'roadmap' ? ' roadmap-page' : ''}${focused && page === 'roadmap' ? ' timeline-focus' : ''}`}><div className="shell">
    <a className="skip" href="#main" onClick={event => {event.preventDefault(); main.current.focus();}}>Skip to content</a>
    <header className="topbar"><div className="brand topbrand"><div className="mark"><Icon name="road"/></div><strong>CDP Program Management</strong></div><div className="top-actions"><ThemeToggle theme={theme} onChange={changeTheme}/></div></header>
    <main id="main" className="content" ref={main} tabIndex="-1">
      <nav className="canvas-tabs" aria-label="Workspace pages">{[['overview', 'Overview'], ['roadmap', 'Roadmap']].map(([key, label]) => <button key={key} aria-current={page === key ? 'page' : undefined} onClick={() => navigate(key)}>{label}</button>)}</nav>
      <div className="hero"><div><div className="eyebrow">Cyber Data Platform</div><h1 ref={heading} tabIndex="-1">{COPY[page]}</h1></div><div className="hero-actions"><EditLink url={safeUrl}/><button className="secondary" onClick={reload} disabled={result.phase === 'loading'}>{result.phase === 'loading' ? 'Loading…' : 'Reload'}</button></div></div>
      {preview && <div className="notice loading">Project-layout preview · Illustrative entries only · No Splunk reads or writes.</div>}
      {!safeUrl && !preview && <div className="notice warning">Editing unavailable.</div>}
      {result.phase === 'loading' && <div className="notice loading" role="status"><strong>Loading entries…</strong></div>}
      {result.phase === 'error' && <div className="notice error" role="alert"><strong>Entries could not be loaded.</strong><p>{result.error}</p></div>}
      {result.phase === 'ready' && <>
        {result.model.overflow && <div className="notice warning" role="alert"><strong>Entry limit exceeded.</strong><p>Only the first 1,000 entries are displayed and counted. Remaining entries are not validated.</p></div>}
        {result.model.invalidCount > 0 && <div className="notice warning" role="status"><strong>{result.model.invalidCount} of {result.model.rows.length} loaded entries need validation review.</strong><p>Counts are before filters. Invalid entries remain in the Overview register and are omitted from the timeline.</p></div>}
        <Filters rows={result.model.rows} filters={filters} setFilters={setFilters} count={rows.length}/>
        {page === 'overview' && <Overview rows={rows} model={result.model} openEntry={openEntry} navigate={navigate} filtered={filtered}/>}
        {page === 'roadmap' && <Roadmap rows={rows} allRows={result.model.rows} openEntry={openEntry} filtered={filtered} navigate={navigate} focused={focused} toggleFocus={() => setFocused(value => !value)} theme={theme} changeTheme={changeTheme}/>}
      </>}

    </main>
  </div>{selected && <DetailDialog row={selected} editorUrl={safeUrl} onClose={() => setSelected(null)} returnFocus={returnFocus.current}/>}</div>;
}

const mounts = new WeakMap();
/** Mount exactly one read-only UI. Returns an idempotent unmount function. */
export function mount(container, {loadData, editorUrl, preview = false} = {}) {
  if (!container || container.nodeType !== 1) throw new TypeError('mount requires a DOM element.');
  if (typeof loadData !== 'function') throw new TypeError('mount requires loadData().');
  mounts.get(container)?.();
  const shadow = container.shadowRoot || container.attachShadow({mode: 'open'});
  const style = container.ownerDocument.createElement('style');
  style.textContent = css;
  const rootElement = container.ownerDocument.createElement('div');
  rootElement.className = 'cdp-react-root';
  shadow.append(style, rootElement);
  const root = createRoot(rootElement);
  root.render(<App loadData={loadData} editorUrl={editorUrl} view={container.ownerDocument.defaultView} preview={preview}/>);
  let active = true;
  const unmount = () => {
    if (!active) return;
    active = false;
    root.unmount();
    rootElement.remove();
    style.remove();
    mounts.delete(container);
  };
  mounts.set(container, unmount);
  return unmount;
}
