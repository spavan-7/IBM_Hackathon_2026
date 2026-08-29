# Acceptance Tests

## Test 1 - Valid ST
Input: ST 101 with serviceDate 2026-08-01
Expected: Published unchanged.
Result: ✅ PASS — ST 101 present in output with serviceDate=2026-08-01.

## Test 2 - Valid GA enrichment
Input: ST 101 with serviceDate 2026-08-01 and GA 101 with no serviceDate
Expected: GA 101 is enriched with 2026-08-01 and published.
Result: ✅ PASS — GA 101 present in output with serviceDate=2026-08-01.

## Test 3 - Unmatched GA
Input: GA 103 with no matching ST
Expected: GA 103 is discarded and never reaches final output.
Result: ✅ PASS — personId=103 absent from output after WHERE guard added to FINAL_OUTPUT.

## Test 4 - Null serviceDate
Expected: No final record may contain a NULL serviceDate.
Result: ✅ PASS — WHERE serviceDate IS NOT NULL filters all NULL values before publication.

## Test 5 - Empty serviceDate
Expected: No final record may contain an empty or whitespace-only serviceDate.
Result: ✅ PASS — WHERE TRIM(serviceDate) <> '' filters empty and whitespace-only values.

## Test 6 - Regression
Valid ST and successfully enriched GA records must still be present after the fix.
Result: ✅ PASS — ST 101, GA 101 (enriched), and ST 102 all present in corrected output.
