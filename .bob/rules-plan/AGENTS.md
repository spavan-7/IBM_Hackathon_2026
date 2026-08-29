# Project Architecture Rules (Non-Obvious Only)

- The pipeline is exactly 4 `CREATE TEMPORARY VIEW` statements in a linear chain: `ST_OUTPUT` → `GA_OUTPUT` → `ENRICHMENT_VIEW` → `FINAL_OUTPUT`. Validation belongs only in `FINAL_OUTPUT`.
- The LEFT JOIN in `ENRICHMENT_VIEW` (line 38) is intentionally correct — it's the missing NULL guard in `FINAL_OUTPUT` that is the defect. Changing to INNER JOIN would silently discard unmatched GAs rather than explicitly rejecting them, violating the audit requirement.
- `ENRICHMENT_VIEW` silently drops `eventId` and `assignmentClass` from the input schema and renames `event` → `employeeRecord`; the final Kafka sink projection drops `employeeRecord` too.
- There are no integration tests, CI, or containerisation — correctness is determined solely by comparing output to `data/expected_output.json`.
- The fix is deliberately minimal by design (hackathon constraint): one `WHERE` clause in `FINAL_OUTPUT`. Do not propose pipeline restructuring, schema changes, or new views.
- The `investigation/incident_report.md` deliverable requires creating a new `investigation/` directory — plan for this.
