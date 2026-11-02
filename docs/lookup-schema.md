# Lookup schema

`lookups/cdp_roadmap.csv` contains eight fictional `DEMO-*` activities. The public repository/package never includes operational roadmap data. Back up live data before replacing examples or importing changes.

| Column | Required | Meaning |
|---|---:|---|
| `id` | yes | Unique stable activity identifier, such as `DEMO-001`. |
| `project` | no | Project lane; blank means Unassigned project. |
| `project_category` | no | Exact canonical category; blank/missing means Uncategorized. |
| `workstream` | yes | Workstream within delivery; distinct from category. |
| `milestone` | yes | Full activity/milestone text. |
| `timeline_label` | no | Optional short bar label; blank falls back to milestone. |
| `start_date` | yes | Calendar date in `YYYY-MM-DD`. |
| `end_date` | yes | End-exclusive calendar date; cannot precede start. |
| `status` | yes | Planned, In progress, At risk, Blocked or Complete. |
| `owner` | yes | Approved role/team label; avoid unapproved personal data. |
| `dependency_ids` | no | Semicolon-delimited activity IDs; informational only. |
| `acceptance_criteria` | no | Plain-text completion criteria. |

## Project Category

The fixed categories are **Observability**, **Security**, **Infrastructure**, **Automation & Analytics**, and **OT/ICS**. Use the exact spelling/case. Every activity of a named project must carry the same category, including blank values. A partial category update creates a visible validation issue; update all relevant rows together. Unassigned-project rows are not forced into one common category.

The category selector always offers all five values. Legacy data without the column stays valid as Uncategorized. Do not use the reserved filter value `__all__` as a real category, workstream, status or owner.

## Example

```csv
id,project,project_category,workstream,milestone,timeline_label,start_date,end_date,status,owner,dependency_ids,acceptance_criteria
DEMO-101,Example Review,Security,Discovery,Review dummy requirements,Dummy Scope,2027-02-01,2027-02-05,Planned,Example Owner A,,Illustrative requirements reviewed
DEMO-102,Example Review,Security,Validation,Accept example results,Dummy Acceptance,2027-02-05,2027-02-05,Planned,Example Owner A,DEMO-101,Example acceptance recorded
```

## Date semantics and bounds

The React canvas strictly parses calendar dates and displays them in UTC to avoid daylight-saving drift. A bar ends at the start of `end_date`; equal dates create a milestone. The Today marker follows the browser's local calendar date. Studio's SPL date parsing follows the search context timezone.

At most 1,001 rows are read. The first 1,000 are rendered, with the extra row detecting overflow. Missing text/IDs, duplicate IDs, invalid/reversed dates, unsupported statuses/categories and conflicting project categories require review. Invalid records remain in Overview but do not enter the timeline. The app does not validate unseen rows beyond the cap or enforce dependency schedules.

## Lookup Editor imports

Use the same-origin app-shared CSV, not a similarly named user/private lookup. Create any new column before importing: installed Lookup Editor versions may ignore unknown import columns. Compare headers and rows before Save, remove unintended blank trailing records, keep a backup, then return and Reload. On SHC, verify the supported replication behavior on another member.
