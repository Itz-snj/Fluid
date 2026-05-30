import type { LLMProvider } from "./provider";
import { AnthropicProvider } from "./anthropic";
import { GeminiProvider } from "./gemini";
import { OpenRouterProvider } from "./openrouter";
import { GroqProvider } from "./groq";

export type { LLMProvider, GenerateOptions, GenerateResult } from "./provider";
export { AnthropicProvider } from "./anthropic";
export { GeminiProvider } from "./gemini";
export { OpenRouterProvider } from "./openrouter";
export { GroqProvider } from "./groq";

/**
 * Default provider factory — Anthropic.
 */
export function createAnthropicProvider(apiKey: string): LLMProvider {
  return new AnthropicProvider(apiKey);
}

/**
 * Gemini (Google AI Studio) provider factory.
 */
export function createGeminiProvider(apiKey: string): LLMProvider {
  return new GeminiProvider(apiKey);
}

/**
 * OpenRouter provider factory.
 * Routes to many models (Claude, GPT-4, Gemini, etc.) via a single API key.
 */
export function createOpenRouterProvider(apiKey: string, model?: string): LLMProvider {
  return new OpenRouterProvider(apiKey, model);
}

/**
 * Groq provider factory.
 * Ultra-fast inference on open-source models. Free tier available.
 */
export function createGroqProvider(apiKey: string, model?: string): LLMProvider {
  return new GroqProvider(apiKey, model);
}
