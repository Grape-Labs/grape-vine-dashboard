import { PublicKey, Connection } from "@solana/web3.js";

export const VINE_REP_PROGRAM_ID = new PublicKey(
  "V1NE6WCWJPRiVFq5DtaN8p87M9DmmUd2zQuVbvLgQwX"
);

// Whatever you passed as `dao_id` in initializeConfig for GRAPE
export const GRAPE_DAO_ID = new PublicKey(
  "By2sVGZXwfQq6rAiAM3rNPJ9iQfb5e2QhnF4YjJ4Bip"
);

/* ------------------------------------------------------------------ */
/* PDA HELPERS                                                        */
/* ------------------------------------------------------------------ */

export function getConfigPda(daoId: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("config"), daoId.toBuffer()],
    VINE_REP_PROGRAM_ID
  );
}

export function getReputationPda(
  configPk: PublicKey,
  userPk: PublicKey,
  season: number
) {
  const seasonBuf = Buffer.alloc(2);
  seasonBuf.writeUInt16LE(season, 0);

  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("reputation"),
      configPk.toBuffer(),
      userPk.toBuffer(),
      seasonBuf,
    ],
    VINE_REP_PROGRAM_ID
  );
}

/* ------------------------------------------------------------------ */
/* ACCOUNT TYPES + DECODERS                                           */
/* ------------------------------------------------------------------ */

export interface ReputationConfigAccount {
  pubkey: PublicKey;
  daoId: PublicKey;
  authority: PublicKey;
  repMint: PublicKey;
  currentSeason: number;
  bump: number;
}

export interface ReputationAccount {
  pubkey: PublicKey;
  user: PublicKey;
  season: number;
  points: bigint;          // use bigint to be exact
  lastUpdateSlot: bigint;  // bigint, can be cast to Number in UI
  bump: number;
}

// Anchor adds an 8-byte discriminator at the start of each account.
const ACCOUNT_DISCRIMINATOR_LEN = 8;

export function decodeReputationConfigAccount(
  pubkey: PublicKey,
  data: Buffer
): ReputationConfigAccount {
  if (data.length < ACCOUNT_DISCRIMINATOR_LEN + 32 + 32 + 32 + 2 + 1) {
    throw new Error("ReputationConfig account data too small");
  }

  let offset = ACCOUNT_DISCRIMINATOR_LEN;

  const daoId = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;

  const authority = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;

  const repMint = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;

  const currentSeason = data.readUInt16LE(offset);
  offset += 2;

  const bump = data.readUInt8(offset);
  // padding after this is ignored

  return {
    pubkey,
    daoId,
    authority,
    repMint,
    currentSeason,
    bump,
  };
}

export function decodeReputationAccount(
  pubkey: PublicKey,
  data: Buffer
): ReputationAccount {
  if (data.length < ACCOUNT_DISCRIMINATOR_LEN + 32 + 2 + 8 + 8 + 1) {
    throw new Error("Reputation account data too small");
  }

  let offset = ACCOUNT_DISCRIMINATOR_LEN;

  const user = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;

  const season = data.readUInt16LE(offset);
  offset += 2;

  const points = data.readBigUInt64LE(offset);
  offset += 8;

  const lastUpdateSlot = data.readBigUInt64LE(offset);
  offset += 8;

  const bump = data.readUInt8(offset);
  // padding ignored

  return {
    pubkey,
    user,
    season,
    points,
    lastUpdateSlot,
    bump,
  };
}

/* ------------------------------------------------------------------ */
/* HIGH-LEVEL FETCH HELPERS                                           */
/* ------------------------------------------------------------------ */

/**
 * Fetch the ReputationConfig for a given DAO.
 * Returns `null` if the config account does not exist.
 */
export async function fetchConfig(
  connection: Connection,
  daoId: PublicKey = GRAPE_DAO_ID
): Promise<ReputationConfigAccount | null> {
  const [configPk] = getConfigPda(daoId);

  const accountInfo = await connection.getAccountInfo(configPk);
  if (!accountInfo || !accountInfo.data) {
    return null;
  }

  return decodeReputationConfigAccount(configPk, accountInfo.data);
}

/**
 * Fetch the reputation for a user in the *current season* for the DAO.
 * Returns:
 *   - `config`: the DAO config (must exist)
 *   - `reputation`: the account or `null` if user has no reputation yet
 */
export async function fetchUserReputation(
  connection: Connection,
  userPk: PublicKey,
  daoId: PublicKey = GRAPE_DAO_ID
): Promise<{
  config: ReputationConfigAccount;
  reputation: ReputationAccount | null;
}> {
  const config = await fetchConfig(connection, daoId);
  if (!config) {
    throw new Error("Reputation config not found for this DAO");
  }

  const [repPda] = getReputationPda(
    config.pubkey,
    userPk,
    config.currentSeason
  );

  const accountInfo = await connection.getAccountInfo(repPda);
  if (!accountInfo || !accountInfo.data) {
    return { config, reputation: null };
  }

  const reputation = decodeReputationAccount(repPda, accountInfo.data);
  return { config, reputation };
}