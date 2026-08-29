export const DEFAULT_CHAT_MODEL = "claude-opus-5";

export const titleModel = {
  description: "Fast model for title generation",
  id: "claude-haiku-4-5",
  name: "Claude Haiku 4.5",
  provider: "anthropic",
};

export type ModelCapabilities = {
  tools: boolean;
  vision: boolean;
  reasoning: boolean;
};

export type ChatModel = {
  id: string;
  name: string;
  provider: string;
  description: string;
  capabilities: ModelCapabilities;
};

export const chatModels: ChatModel[] = [
  {
    capabilities: { reasoning: true, tools: true, vision: true },
    description: "Most capable model, best Fusion SQL accuracy",
    id: "claude-opus-5",
    name: "Claude Opus 5",
    provider: "anthropic",
  },
  {
    capabilities: { reasoning: true, tools: true, vision: true },
    description: "Fast and capable, good balance of speed and quality",
    id: "claude-sonnet-5",
    name: "Claude Sonnet 5",
    provider: "anthropic",
  },
  {
    capabilities: { reasoning: false, tools: true, vision: true },
    description: "Fastest model for quick lookups",
    id: "claude-haiku-4-5",
    name: "Claude Haiku 4.5",
    provider: "anthropic",
  },
];

export function getCapabilities(): Promise<Record<string, ModelCapabilities>> {
  return Promise.resolve(
    Object.fromEntries(chatModels.map((m) => [m.id, m.capabilities]))
  );
}

export const isDemo = process.env.IS_DEMO === "1";

export type GatewayModelWithCapabilities = ChatModel;

export function getAllGatewayModels(): Promise<GatewayModelWithCapabilities[]> {
  return Promise.resolve(chatModels);
}

export function getActiveModels(): ChatModel[] {
  return chatModels;
}

export const allowedModelIds = new Set(chatModels.map((m) => m.id));

export const modelsByProvider = chatModels.reduce(
  (acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  },
  {} as Record<string, ChatModel[]>
);

export type ModelAvailability = "healthy" | "impacted" | "unknown";

export function getModelAvailability(): Promise<ModelAvailability> {
  return Promise.resolve("unknown");
}
