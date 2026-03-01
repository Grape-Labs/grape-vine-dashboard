import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Grape Vine Reputation",
    short_name: "Grape Vine",
    description: "On-chain reputation spaces powered by Grape on Solana.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#020617",
    theme_color: "#0b1220",
    icons: [
      { src: "/icons/grape-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/grape-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/grape-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
