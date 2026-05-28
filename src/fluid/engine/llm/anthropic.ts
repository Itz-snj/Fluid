import Anthropic from "@anthropic-ai/sdk";
import type { GenerateOptions, GenerateResult, LLMProvider } from "./provider";

const MODEL = "claude-opus-4-7";

/**
 * Anthropic SDK implementation.
 *
 * - Uses Opus 4.7 with adaptive thinking — the IR generation task is non-trivial
 *   pattern-matching from intent + schema to a layout tree, so adaptive thinking
 *   is worth it. Effort defaults to "high" — bumped to "xhigh" for codegen.
 * - Streams the response so we can use a generous max_tokens (IRs can be ~4-8K
 *   tokens) without hitting SDK HTTP timeouts.
 * - System prompt is split into [stable | cache_control breakpoint | schema-context]
 *   so repeat requests with the same schema reuse the cache. The user message
 *   carries the volatile intent string and is never cached.
 */
export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic";
  private client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic({ apiKey });
  }

  async generate(opts: GenerateOptions): Promise<GenerateResult> {
    const stream = this.client.messages.stream({
      model: MODEL,
      max_tokens: opts.maxTokens ?? 16000,
      thinking: { type: "adaptive" },
      output_config: { effort: opts.effort ?? "xhigh" },
      system: [
        {
          type: "text",
          text: opts.systemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: opts.userMessage }],
    });

    try {
      const message = await stream.finalMessage();
      const text = message.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");

      return {
        text,
        usage: {
          inputTokens: message.usage.input_tokens,
          outputTokens: message.usage.output_tokens,
          cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
          cacheCreationTokens: message.usage.cache_creation_input_tokens ?? 0,
        },
        model: message.model,
        provider: this.name,
      };
    } catch (err) {
      if (err instanceof Anthropic.APIError) {
        throw new Error(
          `[anthropic ${err.status ?? "?"}] ${err.message}`,
          { cause: err },
        );
      }
      throw err;
    }
  }
}
