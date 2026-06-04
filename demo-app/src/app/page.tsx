import { demoSchema } from "@/schemas/demo.fluid";
import { Dashboard } from "@/components/Dashboard";
import type { DataContext } from "@fluid-genui/react";

/**
 * Main Page (Server Component)
 *
 * Fetches data server-side and passes it to the client Dashboard component.
 */
export default async function HomePage() {
  // Fetch all data from schema endpoints
  const data: DataContext = {};

  try {
    for (const [name, ep] of Object.entries(demoSchema.endpoints)) {
      try {
        const result = await ep.fetch();
        data[ep.entity] = Array.isArray(result) ? result : [];
      } catch (err) {
        console.error(`Error fetching ${ep.entity}:`, err);
        data[ep.entity] = [];
      }
    }
  } catch (error) {
    console.error("Error fetching data:", error);
    // Provide empty arrays as fallback
    data.Task = [];
    data.Project = [];
    data.Team = [];
    data.User = [];
  }

  // Strip functions from schema before sending to client
  let clientSchema;
  try {
    clientSchema = JSON.parse(JSON.stringify(demoSchema));
  } catch (err) {
    console.error("Error serializing schema:", err);
    clientSchema = { name: "demo", entities: {}, endpoints: {}, mutations: {} };
  }

  return (
    <main className="min-h-screen bg-zinc-950">
      <Dashboard data={data} schema={clientSchema} />
    </main>
  );
}
