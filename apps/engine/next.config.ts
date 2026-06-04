import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Allow Turbopack to resolve workspace packages outside the app directory.
  turbopack: {
    root: path.resolve(__dirname, "../.."),
  },
  // Ensure @fluid-genui/* workspace packages are transpiled by Next.js.
  transpilePackages: [
    "@fluid-genui/core",
    "@fluid-genui/engine",
    "@fluid-genui/react",
    "@fluid-genui/db",
    "@fluid-genui/telemetry",
  ],
};

export default nextConfig;

