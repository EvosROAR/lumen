import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["openai", "pdf-parse"],
};

export default nextConfig;
