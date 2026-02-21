// app/dao/[dao]/page.tsx
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Connection, PublicKey } from "@solana/web3.js";
import { fetchConfig, fetchProjectMetadata, getConfigPda } from "@grapenpm/vine-reputation-client";
import { GRAPE_RPC_ENDPOINT } from "@/app/constants";
import DaoApp from "../../components/DaoApp";

function isValidPk(s: string) {
  try {
    new PublicKey(s);
    return true;
  } catch {
    return false;
  }
}

function getSiteUrl() {
  // Must be absolute for OG crawlers (Discord/iMessage/etc)
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL || // optional fallback if you use Vercel's SITE_URL
    "https://vine.governance.so";

  // normalize (avoid trailing slash issues)
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

type VineTheme = {
  mode?: "auto" | "light" | "dark";
  primary?: string;
  background_image?: string | null;
  background_opacity?: number;
  background_blur?: number;
  background_position?: string;
  background_size?: string;
  background_repeat?: string;
};

type OffchainTokenMeta = {
  name?: string;
  symbol?: string;
  description?: string;
  image?: string;
  vine?: { theme?: VineTheme };
};

type VineSpaceWire = {
  version: number;
  daoId: string;
  authority: string;
  repMint: string;
  currentSeason: number;
  decayBps: number;
  configPda: string;
};

type SpaceUiMetaWire = {
  dao: string;
  uri?: string | null;
  offchain?: OffchainTokenMeta | null;
};

type DaoInitialState = {
  activeDao: string;
  spaces: VineSpaceWire[];
  spaceUiMeta: Record<string, SpaceUiMetaWire>;
} | null;

function resolveEndpoint(raw?: string) {
  return (raw || "").trim() || GRAPE_RPC_ENDPOINT;
}

function normalizeUrl(u?: string | null): string | null {
  if (!u) return null;
  if (u.startsWith("ipfs://")) return `https://ipfs.io/ipfs/${u.slice("ipfs://".length)}`;
  if (u.startsWith("ar://")) return `https://arweave.net/${u.slice("ar://".length)}`;
  return u;
}

function normalizeOffchainMeta(meta?: OffchainTokenMeta | null): OffchainTokenMeta | null {
  if (!meta) return null;
  const theme = meta.vine?.theme;
  return {
    ...meta,
    image: normalizeUrl(meta.image) ?? meta.image,
    vine: theme
      ? {
          ...meta.vine,
          theme: {
            ...theme,
            background_image: normalizeUrl(theme.background_image) ?? null,
          },
        }
      : meta.vine,
  };
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

async function fetchOffchainJson(uri: string) {
  try {
    const normalized = normalizeUrl(uri);
    if (!normalized) return null;
    const r = await fetch(normalized, { cache: "no-store" });
    if (!r.ok) return null;
    return normalizeOffchainMeta((await r.json()) as OffchainTokenMeta);
  } catch {
    return null;
  }
}

async function buildDaoInitialState(endpoint: string, dao: string): Promise<DaoInitialState> {
  try {
    const daoPk = new PublicKey(dao);
    const conn = new Connection(endpoint, "confirmed");

    const cfg = await fetchConfig(conn, daoPk);
    if (!cfg) return null;

    const [configPda] = getConfigPda(daoPk);

    const space: VineSpaceWire = {
      version: Number(cfg.version),
      daoId: daoPk.toBase58(),
      authority: cfg.authority.toBase58(),
      repMint: cfg.repMint.toBase58(),
      currentSeason: Number(cfg.currentSeason),
      decayBps: Number(cfg.decayBps),
      configPda: configPda.toBase58(),
    };

    const pm = await fetchProjectMetadata(conn, daoPk);
    const uri = extractMetadataUri(pm);
    const offchain = uri ? await fetchOffchainJson(uri) : null;

    return {
      activeDao: daoPk.toBase58(),
      spaces: [space],
      spaceUiMeta: {
        [daoPk.toBase58()]: {
          dao: daoPk.toBase58(),
          uri: normalizeUrl(uri) ?? uri ?? null,
          offchain,
        },
      },
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params, searchParams }: any): Promise<Metadata> {
  const dao = String(params.dao || "");

  if (!isValidPk(dao)) {
    const site = getSiteUrl();
    return {
      metadataBase: new URL(site),
      title: "Invalid DAO",
      description: "Invalid DAO address",
      manifest: `/dao/${dao}/manifest.webmanifest`,
      robots: { index: false, follow: false },
    };
  }

  const site = getSiteUrl();
  const metadataBase = new URL(site);
  const endpoint = resolveEndpoint(searchParams?.endpoint as string | undefined);

  // Make the title useful in iMessage compact previews
  const shortDao = `${dao.slice(0, 6)}…${dao.slice(-6)}`;
  const title = `Vine Reputation · ${shortDao}`;
  const description = "On-chain, season-based reputation dashboard for this DAO.";

  // IMPORTANT: Open Graph image must be absolute
  // Next will serve this automatically if you have:
  // app/dao/[dao]/opengraph-image.tsx  (or .tsx route handler)
  const ogImageUrl = new URL(`/dao/${dao}/opengraph-image`, metadataBase).toString();
  const ogImage = new URL(ogImageUrl);
  ogImage.searchParams.set("endpoint", endpoint);

  const pageUrl = new URL(`/dao/${dao}`, metadataBase);
  if (searchParams?.endpoint) pageUrl.searchParams.set("endpoint", String(searchParams.endpoint));
  const pageUrlStr = pageUrl.toString();

  return {
    metadataBase,
    title,
    description,
    alternates: { canonical: pageUrlStr },

    openGraph: {
      type: "website",
      url: pageUrlStr,
      title,
      description,
      siteName: "Vine Reputation",
      locale: "en_US",
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

    // This can help iMessage show a better icon in compact mode
    // (make sure these files exist in /public)
    icons: {
      icon: "/public/images/favicon-32x32.png",
      apple: "/public/images/apple-touch-icon.png",
    },
  };
}

export default async function Page({ params, searchParams }: any) {
  const dao = String(params.dao || "");
  if (!isValidPk(dao)) redirect("/?notfound=1");

  const endpoint = resolveEndpoint(searchParams?.endpoint as string | undefined);
  const initialState = await buildDaoInitialState(endpoint, dao);

  return <DaoApp initialEndpoint={endpoint} initialState={initialState ?? undefined} />;
}
