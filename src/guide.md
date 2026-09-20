# CDP Schedule · Maintain your roadmap

**Author: G0TH3R · Illustrative sample data—not an approved platform design or delivery commitment.**

## Edit entries

1. Open [Edit roadmap entries](/en-US/app/lookup_editor/lookup_edit?namespace=cdp_roadmap&lookup=cdp_roadmap.csv&type=csv&owner=nobody).
2. Change dates, status, owner, deliverables, dependencies or acceptance criteria in the grid. Add a row for a new deliverable.
3. Select **Save**, then return to the [roadmap](/en-US/app/cdp_roadmap/roadmap) and reload it.

Use the app's **Edit entries** navigation item for data changes. Dashboard Studio's **Edit** action changes the dashboard design and SPL, not the lookup records.

## Entry rules

- **id:** unique and stable, such as `CDP-007`.
- **workstream, milestone, owner:** required text. Do not use the reserved filter value `__all__`.
- **timeline_label:** optional short bar text; blank values fall back to the full milestone.
- **start_date / end_date:** `YYYY-MM-DD`. End must not precede start.
- **status:** `Planned`, `In progress`, `At risk`, `Blocked`, or `Complete`.
- **dependency_ids:** optional semicolon-separated IDs, for example `CDP-004;CDP-005`. Informational only—dependencies do not reschedule work.
- **acceptance_criteria:** optional definition of completion.

A bar ends at midnight at the **start** of its end date. To show work through December 18, use December 19 as its end boundary. Equal start/end dates create a milestone point. Date parsing follows the search user's Splunk timezone.

## Reading the dashboard

Use **Overview** for summary cards, the entry register and lookup health. Open the separate **Roadmap** tab for the full-width timeline. Filter by workstream, status and owner; the timeline and entry register share those filters across tabs. The lookup-health panel checks all loaded entries before filters; invalid entries remain in the register but are omitted from the timeline. Reset filters to find invalid rows.

The supported limit is **1,000 entries**. A bounded 1,001-row read detects overflow and displays a warning; it does not validate the rest of an oversized lookup. Split larger roadmaps before operational use.

## Ownership and safety

This app owns its own `cdp_roadmap.csv` in the `cdp_roadmap` namespace. The earlier Search & Reporting example is a separate snapshot; editing it does not update this app.

Access is initially limited to the **admin** role. Expand viewer/editor access deliberately before sharing. Export a backup before bulk edits. The dashboard reads only a lookup: it does not scan security events, write records, or run scheduled searches.

Dashboard Studio supplies the native timeline. The original Timeline gallery remains unchanged; the standalone app does not require its Classic visualization.
