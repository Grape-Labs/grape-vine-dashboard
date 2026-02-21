// app/card/[dao]/[wallet]/page.tsx
import type { Metadata } from "next";
import VineReputationShareCard from "./ui";
import { Connection, PublicKey } from "@solana/web3.js";
import { fetchConfig, fetchProjectMetadata, fetchReputation } from "@grapenpm/vine-reputation-client";
import { GRAPE_RPC_ENDPOINT } from "@/app/constants";

type VineTheme = {
  primary?: string;
  background_image?: string | null;
  background_opacity?: number;
  background_blur?: number;
  background_position?: string;
  background_size?: string;
  background_repeat?: string;
};

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

function normalizeUrl(u?: string | null): string | null {
  if (!u) return null;
  if (u.startsWith("ipfs://")) return `https://ipfs.io/ipfs/${u.slice("ipfs://".length)}`;
  if (u.startsWith("ar://")) return `https://arweave.net/${u.slice("ar://".length)}`;
  return u;
}

function shortenPk(base58: string, start = 6, end = 6) {
  if (!base58) return "";
  if (base58.length <= start + end) return base58;
  return `${base58.slice(0, start)}…${base58.slice(-end)}`;
}

async function fetchOffchainJson(uri: string) {
  try {
    const url = normalizeUrl(uri);
    if (!url) return null;
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return null;
    return (await r.json()) as any;
  } catch {
    return null;
  }
}

function resolveEndpoint(raw?: string) {
  return (raw || "").trim() || GRAPE_RPC_ENDPOINT;
}

function bigintToSafeNumber(bi: bigint): number | null {
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  if (bi < BigInt(0) || bi > max) return null;
  return Number(bi);
}

type InitialSeasonRowWire = {
  season: number;
  found: boolean;
  points: string;
  lastUpdateSlot: string;
  weight: number;
  effectivePoints: string;
};

type InitialCardStateWire = {
  currentSeason: number | null;
  decayBps: number | null;
  rows: InitialSeasonRowWire[];
  error: string | null;
};

async function buildInitialCardState(args: {
  conn: Connection;
  daoPk: PublicKey;
  userPk: PublicKey;
  historyDepth: number;
}): Promise<InitialCardStateWire> {
  const { conn, daoPk, userPk, historyDepth } = args;

  const cfg = await fetchConfig(conn, daoPk);
  if (!cfg) {
    return {
      currentSeason: null,
      decayBps: null,
      rows: [],
      error: "No config found for this DAO.",
    };
  }

  if (!Number.isFinite(cfg.currentSeason) || cfg.currentSeason <= 0) {
    return {
      currentSeason: null,
      decayBps: null,
      rows: [],
      error: `Config currentSeason is invalid: ${cfg.currentSeason}`,
    };
  }

  const currentSeason = Number(cfg.currentSeason);
  const onchainDecay = Number.isFinite(cfg.decayBps) ? Number(cfg.decayBps) : 7000;
  const decayFactor = Math.max(0, Math.min(1, onchainDecay / 10000));
  const depth = Math.max(1, Math.floor(historyDepth));
  const startSeason = Math.max(1, currentSeason - depth + 1);

  const rows: InitialSeasonRowWire[] = [];

  for (let s = startSeason; s <= currentSeason; s++) {
    const rep = await fetchReputation(conn, daoPk, userPk, s);
    const points = rep?.points ?? BigInt(0);
    const lastUpdateSlot = rep?.lastUpdateSlot ?? BigInt(0);
    const diff = currentSeason - s;
    const weight = diff < 0 ? 0 : Math.pow(decayFactor, diff);

    let effectivePoints = BigInt(0);
    const ptsNum = bigintToSafeNumber(points);
    if (ptsNum != null) effectivePoints = BigInt(Math.round(ptsNum * weight));
    else effectivePoints = points;

    rows.push({
      season: s,
      found: !!rep,
      points: points.toString(),
      lastUpdateSlot: lastUpdateSlot.toString(),
      weight,
      effectivePoints: effectivePoints.toString(),
    });
  }

  return {
    currentSeason,
    decayBps: onchainDecay,
    rows,
    error: null,
  };
}

/**
 * TODO: Replace this with your real reputation read.
 * Return a number (effective points) or null if unavailable.
 *
 * Examples of what you might do here:
 * - call your vine-reputation-client account fetch for (dao, wallet)
 * - compute effective points from season history / decay
 */
async function fetchEffectivePoints(_endpoint: string, _dao: string, _wallet: string): Promise<number | null> {
  return null; // <-- replace
}

// ✅ IMPORTANT: set this to your deployed origin (https)
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://vine.governance.so";

export async function generateMetadata(
  { params, searchParams }: any
): Promise<Metadata> {
  const dao = params.dao as string;
  const wallet = params.wallet as string;

  const endpoint = resolveEndpoint(searchParams?.endpoint as string | undefined);

  // Defaults
  let daoName = "Vine Reputation";
  let daoSymbol = "";
  let description = "Proof of participation • DAO reputation score";
  let logo: string | null = null;

  // Optional share “value”
  let effectivePts: number | null = null;

  try {
    const conn = new Connection(endpoint, "confirmed");
    const daoPk = new PublicKey(dao);

    const pm = await fetchProjectMetadata(conn, daoPk);
    const uri = extractMetadataUri(pm);

    if (uri) {
      const offchain = await fetchOffchainJson(uri);
      if (offchain?.name) daoName = offchain.name;
      if (offchain?.symbol) daoSymbol = offchain.symbol;
      if (offchain?.description) description = offchain.description;
      if (offchain?.image) logo = normalizeUrl(offchain.image);
    }

    // Try to fetch points (safe if it fails)
    effectivePts = await fetchEffectivePoints(endpoint, dao, wallet);
  } catch {
    // ignore
  }

  const shortWallet = shortenPk(wallet);

  // ✅ Make compact iMessage preview useful by putting info in the TITLE
  // Keep it short — iMessage truncates aggressively.
  const titleParts: string[] = [];

  // prefer showing points first (most useful)
  if (typeof effectivePts === "number" && Number.isFinite(effectivePts)) {
    titleParts.push(`${Math.round(effectivePts)} pts`);
  } else {
    // fallback: brand name
    titleParts.push(daoName);
  }

  titleParts.push(shortWallet);

  // Optionally add symbol if it fits
  const symbolSuffix = daoSymbol ? ` • ${daoSymbol}` : "";
  const title = `${titleParts.join(" • ")}${symbolSuffix}`;

  // ✅ OG image URL (generated server-side)
  const ogImage = new URL(`/api/og/card`, SITE_URL);
  ogImage.searchParams.set("dao", dao);
  ogImage.searchParams.set("wallet", wallet);
  ogImage.searchParams.set("endpoint", endpoint);

  const pageUrl = new URL(`/card/${dao}/${wallet}`, SITE_URL);
  if (searchParams?.endpoint) pageUrl.searchParams.set("endpoint", String(searchParams.endpoint));
  if (searchParams?.d) pageUrl.searchParams.set("d", String(searchParams.d));

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    openGraph: {
      type: "website",
      url: pageUrl.toString(),
      title,
      description,
      images: [
        {
          url: ogImage.toString(),
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage.toString()],
    },

    /**
     * ✅ iMessage compact bubble uses the apple-touch-icon/favicon a lot.
     * Put branded icons in /public:
     * - /public/apple-touch-icon.png (180x180)
     * - /public/favicon-32x32.png
     *
     * If you want per-DAO icons, you can keep `logo` too — but iMessage
     * is more consistent with static app icons.
     */
    icons: {
      apple: "/public/images/apple-touch-icon.png",
      icon: [
        { url: "/public/images/favicon-32x32.png", sizes: "32x32", type: "image/png" },
        { url: "/public/images/favicon.ico" },
      ],
      // keep this if you still want the per-DAO logo as a hint
      ...(logo ? { other: [{ rel: "image_src", url: logo }] } : {}),
    },
  };
}

export default async function Page({ params, searchParams }: any) {
  const dao = params.dao as string;
  const wallet = params.wallet as string;

  const endpoint = resolveEndpoint(searchParams?.endpoint as string | undefined);
  const historyDepth = Math.max(1, Math.floor(Number(searchParams?.d ?? 4)));

  const conn = new Connection(endpoint, "confirmed");

  let meta: any = null;
  let resolvedTheme: any = null;
  let initialState: InitialCardStateWire | null = null;

  try {
    const daoPk = new PublicKey(dao);
    const userPk = new PublicKey(wallet);

    initialState = await buildInitialCardState({
      conn,
      daoPk,
      userPk,
      historyDepth,
    });

    const pm = await fetchProjectMetadata(conn, daoPk);
    const uri = extractMetadataUri(pm);

    if (uri) {
      const offchain = await fetchOffchainJson(uri);
      meta = offchain
        ? {
            name: offchain.name,
            symbol: offchain.symbol,
            description: offchain.description,
            image: normalizeUrl(offchain.image),
          }
        : null;

      const t: VineTheme = offchain?.vine?.theme ?? {};
      resolvedTheme = {
        primary: t.primary ?? "#7c3aed",
        background: {
          image: normalizeUrl(t.background_image) ?? null,
          opacity: typeof t.background_opacity === "number" ? t.background_opacity : 0.55,
          blur: typeof t.background_blur === "number" ? t.background_blur : 12,
          position: t.background_position ?? "center",
          size: t.background_size ?? "cover",
          repeat: t.background_repeat ?? "no-repeat",
        },
      };
    }
  } catch {
    // ignore
  }

  return (
    <div style={{ padding: 24, display: "flex", justifyContent: "center" }}>
      <VineReputationShareCard
        daoBase58={dao}
        walletBase58={wallet}
        endpoint={endpoint}
        historyDepth={historyDepth}
        meta={meta}
        resolvedTheme={resolvedTheme}
        initialState={initialState ?? undefined}
      />
    </div>
  );
}
