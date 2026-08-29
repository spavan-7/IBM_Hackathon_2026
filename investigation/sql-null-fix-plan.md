# Plan: Fix NULL serviceDate Publication Bug

## Top-Level Overview

**Goal**: Apply the minimal SQL fix that prevents records with a NULL or empty `serviceDate` from being published, then update all documentation and test artefacts to reflect the corrected state.

**Scope**:
1. One-line SQL fix in `flink/employee_enrichment.sql`
2. Create `investigation/incident_report.md` (before/after documentation)
3. Update `tests/acceptance_tests.md` with pass/fail results
4. Update `data/actual_output.json` to match post-fix output

**Non-goals**: Refactoring the view structure, adding coalesce logic to `ENRICHMENT_VIEW`, changing the Kafka sink, or modifying any other business rules.

---

## Sub-Tasks

### Sub-Task 1 — Apply the Minimal SQL Fix

**Intent**  
Add a single `WHERE` clause to the `FINAL_OUTPUT` view so records with a NULL or empty `serviceDate` are filtered before publication. This is the only code change in the entire plan.

**Expected Outcomes**  
- `FINAL_OUTPUT` contains exactly 3 records for the test dataset (ST 101, GA 101 enriched, ST 102).
- `personId=103` (GA with no matching ST) is silently dropped.
- All other valid records are unaffected.

**Todo List**  
1. Open `flink/employee_enrichment.sql`.
2. In the `FINAL_OUTPUT` view (lines 43–49), add after the `FROM ENRICHMENT_VIEW` line:
   ```sql
   WHERE serviceDate IS NOT NULL AND TRIM(serviceDate) <> ''
   ```
3. Remove the `-- INCIDENT LOCATION` comment block (lines 41–42) and replace with a `-- FIX APPLIED` comment noting the added WHERE clause.

**Relevant Context**  
- File: `flink/employee_enrichment.sql`, lines 41–49
- Violated rule: `requirements/business_requirements.md` §4
- AGENTS.md line 33 explicitly documents this exact fix

**Status**: `[ ] pending`

---

### Sub-Task 2 — Create `investigation/incident_report.md`

**Intent**  
Document the full incident lifecycle: what was broken (before-state), why it was broken (root cause), what was changed (the fix), and what the pipeline now produces (after-state). This satisfies the hackathon's Prompt 6 deliverable and the user's "before and after" documentation requirement.

**Expected Outcomes**  
- New file `investigation/incident_report.md` exists.
- Includes: incident summary, before-SQL snippet, root cause analysis, violated business rule, fix diff, after-SQL snippet, before/after output comparison.

**Todo List**  
1. Create the directory `investigation/` (it does not yet exist).
2. Write `investigation/incident_report.md` with the following sections:
   - **Incident Summary** — one-paragraph overview
   - **Before State** — the original `FINAL_OUTPUT` SQL and description of the defective output (4 records, including `personId=103` with `serviceDate=null`)
   - **Root Cause** — GA branch of `ENRICHMENT_VIEW` LEFT JOINs ST; when no ST match, `st.serviceDate` is NULL; `FINAL_OUTPUT` had no WHERE guard
   - **Violated Rule** — Business Requirement §4 (no NULL/empty serviceDate published)
   - **Evidence** — log lines 8 and 10 from `logs/pipeline.log` showing the pipeline detected NULL but did not stop publication
   - **Fix Applied** — the exact SQL diff (before/after the `WHERE` clause)
   - **After State** — description of the corrected output (3 records matching `expected_output.json`)
   - **Tests Affected** — Tests 3 and 4 now pass; Test 6 regression confirmed

**Relevant Context**  
- `data/actual_output.json` — defective output (before)
- `data/expected_output.json` — correct output (after)
- `logs/pipeline.log` — evidence lines 8 and 10
- `requirements/business_requirements.md` §4
- `AGENTS.md` lines 27–33

**Status**: `[ ] pending`

---

### Sub-Task 3 — Update `tests/acceptance_tests.md`

**Intent**  
Annotate each test with its result status post-fix so the test document reflects reality after the change.

**Expected Outcomes**  
- Each of the 6 tests has a `Result:` line showing `PASS` or `PASS (regression confirmed)` as appropriate.
- No test content is removed or rewritten — only result lines are added.

**Todo List**  
1. Open `tests/acceptance_tests.md`.
2. Append a `Result: PASS` line under each test:
   - Test 1: PASS (ST 101 unchanged)
   - Test 2: PASS (GA 101 enriched with 2026-08-01)
   - Test 3: PASS (GA 103 now discarded)
   - Test 4: PASS (no NULL serviceDate in output)
   - Test 5: PASS (WHERE clause covers empty/whitespace via TRIM)
   - Test 6: PASS — regression confirmed, ST 101 and GA 101 still present

**Relevant Context**  
- `tests/acceptance_tests.md`
- `data/expected_output.json` — ground truth for all pass assertions

**Status**: `[ ] pending`

---

### Sub-Task 4 — Update `data/actual_output.json`

**Intent**  
Replace the defective actual output file with the corrected post-fix output so it matches `expected_output.json`. This is a static artefact file — it is not regenerated at runtime.

**Expected Outcomes**  
- `data/actual_output.json` contains exactly 3 records: ST 101, GA 101, ST 102.
- The `personId=103` record with `serviceDate=null` is removed.
- The 2 malformed records (lines 23–29) are removed.
- File is valid JSON.

**Todo List**  
1. Open `data/actual_output.json`.
2. Replace the contents with the 3-record corrected output (identical to `expected_output.json`).

**Relevant Context**  
- `data/actual_output.json` — current defective state (4 records + 2 malformed)
- `data/expected_output.json` — target state (3 correct records)
- AGENTS.md line 24: "static file, not regenerated at runtime"

**Status**: `[ ] pending`

---

## Execution Order

Sub-tasks must be done in this order:
1. **Sub-Task 1** first (SQL fix) — the incident report references the fixed SQL
2. **Sub-Task 2** next (incident report) — documents both before and after
3. **Sub-Task 3** then (acceptance tests) — annotates results post-fix
4. **Sub-Task 4** last (actual_output.json) — reflects the corrected runtime state
