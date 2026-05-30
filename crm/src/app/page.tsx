import Link from "next/link";
import { archetypes, getArchetype } from "@/archetypes";
import { crmSchema } from "@/schemas/crm.fluid";
import { FluidView, type DataContext } from "@fluid/react";

interface PageProps {
  searchParams: Promise<{ as?: string }>;
}

/**
 * Minimal demo page — proves the CRM backend wiring end to end.
 *
 * It builds the DataContext by calling every endpoint's fetch(), picks a preset
 * archetype, and hands both to <FluidView>. The dynamic frontend (intent box,
 * learning loop, telemetry) is layered on top of the same /api routes later.
 */
export default async function HomePage({ searchParams }: PageProps) {
  const { as = "sales_rep" } = await searchParams;
  const archetype = getArchetype(as);

  const data: DataContext = {};
  for (const ep of Object.values(crmSchema.endpoints)) {
    data[ep.entity] = await ep.fetch();
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-10 backdrop-blur bg-zinc-950/80 border-b border-zinc-900">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-6">
          <div className="flex items-baseline gap-3">
            <span className="text-lg font-semibold tracking-tight">Fluid CRM</span>
            <span className="text-xs text-zinc-500 hidden sm:inline">
              one schema · ten entities · a UI per role
            </span>
          </div>
          <nav className="flex items-center gap-1 rounded-lg bg-zinc-900 p-1 ring-1 ring-zinc-800">
            {archetypes.map((a) => {
              const active = a.id === archetype.id;
              return (
                <Link
                  key={a.id}
                  href={`/?as=${a.id}`}
                  className={`px-3 py-1.5 text-sm rounded-md transition ${
                    active
                      ? "bg-zinc-100 text-zinc-900 font-medium"
                      : "text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800"
                  }`}
                >
                  <span className="mr-1.5">{a.emoji}</span>
                  {a.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="max-w-7xl mx-auto px-6 pb-3">
          <p className="text-xs text-zinc-500">
            <span className="text-zinc-400">Intent:</span>{" "}
            <span className="italic">&ldquo;{archetype.intent}&rdquo;</span>
          </p>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-6 py-8">
        <FluidView ir={archetype.ir} data={data} schema={crmSchema} />
      </section>

      <footer className="max-w-7xl mx-auto px-6 py-10 text-xs text-zinc-600">
        Schema: <code className="text-zinc-400">{crmSchema.name}.fluid.ts</code> ·
        Archetype: <code className="text-zinc-400">{archetype.id}</code> ·
        POST <code className="text-zinc-400">/api/generate</code> to generate a UI from intent
      </footer>
    </main>
  );
}
