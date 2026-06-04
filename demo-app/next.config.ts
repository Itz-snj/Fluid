import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@fluid-genui/core", "@fluid-genui/engine", "@fluid-genui/react", "@fluid-genui/db", "@fluid-genui/telemetry"],
};

export default nextConfig;
