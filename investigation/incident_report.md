# Incident Report — NULL serviceDate Publication Bug

**File affected**: `flink/employee_enrichment.sql`  
**Rule violated**: Business Requirement §4  
**Severity**: High — invalid records published to Kafka sink  
**Status**: ✅ Fixed

---

## Incident Summary

The employee enrichment pipeline published records with a `NULL` `serviceDate` to the final output. Specifically, GA record for `personId=103` (which has no matching ST record) was forwarded through `FINAL_OUTPUT` with `serviceDate=null`, violating the requirement that no record with a NULL or empty `serviceDate` may be published.

The pipeline logs detected the problem (two WARN lines) but did not prevent publication. The root cause was a missing `WHERE` guard in the `FINAL_OUTPUT` view.

---

## Evidence from Logs

From `logs/pipeline.log`:

```
2026-08-29T10:00:08Z WARN  No ST match found personId=103
2026-08-29T10:00:09Z INFO  Publishing GA record personId=103
2026-08-29T10:00:10Z WARN  Output record contains serviceDate=null personId=103
```

The WARN on line 8 detected that no ST match existed for `personId=103`. The WARN on line 10 detected the NULL `serviceDate` in the output record. Neither warning prevented publication — the record was still emitted on line 9.

---

## Root Cause

The `ENRICHMENT_VIEW` GA branch uses a `LEFT JOIN` against `ST_OUTPUT`:

```sql
SELECT
    ga.personId,
    'GA' AS recordType,
    st.serviceDate,          -- ← NULL when no ST match exists
    ga.event AS employeeRecord
FROM GA_OUTPUT ga
LEFT JOIN ST_OUTPUT st
    ON ga.personId = st.personId;
```

When no ST record exists for a given `personId` (e.g. `personId=103`), the LEFT JOIN produces `st.serviceDate = NULL`. This NULL value propagated into `FINAL_OUTPUT` without any validation.

**FINAL_OUTPUT before fix** (no WHERE guard):

```sql
CREATE TEMPORARY VIEW FINAL_OUTPUT AS
SELECT
    personId,
    recordType,
    serviceDate,
    employeeRecord
FROM ENRICHMENT_VIEW;
```

There was no filter to reject records where `serviceDate` was NULL or empty, so they reached the Kafka sink.

---

## Violated Business Rule

**Business Requirement §4 — Output Validation Rule**:

> No record may be published to the final Kafka topic when:
> - `serviceDate` is NULL
> - `serviceDate` is empty
> - the final payload is NULL
> - the final payload is empty

---

## Before State

**Defective output** (`data/actual_output.json` before fix) — 4 valid/invalid records + 2 malformed:

| personId | recordType | serviceDate | Status |
|----------|------------|-------------|--------|
| 101 | ST | 2026-08-01 | ✅ correct |
| 101 | GA | 2026-08-01 | ✅ correct |
| 102 | ST | 2026-08-05 | ✅ correct |
| **103** | **GA** | **null** | **❌ should not be published** |
| 101 | _(malformed)_ | _(missing)_ | ❌ malformed |
| 102 | _(malformed)_ | _(missing)_ | ❌ malformed |

Tests failing before fix: **Test 3** (unmatched GA not discarded) and **Test 4** (NULL serviceDate present in output).

---

## Fix Applied

**One `WHERE` clause added to `FINAL_OUTPUT`** in `flink/employee_enrichment.sql`:

```diff
-FROM ENRICHMENT_VIEW;
+FROM ENRICHMENT_VIEW
+WHERE serviceDate IS NOT NULL AND TRIM(serviceDate) <> '';
```

Full view after fix:

```sql
-- FIX APPLIED: Added WHERE clause to filter out records where serviceDate is NULL or empty,
-- enforcing Business Requirement §4 (no NULL/empty serviceDate may be published).
CREATE TEMPORARY VIEW FINAL_OUTPUT AS
SELECT
    personId,
    recordType,
    serviceDate,
    employeeRecord
FROM ENRICHMENT_VIEW
WHERE serviceDate IS NOT NULL AND TRIM(serviceDate) <> '';
```

This is the **minimal change** required. No other views were modified. The fix is localised entirely to `FINAL_OUTPUT`, which is the last view before the Kafka sink.

---

## After State

**Corrected output** (`data/actual_output.json` after fix) — 3 records, all valid:

| personId | recordType | serviceDate | Status |
|----------|------------|-------------|--------|
| 101 | ST | 2026-08-01 | ✅ correct |
| 101 | GA | 2026-08-01 | ✅ correct |
| 102 | ST | 2026-08-05 | ✅ correct |

Output now matches `data/expected_output.json` exactly.

---

## Acceptance Test Results (Post-Fix)

| Test | Scenario | Result |
|------|----------|--------|
| Test 1 | Valid ST unchanged | ✅ PASS |
| Test 2 | Valid GA enrichment | ✅ PASS |
| Test 3 | Unmatched GA discarded | ✅ PASS |
| Test 4 | No NULL serviceDate | ✅ PASS |
| Test 5 | No empty serviceDate | ✅ PASS |
| Test 6 | Regression — valid records still present | ✅ PASS |
