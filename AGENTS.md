# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Project Type

This is a **hackathon debugging exercise** — not a deployable application. The codebase contains intentionally broken SQL designed to be investigated and fixed using the structured prompts in `instructions/IBM_BOB_PROMPTS.md`.

## Stack

- **Language**: Apache Flink SQL only — no application code, no package manager, no build step
- **Data format**: JSON streaming events → SQL views → Kafka sink (sink omitted from demo)

## Key Files

| File | Purpose |
|---|---|
| `flink/employee_enrichment.sql` | The pipeline — **intentionally broken** |
| `requirements/business_requirements.md` | Specification the SQL violates |
| `tests/acceptance_tests.md` | 6 acceptance criteria (manually verified, no runner) |
| `data/input_events.json` | 4 test events |
| `data/expected_output.json` | 3 correct output records (ground truth) |
| `data/actual_output.json` | 4 defective records — static file, not regenerated at runtime |
| `logs/pipeline.log` | Execution trace — WARN on line 8 detects missing ST match, line 10 detects NULL serviceDate, but neither stops publication |
| `instructions/IBM_BOB_PROMPTS.md` | 6 sequential investigation prompts — do not modify files until Prompt 4 |

## The Known Defect

**File**: `flink/employee_enrichment.sql` line 35  
**Bug**: The GA branch of `ENRICHMENT_VIEW`'s `UNION ALL` selects `st.serviceDate` (from the LEFT JOIN) instead of a coalesced/validated value. When no ST match exists, `st.serviceDate` is NULL and flows into `FINAL_OUTPUT` unguarded.  
**Comment on line 41** explicitly marks the incident location: `-- INCIDENT LOCATION`.  
**Violated rule**: Business Requirement §4 — no record with NULL/empty `serviceDate` may be published.  
**Minimal fix**: Add `WHERE serviceDate IS NOT NULL AND TRIM(serviceDate) <> ''` to `FINAL_OUTPUT`.

## Schema Non-Obviousness

- Input events have 5 fields (`eventId`, `personId`, `assignmentClass`, `serviceDate`, `event`), but `eventId` and `assignmentClass` are **silently dropped** in `ENRICHMENT_VIEW`.
- The `event` column (a nested JSON object) is **renamed** to `employeeRecord` in `ENRICHMENT_VIEW`.
- `expected_output.json` only has 3 fields (`personId`, `recordType`, `serviceDate`) — `employeeRecord` is absent, meaning the Kafka sink projection is narrower than the view.

## Testing (Manual — No Automated Runner)

Compare SQL output against `data/expected_output.json`. All 6 scenarios in `tests/acceptance_tests.md` must pass.  
To isolate a single test (e.g. Test 3 — unmatched GA): run `ENRICHMENT_VIEW` with only `evt-004` as input and assert `personId=103` is absent from output.

## SQL Conventions (from existing code)

- View names: `UPPER_SNAKE_CASE`
- Source column names: `camelCase` (`personId`, `assignmentClass`, `serviceDate`)
- Table aliases: single lowercase letters (`st`, `ga`)
- Pipeline pattern: chain of `CREATE TEMPORARY VIEW` statements ending in `FINAL_OUTPUT`

## Investigation Workflow

Prompts 1–6 in `instructions/IBM_BOB_PROMPTS.md` are sequential. The final deliverable, `investigation/incident_report.md`, must be created under a **new `investigation/` directory** (it does not exist yet).

## Security

- `.bobignore` prevents AI assistants from logging IBM Cloud / Watson credentials.
- No credentials committed — `.env.example` is the template.
