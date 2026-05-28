import type { LLMProvider } from "./provider";
import { AnthropicProvider } from "./anthropic";

export type { LLMProvider, GenerateOptions, GenerateResult } from "./provider";
export { AnthropicProvider } from "./anthropic";

/**
 * Factory: pick a provider based on env. Default = Anthropic.
 *
 * To add OpenAI/Gemini/etc later, drop a new file alongside anthropic.ts
 * implementing LLMProvider, then add a case here. The engine layer never
 * imports a provider directly — it only sees the LLMProvider interface.
 */
export function getProvider(): LLMProvider {
  const name = (process.env.FLUID_LLM_PROVIDER ?? "anthropic").toLowerCase();
  switch (name) {
    case "anthropic":
      return new AnthropicProvider();
    default:
      throw new Error(
        `Unknown FLUID_LLM_PROVIDER=${name}. Supported: anthropic.`,
      );
  }
}
