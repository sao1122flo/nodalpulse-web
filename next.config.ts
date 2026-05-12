import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    authInterrupts: true,
  },
  async redirects() {
    return [
      { source: "/signup", destination: "/login", permanent: false },
    ]
  },
};

export default nextConfig;
