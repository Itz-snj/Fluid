import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@fluid/core", "@fluid/engine", "@fluid/react", "@fluid/db", "@fluid/telemetry"],
};

export default nextConfig;
