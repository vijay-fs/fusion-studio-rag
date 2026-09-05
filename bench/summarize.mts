/**
 * Combines benchmark-raw.json and verification.json into a per-run and
 * per-model summary with API costs.
 *
 * Usage: pnpm exec tsx bench/summarize.mts
 */
import { readFileSync, writeFileSync } from "node:fs";

// USD per million tokens (Claude API list prices, Aug 2026; Sonnet 5 at
// intro pricing valid through 2026-08-31, standard is $3/$15)
const PRICING = {
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-opus-5": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 2, output: 10 },
};

const raw = JSON.parse(
  readFileSync("bench/results/benchmark-raw.json", "utf8")
);
const verifications = JSON.parse(
  readFileSync("bench/results/verification.json", "utf8")
);

const verificationByKey = new Map(
  verifications.map((v) => [`${v.modelId}/${v.questionId}`, v])
);

const rows = raw.results.map((run) => {
  const pricing = PRICING[run.modelId];
  const usage = run.usage ?? {};
  const inputTokens = usage.inputTokens ?? 0;
  const outputTokens = usage.outputTokens ?? 0;
  const costUsd =
    (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
  const verification = verificationByKey.get(
    `${run.modelId}/${run.questionId}`
  );

  return {
    badColumns: verification?.badColumns ?? [],
    badTables: verification?.badTables ?? [],
    columnsChecked: verification?.columnsChecked ?? 0,
    columnsValid: verification?.columnsValid ?? 0,
    costUsd: Number(costUsd.toFixed(4)),
    elapsedSec: Math.round(run.elapsedMs / 1000),
    inputTokens,
    modelId: run.modelId,
    outputTokens,
    questionId: run.questionId,
    status: run.status,
    tablesChecked: verification?.tablesChecked ?? 0,
    tablesValid: verification?.tablesValid ?? 0,
    toolCalls: run.toolCalls?.length ?? 0,
  };
});

type ModelTotals = {
  columnsChecked: number;
  columnsValid: number;
  costUsd: number;
  elapsedSec: number;
  errors: number;
  inputTokens: number;
  outputTokens: number;
  runs: number;
  tablesChecked: number;
  tablesValid: number;
  toolCalls: number;
};

function emptyTotals(): ModelTotals {
  return {
    columnsChecked: 0,
    columnsValid: 0,
    costUsd: 0,
    elapsedSec: 0,
    errors: 0,
    inputTokens: 0,
    outputTokens: 0,
    runs: 0,
    tablesChecked: 0,
    tablesValid: 0,
    toolCalls: 0,
  };
}

const perModel: Record<string, ModelTotals> = {};
for (const row of rows) {
  if (!perModel[row.modelId]) {
    perModel[row.modelId] = emptyTotals();
  }
  const acc = perModel[row.modelId];
  acc.runs += 1;
  if (row.status !== "ok") {
    acc.errors += 1;
    continue;
  }
  acc.columnsChecked += row.columnsChecked;
  acc.columnsValid += row.columnsValid;
  acc.costUsd += row.costUsd;
  acc.elapsedSec += row.elapsedSec;
  acc.inputTokens += row.inputTokens;
  acc.outputTokens += row.outputTokens;
  acc.tablesChecked += row.tablesChecked;
  acc.tablesValid += row.tablesValid;
  acc.toolCalls += row.toolCalls;
}

console.log("PER RUN:");
for (const row of rows) {
  console.log(
    `${row.modelId} | ${row.questionId} | ${row.status} | ${row.elapsedSec}s | in ${row.inputTokens} out ${row.outputTokens} | $${row.costUsd} | tools ${row.toolCalls} | tables ${row.tablesValid}/${row.tablesChecked} cols ${row.columnsValid}/${row.columnsChecked}` +
      (row.badTables.length
        ? ` | BAD TABLES ${row.badTables.map((t) => t.tableName).join(",")}`
        : "") +
      (row.badColumns.length
        ? ` | BAD COLS ${row.badColumns.map((c) => `${c.tableName}.${c.columnName}`).join(",")}`
        : "")
  );
}

console.log("\nPER MODEL:");
for (const [modelId, acc] of Object.entries(perModel)) {
  console.log(
    `${modelId}: ${acc.runs - acc.errors}/${acc.runs} ok | total ${acc.elapsedSec}s | in ${acc.inputTokens} out ${acc.outputTokens} | $${acc.costUsd.toFixed(4)} | tables ${acc.tablesValid}/${acc.tablesChecked} | cols ${acc.columnsValid}/${acc.columnsChecked}`
  );
}

writeFileSync(
  "bench/results/summary.json",
  JSON.stringify({ perModel, rows }, null, 2)
);
console.log("\nSaved to bench/results/summary.json");
