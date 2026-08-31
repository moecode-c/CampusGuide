import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Reduce bandwidth: enable compression, modern image formats, and cache versioned public assets.
  compress: true,
  poweredByHeader: false,
  experimental: {
    // Client-side router cache, meant to stop every back-and-forth between two
    // pages from refetching the RSC payload.
    //
    // MEASURED: this has no effect on this app, in dev or in production.
    // Navigating away and back re-fetches the RSC payload every time.
    //
    // The first guess was that the missing loading.tsx boundaries were the
    // blocker. They were added later, and re-measuring showed the same two
    // refetches on a revisit — so that was not the cause. The remaining
    // explanation is that every route is fully dynamic: the (app) layout calls
    // headers() and getServerSession() on each request, and the router will not
    // reuse a cached entry for a route it has to re-render anyway.
    //
    // Left in place because it costs nothing and is the correct setting, but do
    // not count it as a bandwidth saving unless someone re-measures and shows
    // otherwise.
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
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
        source: "/campus-map-v3.png",
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
