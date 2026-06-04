import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  external: [
    "@fluid-genui/core",
    "@anthropic-ai/sdk",
    "@google/generative-ai",
    "groq-sdk",
    "zod",
  ],
});
