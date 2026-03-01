import { fetchProjectMetadata } from "@grapenpm/vine-reputation-client";
import { Connection, PublicKey } from "@solana/web3.js";
import { GRAPE_RPC_ENDPOINT } from "@/app/constants";

type VineTheme = {
  primary?: string;
};

type OffchainTokenMeta = {
  name?: string;
  description?: string;
  image?: string;
  vine?: { theme?: VineTheme };
};

export type DaoBranding = {
  dao: string;
  shortDao: string;
  name: string;
  description: string;
  image: string | null;
  themeColor: string;
  backgroundColor: string;
};

const DEFAULT_THEME_COLOR = "#0b1220";
const DEFAULT_BACKGROUND_COLOR = "#020617";

export function isValidPk(value: string) {
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

export function shortenPk(base58: string, start = 6, end = 6) {
  if (!base58) return "";
  if (base58.length <= start + end) return base58;
  return `${base58.slice(0, start)}...${base58.slice(-end)}`;
}

export function resolveEndpoint(raw?: string) {
  return (raw || "").trim() || GRAPE_RPC_ENDPOINT;
}

export function normalizeUrl(value?: string | null): string | null {
  if (!value) return null;
  if (value.startsWith("ipfs://")) return `https://ipfs.io/ipfs/${value.slice("ipfs://".length)}`;
  if (value.startsWith("ar://")) return `https://arweave.net/${value.slice("ar://".length)}`;
  return value;
}

function extractMetadataUri(projectMeta: any): string | null {
  return (
    projectMeta?.metadataUri ??
    projectMeta?.metadata_uri ??
    projectMeta?.vine?.metadataUri ??
    projectMeta?.vine?.metadata_uri ??
    projectMeta?.token?.metadataUri ??
    projectMeta?.token?.metadata_uri ??
    projectMeta?.token?.uri ??
    null
  );
}

function normalizeThemeColor(raw?: string) {
  if (!raw) return null;
  const trimmed = raw.trim();
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed) ? trimmed : null;
}

async function fetchOffchainJson(uri: string): Promise<OffchainTokenMeta | null> {
  try {
    const normalized = normalizeUrl(uri);
    if (!normalized) return null;
    const response = await fetch(normalized, { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as OffchainTokenMeta;
  } catch {
    return null;
  }
}

function fallbackBranding(dao: string): DaoBranding {
  const shortDao = isValidPk(dao) ? shortenPk(dao) : "Unknown DAO";
  return {
    dao,
    shortDao,
    name: `Vine Reputation ${shortDao}`,
    description: "On-chain, season-based reputation dashboard for this DAO.",
    image: null,
    themeColor: DEFAULT_THEME_COLOR,
    backgroundColor: DEFAULT_BACKGROUND_COLOR,
  };
}

export async function fetchDaoBranding(dao: string, endpoint?: string): Promise<DaoBranding> {
  const normalizedDao = String(dao || "").trim();
  const fallback = fallbackBranding(normalizedDao);
  if (!isValidPk(normalizedDao)) return fallback;

  try {
    const connection = new Connection(resolveEndpoint(endpoint), "confirmed");
    const daoPk = new PublicKey(normalizedDao);
    const projectMetadata = await fetchProjectMetadata(connection, daoPk);
    const metadataUri = extractMetadataUri(projectMetadata);
    const offchain = metadataUri ? await fetchOffchainJson(metadataUri) : null;

    const name = offchain?.name?.trim() || fallback.name;
    const description = offchain?.description?.trim() || fallback.description;
    const image = normalizeUrl(offchain?.image) || null;
    const themeColor = normalizeThemeColor(offchain?.vine?.theme?.primary) || fallback.themeColor;

    return {
      dao: normalizedDao,
      shortDao: shortenPk(normalizedDao),
      name,
      description,
      image,
      themeColor,
      backgroundColor: DEFAULT_BACKGROUND_COLOR,
    };
  } catch {
    return fallback;
  }
}
