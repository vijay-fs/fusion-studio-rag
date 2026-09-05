import type { InferUITool, UIMessage } from "ai";
import { z } from "zod";
import type { ArtifactKind } from "@/components/chat/artifact";
import type { createDocument } from "./ai/tools/create-document";
import type { getFusionTableColumns } from "./ai/tools/get-fusion-table-columns";
import type { listFusionDomains } from "./ai/tools/list-fusion-domains";
import type { requestSuggestions } from "./ai/tools/request-suggestions";
import type { searchFusionColumns } from "./ai/tools/search-fusion-columns";
import type { searchFusionTables } from "./ai/tools/search-fusion-tables";
import type { updateDocument } from "./ai/tools/update-document";
import type { Suggestion } from "./db/schema";

export const messageMetadataSchema = z.object({
  createdAt: z.string(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

type listFusionDomainsTool = InferUITool<typeof listFusionDomains>;
type searchFusionTablesTool = InferUITool<typeof searchFusionTables>;
type getFusionTableColumnsTool = InferUITool<typeof getFusionTableColumns>;
type searchFusionColumnsTool = InferUITool<typeof searchFusionColumns>;
type createDocumentTool = InferUITool<ReturnType<typeof createDocument>>;
type updateDocumentTool = InferUITool<ReturnType<typeof updateDocument>>;
type requestSuggestionsTool = InferUITool<
  ReturnType<typeof requestSuggestions>
>;

export type ChatTools = {
  listFusionDomains: listFusionDomainsTool;
  searchFusionTables: searchFusionTablesTool;
  getFusionTableColumns: getFusionTableColumnsTool;
  searchFusionColumns: searchFusionColumnsTool;
  createDocument: createDocumentTool;
  updateDocument: updateDocumentTool;
  requestSuggestions: requestSuggestionsTool;
};

export type WaitingStatusData = {
  phase: "waiting" | "still-waiting" | "health" | "thinking";
  message: string;
  modelId: string;
  modelName: string;
};

export type CustomUIDataTypes = {
  textDelta: string;
  imageDelta: string;
  sheetDelta: string;
  codeDelta: string;
  suggestion: Suggestion;
  appendMessage: string;
  id: string;
  title: string;
  kind: ArtifactKind;
  clear: null;
  finish: null;
  "chat-title": string;
  "waiting-status": WaitingStatusData;
};

export type ChatMessage = UIMessage<
  MessageMetadata,
  CustomUIDataTypes,
  ChatTools
>;

export type Attachment = {
  name: string;
  url: string;
  contentType: string;
};
