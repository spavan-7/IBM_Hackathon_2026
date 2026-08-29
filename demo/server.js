#!/usr/bin/env node
/**
 * Employee Enrichment Pipeline — Web UI Server
 * Serves the interactive HTML UI and exposes the pipeline logic as a JSON API.
 *
 *   GET  /api/data           → input events + expected output (raw data files)
 *   POST /api/run-pipeline   → runs broken + fixed pipeline, returns full results
 *   GET  /                   → serves index.html
 */

"use strict";

const express = require("express");
const path    = require("path");
const fs      = require("fs");

const app     = express();
const PORT    = 3000;
const dataDir = path.join(__dirname, "..", "data");

app.use(express.json());
app.use(express.static(__dirname));

// ─── Pipeline logic (same as pipeline_demo.js) ───────────────────────────────

function ST_OUTPUT(events) {
  return events.filter(e => e.assignmentClass === "ST");
}

function GA_OUTPUT(events) {
  return events.filter(e => e.assignmentClass === "GA");
}

function ENRICHMENT_VIEW(events) {
  const stRows  = ST_OUTPUT(events);
  const gaRows  = GA_OUTPUT(events);
  const stIndex = {};
  stRows.forEach(st => { stIndex[st.personId] = st; });

  const stBranch = stRows.map(st => ({
    personId: st.personId, recordType: "ST",
    serviceDate: st.serviceDate, employeeRecord: st.event,
  }));

  const gaBranch = gaRows.map(ga => {
    const match = stIndex[ga.personId] || null;
    return {
      personId: ga.personId, recordType: "GA",
      serviceDate: match ? match.serviceDate : null,
      employeeRecord: ga.event,
    };
  });

  return [...stBranch, ...gaBranch];
}

function kafkaProjection(rows) {
  return rows.map(({ personId, recordType, serviceDate }) => ({ personId, recordType, serviceDate }));
}

function runBroken(events) { return kafkaProjection(ENRICHMENT_VIEW(events)); }

function runFixed(events) {
  return kafkaProjection(
    ENRICHMENT_VIEW(events).filter(
      r => r.serviceDate !== null && r.serviceDate !== undefined && r.serviceDate.trim() !== ""
    )
  );
}

function runTests(output) {
  const find = (pid, type) => output.find(r => r.personId === pid && r.recordType === type);
  const t1 = find("101", "ST");
  const t2 = find("101", "GA");
  const t3 = output.find(r => r.personId === "103");
  const nullRows  = output.filter(r => r.serviceDate === null || r.serviceDate === undefined);
  const emptyRows = output.filter(r => typeof r.serviceDate === "string" && r.serviceDate.trim() === "");
  const st101 = find("101", "ST"), ga101 = find("101", "GA"), st102 = find("102", "ST");

  return [
    { id:1, name:"Valid ST unchanged",              pass:!!(t1 && t1.serviceDate==="2026-08-01"), detail: t1 ? `ST 101 serviceDate=${t1.serviceDate}` : "ST 101 not found" },
    { id:2, name:"Valid GA enrichment",             pass:!!(t2 && t2.serviceDate==="2026-08-01"), detail: t2 ? `GA 101 serviceDate=${t2.serviceDate}` : "GA 101 not found" },
    { id:3, name:"Unmatched GA discarded",          pass:!t3,   detail: t3 ? `personId=103 still in output (serviceDate=${t3.serviceDate})` : "personId=103 absent from output" },
    { id:4, name:"No NULL serviceDate",             pass:nullRows.length===0,  detail: nullRows.length===0  ? "No NULL records found"  : `${nullRows.length} record(s) with NULL serviceDate` },
    { id:5, name:"No empty serviceDate",            pass:emptyRows.length===0, detail: emptyRows.length===0 ? "No empty records found" : `${emptyRows.length} record(s) with empty serviceDate` },
    { id:6, name:"Regression — valid records present", pass:!!(st101&&ga101&&st102), detail: `ST 101=${st101?"✓":"✗"}  GA 101=${ga101?"✓":"✗"}  ST 102=${st102?"✓":"✗"}` },
  ];
}

// ─── API routes ───────────────────────────────────────────────────────────────

app.get("/api/data", (req, res) => {
  const inputEvents    = JSON.parse(fs.readFileSync(path.join(dataDir, "input_events.json"),    "utf8"));
  const expectedOutput = JSON.parse(fs.readFileSync(path.join(dataDir, "expected_output.json"), "utf8"));
  res.json({ inputEvents, expectedOutput });
});

app.post("/api/run-pipeline", (req, res) => {
  const inputEvents    = JSON.parse(fs.readFileSync(path.join(dataDir, "input_events.json"),    "utf8"));
  const expectedOutput = JSON.parse(fs.readFileSync(path.join(dataDir, "expected_output.json"), "utf8"));

  const brokenOutput = runBroken(inputEvents);
  const fixedOutput  = runFixed(inputEvents);
  const brokenTests  = runTests(brokenOutput);
  const fixedTests   = runTests(fixedOutput);

  const sortKey = r => `${r.personId}|${r.recordType}`;
  const sort    = arr => [...arr].sort((a,b) => sortKey(a).localeCompare(sortKey(b)));
  const outputMatch = JSON.stringify(sort(fixedOutput)) === JSON.stringify(sort(expectedOutput));

  res.json({
    inputEvents, expectedOutput,
    brokenOutput, fixedOutput,
    brokenTests,  fixedTests,
    outputMatch,
    logLines: [
      { level:"INFO", msg:"Received event eventId=evt-001 personId=101 assignmentClass=ST" },
      { level:"INFO", msg:"Received event eventId=evt-002 personId=101 assignmentClass=GA" },
      { level:"INFO", msg:"Received event eventId=evt-003 personId=102 assignmentClass=ST" },
      { level:"INFO", msg:"Received event eventId=evt-004 personId=103 assignmentClass=GA" },
      { level:"INFO", msg:"Starting employee enrichment" },
      { level:"INFO", msg:"ST match found personId=101 serviceDate=2026-08-01" },
      { level:"INFO", msg:"Publishing enriched GA record personId=101" },
      { level:"WARN", msg:"No ST match found personId=103" },
      { level:"INFO", msg:"Publishing GA record personId=103", highlight:true },
      { level:"WARN", msg:"Output record contains serviceDate=null personId=103" },
      { level:"INFO", msg:"Pipeline completed" },
    ],
  });
});

app.listen(PORT, () => {
  console.log(`\n  Employee Enrichment Pipeline UI`);
  console.log(`  Running at http://localhost:${PORT}\n`);
});
