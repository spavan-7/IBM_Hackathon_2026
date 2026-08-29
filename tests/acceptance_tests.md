# Acceptance Tests

## Test 1 - Valid ST
Input: ST 101 with serviceDate 2026-08-01
Expected: Published unchanged.

## Test 2 - Valid GA enrichment
Input: ST 101 with serviceDate 2026-08-01 and GA 101 with no serviceDate
Expected: GA 101 is enriched with 2026-08-01 and published.

## Test 3 - Unmatched GA
Input: GA 103 with no matching ST
Expected: GA 103 is discarded and never reaches final output.

## Test 4 - Null serviceDate
Expected: No final record may contain a NULL serviceDate.

## Test 5 - Empty serviceDate
Expected: No final record may contain an empty or whitespace-only serviceDate.

## Test 6 - Regression
Valid ST and successfully enriched GA records must still be present after the fix.
