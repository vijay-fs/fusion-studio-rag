/**
 * Verifies benchmark SQL outputs against the Fusion catalog in Qdrant:
 * every FROM/JOIN table must exist in fusion_tables, and every alias.column
 * reference must exist on that table in fusion_columns.
 *
 * Usage: pnpm exec tsx bench/verify-sql.mts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { QdrantClient } from "@qdrant/js-client-rest";

const client = new QdrantClient({
  url: process.env.QDRANT_URL ?? "http://localhost:6333",
});

const SQL_FENCE = /```sql\n([\s\S]*?)```/g;
const TABLE_REF =
  /\b(?:FROM|JOIN)\s+([a-zA-Z_][\w$#]*)(?:\s+(?:AS\s+)?([a-zA-Z_]\w*))?/gi;
const CTE_NAME = /(?:\bWITH\s+|,\s*)([a-zA-Z_]\w*)\s+AS\s*\(/gi;
const COLUMN_REF = /\b([a-zA-Z_]\w*)\.([a-zA-Z_][\w$#]*)/g;
const SQL_KEYWORDS = new Set([
  "AND",
  "AS",
  "BY",
  "CASE",
  "ELSE",
  "END",
  "FROM",
  "GROUP",
  "HAVING",
  "IN",
  "INNER",
  "JOIN",
  "LEFT",
  "NOT",
  "ON",
  "OR",
  "ORDER",
  "OUTER",
  "RIGHT",
  "SELECT",
  "THEN",
  "WHEN",
  "WHERE",
  "WITH",
]);

type ScrollOffset = Awaited<
  ReturnType<typeof client.scroll>
>["next_page_offset"];
type TableCheck = { exists: boolean; tableName: string };
type ColumnCheck = { columnName: string; exists: boolean; tableName: string };

const tableExistsCache = new Map<string, boolean>();
const tableColumnsCache = new Map<string, Set<string>>();

async function tableExists(tableName: string): Promise<boolean> {
  const cached = tableExistsCache.get(tableName);
  if (cached !== undefined) {
    return cached;
  }
  const result = await client.scroll("fusion_tables", {
    filter: { must: [{ key: "table_name", match: { value: tableName } }] },
    limit: 1,
    with_payload: false,
    with_vector: false,
  });
  const exists = result.points.length > 0;
  tableExistsCache.set(tableName, exists);
  return exists;
}

async function getAllColumns(tableName: string): Promise<Set<string>> {
  const cached = tableColumnsCache.get(tableName);
  if (cached) {
    return cached;
  }
  const columns = new Set<string>();
  let offset: ScrollOffset;
  do {
    // biome-ignore lint/performance/noAwaitInLoops: cursor pagination requires sequential requests
    const result = await client.scroll("fusion_columns", {
      filter: { must: [{ key: "table_name", match: { value: tableName } }] },
      limit: 1000,
      offset,
      with_payload: ["column_name"],
      with_vector: false,
    });
    for (const pt of result.points) {
      columns.add(String(pt.payload?.column_name ?? ""));
    }
    offset = result.next_page_offset ?? undefined;
  } while (offset);
  tableColumnsCache.set(tableName, columns);
  return columns;
}

type BenchmarkRun = {
  modelId: string;
  questionId: string;
  status: string;
  text?: string;
};

function extractSql(text: string): string[] {
  return [...text.matchAll(SQL_FENCE)].map((m) => m[1]);
}

async function verifyRun(run: BenchmarkRun) {
  const sqlBlocks = extractSql(run.text ?? "");
  const aliasToTable = new Map<string, string>();
  const tables = new Set<string>();
  const cteNames = new Set<string>();

  for (const sql of sqlBlocks) {
    for (const match of sql.matchAll(CTE_NAME)) {
      cteNames.add(match[1].toUpperCase());
    }
  }

  for (const sql of sqlBlocks) {
    for (const match of sql.matchAll(TABLE_REF)) {
      const [, rawTableName, alias] = match;
      const tableName = rawTableName.toUpperCase();
      if (
        SQL_KEYWORDS.has(tableName) ||
        tableName === "DUAL" ||
        cteNames.has(tableName)
      ) {
        continue;
      }
      tables.add(tableName);
      if (alias && !SQL_KEYWORDS.has(alias.toUpperCase())) {
        aliasToTable.set(alias.toLowerCase(), tableName);
      }
    }
  }

  const tableResults: TableCheck[] = await Promise.all(
    [...tables].map(async (tableName) => ({
      exists: await tableExists(tableName),
      tableName,
    }))
  );
  const existingTables = tableResults
    .filter((check) => check.exists)
    .map((check) => check.tableName);
  const columnsByTable = new Map<string, Set<string>>(
    await Promise.all(
      existingTables.map(
        async (tableName): Promise<[string, Set<string>]> => [
          tableName,
          await getAllColumns(tableName),
        ]
      )
    )
  );

  const checkedColumns: ColumnCheck[] = [];
  const skippedAliases = new Set<string>();
  for (const sql of sqlBlocks) {
    for (const match of sql.matchAll(COLUMN_REF)) {
      const [, rawAlias, rawColumnName] = match;
      const columnName = rawColumnName.toUpperCase();
      const tableName = aliasToTable.get(rawAlias.toLowerCase());
      if (!tableName) {
        skippedAliases.add(rawAlias);
        continue;
      }
      const columns = columnsByTable.get(tableName);
      if (!columns) {
        continue;
      }
      checkedColumns.push({
        columnName,
        exists: columns.has(columnName),
        tableName,
      });
    }
  }

  const uniqueColumns = new Map<string, ColumnCheck>();
  for (const check of checkedColumns) {
    uniqueColumns.set(`${check.tableName}.${check.columnName}`, check);
  }
  const columnResults = [...uniqueColumns.values()];

  return {
    badColumns: columnResults.filter((c) => !c.exists),
    badTables: tableResults.filter((t) => !t.exists),
    columnsChecked: columnResults.length,
    columnsValid: columnResults.filter((c) => c.exists).length,
    modelId: run.modelId,
    questionId: run.questionId,
    skippedAliases: [...skippedAliases],
    sqlBlockCount: sqlBlocks.length,
    tablesChecked: tableResults.length,
    tablesValid: tableResults.filter((t) => t.exists).length,
  };
}

const raw = JSON.parse(
  readFileSync("bench/results/benchmark-raw.json", "utf8")
);
const successfulRuns: BenchmarkRun[] = raw.results.filter(
  (run: BenchmarkRun) => run.status === "ok"
);
const verifications = await Promise.all(successfulRuns.map(verifyRun));
for (const verification of verifications) {
  console.log(
    `${verification.modelId} / ${verification.questionId}: tables ${verification.tablesValid}/${verification.tablesChecked}, columns ${verification.columnsValid}/${verification.columnsChecked}` +
      (verification.badTables.length
        ? ` | BAD TABLES: ${verification.badTables.map((t) => t.tableName).join(", ")}`
        : "") +
      (verification.badColumns.length
        ? ` | BAD COLUMNS: ${verification.badColumns.map((c) => `${c.tableName}.${c.columnName}`).join(", ")}`
        : "")
  );
}

writeFileSync(
  "bench/results/verification.json",
  JSON.stringify(verifications, null, 2)
);
console.log("Saved to bench/results/verification.json");
