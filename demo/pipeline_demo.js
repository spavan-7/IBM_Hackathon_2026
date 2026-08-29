#!/usr/bin/env node
/**
 * Employee Enrichment Pipeline — Demo Simulator
 * Simulates the Flink SQL pipeline in JavaScript using the real input data.
 * Runs the BROKEN version (no WHERE guard) then the FIXED version (WITH WHERE guard)
 * and prints a before/after comparison plus all 6 acceptance test results.
 */

"use strict";

const path = require("path");
const fs   = require("fs");

// ─── ANSI colours ────────────────────────────────────────────────────────────
const R = "\x1b[0m";
const BOLD  = s => `\x1b[1m${s}${R}`;
const DIM   = s => `\x1b[2m${s}${R}`;
const RED   = s => `\x1b[31m${s}${R}`;
const GREEN = s => `\x1b[32m${s}${R}`;
const YELLOW= s => `\x1b[33m${s}${R}`;
const BLUE  = s => `\x1b[34m${s}${R}`;
const CYAN  = s => `\x1b[36m${s}${R}`;

// ─── Load data files ─────────────────────────────────────────────────────────
const dataDir = path.join(__dirname, "..", "data");
const inputEvents    = JSON.parse(fs.readFileSync(path.join(dataDir, "input_events.json"),    "utf8"));
const expectedOutput = JSON.parse(fs.readFileSync(path.join(dataDir, "expected_output.json"), "utf8"));

// ─── SQL VIEW SIMULATORS ─────────────────────────────────────────────────────

/** ST_OUTPUT: assignmentClass = 'ST' */
function ST_OUTPUT(events) {
  return events.filter(e => e.assignmentClass === "ST");
}

/** GA_OUTPUT: assignmentClass = 'GA' */
function GA_OUTPUT(events) {
  return events.filter(e => e.assignmentClass === "GA");
}

/**
 * ENRICHMENT_VIEW: UNION ALL of ST branch + GA branch (LEFT JOIN).
 * The GA branch takes serviceDate from the ST match (NULL when no match).
 */
function ENRICHMENT_VIEW(events) {
  const stRows = ST_OUTPUT(events);
  const gaRows = GA_OUTPUT(events);

  // ST branch — direct pass-through
  const stBranch = stRows.map(st => ({
    personId:       st.personId,
    recordType:     "ST",
    serviceDate:    st.serviceDate,
    employeeRecord: st.event,
  }));

  // GA branch — LEFT JOIN against ST_OUTPUT on personId
  const stIndex = {};
  stRows.forEach(st => { stIndex[st.personId] = st; });

  const gaBranch = gaRows.map(ga => {
    const match = stIndex[ga.personId] || null;
    return {
      personId:       ga.personId,
      recordType:     "GA",
      serviceDate:    match ? match.serviceDate : null,  // NULL when no match
      employeeRecord: ga.event,
    };
  });

  return [...stBranch, ...gaBranch];
}

/** FINAL_OUTPUT — BROKEN: no WHERE guard */
function FINAL_OUTPUT_BROKEN(events) {
  return ENRICHMENT_VIEW(events);          // every row passes through
}

/** FINAL_OUTPUT — FIXED: WHERE serviceDate IS NOT NULL AND TRIM(serviceDate) <> '' */
function FINAL_OUTPUT_FIXED(events) {
  return ENRICHMENT_VIEW(events).filter(
    r => r.serviceDate !== null &&
         r.serviceDate !== undefined &&
         r.serviceDate.trim() !== ""
  );
}

// Project down to the Kafka sink fields (personId, recordType, serviceDate)
function kafkaProjection(rows) {
  return rows.map(({ personId, recordType, serviceDate }) => ({
    personId, recordType, serviceDate,
  }));
}

// ─── ACCEPTANCE TESTS ────────────────────────────────────────────────────────

function runTests(output) {
  const tests = [];

  // Test 1 — Valid ST unchanged
  const t1 = output.find(r => r.personId === "101" && r.recordType === "ST");
  tests.push({
    id: 1,
    name: "Valid ST unchanged",
    pass: !!(t1 && t1.serviceDate === "2026-08-01"),
    detail: t1
      ? `ST 101 serviceDate=${t1.serviceDate}`
      : "ST 101 not found in output",
  });

  // Test 2 — Valid GA enrichment
  const t2 = output.find(r => r.personId === "101" && r.recordType === "GA");
  tests.push({
    id: 2,
    name: "Valid GA enrichment",
    pass: !!(t2 && t2.serviceDate === "2026-08-01"),
    detail: t2
      ? `GA 101 serviceDate=${t2.serviceDate}`
      : "GA 101 not found in output",
  });

  // Test 3 — Unmatched GA discarded
  const t3 = output.find(r => r.personId === "103");
  tests.push({
    id: 3,
    name: "Unmatched GA discarded",
    pass: !t3,
    detail: t3
      ? `personId=103 still in output (serviceDate=${t3.serviceDate})`
      : "personId=103 absent from output ✓",
  });

  // Test 4 — No NULL serviceDate
  const nullRows = output.filter(r => r.serviceDate === null || r.serviceDate === undefined);
  tests.push({
    id: 4,
    name: "No NULL serviceDate",
    pass: nullRows.length === 0,
    detail: nullRows.length === 0
      ? "No NULL serviceDate records found ✓"
      : `${nullRows.length} record(s) with NULL serviceDate`,
  });

  // Test 5 — No empty serviceDate
  const emptyRows = output.filter(r => typeof r.serviceDate === "string" && r.serviceDate.trim() === "");
  tests.push({
    id: 5,
    name: "No empty serviceDate",
    pass: emptyRows.length === 0,
    detail: emptyRows.length === 0
      ? "No empty serviceDate records found ✓"
      : `${emptyRows.length} record(s) with empty serviceDate`,
  });

  // Test 6 — Regression (all 3 valid records still present)
  const st101 = output.find(r => r.personId === "101" && r.recordType === "ST");
  const ga101 = output.find(r => r.personId === "101" && r.recordType === "GA");
  const st102 = output.find(r => r.personId === "102" && r.recordType === "ST");
  tests.push({
    id: 6,
    name: "Regression — valid records still present",
    pass: !!(st101 && ga101 && st102),
    detail: `ST 101=${st101 ? "✓" : "✗"}  GA 101=${ga101 ? "✓" : "✗"}  ST 102=${st102 ? "✓" : "✗"}`,
  });

  return tests;
}

// ─── PRINT HELPERS ───────────────────────────────────────────────────────────

function hr(char = "─", width = 62) { return char.repeat(width); }

function printTable(rows) {
  const w = [10, 12, 14, 22];
  const fmt = (v, i) => String(v ?? "null").padEnd(w[i]);
  const head = ["personId", "recordType", "serviceDate", "status"].map(fmt);
  console.log("  " + BOLD(head.join("  ")));
  console.log("  " + DIM(hr("─", 62)));
  rows.forEach(r => {
    const isNull = r.serviceDate === null || r.serviceDate === undefined;
    const status = isNull ? RED("❌ NULL serviceDate") : GREEN("✅ valid");
    const sd     = isNull ? RED(String(r.serviceDate)) : CYAN(r.serviceDate);
    console.log(
      "  " +
      fmt(r.personId,   0) + "  " +
      fmt(r.recordType, 1) + "  " +
      String(sd).padEnd(w[2] + 10) +
      status
    );
  });
}

function printTests(tests) {
  tests.forEach(t => {
    const icon   = t.pass ? GREEN("✅ PASS") : RED("❌ FAIL");
    const num    = BOLD(`Test ${t.id}`);
    const name   = t.name;
    const detail = DIM(t.detail);
    console.log(`  ${icon}  ${num} — ${name}`);
    console.log(`         ${detail}`);
  });
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

console.log("\n" + BOLD("═".repeat(64)));
console.log(BOLD("  Employee Enrichment Pipeline — Demo Simulator"));
console.log(BOLD("  IBM Hackathon 2026"));
console.log(BOLD("═".repeat(64)));

// ── Input events ──────────────────────────────────────────────────────────────
console.log("\n" + BOLD("📥  Input Events  ") + DIM(`(${inputEvents.length} records from data/input_events.json)`));
console.log(DIM("  " + hr()));
inputEvents.forEach(e => {
  const sd = e.serviceDate
    ? CYAN(e.serviceDate)
    : YELLOW("null");
  console.log(`  ${DIM(e.eventId)}  personId=${BOLD(e.personId)}  class=${BLUE(e.assignmentClass)}  serviceDate=${sd}`);
});

// ── Simulate pipeline log ─────────────────────────────────────────────────────
console.log("\n" + BOLD("📋  Simulating Pipeline Log"));
console.log(DIM("  " + hr()));
const logLines = [
  ["INFO ", `Received event eventId=evt-001 personId=101 assignmentClass=ST`],
  ["INFO ", `Received event eventId=evt-002 personId=101 assignmentClass=GA`],
  ["INFO ", `Received event eventId=evt-003 personId=102 assignmentClass=ST`],
  ["INFO ", `Received event eventId=evt-004 personId=103 assignmentClass=GA`],
  ["INFO ", `Starting employee enrichment`],
  ["INFO ", `ST match found personId=101 serviceDate=2026-08-01`],
  ["INFO ", `Publishing enriched GA record personId=101`],
  ["WARN ", `No ST match found personId=103`],
  ["INFO ", `Publishing GA record personId=103`],
  ["WARN ", `Output record contains serviceDate=null personId=103`],
  ["INFO ", `Pipeline completed`],
];
logLines.forEach(([level, msg]) => {
  const ts   = DIM("2026-08-29T10:00:xxZ");
  const lvl  = level.startsWith("WARN") ? YELLOW(level) : GREEN(level);
  const text = level.startsWith("WARN") ? YELLOW(msg) : msg;
  console.log(`  ${ts} ${lvl} ${text}`);
});

// ── BROKEN run ────────────────────────────────────────────────────────────────
console.log("\n" + BOLD(RED("❌  BEFORE FIX — FINAL_OUTPUT (no WHERE guard)")));
console.log(DIM("  " + hr()));
console.log(DIM("  FINAL_OUTPUT: SELECT ... FROM ENRICHMENT_VIEW;   ← no filter"));
console.log();
const brokenOutput  = kafkaProjection(FINAL_OUTPUT_BROKEN(inputEvents));
printTable(brokenOutput);
console.log(DIM(`\n  ${brokenOutput.length} records published (${brokenOutput.filter(r => !r.serviceDate).length} invalid)`));

const brokenTests = runTests(brokenOutput);
console.log("\n" + BOLD("  Acceptance Tests — BEFORE FIX:"));
printTests(brokenTests);

// ── FIXED run ─────────────────────────────────────────────────────────────────
console.log("\n" + BOLD(GREEN("✅  AFTER FIX — FINAL_OUTPUT (with WHERE guard)")));
console.log(DIM("  " + hr()));
console.log(DIM("  FINAL_OUTPUT: ... FROM ENRICHMENT_VIEW"));
console.log(DIM("                WHERE serviceDate IS NOT NULL AND TRIM(serviceDate) <> '';"));
console.log();
const fixedOutput = kafkaProjection(FINAL_OUTPUT_FIXED(inputEvents));
printTable(fixedOutput);
console.log(DIM(`\n  ${fixedOutput.length} records published (all valid)`));

const fixedTests = runTests(fixedOutput);
console.log("\n" + BOLD("  Acceptance Tests — AFTER FIX:"));
printTests(fixedTests);

// ── Compare vs expected ───────────────────────────────────────────────────────
console.log("\n" + BOLD("🔍  Output vs expected_output.json"));
console.log(DIM("  " + hr()));
// Order-independent comparison (sort by personId+recordType)
const sortKey = r => `${r.personId}|${r.recordType}`;
const sort    = arr => [...arr].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
const actualJSON   = JSON.stringify(sort(fixedOutput),    null, 2);
const expectedJSON = JSON.stringify(sort(expectedOutput), null, 2);
if (actualJSON === expectedJSON) {
  console.log(GREEN("  ✅  actual_output matches expected_output.json exactly (order-independent)."));
} else {
  console.log(RED("  ❌  Mismatch between actual and expected output!"));
  console.log("  Expected:", expectedJSON);
  console.log("  Actual:  ", actualJSON);
}

// ── Summary ───────────────────────────────────────────────────────────────────
const brokenPass = brokenTests.filter(t =>  t.pass).length;
const brokenFail = brokenTests.filter(t => !t.pass).length;
const fixedPass  = fixedTests.filter(t =>  t.pass).length;
const fixedFail  = fixedTests.filter(t => !t.pass).length;

console.log("\n" + BOLD("📊  Summary"));
console.log(DIM("  " + hr()));
console.log(`  Before fix:  ${GREEN(`${brokenPass} passed`)}  ${RED(`${brokenFail} failed`)}`);
console.log(`  After fix:   ${GREEN(`${fixedPass} passed`)}  ${fixedFail > 0 ? RED(`${fixedFail} failed`) : DIM("0 failed")}`);
console.log(`\n  Fix:         ${BOLD("1 WHERE clause added to FINAL_OUTPUT")}`);
console.log(`  Rule fixed:  Business Requirement §4 — no NULL/empty serviceDate published`);
console.log("\n" + BOLD("═".repeat(64)) + "\n");
