# Project Documentation Context (Non-Obvious Only)

- `instructions/IBM_BOB_PROMPTS.md` is the canonical task list — answer questions by following its 6-prompt sequence.
- `logs/pipeline.log` is the most direct evidence: line 8 (`WARN No ST match found personId=103`) and line 10 (`WARN Output record contains serviceDate=null personId=103`) show the pipeline detected the problem at two points but published anyway (line 9: `INFO Publishing GA record personId=103`).
- `data/actual_output.json` is a **static pre-captured file** — it is not regenerated at runtime; compare it directly to `data/expected_output.json` for analysis.
- `requirements/business_requirements.md` is the authoritative specification; `tests/acceptance_tests.md` is derived from it — prefer the requirements file for root cause analysis.
- The `investigation/` directory does not yet exist; it must be created when writing the incident report (Prompt 6).
- The `event` field in input JSON is a nested object (`{"employee": "...", "source": "..."}`), renamed to `employeeRecord` in the SQL views — but `expected_output.json` omits it entirely, so the final Kafka projection drops it.
