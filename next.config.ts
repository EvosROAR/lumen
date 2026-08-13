import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep native/pdf workers out of the Next bundle (required on Vercel).
  serverExternalPackages: ["openai", "pdf-parse", "@napi-rs/canvas"],
};

export default nextConfig;
