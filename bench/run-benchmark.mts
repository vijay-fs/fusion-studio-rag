/**
 * Cross-module SQL quality benchmark: runs the same Fusion questions through
 * all three chat models using the production system prompt and schema tools,
 * then records SQL output, token usage, latency, and tool call counts.
 *
 * Usage: pnpm exec tsx bench/run-benchmark.mts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { config } from "dotenv";

config({ path: ".env.local" });

const { createAnthropic } = await import("@ai-sdk/anthropic");
const { isStepCount, streamText } = await import("ai");
const { systemPrompt } = await import("../lib/ai/prompts");
const { getFusionTableColumns } = await import(
  "../lib/ai/tools/get-fusion-table-columns"
);
const { searchFusionColumns } = await import(
  "../lib/ai/tools/search-fusion-columns"
);
const { searchFusionTables } = await import(
  "../lib/ai/tools/search-fusion-tables"
);
const { listFusionDomains } = await import(
  "../lib/ai/tools/list-fusion-domains"
);

const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODELS = ["claude-opus-5", "claude-sonnet-5", "claude-haiku-4-5"];

const QUESTIONS = [
  {
    id: "fin-proc-po-invoice-match",
    modules: "Financials + Procurement",
    prompt:
      "Show AP invoices matched to purchase orders where the invoice amount exceeds the PO ordered amount, with supplier name and buyer name.",
  },
  {
    id: "hcm-active-emps",
    modules: "HCM",
    prompt:
      "List active employees with their full name, department name, job title, and supervisor full name.",
  },
  {
    id: "ppm-fin-project-costs",
    modules: "Projects + Financials",
    prompt:
      "Show project costs by project number and name with expenditure type and accounting period, for costs posted this fiscal year.",
  },
  {
    id: "scm-proc-receipts",
    modules: "SCM + Procurement",
    prompt:
      "Show receipts pending inspection with receipt number, PO number, supplier, item, and received quantity.",
  },
  {
    id: "cx-fin-ar-balances",
    modules: "CX/TCA + Financials",
    prompt:
      "Show AR open invoice balances per customer with customer account number and party name, sorted by open balance.",
  },
];

const stopWhen = isStepCount(12);

async function runOne(modelId: string, question: (typeof QUESTIONS)[number]) {
  const startedAt = Date.now();
  try {
    const result = streamText({
      instructions: systemPrompt({
        requestHints: {
          city: undefined,
          country: undefined,
          latitude: undefined,
          longitude: undefined,
        },
        supportsTools: false,
      }),
      messages: [
        { content: [{ text: question.prompt, type: "text" }], role: "user" },
      ],
      model: anthropic(modelId),
      stopWhen,
      tools: {
        getFusionTableColumns,
        listFusionDomains,
        searchFusionColumns,
        searchFusionTables,
      },
    });

    const text = await result.text;
    const totalUsage = await result.totalUsage;
    const steps = await result.steps;
    const toolCalls = steps.flatMap((step) =>
      step.toolCalls.map((call) => call.toolName)
    );

    return {
      elapsedMs: Date.now() - startedAt,
      modelId,
      questionId: question.id,
      status: "ok",
      text,
      toolCalls,
      usage: totalUsage,
    };
  } catch (error) {
    return {
      elapsedMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
      modelId,
      questionId: question.id,
      status: "error",
    };
  }
}

type BenchmarkResult = Awaited<ReturnType<typeof runOne>>;

async function runModelLane(modelId: string) {
  const results: BenchmarkResult[] = [];
  for (const question of QUESTIONS) {
    console.log(`[${modelId}] ${question.id} ...`);
    // biome-ignore lint/performance/noAwaitInLoops: questions run sequentially per model to respect rate limits
    const result = await runOne(modelId, question);
    console.log(
      `[${modelId}] ${question.id} -> ${result.status} in ${Math.round(result.elapsedMs / 1000)}s`
    );
    results.push(result);
  }
  return results;
}

const lanes = await Promise.all(MODELS.map((modelId) => runModelLane(modelId)));
const allResults = lanes.flat();

mkdirSync("bench/results", { recursive: true });
writeFileSync(
  "bench/results/benchmark-raw.json",
  JSON.stringify({ questions: QUESTIONS, results: allResults }, null, 2)
);
console.log(
  `Done. ${allResults.filter((r) => r.status === "ok").length}/${allResults.length} runs OK. Saved to bench/results/benchmark-raw.json`
);
