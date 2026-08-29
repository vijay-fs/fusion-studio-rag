import { tool } from "ai";
import { z } from "zod";
import { searchTables } from "@/lib/fusion/qdrant";

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 20;

export const searchFusionTables = tool({
  description:
    "Semantic search over the Oracle Fusion Cloud table catalog (22k tables and views across all modules). Use this FIRST when writing SQL, to find the correct tables for a business question. Returns table names, descriptions, modules, and primary keys.",
  execute: async ({ query, limit, module }) => {
    try {
      const tables = await searchTables(
        query,
        Math.min(limit ?? DEFAULT_LIMIT, MAX_LIMIT),
        module
      );
      return { tables };
    } catch (error) {
      return {
        error: `Schema search unavailable (${error instanceof Error ? error.message : "unknown error"}). Fall back to your own knowledge of Fusion tables and state clearly that table names are unverified.`,
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
      .describe("Number of tables to return (default 8)"),
    module: z
      .enum([
        "financials",
        "hcm",
        "scm",
        "procurement",
        "sales",
        "cx",
        "erp",
        "common",
        "project_management",
      ])
      .optional()
      .describe(
        "Optional module filter. Omit for cross-module search (recommended)."
      ),
    query: z
      .string()
      .describe(
        "Business-language description of the data needed, e.g. 'supplier invoice headers and payment status'"
      ),
  }),
});
