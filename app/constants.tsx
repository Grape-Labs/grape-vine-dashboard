// app/constants.tsx

// Next will inline NEXT_PUBLIC_* at build time.
// Guard with typeof process for edge bundler cases.
// app/constants.tsx

export const RPC_SOLANA_MAINNET =
  process.env.NEXT_PUBLIC_RPC_SOLANA_MAINNET ??
  "https://api.mainnet-beta.solana.com";

export const RPC_SOLANA_DEVNET =
  process.env.NEXT_PUBLIC_RPC_SOLANA_DEVNET ??
  "https://api.devnet.solana.com";

export const RPC_SHYFT_MAINNET =
  process.env.NEXT_PUBLIC_RPC_SHYFT_MAINNET ?? "";

export const RPC_SHYFT_DEVNET =
  process.env.NEXT_PUBLIC_RPC_SHYFT_DEVNET ?? "";

export const RPC_ALCHEMY_MAINNET =
  process.env.NEXT_PUBLIC_RPC_ALCHEMY_MAINNET ?? "";

// Back-compat / defaults
export const GRAPE_RPC_ENDPOINT =
  RPC_SHYFT_MAINNET || RPC_SOLANA_MAINNET;

export const GRAPE_RPC_DEVNET_ENDPOINT =
  RPC_SHYFT_DEVNET || RPC_SOLANA_DEVNET;

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
export const OG_GREYLOGO = "/images/og_logo_graysquare.png";
export const OG_HERO = "/images/og.png";
export const OG_DEFAULTBG = "/images/background.jpg";
export const VINE_LOGO = "./images/vine.jpg";
