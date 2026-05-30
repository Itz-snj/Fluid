import type { LLMProvider } from "./provider";
import { AnthropicProvider } from "./anthropic";

export type { LLMProvider, GenerateOptions, GenerateResult } from "./provider";
export { AnthropicProvider } from "./anthropic";

/**
 * Default provider factory — Anthropic only for now.
 *
 * The library is BYOK: the consumer passes the API key into createEngine().
 * No env reads inside the package; that's the consumer's job. To plug in
 * OpenAI/Gemini/etc later, implement LLMProvider in a sibling file and pass
 * the instance directly to createEngine({ provider }).
 */
export function createAnthropicProvider(apiKey: string): LLMProvider {
  return new AnthropicProvider(apiKey);
}
