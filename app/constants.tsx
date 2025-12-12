export const GRAPE_RPC_ENDPOINT = process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
export const REACT_APP_RPC_DEVNET_ENDPOINT = process.env.NEXT_PUBLIC_RPC_DEVNET_ENDPOINT || 'https://api.devnet.solana.com';

export const FALLBACK_VINE_MINT = "8n5buhK82U6Mb5tTwwRJgJWBt1HjEJM2CxhRutw1n6qT";
// your deployed program id (vine_reputation)
export const VINE_REP_PROGRAM_ID = "V1NE6WCWJPRiVFq5DtaN8p87M9DmmUd2zQuVbvLgQwX";

export const tokens = [
  {
    programId: "8n5buhK82U6Mb5tTwwRJgJWBt1HjEJM2CxhRutw1n6qT",
    //programId: "GXQdLgaxTMCoAKbHSnQq8M9UtDzYYjHEPkxPUJKiTuYC",
    //programId: "A6GComqUgUZ7mTqZcDrgnigPEdYDcw5yCumbHaaQxVKK",
    name: "Vine v3",
    image: "./images/vine.jpg"
  }
]

export const VINE_LOGO = './images/vine.jpg';