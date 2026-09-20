# Lookup schema

`lookups/cdp_roadmap.csv` contains eight illustrative seed rows. Replace or edit them only after reviewing the target environment's access and data-classification requirements.

| Column | Required | Meaning |
|---|---:|---|
| `id` | yes | Unique, stable activity identifier, for example `CDP-001`. |
| `project` | no | Project lane. Blank values appear under **Unassigned project**. |
| `workstream` | yes | Filterable workstream label. |
| `milestone` | yes | Full activity or milestone name. |
| `timeline_label` | no | Short label used when a bar has enough width. |
| `start_date` | yes | Calendar date in `YYYY-MM-DD`. |
| `end_date` | yes | Calendar date in `YYYY-MM-DD`; must not precede `start_date`. |
| `status` | yes | One of `Planned`, `In progress`, `At risk`, `Blocked`, or `Complete`. |
| `owner` | yes | Display label for the responsible role or team. Avoid personal or sensitive identifiers unless approved. |
| `dependency_ids` | no | Semicolon-delimited IDs, for example `CDP-002;CDP-003`. Informational only. |
| `acceptance_criteria` | no | Plain-text completion criteria. |

The reserved filter value `__all__` must not be used as a real workstream, status, or owner.

## Example

```csv
id,project,workstream,milestone,timeline_label,start_date,end_date,status,owner,dependency_ids,acceptance_criteria
CDP-101,Example release,Planning,Confirm delivery scope,Scope,2027-02-01,2027-02-05,Planned,Program lead,,Scope is reviewed and approved
CDP-102,Example release,Delivery,Complete pilot,Pilot,2027-02-08,2027-02-19,In progress,Delivery team,CDP-101,Pilot acceptance checks pass
```

## Date semantics

Dates are parsed strictly as calendar dates and displayed in UTC to avoid daylight-saving drift. Bars end at the start of `end_date`; when start and end are equal, the activity is rendered as a milestone point.

## Validation and bounds

The search reads at most 1,001 records. The UI renders the first 1,000 and uses the extra row to report capacity overflow. Missing IDs, duplicate IDs, invalid/reversed dates, missing required text, and unsupported statuses are reported. Invalid rows remain in the Overview register but do not enter the timeline.
