import Groq from "groq-sdk";
import type { GenerateOptions, GenerateResult, LLMProvider } from "./provider";

const DEFAULT_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

/**
 * Groq LLM provider.
 *
 * Uses the Groq SDK for ultra-fast inference on open-source models.
 * Groq is free with generous rate limits — ideal for development.
 *
 * Recommended models:
 * - meta-llama/llama-4-scout-17b-16e-instruct (best for structured JSON)
 * - llama-3.3-70b-versatile (powerful, good at following schemas)
 * - gemma2-9b-it (fast, smaller)
 *
 * Get a free key at: https://console.groq.com
 */
export class GroqProvider implements LLMProvider {
  readonly name = "groq";
  private client: Groq;
  private model: string;

  constructor(apiKey: string, model?: string) {
    if (!apiKey) {
      throw new Error(
        "GroqProvider: apiKey is required. Get one free at https://console.groq.com",
      );
    }
    this.client = new Groq({ apiKey });
    this.model = model ?? DEFAULT_MODEL;
  }

  async generate(opts: GenerateOptions): Promise<GenerateResult> {
    try {
      const completion = await this.client.chat.completions.create(
        {
          model: this.model,
          max_tokens: opts.maxTokens ?? 8000,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: opts.systemPrompt +
                "\n\nIMPORTANT: You MUST respond with valid JSON only. No markdown, no code fences, no explanation — just the JSON object.",
            },
            { role: "user", content: opts.userMessage },
          ],
        },
      );

      let text = completion.choices?.[0]?.message?.content ?? "";

      // Strip <think>...</think> blocks (reasoning models)
      text = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

      return {
        text,
        usage: {
          inputTokens: completion.usage?.prompt_tokens ?? 0,
          outputTokens: completion.usage?.completion_tokens ?? 0,
          cacheReadTokens: 0,
          cacheCreationTokens: 0,
        },
        model: completion.model ?? this.model,
        provider: this.name,
      };
    } catch (err: any) {
      if (err?.status) {
        throw new Error(
          `[groq ${err.status}] ${err.message}`,
          { cause: err },
        );
      }
      if (err instanceof Error) {
        throw new Error(`[groq] ${err.message}`, { cause: err });
      }
      throw err;
    }
  }
}
