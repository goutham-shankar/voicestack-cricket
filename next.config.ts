import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow Next.js dev assets (_next/*) when the app is opened via ngrok / tunnels.
  allowedDevOrigins: [
    "*.ngrok-free.app",
    "*.ngrok-free.dev",
    "*.ngrok.app",
    "*.ngrok.io",
  ],
};

export default nextConfig;
