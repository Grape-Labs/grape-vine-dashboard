import type { MetadataRoute } from "next";
import { PublicKey } from "@solana/web3.js";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://vine.governance.so").replace(/\/$/, "");

function isValidPk(s: string) {
  try { new PublicKey(s); return true; } catch { return false; }
}

export default function manifest({ params }: { params: { dao: string } }): MetadataRoute.Manifest {
  const dao = String(params.dao || "");
  const shortDao = isValidPk(dao) ? `${dao.slice(0, 6)}…${dao.slice(-6)}` : "Invalid DAO";

  return {
    name: `Vine Reputation · ${shortDao}`,
    short_name: "Vine",
    description: "On-chain, season-based reputation dashboard.",
    start_url: `/dao/${dao}`,
    scope: `/dao/${dao}`,
    display: "standalone",
    background_color: "#020617",
    theme_color: "#0b1220",
    icons: [
      // You can later swap these to be DAO-branded via a dynamic icon route (step 3)
      { src: "/icons/vine-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/vine-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/vine-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}