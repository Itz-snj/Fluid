import type { GenerateOptions, GenerateResult, LLMProvider } from "./provider";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "google/gemini-2.5-flash";

/**
 * Free model fallback list — tried in order when the primary model
 * returns a 429 rate-limit error.
 */
const FREE_FALLBACKS = [
  "deepseek/deepseek-r1-distill:free",
  "deepseek/deepseek-v4-flash:free",
  "meta-llama/llama-3.3-70b:free",
  "google/gemma-4-31b-it:free",
  "openai/gpt-oss-20b:free",
  "openai/gpt-oss-120b:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "minimax/minimax-m2.5:free",
];

/**
 * OpenRouter LLM provider.
 *
 * Uses the OpenAI-compatible /chat/completions endpoint from OpenRouter.
 * This allows access to many models (Claude, GPT-4, Gemini, etc.) with
 * a single API key. No additional SDK dependency needed — plain fetch.
 *
 * When a free model returns 429, the provider automatically tries the
 * next model in the FREE_FALLBACKS list.
 *
 * API key format: starts with "sk-or-v1-..."
 */
export class OpenRouterProvider implements LLMProvider {
  readonly name = "openrouter";
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model?: string) {
    if (!apiKey) {
      throw new Error(
        "OpenRouterProvider: apiKey is required. Pass it via createEngine({ provider }).",
      );
    }
    this.apiKey = apiKey;
    this.model = model ?? DEFAULT_MODEL;
  }

  async generate(opts: GenerateOptions): Promise<GenerateResult> {
    // Build the list of models to try: primary model first, then fallbacks
    const modelsToTry = [this.model];
    if (this.model.endsWith(":free")) {
      for (const fb of FREE_FALLBACKS) {
        if (!modelsToTry.includes(fb)) modelsToTry.push(fb);
      }
    }

    let lastError: Error | null = null;

    for (const model of modelsToTry) {
      try {
        const result = await this.callModel(model, opts);
        if (model !== this.model) {
          console.log(`[openrouter] Primary model rate-limited, succeeded with fallback: ${model}`);
        }
        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        // Only retry on 429 rate-limit errors
        if (lastError.message.includes("429")) {
          console.warn(`[openrouter] ${model} rate-limited, trying next...`);
          continue;
        }
        // Non-429 errors are thrown immediately
        throw lastError;
      }
    }

    throw lastError ?? new Error("[openrouter] All models rate-limited");
  }

  private async callModel(model: string, opts: GenerateOptions): Promise<GenerateResult> {
    const body = {
      model,
      max_tokens: opts.maxTokens ?? 8000,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system" as const,
          content: opts.systemPrompt +
            "\n\nIMPORTANT: You MUST respond with valid JSON only. No markdown, no code fences, no explanation — just the JSON object.",
        },
        { role: "user" as const, content: opts.userMessage },
      ],
    };

    const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://fluid-crm.dev",
        "X-Title": "Fluid CRM",
      },
      body: JSON.stringify(body),
      signal: opts.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `[openrouter ${response.status}] ${errorBody}`,
      );
    }

    const data = await response.json() as {
      choices: Array<{
        message: { content: string };
      }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
      };
      model?: string;
    };

    let text = data.choices?.[0]?.message?.content ?? "";

    // Strip <think>...</think> blocks (DeepSeek, Qwen reasoning models)
    text = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

    return {
      text,
      usage: {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
      },
      model: data.model ?? model,
      provider: this.name,
    };
  }
}
