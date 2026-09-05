import { QdrantClient } from "@qdrant/js-client-rest";

const TABLES_COLLECTION = "fusion_tables";
const COLUMNS_COLLECTION = "fusion_columns";
const TABLES_VECTOR_DIMENSIONS = 3072;
const COLUMNS_VECTOR_DIMENSIONS = 1024;
const EMBEDDING_MODEL = "text-embedding-3-large";

let client: QdrantClient | null = null;

function getClient(): QdrantClient {
  if (!client) {
    client = new QdrantClient({
      url: process.env.QDRANT_URL ?? "http://localhost:6333",
    });
  }
  return client;
}

export function isSchemaSearchEnabled(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

/**
 * Embeds a query with OpenAI text-embedding-3-large. The two collections were
 * built with different dimension settings, so the dimension must match the
 * target collection (3072 for tables, 1024 for columns).
 */
async function embedQuery(
  query: string,
  dimensions: number
): Promise<number[]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    body: JSON.stringify({
      dimensions,
      input: query,
      model: EMBEDDING_MODEL,
    }),
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Embedding request failed (${response.status}): ${body}`);
  }

  const json = await response.json();
  return json.data[0].embedding;
}

export type FusionTableHit = {
  tableName: string;
  description: string | null;
  module: string | null;
  docModule: string | null;
  docSection: string | null;
  isView: boolean;
  primaryKey: string[] | null;
  score: number;
};

type FieldMatchCondition = { key: string; match: { value: string } };

export async function searchTables(
  query: string,
  limit: number,
  filters?: { module?: string; docSection?: string }
): Promise<FusionTableHit[]> {
  const must: FieldMatchCondition[] = [];
  if (filters?.module) {
    must.push({ key: "module", match: { value: filters.module } });
  }
  if (filters?.docSection) {
    must.push({ key: "doc_section", match: { value: filters.docSection } });
  }

  const vector = await embedQuery(query, TABLES_VECTOR_DIMENSIONS);
  const result = await getClient().query(TABLES_COLLECTION, {
    filter: must.length > 0 ? { must } : undefined,
    limit,
    query: vector,
    with_payload: [
      "table_name",
      "description",
      "module",
      "doc_module",
      "doc_section",
      "is_view",
      "primary_key",
    ],
  });

  return result.points.map((hit) => {
    const payload = hit.payload as Record<string, unknown>;
    const primaryKey = payload.primary_key as { columns?: string[] } | null;
    return {
      description: (payload.description as string) ?? null,
      docModule: (payload.doc_module as string) ?? null,
      docSection: (payload.doc_section as string) ?? null,
      isView: Boolean(payload.is_view),
      module: (payload.module as string) ?? null,
      primaryKey: primaryKey?.columns ?? null,
      score: hit.score,
      tableName: payload.table_name as string,
    };
  });
}

export type FusionColumn = {
  columnName: string;
  dataType: string | null;
  nullable: boolean;
  isPrimaryKey: boolean;
  comment: string | null;
};

const MAX_COLUMNS_PER_TABLE = 600;
const COMMENT_TRUNCATE_LENGTH = 160;

function truncateComment(comment: unknown): string | null {
  if (typeof comment !== "string" || comment.length === 0) {
    return null;
  }
  if (comment.length <= COMMENT_TRUNCATE_LENGTH) {
    return comment;
  }
  return `${comment.slice(0, COMMENT_TRUNCATE_LENGTH)}...`;
}

export async function getColumnsForTable(tableName: string): Promise<{
  columns: FusionColumn[];
  truncated: boolean;
}> {
  const result = await getClient().scroll(COLUMNS_COLLECTION, {
    filter: {
      must: [{ key: "table_name", match: { value: tableName } }],
    },
    limit: MAX_COLUMNS_PER_TABLE + 1,
    with_payload: [
      "column_name",
      "column_id",
      "data_type",
      "nullable",
      "is_pk_column",
      "comment",
    ],
    with_vector: false,
  });

  const points = result.points
    .map((pt) => pt.payload as Record<string, unknown>)
    .sort((a, b) => Number(a.column_id ?? 0) - Number(b.column_id ?? 0));

  const truncated = points.length > MAX_COLUMNS_PER_TABLE;
  const columns = points.slice(0, MAX_COLUMNS_PER_TABLE).map((payload) => ({
    columnName: payload.column_name as string,
    comment: truncateComment(payload.comment),
    dataType: (payload.data_type as string) ?? null,
    isPrimaryKey: Boolean(payload.is_pk_column),
    nullable: Boolean(payload.nullable),
  }));

  return { columns, truncated };
}

export type FusionColumnHit = FusionColumn & {
  tableName: string;
  score: number;
};

export async function searchColumns(
  query: string,
  limit: number
): Promise<FusionColumnHit[]> {
  const vector = await embedQuery(query, COLUMNS_VECTOR_DIMENSIONS);
  const result = await getClient().query(COLUMNS_COLLECTION, {
    limit,
    query: vector,
    with_payload: [
      "table_name",
      "column_name",
      "data_type",
      "nullable",
      "is_pk_column",
      "comment",
    ],
  });

  return result.points.map((hit) => {
    const payload = hit.payload as Record<string, unknown>;
    return {
      columnName: payload.column_name as string,
      comment: truncateComment(payload.comment),
      dataType: (payload.data_type as string) ?? null,
      isPrimaryKey: Boolean(payload.is_pk_column),
      nullable: Boolean(payload.nullable),
      score: hit.score,
      tableName: payload.table_name as string,
    };
  });
}
