import * as anchor from "@project-serum/anchor";

export const VINE_REP_PROGRAM_ID = new anchor.web3.PublicKey(
  "V1NE6WCWJPRiVFq5DtaN8p87M9DmmUd2zQuVbvLgQwX"
);

export function getConfigPda() {
  return anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    VINE_REP_PROGRAM_ID
  );
}

export function getReputationPda(user: anchor.web3.PublicKey, season: number) {
  const seasonBuf = Buffer.alloc(2);
  seasonBuf.writeUInt16LE(season, 0);

  return anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("reputation"), user.toBuffer(), seasonBuf],
    VINE_REP_PROGRAM_ID
  );
}

export async function fetchConfig(
  program: anchor.Program
): Promise<any | null> {
  const [configPda] = getConfigPda();
  try {
    return await program.account.reputationConfig.fetch(configPda);
  } catch {
    return null;
  }
}

export async function fetchReputationForWallet(
  program: anchor.Program,
  user: anchor.web3.PublicKey,
  season: number
): Promise<any | null> {
  const [repPda] = getReputationPda(user, season);
  try {
    return await program.account.reputation.fetch(repPda);
  } catch {
    return null;
  }
}