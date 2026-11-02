# Release process

## Prepare

1. Update `default/app.conf`, `package.json`, and `CHANGELOG.md` to the same version.
2. Update package-lock.json, current versioned asset exceptions in .gitignore and workflow artifact paths. Remove superseded tracked runtime bundles, not historical release assets.
3. Review every seed lookup row and screenshot for public suitability.
4. Install pinned dependencies with `npm ci --ignore-scripts`.

## Validate

```sh
npm test
npm run build
npm run build
```

The two builds must produce byte-identical archives. Also verify:

- JSON and XML parse successfully;
- Python sources byte-compile;
- the package contains only regular files below `cdp_roadmap/`;
- only `default/`, `metadata/`, `lookups/`, and `appserver/` ship;
- source and package versions match;
- secret, credential, private-path, private-host, and raw-data scans return no plausible findings;
- screenshots contain synthetic data and no identifying metadata;
- `git diff --cached --check` passes.

Splunk AppInspect should be run when available. Passing local tests is not a Splunk Cloud certification.

## Publish

1. Review the staged diff and exact Git-tree inventory, including a reopened dummy-only package and regenerated screenshots.
2. Create a conventional commit with the approved GitHub noreply identity; push only to the requested repository/ref.
3. Wait for automatically triggered CI and verify the remote commit, CSV and checks. A successful push alone is not CI success.
4. Only when separately authorized, create a tag/release and attach the verified package with its SHA-256. A source push is not a published GitHub Release.
5. Read back any authorized tag/release/assets and anonymous cloneability before claiming publication succeeded.

## Version 0.7.1 expected artifact

The canonical filename is `cdp_roadmap-0.7.1.tgz`. Its digest must come from the public checkout's dummy-data build and match `build/manifest.json`. Never reuse an operational-instance archive or assume its digest matches the synthetic distribution. No operational CSV, receipt, backup or deployment automation should be attached.
