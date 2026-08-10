import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Reduce bandwidth: enable compression, modern image formats, and cache versioned public assets.
  compress: true,
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    // These are static files in /public that only change when renamed, so a
    // 60-second TTL just pays for the same optimization over and over.
    minimumCacheTTL: 31536000,
  },
  async headers() {
    return [
      {
        // Cache-bustable assets (rename when you change the file)
        source: "/campus-map-v2.png",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/retromo1nobg.png",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
