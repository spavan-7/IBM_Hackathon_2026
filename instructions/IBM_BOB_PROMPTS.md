# IBM Bob Hackathon Investigation Prompts

## Prompt 1 - Understand the repository
Analyze this repository and explain the complete employee data flow. Identify the input sources, ST processing, GA processing, enrichment logic, final output logic, business rules, and possible validation points. Do not modify any files.

## Prompt 2 - Parallel investigation
Investigate the incident using separate tasks for:
1. Flink SQL and code analysis
2. Business requirement analysis
3. Pipeline log analysis
4. Actual versus expected payload comparison

Each task should independently report findings, evidence, and confidence. Do not modify code yet.

## Prompt 3 - Root cause
Combine the findings into an evidence-based root cause analysis. Explain exactly how personId 103 traveled through the pipeline and why it reached the final output with serviceDate=null. Identify the minimal defect and cite the files that support the conclusion.

## Prompt 4 - Fix
Implement the minimal safe fix. Preserve valid ST records and successfully enriched GA records. Prevent NULL, empty, or whitespace-only serviceDate values from reaching FINAL_OUTPUT. Explain the proposed change before applying it.

## Prompt 5 - Tests
Generate or update tests covering valid ST, valid GA enrichment, unmatched GA, NULL serviceDate, empty serviceDate, and regression behavior. Validate the fix against the expected output.

## Prompt 6 - Incident report
Create investigation/incident_report.md with: incident summary, record journey, root cause, evidence, requirement violation, fix, before/after behavior, tests, and prevention recommendation.
