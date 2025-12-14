export const GRAPE_RPC_ENDPOINT = process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
export const REACT_APP_RPC_DEVNET_ENDPOINT = process.env.NEXT_PUBLIC_RPC_DEVNET_ENDPOINT || 'https://api.devnet.solana.com';

export const FALLBACK_VINE_MINT = "8n5buhK82U6Mb5tTwwRJgJWBt1HjEJM2CxhRutw1n6qT";
// your deployed program id (vine_reputation)
export const VINE_REP_PROGRAM_ID = "V1NE6WCWJPRiVFq5DtaN8p87M9DmmUd2zQuVbvLgQwX";

// Whatever you passed as `dao_id` in initializeConfig for GRAPE
export const GRAPE_DAO_ID = "By2sVGZXwfQq6rAiAM3rNPJ9iQfb5e2QhnF4YjJ4Bip";

export const tokens = [
  {
    key: "v3", 
    mint: "8n5buhK82U6Mb5tTwwRJgJWBt1HjEJM2CxhRutw1n6qT",
    name: "Vine v3",
    image: "./images/vine.jpg"
  },  {
    key: "v2", 
    mint: "GXQdLgaxTMCoAKbHSnQq8M9UtDzYYjHEPkxPUJKiTuYC",
    name: "Vine v2",
    image: "./images/vine.jpg"
  },  {
    key: "v1", 
    mint: "A6GComqUgUZ7mTqZcDrgnigPEdYDcw5yCumbHaaQxVKK",
    name: "Vine v1",
    image: "./images/vine.jpg"
  }
]

export const VINE_LOGO = './images/vine.jpg';