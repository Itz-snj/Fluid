# @fluid/core

Schema definition, IR (intermediate representation) types, and Zod validation for [Fluid](https://github.com/) — the LLM-driven personalized-UI infrastructure.

This package is the **specification layer**. It is what the engine validates LLM output against and what the renderer walks. It has no runtime deps beyond Zod and is safe to import in both server and client code.

## Install

```bash
npm install @fluid/core
# or
bun add @fluid/core
```

## What's exported

```ts
import {
  defineSchema,
  validateIR,
  checkIRAgainstSchema,
  type FluidSchema,
  type FluidIR,
} from "@fluid/core";
```

- `defineSchema(...)` — declare entities, endpoints, mutations.
- `validateIR(unknown)` — Zod-parse arbitrary input into a `FluidIR`.
- `checkIRAgainstSchema(ir, schema)` — semantic check (no undeclared fields, valid endpoints, etc.).
- IR node types: `Stack`, `Split`, `Grid`, `List`, `Kanban`, `Card`, `Stat`, `Heading`, `Field`, `Badge`, `Action`.

## Why a separate package?

The IR is the security boundary between LLM output and rendered components. Keeping the spec, the validators, and the types in their own dep-light package means:

- The engine (`@fluid/engine`) can import it server-side without dragging React.
- The renderer (`@fluid/react`) can import it client-side without dragging an LLM SDK.
- Third-party adapters (custom caches, custom providers) can validate IRs without a heavy dep cone.

See the [project README](https://github.com/) for the full architecture.

## License

MIT
