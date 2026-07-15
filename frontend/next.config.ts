import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/ready",
        destination: "http://localhost:8000/ready",
      },
      {
        source: "/api/v1/:path*",
        destination: "http://localhost:8000/v1/:path*",
      },
    ];
  },
};

export default nextConfig;
