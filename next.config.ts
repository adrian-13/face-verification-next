import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false, // Ignorovanie nepotrebného modulu `fs`
      path: false, // Ignorovanie nepotrebného modulu `path`
    };

    return config;
  },
};

export default nextConfig;
