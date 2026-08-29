import { tool } from "ai";
import { z } from "zod";
import { searchColumns } from "@/lib/fusion/qdrant";

const DEFAULT_LIMIT = 15;
const MAX_LIMIT = 40;

export const searchFusionColumns = tool({
  description:
    "Semantic search across all 1.16M Oracle Fusion column definitions. Use when you know WHAT data you need but not WHICH table holds it (e.g. 'column storing invoice approval status'), or to locate flexfield/attribute columns.",
  execute: async ({ query, limit }) => {
    try {
      const columns = await searchColumns(
        query,
        Math.min(limit ?? DEFAULT_LIMIT, MAX_LIMIT)
      );
      return { columns };
    } catch (error) {
      return {
        error: `Column search unavailable (${error instanceof Error ? error.message : "unknown error"}). Fall back to your own knowledge and state clearly that column names are unverified.`,
      };
    }
  },
  inputSchema: z.object({
    limit: z
      .number()
      .int()
      .min(1)
      .max(MAX_LIMIT)
      .optional()
      .describe("Number of columns to return (default 15)"),
    query: z
      .string()
      .describe(
        "Business-language description of the column needed, e.g. 'employee termination date'"
      ),
  }),
});
