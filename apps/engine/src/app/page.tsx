import Link from "next/link";
import { archetypes, getArchetype } from "@/archetypes";
import { taskSchema } from "@/schemas/tasks.fluid";
import { FluidView, type DataContext } from "@/fluid/react";
import { IntentBox } from "@/components/IntentBox";

interface PageProps {
  searchParams: Promise<{ as?: string }>;
}

export default async function HomePage({ searchParams }: PageProps) {
  const { as = "lawyer" } = await searchParams;
  const archetype = getArchetype(as);

  const data: DataContext = {};
  for (const ep of Object.values(taskSchema.endpoints)) {
    data[ep.entity] = ep.fetch();
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-10 backdrop-blur bg-zinc-950/80 border-b border-zinc-900">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-6">
          <div className="flex items-baseline gap-3">
            <span className="text-lg font-semibold tracking-tight">Fluid</span>
            <span className="text-xs text-zinc-500 hidden sm:inline">
              same schema · same data · UI per user
            </span>
          </div>
          <nav className="flex items-center gap-1 rounded-lg bg-zinc-900 p-1 ring-1 ring-zinc-800">
            {archetypes.map((a) => {
              const active = a.id === archetype.id;
              return (
                <Link
                  key={a.id}
                  href={`/?as=${a.id}`}
                  className={`px-3 py-1.5 text-sm rounded-md transition ${active
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
        <FluidView ir={archetype.ir} data={data} schema={taskSchema} />
      </section>

      <section className="max-w-7xl mx-auto px-6 py-8 border-t border-zinc-900">
        <div className="mb-4">
          <h2 className="text-lg font-semibold tracking-tight">Generate from intent</h2>
          <p className="text-xs text-zinc-500 mt-1">
            Or describe your own workflow and Claude will generate a fresh UI from the same schema and data.
          </p>
        </div>
        <IntentBox data={data} />
      </section>

      <footer className="max-w-7xl mx-auto px-6 py-10 text-xs text-zinc-600">
        Schema: <code className="text-zinc-400">{taskSchema.name}.fluid.ts</code> ·
        IR archetype: <code className="text-zinc-400">{archetype.id}</code> ·
        Phase 2 — Claude Opus 4.7 generates IRs from intent
      </footer>
    </main>
  );
}
