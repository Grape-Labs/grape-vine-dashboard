import { PublicKey, Connection } from "@solana/web3.js";

export type VineSpace = {
  daoId: PublicKey;
  configPda: PublicKey;
  authority: PublicKey;
  repMint: PublicKey;
  currentSeason: number;
  metadataUri: string; // if you store it on chain; if not, keep ""
};

export function getConfigPda(programId: PublicKey, daoId: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("config"), daoId.toBuffer()],
    programId
  )[0];
}

// ReputationConfig layout (from your Rust):
// dao_id(32) authority(32) rep_mint(32) current_season(u16) bump(u8) padding(5)
// plus metadata_uri if you added it (Anchor String: u32 len + bytes) AFTER those fields.
export function decodeConfigAccount(data: Buffer): Omit<VineSpace, "configPda"> {
  // skip Anchor discriminator
  let o = 8;

  const daoId = new PublicKey(data.subarray(o, o + 32)); o += 32;
  const authority = new PublicKey(data.subarray(o, o + 32)); o += 32;
  const repMint = new PublicKey(data.subarray(o, o + 32)); o += 32;

  const currentSeason = data.readUInt16LE(o); o += 2;

  // bump + padding
  o += 1; // bump
  o += 5; // padding

  // optional metadata_uri (if present)
  let metadataUri = "";
  if (o + 4 <= data.length) {
    const len = data.readUInt32LE(o); o += 4;
    if (len > 0 && o + len <= data.length) {
      metadataUri = data.subarray(o, o + len).toString("utf8");
      o += len;
    }
  }

  return { daoId, authority, repMint, currentSeason, metadataUri };
}

export async function fetchAllSpaces(
  connection: Connection,
  programId: PublicKey
): Promise<VineSpace[]> {
  // Anchor accounts start with 8-byte discriminator.
  // We can list *all* program accounts and decode those that look like configs.
  const accts = await connection.getProgramAccounts(programId);

  const spaces: VineSpace[] = [];

  for (const a of accts) {
    const data = a.account.data as Buffer;

    // basic sanity: at least fits base config size (8 + 32+32+32+2+1+5)
    if (data.length < 8 + 104) continue;

    try {
      const decoded = decodeConfigAccount(data);
      spaces.push({
        ...decoded,
        configPda: a.pubkey,
      });
    } catch {
      // ignore non-config accounts
    }
  }

  // stable ordering: newest-ish first by season then daoId
  spaces.sort((x, y) => (y.currentSeason - x.currentSeason) || x.daoId.toBase58().localeCompare(y.daoId.toBase58()));
  return spaces;
}