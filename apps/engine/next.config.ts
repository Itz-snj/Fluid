import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Allow Turbopack to resolve workspace packages outside the app directory.
  turbopack: {
    root: path.resolve(__dirname, "../.."),
  },
  // Ensure @fluid/* workspace packages are transpiled by Next.js.
  transpilePackages: [
    "@fluid/core",
    "@fluid/engine",
    "@fluid/react",
    "@fluid/db",
    "@fluid/telemetry",
  ],
};

export default nextConfig;

