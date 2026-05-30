import { GoogleGenerativeAI } from "@google/generative-ai";
import type { GenerateOptions, GenerateResult, LLMProvider } from "./provider";

const MODEL = "gemini-2.0-flash";

/**
 * Google Gemini (AI Studio) provider.
 *
 * Uses the @google/generative-ai SDK with Gemini 2.5 Flash.
 * Drop-in replacement for AnthropicProvider — same LLMProvider interface.
 *
 * API key format: starts with "AIza..." or the free-tier "fe_oa_..." keys
 * from Google AI Studio.
 */
export class GeminiProvider implements LLMProvider {
  readonly name = "gemini";
  private client: GoogleGenerativeAI;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error(
        "GeminiProvider: apiKey is required. Pass it via createEngine({ provider }).",
      );
    }
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async generate(opts: GenerateOptions): Promise<GenerateResult> {
    const model = this.client.getGenerativeModel({
      model: MODEL,
      systemInstruction: opts.systemPrompt,
      generationConfig: {
        maxOutputTokens: opts.maxTokens ?? 16000,
        temperature: 0.3,
      },
    });

    try {
      const result = await model.generateContent(opts.userMessage);
      const response = result.response;
      const text = response.text();

      // Gemini usage metadata.
      const usageMeta = response.usageMetadata;

      return {
        text,
        usage: {
          inputTokens: usageMeta?.promptTokenCount ?? 0,
          outputTokens: usageMeta?.candidatesTokenCount ?? 0,
          cacheReadTokens: 0,
          cacheCreationTokens: 0,
        },
        model: MODEL,
        provider: this.name,
      };
    } catch (err) {
      if (err instanceof Error) {
        throw new Error(
          `[gemini] ${err.message}`,
          { cause: err },
        );
      }
      throw err;
    }
  }
}
