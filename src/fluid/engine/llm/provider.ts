/**
 * Provider-agnostic LLM interface.
 *
 * Swap implementations without touching the engine. Anthropic today;
 * OpenAI/Gemini/etc. could plug in tomorrow by implementing this interface.
 */

export interface GenerateOptions {
  systemPrompt: string;
  userMessage: string;
  /** Recommended for the IR generation use case — large output, deep reasoning. */
  maxTokens?: number;
  /** Free-form provider hint; Anthropic uses adaptive + effort, others ignore. */
  effort?: "low" | "medium" | "high" | "max" | "xhigh";
}

export interface GenerateResult {
  /** The model's text output — for our use case, expected to be JSON. */
  text: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
  };
  model: string;
  provider: string;
}

export interface LLMProvider {
  readonly name: string;
  generate(options: GenerateOptions): Promise<GenerateResult>;
}
