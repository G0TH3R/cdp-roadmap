# CDP Schedule production UI

This directory is the React presentation layer for the stable `cdp_roadmap` app. It ports the approved `sketches/executive-canvas/index.html` CSS into a Shadow DOM `.canvas` wrapper, with the same charcoal surfaces, muted teal actions, type scale, segmented navigation, cards, register, and timeline. No prototype script or seed data is imported.

## Integration contract

```jsx
import {mount} from './src/web/entry.jsx';
const unmount = mount(hostElement, {loadData, editorUrl});
// Call unmount() when removing the app host.
```

- `hostElement`: an otherwise dedicated DOM element supporting Shadow DOM.
- `loadData()`: a Promise resolving to an **array** from the app's single bounded `inputlookup max=1001 cdp_roadmap.csv` search. Fields: `id`, `workstream`, `milestone`, `start_date`, `end_date`, `status`, `owner`, `dependency_ids`, `acceptance_criteria`, `validation`. The existing SPL's successful validation value is exactly `OK`.
- The adapter must reject on search/permissions/transport errors and settle unsuccessful jobs (including timeout/cancellation). An empty successful lookup resolves to `[]`. The UI never interprets a rejected search as an empty lookup.
- `editorUrl`: parent-provided, same-origin authorized Lookup Editor URL for `namespace=cdp_roadmap`, lookup `cdp_roadmap.csv`. It opens a separate tab; the UI never writes entries. Missing, cross-origin, credential-bearing, or non-HTTP(S) URLs disable editing with an explanation.
- Mount dispatches once, Reload dispatches once. Tab/filter changes do not dispatch searches. Reload clears stale results and details while loading. Late results cannot update a disposed mount. Remounting the same host first disposes the prior root. The returned cleanup is idempotent.
- Shadow DOM requires the dedicated host to have no existing conflicting closed shadow root. Splunk navigation/authentication remain outside this UI.

## Build requirements (parent-owned)

Install/use only `react` and `react-dom` as runtime dependencies. Bundle both locally; do not externalize them to a CDN or Splunk's AMD registry.

**Required esbuild setting:** `loader: {'.css': 'text'}`. `entry.jsx` uses `import css from './style.css'`; mount appends that string as a `<style>` inside its shadow root. The default CSS asset loader will not work for this entry.

Use your normal JSX transform (`React` is explicitly imported) and AMD bootstrap integration. No `window.require` is used. Only bundle from `entry.jsx`; do not ship `*.test.mjs` or this README in the runtime app. No bundled sample/fallback data exists.

## Behavior

- `#overview`, `#roadmap`, and `#guide`; recognized hashes take priority over legacy `?tab=layout_overview` / `?tab=layout_roadmap`. Browser back/forward updates the view. Filters persist across tabs and reloads; a filter whose value disappears remains selected so a changed dataset never silently broadens a filtered view.
- First 1,000 rows rendered. Row 1,001 is an overflow sentinel. Counts describe the first 1,000, never the full oversized lookup. Validation health is before filters. Duplicate/missing/invalid-date/unsupported-status rows remain inspectable in Overview and are omitted from the timeline.
- Strict date-only parsing, UTC formatting, calendar-roundtrip validation, exclusive end boundaries, and zero-duration diamonds. No local-time DST arithmetic. Unfiltered valid rows determine stable axes. Month widths and gridlines share proportional geometry; exceptionally long spans use at most 24 grouped month intervals rather than creating unbounded DOM.
- Full status text is always visible in the lane label. Bar text is shown only when its container is wide enough, avoiding clipped labels. Native tooltips and accessible button names contain full details.
- Native modal details have Escape, Close, focus trapping, focus restoration, and an Edit entries link; they contain no editable fields.

## Tests

From the app root:

```sh
node --test src/web/*.test.mjs
TZ=America/New_York node --test src/web/data.test.mjs
TZ=Pacific/Auckland node --test src/web/data.test.mjs
```

`data.test.mjs` exercises real pure helpers. `ui-contract.test.mjs` is a static guard, **not browser coverage**. Tests use isolated synthetic records that are never imported by production code.

Parent's exact-built-bundle browser acceptance checks:

1. In authenticated Splunk, verify the dark canvas background through the footer (not inherited white), teal Edit entries, separate Overview/Roadmap/Guide, and no preview/sample labels. Compare desktop spacing and 375px responsive layout against the approved reference.
2. Confirm one bounded initial read; filters and tabs cause no new searches. Apply all three filters, change tabs, inspect a row, close it, and confirm filters persist. Reload causes exactly one read.
3. With a deliberately delayed adapter, verify a loading notice and disabled Reload, not an empty plan. Reject it and verify an alert, no stale register or fallback, and an enabled retry. Resolve an empty array and verify explicit empty states.
4. Supply test-only records for all five statuses, same-day milestones, leap dates, missing dates, impossible dates, reversed ranges, unknown status, duplicate ID, missing text, non-OK SPL validation, and HTML-like text. Invalid rows must remain in the register, contribute to global validation counts, and never enter timeline lanes. Text must be literal, never parsed as markup.
5. Supply 1,001 distinct rows: verify warning and exactly 1,000 register rows / at most 1,000 timeline lanes; hide invalid rows via filters and verify global health counts remain unchanged.
6. Check unequal month lengths and year boundaries; compare aligned gridlines with bar positions. Check short bars, first-day diamonds, and a multi-century range for bounded axes and unclipped status information.
7. Test keyboard-only filters/tabs/details. Escape and Close restore focus; Tab stays inside the modal. Verify explicit status labels, screen-reader loading/error announcements, reduced motion, mobile horizontal timeline scrolling, and visible focus.
8. Test direct hash links, both legacy query tabs, browser back/forward, unmount during a pending load, and remount. The previous pending result must not replace the new mount's data.
9. Open Edit entries (new tab) from header and details. Verify exact app/lookup namespace, save only in authorized Lookup Editor, return and reload. Invalid editor URLs must fail closed with no unsafe link.

No installation, packaging, remote access, or deployment is performed by this layer.
