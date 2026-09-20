# Release process

## Prepare

1. Update `default/app.conf`, `package.json`, and `CHANGELOG.md` to the same version.
2. Update the versioned asset expectation in tests when required.
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

1. Create a conventional release commit.
2. Create signed or annotated tag `vX.Y.Z`.
3. Push the exact commit and tag.
4. Wait for CI and verify its result.
5. Create the release from the existing tag and attach `build/cdp_roadmap-X.Y.Z.tgz`.
6. Record the SHA-256 in release notes.
7. Read back repository visibility, default branch, commit, tag, release, asset metadata, and anonymous cloneability.

## Version 0.4.1 expected artifact

The canonical filename is `cdp_roadmap-0.4.1.tgz`. Its digest must be taken from the newly verified standalone build and must match `build/manifest.json` and both release assets.
