import { createAnthropic } from "@ai-sdk/anthropic";
import { customProvider } from "ai";
import { isTestEnvironment } from "../constants";
import { titleModel } from "./models";

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const myProvider = isTestEnvironment
  ? (() => {
      const {
        chatModel,
        titleModel: mockTitleModel,
      } = require("./models.mock");
      return customProvider({
        languageModels: {
          "chat-model": chatModel,
          "title-model": mockTitleModel,
        },
      });
    })()
  : null;

export function getLanguageModel(modelId: string) {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel(modelId);
  }

  return anthropic(modelId);
}

export function getTitleModel() {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("title-model");
  }
  return anthropic(titleModel.id);
}
