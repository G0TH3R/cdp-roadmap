# Architecture and data flow

## Components

1. `lookups/cdp_roadmap.csv` is the packaged seed and runtime data contract.
2. `src/base.spl` performs one app-scoped, read-only lookup search, validates rows, and caps transport at 1,001 records.
3. `src/splunk_adapter.js` owns the SplunkJS `SearchManager`, explicit `-24h`/`now` bounds, cancellation, timeout, overflow rejection, and result conversion.
4. `src/web/` contains the React presentation and pure data helpers. It never contains fallback records or a write API.
5. `tools/build.py` generates the Dashboard Studio fallback from reviewed source JSON/SPL.
6. `tools/build_release.py` bundles React locally, writes versioned assets and the Simple XML host, then creates a deterministic package and manifest.

## Runtime flow

```text
Browser route
  -> Classic Simple XML host
  -> versioned local JS/CSS
  -> SplunkJS SearchManager (app=cdp_roadmap)
  -> inputlookup max=1001 cdp_roadmap.csv
  -> validation and field shaping in SPL
  -> adapter result cap/error boundary
  -> React Overview and Roadmap views
```

Editing is intentionally separate:

```text
Edit entries link
  -> same-origin Splunk Lookup Editor
  -> authorized save to cdp_roadmap.csv
  -> user returns to the app and selects Reload
```

The app installs no custom REST handler, scheduled search, index, input, alert action, or search-time write. It does not call an external network service or CDN.

## Trust boundaries

- Splunk authentication, capabilities, and knowledge-object ACLs are authoritative.
- Search results are untrusted text. React renders values as text rather than injecting result HTML.
- The editor URL must be same-origin HTTP(S), contain no credentials, and be supplied by the Splunk host integration.
- Browser local storage contains only `dark` or `light` under `cdp-schedule.theme.v1`.
- Package creation rejects runtime symlinks and includes only the four runtime directories.

## Packaging

The archive root is `cdp_roadmap/`. Every member is a regular file with mode `0644` and fixed nonzero mtime `2020-01-01T00:00:00Z`. `build/manifest.json` records the package SHA-256 and every runtime-file SHA-256. The tests reopen the archive and compare every member byte-for-byte with source.
