# Employee Enrichment Business Requirements

## 1. Data sources
Employee events arrive through a stream. Every event contains:
- `personId`
- `assignmentClass`
- `serviceDate`
- `event`

There are two relevant assignment classes:
- `ST`
- `GA`

## 2. ST rule
ST records contain the authoritative `serviceDate`.

A valid ST record with a non-null and non-empty `serviceDate` must be retained in the final output.

## 3. GA enrichment rule
A GA record may have no `serviceDate`.

When an ST record exists with the same `personId`, the GA record must be enriched with the ST record's `serviceDate`.

## 4. Output validation rule
No record may be published to the final Kafka topic when:
- `serviceDate` is NULL
- `serviceDate` is empty
- the final payload is NULL
- the final payload is empty

## 5. Duplicate protection
The final output should contain only valid records. Duplicate output created by enrichment logic should be investigated and prevented when it violates the intended one-record-per-event behavior.

## 6. Example
Input:
- ST / personId 101 / serviceDate 2026-08-01
- GA / personId 101 / serviceDate NULL
- GA / personId 103 / serviceDate NULL

Expected:
- ST 101 is published.
- GA 101 is enriched with 2026-08-01 and published.
- GA 103 is not published because no valid ST service date exists.
