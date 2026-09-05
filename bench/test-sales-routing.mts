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
    {
      content: [
        {
          text: "Show total sales value by item for last month",
          type: "text",
        },
      ],
      role: "user",
    },
  ],
  model: anthropic("claude-sonnet-5"),
  stopWhen: isStepCount(12),
  tools: {
    getFusionTableColumns,
    listFusionDomains,
    searchFusionColumns,
    searchFusionTables,
  },
});

const text = await result.text;
const steps = await result.steps;
console.log("TOOL CALLS:");
for (const step of steps) {
  for (const call of step.toolCalls) {
    console.log(" ", call.toolName, JSON.stringify(call.input).slice(0, 120));
  }
}
console.log("\nTABLES IN SQL:");
for (const m of text.matchAll(/(?:FROM|JOIN)\s+([a-zA-Z_][\w$#]*)/gi)) {
  console.log(" ", m[1].toUpperCase());
}
console.log("\nFIRST 600 CHARS:\n", text.slice(0, 600));
