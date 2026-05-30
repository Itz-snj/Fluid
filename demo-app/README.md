# Fluid Demo App - Complete Implementation

A comprehensive demonstration of Fluid's capabilities including:

- ✅ **Database Integration** - Postgres with Drizzle ORM
- ✅ **LLM Providers** - Anthropic Claude Opus 4.7 & Google Gemini 2.5 Flash
- ✅ **Intent Caching** - Multi-layer caching (IR cache + prompt cache)
- ✅ **Personalization** - Learning loop with user profiles
- ✅ **Chat UI** - Conversational IR patching with history
- ✅ **Suggestions** - AI-powered proactive UI improvements
- ✅ **Rollback** - Version history with snapshot revert
- ✅ **Telemetry** - Usage tracking and analytics
- ✅ **Mutations** - Interactive actions from generated UI
- ✅ **Rate Limiting** - Protection against abuse
- ✅ **Proper Error Handling** - Timeouts, retries, validation

## Quick Start

### 1. Prerequisites

- Bun 1.0+ (or Node.js 20+)
- PostgreSQL database
- Anthropic API key OR Google Gemini API key

### 2. Setup Environment

```bash
# Copy environment template
cp .env.example .env.local

# Edit .env.local with your credentials
# Required: ANTHROPIC_API_KEY or GEMINI_API_KEY
# Required: DATABASE_URL
```

### 3. Setup Database

```bash
# Push Drizzle schema to your database
bun run db:push

# Optional: Open Drizzle Studio to inspect tables
bun run db:studio
```

This creates the following tables:
- `fluid_ir_cache` - Generated IR cache
- `fluid_user_profiles` - User intent history
- `fluid_usage_events` - Telemetry events
- `fluid_snapshots` - IR version chain
- `fluid_chat_messages` - Chat history
- `fluid_suggestions` - AI suggestions

### 4. Run the App

```bash
bun install
bun run dev
```

Open [http://localhost:3002](http://localhost:3002)

## Features Walkthrough

### 1. **Intent-Based Generation**

Type natural language descriptions of how you want to see your data:

- "Show tasks as a kanban board grouped by status"
- "List overdue tasks with priority badges"
- "Split view: projects on left, tasks on right"

The LLM reads your schema and generates a personalized UI.

### 2. **Personalization (Learn Mode)**

Toggle "Remember my preferences" to enable the learning loop:

- Your intent history is stored per user
- Future generations are biased by past preferences
- Profile is displayed showing what Fluid remembers about you

### 3. **Chat UI**

Click the chat bubble (bottom-right) to:

- Modify the current UI conversationally
- See chat history with applied/rejected changes
- View version history and revert to previous states

Example chat messages:
- "Make the cards bigger"
- "Add a priority filter"
- "Show assignee avatars"

### 4. **AI Suggestions**

The system proactively suggests improvements based on:

- Usage patterns (which sections you interact with)
- Common workflows
- Data characteristics

Suggestions appear in the chat widget. Accept or dismiss them.

### 5. **Rollback / Version History**

Every generation and chat patch creates a snapshot:

- View version history in the chat widget
- Click any version to preview it
- Revert to any previous state

### 6. **Mutations (Interactive Actions)**

Generated UIs can include action buttons:

- "Mark as Done" buttons on tasks
- "Change Status" dropdowns
- Custom mutations defined in your schema

All mutations are validated and executed server-side.

### 7. **Telemetry**

Usage events are automatically tracked:

- Which UI sections are viewed
- How long users spend on each section
- Interaction patterns

View usage summary at `/api/usage?userId=<your-user-id>`

### 8. **Multi-Provider Support**

Switch between LLM providers in `.env.local`:

```bash
# Use Anthropic Claude Opus 4.7 (default)
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...

# OR use Google Gemini 2.5 Flash
LLM_PROVIDER=gemini
GEMINI_API_KEY=AIza...
```

## Project Structure

```
demo-app/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── generate/route.ts      # Intent → IR generation
│   │   │   ├── chat/route.ts          # Conversational patching
│   │   │   ├── chat/revert/route.ts   # Rollback to snapshot
│   │   │   ├── suggestions/route.ts   # Get AI suggestions
│   │   │   ├── suggestions/resolve/   # Accept/dismiss suggestions
│   │   │   ├── telemetry/route.ts     # Usage tracking
│   │   │   ├── mutate/route.ts        # Execute mutations
│   │   │   ├── refresh/route.ts       # Background refresh
│   │   │   ├── usage/route.ts         # Usage analytics
│   │   │   └── ir/history/route.ts    # Version history
│   │   ├── layout.tsx                 # Root layout
│   │   ├── page.tsx                   # Main page (server)
│   │   └── globals.css                # Tailwind styles
│   ├── components/
│   │   └── Dashboard.tsx              # Main client component
│   ├── lib/
│   │   └── engine.ts                  # Engine singleton
│   └── schemas/
│       └── demo.fluid.ts              # Schema definition
├── .env.example                       # Environment template
├── .env.local                         # Your credentials (gitignored)
├── package.json
├── tsconfig.json
└── next.config.ts
```

## API Routes Reference

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/generate` | POST | Generate IR from intent |
| `/api/chat` | POST | Send chat message, patch IR |
| `/api/chat` | GET | Load chat history |
| `/api/chat/revert` | POST | Revert to previous snapshot |
| `/api/suggestions` | GET | Get pending suggestions |
| `/api/suggestions/resolve` | POST | Accept/dismiss suggestion |
| `/api/telemetry` | POST | Record usage events |
| `/api/mutate` | POST | Execute schema mutation |
| `/api/refresh` | POST | Background IR refresh |
| `/api/usage` | GET | Get usage summary |
| `/api/ir/history` | GET | Get version history |

## Schema Definition

The schema (`src/schemas/demo.fluid.ts`) defines:

1. **Entities** - Data models (Task, Project, Team)
2. **Endpoints** - Data fetching functions
3. **Mutations** - Interactive actions

Example:

```typescript
export const demoSchema = defineSchema({
  name: "demo",
  entities: {
    Task: {
      fields: {
        id: { type: "string" },
        title: { type: "string" },
        status: { type: "enum", values: ["todo", "doing", "done"] },
        // ... more fields
      },
    },
  },
  endpoints: {
    tasks: {
      entity: "Task",
      fetch: async () => {
        // Your database query
        return await db.query.tasks.findMany();
      },
    },
  },
  mutations: {
    completeTask: {
      entity: "Task",
      args: { id: { type: "string", required: true } },
      handler: async ({ id }) => {
        await db.update(tasks).set({ status: "done" }).where(eq(tasks.id, id));
        return { ok: true };
      },
    },
  },
});
```

## Performance Characteristics

| Scenario | Latency | Cost |
|----------|---------|------|
| Cache hit (same intent) | <50ms | $0 |
| Cache miss, hot prompt cache | 5-10s | ~30% cheaper |
| Cold generation | 8-15s | Full LLM cost |
| Chat patch | 3-8s | Depends on change complexity |

## Caching Strategy

Three layers of caching:

1. **IR Cache** - Stores generated IRs by `(schema, intent, userId?)`
   - Default: In-memory LRU (500 entries, 1h TTL)
   - Production: Postgres via `@fluid/db`

2. **Prompt Cache** - Anthropic's 5-minute cache for system prompts
   - Automatically enabled
   - Reduces input token costs by ~70%

3. **Client Cache** - React state in `useFluidIR`
   - Prevents unnecessary re-fetches
   - Can be enhanced with React Query/SWR

## Troubleshooting

### Database Connection Issues

```bash
# Test connection
psql $DATABASE_URL

# Verify tables exist
bun run db:studio
```

### LLM API Issues

```bash
# Test Anthropic key
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-opus-4-20250514","max_tokens":100,"messages":[{"role":"user","content":"Hi"}]}'

# Test Gemini key
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=$GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Hi"}]}]}'
```

### Rate Limiting

Default: 20 requests per minute per IP

Adjust in `src/lib/engine.ts`:

```typescript
createEngine({
  rateLimiter: createMemoryRateLimiter({ 
    maxRequests: 50, 
    windowMs: 60_000 
  }),
});
```

## Production Deployment

### Environment Variables

Set these in your hosting platform:

- `ANTHROPIC_API_KEY` or `GEMINI_API_KEY`
- `DATABASE_URL` (Postgres connection string)
- `LLM_PROVIDER` (optional, defaults to anthropic)

### Database

Use a managed Postgres service:
- Neon
- Supabase
- Railway
- Render

### Scaling Considerations

1. **Horizontal Scaling** - Use Redis for cache/rate-limiter instead of in-memory
2. **Database Connection Pooling** - Use PgBouncer or Supabase pooler
3. **CDN** - Cache static assets
4. **Background Jobs** - Use a queue for refresh jobs

## Next Steps

1. **Customize the Schema** - Edit `src/schemas/demo.fluid.ts` with your entities
2. **Connect Real Data** - Replace mock data with actual database queries
3. **Style the UI** - Customize `src/app/globals.css` and component styles
4. **Add Authentication** - Integrate with your auth provider
5. **Deploy** - Push to Vercel, Railway, or your preferred platform

## Learn More

- [Fluid Architecture](../ARCHITECTURE.md)
- [Fluid README](../README.md)
- [Package Documentation](../packages/)

## Support

For issues or questions, check the main repository documentation or create an issue.
