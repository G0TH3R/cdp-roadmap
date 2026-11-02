# Administrator guide

## Prerequisites

- Splunk Enterprise 10.x with Splunk Web and JavaScript enabled.
- Permission to install and manage an app.
- Splunk Lookup Editor if users will edit records through the provided link.
- A maintenance and rollback procedure appropriate to the deployment topology.

## New installation

1. Verify the release asset SHA-256 against the published release notes.
2. Inspect the archive and confirm the single root directory is `cdp_roadmap/`.
3. Install the archive through the supported app-management mechanism.
4. Confirm `default/app.conf` reports app ID `cdp_roadmap` and the expected version.
5. Review `metadata/default.meta`: all-role app/view reads and CSV reads/writes, admin-only definition writes, `export = none`. Restrict these defaults where policy requires.
6. Open `/en-US/app/cdp_roadmap/roadmap` as an authorized user.
7. Confirm the Overview and Roadmap tabs, theme control, filters, details, Today marker behavior, and Lookup Editor link.
8. Confirm the search is app-scoped and returns no more than 1,001 transport rows.

## Upgrade

Before replacement, capture a verified backup of the whole current app. Record the effective version, relevant local overrides, lookup hash, metadata hash, and archive checksum. Stage the candidate outside the live app path, verify its app ID and package inventory, and preserve these paths from the live app when they exist:

- `local/`
- `lookups/`
- `metadata/` ACL customizations

Do not overwrite a live lookup with packaged seed data. Activate app/view discovery using the deployment's supported method. If a restart is required, handle it as a distinct maintenance action.

## Access control

The default metadata allows all-role app/view reads and lookup reads/writes, while definitions remain admin-writable. Apply least privilege through supported Splunk administration and inspect local overrides. App access and Lookup Editor capabilities still apply; wildcard lookup permissions alone do not grant a user every capability. Verify both intended viewers and editors rather than assuming administrator success establishes their access.

## Data maintenance

Users edit through Lookup Editor, then select Reload in the app. Keep the header and date/status/category formats documented in `lookup-schema.md`. New installs include eight dummy rows only. Export a backup before bulk changes. Create new column headers before import if your editor ignores extra CSV columns, inspect for trailing blank records, and verify the stored file after Save. The app never performs `outputlookup` and has no custom write endpoint. Missing/inaccessible Lookup Editor does not block viewing.

## Search-head clusters

Deploy through the SHC deployer, not a standalone file-swap script. Review the packaged `deployer_lookups_push_mode = always_preserve`, supported lookup-update replication, target IT/security policy and app overrides. Verify an approved save on one member is visible through another. CSV does not inherently require KV Store; this repository does not certify an SHC deployment.

## Verification

After installation or upgrade:

- confirm the effective version and app identity;
- parse/check configuration with the target Splunk tooling;
- verify the exact route and versioned JS/CSS assets;
- run the bounded lookup search as the intended role;
- test filters, details, keyboard navigation, theme switching, and narrow-screen scrolling;
- inspect app-specific recent Splunk Web/search logs for new errors;
- confirm live lookup content and ACLs were preserved on upgrade.

## Rollback

Stop the rollout if configuration, search, permissions, or rendering regresses. Restore the verified prior app directory in a controlled swap. Preserve post-upgrade lookup/ACL edits when required, reactivate discovery, and repeat the same verification ladder. Retain the failed candidate outside the live app directory for analysis.

## Uninstall

Export any roadmap data that must be retained, then remove the app only through the supported Splunk process. Verify that no dependent bookmarks, navigation links, or external procedures rely on the route or lookup before removal.
