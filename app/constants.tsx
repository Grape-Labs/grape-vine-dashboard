// app/constants.tsx
// Safe env access that won't crash in the browser if `process` is not defined.
function getEnv(key: string): string | undefined {
  try {
    // In Next builds, this is usually inlined; but this keeps us safe either way.
    const p: any = (globalThis as any).process;
    return p?.env?.[key];
  } catch {
    return undefined;
  }
}

// Prefer new env names, keep legacy fallbacks
export const GRAPE_RPC_ENDPOINT =
  getEnv("NEXT_PUBLIC_RPC_SHYFT_MAINNET") ||
  getEnv("NEXT_PUBLIC_RPC_ENDPOINT") ||
  "https://api.mainnet-beta.solana.com";

export const GRAPE_RPC_DEVNET_ENDPOINT =
  getEnv("NEXT_PUBLIC_RPC_SOLANA_DEVNET") ||
  getEnv("NEXT_PUBLIC_RPC_SHYFT_DEVNET") ||
  getEnv("NEXT_PUBLIC_RPC_DEVNET_ENDPOINT") ||
  "https://api.devnet.solana.com";

export const GRAPE_RPC_ALCHEMY_MAINNET = getEnv("NEXT_PUBLIC_RPC_ALCHEMY_MAINNET") || "";

// Back-compat alias (so older imports don't break)
export const REACT_APP_RPC_DEVNET_ENDPOINT = GRAPE_RPC_DEVNET_ENDPOINT;

// -----------------------------------------------------------------------------
// The rest unchanged
// -----------------------------------------------------------------------------
export const FALLBACK_VINE_MINT = "8n5buhK82U6Mb5tTwwRJgJWBt1HjEJM2CxhRutw1n6qT";
export const VINE_REP_PROGRAM_ID = "V1NE6WCWJPRiVFq5DtaN8p87M9DmmUd2zQuVbvLgQwX";
export const GRAPE_DAO_ID = "By2sVGZXwfQq6rAiAM3rNPJ9iQfb5e2QhnF4YjJ4Bip";

export const tokens = [
  { key: "v3", mint: "8n5buhK82U6Mb5tTwwRJgJWBt1HjEJM2CxhRutw1n6qT", name: "Vine v3", image: "./images/vine.jpg" },
  { key: "v2", mint: "GXQdLgaxTMCoAKbHSnQq8M9UtDzYYjHEPkxPUJKiTuYC", name: "Vine v2", image: "./images/vine.jpg" },
  { key: "v1", mint: "A6GComqUgUZ7mTqZcDrgnigPEdYDcw5yCumbHaaQxVKK", name: "Vine v1", image: "./images/vine.jpg" },
];

export const OG_LOGO = "/images/og_logo_square.png";
export const VINE_LOGO = "./images/vine.jpg";