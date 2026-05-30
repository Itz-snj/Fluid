# Fluid CRM — demo backend

A heavy, Zoho/Tiger-style CRM used as a **backend testbed** for Fluid's
intent → IR → UI engine. This app provides the schema, data, write operations,
and API surface; the dynamic Fluid frontend (intent box, learning loop,
telemetry) is layered on top of the same `/api` routes.

## What's here

- **10 entities** (`src/schemas/crm.entities.ts`): User, Lead, Account, Contact,
  Deal, Activity, Product, Quote, Case, Campaign — with enums, numeric fields
  (for `stat`/`sum` aggregates), dates, and denormalized `*Name` fields.
- **Seed data** (`src/data/*.ts`): realistic in-memory rows for every entity.
- **~16 mutations** (`src/schemas/crm.mutations.{sales,service}.ts`): convert
  lead, advance/close/reassign deal, complete/cancel/reassign activity,
  escalate/close/reassign case, activate/pause campaign, etc.
- **3 preset archetypes** (`src/archetypes/`): sales_rep, sales_manager,
  support_agent — cold-start fallbacks + grammar regression fixtures.
- **API routes** (`src/app/api/`): `generate`, `mutate`, `telemetry`, `usage`,
  `refresh` — identical contract to `apps/engine`, wired to `crmSchema`.

## Denormalization note

The Fluid renderer reads scalar fields off a **single** entity's rows; it does
not join. So every relationship is stored twice: a `<rel>Id` (`ref` field, the
real data model the LLM reasons about) and a `<rel>Name` (denormalized string
the renderer binds to). Mutation handlers keep the two in sync.

## Run

```bash
# from the monorepo root
bun install

# validate archetypes + schema integrity (no API key needed)
bun --filter='@fluid-app/crm' smoke

# dev server on :3001
bun --filter='@fluid-app/crm' dev
```

Set `ANTHROPIC_API_KEY` in `apps/crm/.env.local` for live generation
(see `.env.local.example`). `DATABASE_URL` is optional — without it the engine
uses in-memory adapters (profiles/telemetry reset on restart).

## Try it

```bash
curl -s localhost:3001/api/generate \
  -H 'content-type: application/json' \
  -d '{"intent":"show me deals closing this month grouped by owner, sum the amounts"}' | jq .
```
