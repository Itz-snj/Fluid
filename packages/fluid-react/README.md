# @fluid/react

React components and hooks for [Fluid](https://github.com/) — the LLM-driven personalized-UI infrastructure.

Drop-in pieces:

- `<FluidProvider />` — one-time mount at your app root. Holds `userId`, `schemaName`, endpoint paths, and the current IR.
- `<FluidView />` — renders a validated `FluidIR` tree with smooth crossfade transitions when the IR changes.
- `<FluidChat />` — floating-FAB chat widget that conversationally patches the IR. Zero-prop when wrapped in `FluidProvider`.
- `useFluidIR`, `useFluidChat`, `useMutations`, `useFluidTelemetry` — the hook surface, for when you want full control.

## Install

```bash
npm install @fluid/react @fluid/core
# requires react >= 19
```

## Drop-in usage

```tsx
"use client";
import { FluidProvider, FluidView, FluidChat, useFluidIR } from "@fluid/react";

export function Page({ data }) {
  return (
    <FluidProvider userId={getOrCreateUserId()} schemaName="tasks">
      <Body data={data} />
      <FluidChat />
    </FluidProvider>
  );
}

function Body({ data }) {
  const { ir, loading } = useFluidIR({ intent: "Show tasks by status" });
  return loading ? <Spinner /> : <FluidView ir={ir} data={data} />;
}
```

Endpoints default to `/api/generate`, `/api/chat`, `/api/suggestions`, etc. — override with `<FluidProvider endpoints={{ chat: "/api/v2/chat" }}>`.

The full list of endpoints your backend needs to implement is documented in [SERVER_CONTRACT.md](./SERVER_CONTRACT.md). A reference implementation lives in the repo's `demo-app/src/app/api/*` routes.

## Controlled vs uncontrolled

The provider supports both modes:

```tsx
// Uncontrolled — provider owns ir/snapshotId state.
<FluidProvider userId={u} schemaName="tasks" initialIR={archetypeIR}>...</FluidProvider>

// Controlled — your component owns it, provider just forwards.
<FluidProvider userId={u} schemaName="tasks" ir={ir} onIRChange={setIR}>...</FluidProvider>
```

## Without a provider

Every component and hook accepts the props it previously required, so the old API still works:

```tsx
<FluidChat
  userId={userId}
  schemaName="tasks"
  currentIR={ir}
  onIRChange={setIR}
/>
```

## License

MIT
