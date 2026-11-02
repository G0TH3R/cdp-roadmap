# Security and privacy considerations

## Data handled

The app displays CSV project/category/activity text, dates, status, owner roles, dependencies and completion criteria. Administrators own data classification and access policy. The public CSV contains only eight synthetic Example projects/activities with `DEMO-*` IDs and Example Owner labels; it is not copied from a live instance.

## Security model

- Splunk authentication, app access, capabilities and knowledge-object ACLs are authoritative.
- Packaged app/view reads and CSV reads/writes are all-role, definition writes admin-only, with `export = none`. Review these broad defaults and local overrides before production use. Lookup Editor requires its own access/capabilities.
- Runtime data access is bounded, read-only inputlookup with explicit search bounds. No outputlookup, KV Store, custom REST writer, scripted input, scheduled search or external API is included.
- React renders result text without injecting result HTML. Category validation does not replace output escaping or authorization.
- Editing is delegated to accessible same-origin Lookup Editor; discovery is a bounded GET and does not authorize writes.
- Only the theme preference is stored in local storage, never CSV results.
- The launcher author field and Studio author line are omitted. Required third-party notices remain.

## Publication safeguards

Only reviewed app source, synthetic seed data, tests, documentation and synthetic screenshots belong in this repository. Do not publish operational CSV snapshots, planning exports, receipts, backups, target-specific automation, credentials, internal URLs, private hostnames or absolute home paths. Build archives must be reopened to verify the lookup is the same dummy CSV as the source. A clean source tree alone is insufficient if an asset contains real data.

Tests guard synthetic ID/project/owner conventions, archive ownership, retained library notices, forbidden artifact paths and obvious secrets/private paths. These checks are not a guarantee of anonymity or a substitute for human review. Existing Git/release history is not rewritten by a new sanitized commit.

Screenshots must be regenerated using synthetic data without Splunk/browser chrome or user identity, then reviewed for text and PNG metadata. Never reuse screenshots of live planning records for public distribution.

## Operations

Back up live data and ACLs before upgrades or bulk imports. Never replace live data with the bundled examples. Confirm stored values and intended-role access after edits; on SHC verify another member. Removing author fields does not anonymize project text, ownership or instance audit records.

Follow `SECURITY.md` to report a vulnerability. Do not post credentials, production data or exploitable details in public issues.
