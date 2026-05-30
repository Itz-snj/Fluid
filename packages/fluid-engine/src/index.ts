// Public entry point for @fluid/engine.

export { createEngine, buildExpandedIntent } from "./engine";
export type {
  CreateEngineOptions,
  EngineGenerateOptions,
  EngineRefineOptions,
  EngineRefineResult,
  FluidEngine,
} from "./engine";

// Lower-level pieces — exported so consumers can wire them à la carte.
export { generateIR } from "./generate";
export type { GenerateIROptions, GenerateIRResult } from "./generate";

export { intentKey, createMemoryCache } from "./cache";
export type { MemoryCacheOptions } from "./cache";

export { createMemoryRateLimiter } from "./rate-limit";
export type { MemoryRateLimitOptions } from "./rate-limit";

export { createMemoryProfileStore } from "./profile";
export type { MemoryProfileStoreOptions } from "./profile";

export type {
  CacheAdapter,
  RateLimiter,
  RateLimitDecision,
  ProfileStore,
  IntentProfile,
  IntentHistoryEntry,
  // New adapter interfaces
  UsageEvent,
  UsageSummary,
  UsageTracker,
  ContextSignals,
  ContextEnricher,
  RefreshDecision,
  RefreshPolicy,
} from "./adapters";

export {
  createAnthropicProvider,
  AnthropicProvider,
} from "./llm";
export type {
  LLMProvider,
  GenerateOptions,
  GenerateResult,
} from "./llm";

export { buildSystemPrompt } from "./prompt";

