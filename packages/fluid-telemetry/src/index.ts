/**
 * @fluid-genui/telemetry — Reference implementations for ContextEnricher and RefreshPolicy.
 *
 * These are pure functions with no database dependency. Consumers can use
 * them as-is or write their own implementations of the same interfaces.
 */

export { createContextEnricher } from "./context-enricher";
export { createRefreshPolicy } from "./refresh-policy";
export type { RefreshPolicyOptions } from "./refresh-policy";

export { generateSuggestions } from "./suggestion-generator";
export type {
  SuggestionCandidate,
  UsageSummaryInput,
  SuggestionGeneratorOptions,
} from "./suggestion-generator";
