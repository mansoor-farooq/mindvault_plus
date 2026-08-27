import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js blocks cross-origin requests to dev-only assets (_next/*) by default -
  // without this, the ngrok tunnel serves the initial HTML fine but every JS chunk
  // request gets rejected, so the client bundle never hydrates and the page is stuck
  // on AuthProvider's server-rendered "Loading..." fallback forever.
  allowedDevOrigins: ['unisexual-unruly-gerbil.ngrok-free.dev'],
};

export default nextConfig;
