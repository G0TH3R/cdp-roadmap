# Security and privacy considerations

## Data handled

The application displays the contents of `cdp_roadmap.csv`: project/activity names, dates, statuses, owners, dependencies, and acceptance criteria. Administrators decide whether those fields contain public, internal, confidential, or personal information. The eight packaged rows are synthetic examples.

## Security model

- Splunk authentication, role capabilities, and knowledge-object ACLs control access.
- Packaged ACLs are admin-only and app-local (`export = none`).
- The runtime performs one bounded, read-only `inputlookup`; it does not use `outputlookup`.
- No custom REST endpoint, scripted input, scheduled search, alert action, credential store, external API, telemetry endpoint, or CDN is included.
- Search-result strings are rendered as text by React.
- Lookup editing is delegated to same-origin Splunk Lookup Editor and requires the user's existing authorization.
- Only the dark/light preference is placed in local storage. Results and lookup records are not persisted by the app.

## Deployment guidance

- Verify release checksums and package inventory before installation.
- Preserve and review local configuration and ACLs during upgrades.
- Do not expose the app or lookup more broadly than required.
- Avoid personal identifiers in `owner`; prefer approved role/team labels.
- Review roadmap text and screenshots before sharing them outside the authorized audience.
- Monitor recent app-specific logs after installation.

## Repository privacy review

Public source excludes credentials, tokens, raw event data, private deployment receipts and backups, environment-specific host aliases, internal URLs/topology, absolute user paths, and deployment automation tied to a particular system. Published screenshots use synthetic test records and contain no browser chrome, hostnames, URLs, user identities, or embedded origin metadata found by the documented review.

## Reporting a vulnerability

Follow `SECURITY.md`. Do not disclose credentials, production data, or exploitable details in a public issue.
