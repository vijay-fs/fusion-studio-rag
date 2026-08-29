import { tool } from "ai";
import { z } from "zod";
import { getColumnsForTable } from "@/lib/fusion/qdrant";

const MAX_TABLES_PER_CALL = 6;

export const getFusionTableColumns = tool({
  description:
    "Fetch the exact, verified column list for one or more Oracle Fusion tables (name, data type, nullability, primary key flag, description). ALWAYS call this for every table you reference before writing final SQL - never guess column names.",
  execute: async ({ tableNames }) => {
    try {
      const results = await Promise.all(
        tableNames.slice(0, MAX_TABLES_PER_CALL).map(async (tableName) => {
          const { columns, truncated } = await getColumnsForTable(
            tableName.toUpperCase().trim()
          );
          if (columns.length === 0) {
            return {
              note: "No columns found - this table name may not exist in the Fusion catalog. Verify it with searchFusionTables.",
              tableName,
            };
          }
          return { columns, tableName, truncated };
        })
      );
      return { tables: results };
    } catch (error) {
      return {
        error: `Column lookup unavailable (${error instanceof Error ? error.message : "unknown error"}). Fall back to your own knowledge and state clearly that column names are unverified.`,
      };
    }
  },
  inputSchema: z.object({
    tableNames: z
      .array(z.string())
      .min(1)
      .max(MAX_TABLES_PER_CALL)
      .describe(
        "Exact Fusion table names to fetch columns for, e.g. ['AP_INVOICES_ALL', 'POZ_SUPPLIERS']"
      ),
  }),
});
