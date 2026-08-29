# Project Coding Rules (Non-Obvious Only)

- The only file to edit is `flink/employee_enrichment.sql` — all other files are reference material.
- The fix must be minimal: add a `WHERE` filter to `FINAL_OUTPUT` (line 43+); do not change the JOIN type or restructure views.
- The bug is on **line 35** exactly: `st.serviceDate` is used in the GA branch of the `UNION ALL` — when the LEFT JOIN finds no ST match, this is NULL.
- `TRIM(serviceDate) <> ''` is needed in addition to `IS NOT NULL` to satisfy acceptance Test 5 (empty/whitespace serviceDate).
- `UNION ALL` in `ENRICHMENT_VIEW` is load-bearing — the ST branch (lines 23–28) and GA branch (lines 32–39) must remain separate.
- The pipeline uses `CREATE TEMPORARY VIEW` chaining; Flink SQL requires declarative `WHERE` for NULL filtering — no imperative checks available.
- After fixing SQL, create `investigation/incident_report.md` per Prompt 6 — the `investigation/` directory does not exist yet.
- Do not modify `logs/pipeline.log` or any `data/` files — they are read-only evidence artifacts.
