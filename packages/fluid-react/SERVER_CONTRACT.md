# Server contract for `@fluid/react`

`@fluid/react` is a pure client library. It expects 8 HTTP endpoints on **your** backend. All paths below are the defaults — override any of them via `<FluidProvider endpoints={...}>` or the hook-level `endpoints` prop.

A complete reference implementation lives in this repo under `demo-app/src/app/api/*`. Copy it and adapt to your stack.

| # | Default path | Method | Consumed by |
|---|---|---|---|
| 1 | `/api/generate` | POST | `useFluidIR`, `fetchIR` |
| 2 | `/api/mutate` | POST | `useMutations` |
| 3 | `/api/telemetry` | POST | `useFluidTelemetry` |
| 4 | `/api/chat` | GET + POST | `useFluidChat`, `FluidChat` |
| 5 | `/api/chat/revert` | POST | `useFluidChat`, `FluidChat` |
| 6 | `/api/suggestions` | GET | `useFluidChat`, `FluidChat` |
| 7 | `/api/suggestions/resolve` | POST | `useFluidChat`, `FluidChat` |
| 8 | `/api/ir/history` | GET | `useFluidChat`, `FluidChat` |

Only #1–#3 are strictly required to render a generated UI. #4–#8 are only needed if you mount `<FluidChat />`.

---

## 1. `POST /api/generate` — IR from intent

**Request body**
```ts
{
  intent: string;
  bypassCache?: boolean;
  userId?: string;
}
```

**Response (200)**
```ts
{
  ir: FluidIR;          // see @fluid/core for the schema
  cached: boolean;
  latencyMs: number;
  attempts: number;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
  } | null;
}
```

Server should call `engine.generate({ schema, intent, userId })` from `@fluid/engine` and return its result verbatim.

---

## 2. `POST /api/mutate` — execute a schema mutation

**Request body**
```ts
{
  mutation: string;                    // mutation name (matches schema.mutations key)
  args: Record<string, unknown>;       // already-resolved arg values
}
```

**Response (200)**
Anything with a truthy `ok` field, e.g. `{ ok: true }`. Errors should return a non-2xx status.

---

## 3. `POST /api/telemetry` — batched usage events

**Request body**
```ts
{
  events: UsageEvent[]; // type from @fluid/engine
}
```

**Response**: 204 or `{ ok: true }`. The hook ignores the body — only the HTTP status matters. Sent with `keepalive: true` so it survives page unload.

---

## 4. `GET /api/chat` — load message history

**Query**
```
?userId=<string>&schemaName=<string>&limit=<number?>
```

**Response (200)**
```ts
{ messages: ChatMessage[] }   // type re-exported as FluidChatMessage
```

## 4. `POST /api/chat` — send a chat message, patch the IR

**Request body**
```ts
{
  message: string;
  currentSnapshotId?: string;
  currentIR?: FluidIR;
  userId: string;
  schemaName: string;
}
```

**Response — patch applied (200)**
```ts
{
  reply: string;
  canApply: true;
  newIR: FluidIR;
  newSnapshotId: string;
  newVersion: number;
}
```

**Response — clarification only (200)**
```ts
{
  reply: string;
  canApply: false;
  clarify?: string;
}
```

---

## 5. `POST /api/chat/revert` — rollback to a snapshot

**Request body**
```ts
{
  userId: string;
  targetSnapshotId: string;
  schemaName: string;
}
```

**Response (200)**
```ts
{
  ok: true;
  newIR: FluidIR;
  newSnapshotId: string;
  newVersion: number;
}
```

---

## 6. `GET /api/suggestions` — pending AI suggestions

**Query**
```
?userId=<string>&schemaName=<string?>
```

**Response (200)**
```ts
{ suggestions: SuggestionItem[] }   // type re-exported as FluidSuggestionItem
```

Polled every 30 s by default. Configure with `useFluidChat({ suggestionPollMs })` or set it to `0` to disable.

---

## 7. `POST /api/suggestions/resolve` — accept or dismiss

**Request body**
```ts
{
  suggestionId: string;
  action: "accept" | "dismiss";
  userId: string;
}
```

**Response — accepted (200)**
```ts
{
  ok: true;
  newIR: FluidIR;
  newSnapshotId: string;
  newVersion: number;
}
```

**Response — dismissed (200)**
```ts
{ ok: true }
```

---

## 8. `GET /api/ir/history` — version history

**Query**
```
?userId=<string>&schemaName=<string?>&limit=<number?>
```

**Response (200)**
```ts
{
  userId: string;
  schemaName: string;
  history: SnapshotMeta[];   // also accepted under `snapshots`
}
```

---

## Endpoint overrides

Either at the provider level (recommended):
```tsx
<FluidProvider
  userId={userId}
  schemaName="tasks"
  endpoints={{
    generate: "/api/v2/fluid/generate",
    chat:     "/api/v2/fluid/chat",
    // any unset keys fall back to "/api/<default>"
  }}
>
  <App />
</FluidProvider>
```

Or per-component:
```tsx
<FluidChat endpoints={{ chat: "/api/custom-chat" }} />
```
