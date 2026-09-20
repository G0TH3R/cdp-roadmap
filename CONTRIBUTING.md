# Contributing

Thank you for improving CDP Program Management.

## Before opening a change

- Use synthetic data in tests, examples, and screenshots.
- Do not include credentials, private URLs, host aliases, local paths, event payloads, deployment receipts, or environment-specific topology.
- Keep searches read-only, app-scoped, explicitly bounded, and capped.
- Preserve app ID `cdp_roadmap`, accessibility behavior, and the lookup schema unless the change includes a documented migration.
- Open a private security report rather than a public issue for vulnerabilities.

## Development

```sh
npm ci --ignore-scripts
npm test
npm run build
```

Add or update tests before changing runtime behavior. Confirm deterministic package output by building twice and comparing the archive SHA-256. Keep generated `node_modules/`, caches, smoke-test outputs, and local deployment artifacts out of commits.

## Pull requests

Describe the user-visible behavior, compatibility impact, tests run, and any data/schema migration. Include screenshots only when their contents and metadata have been reviewed for public release.

## Rights

No project license has been granted yet. By submitting a contribution, you represent that you have the right to submit it and permit the repository owner to review and incorporate it. A future contribution or license agreement may supersede this interim notice.
