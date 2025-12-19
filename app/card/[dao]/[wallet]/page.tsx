// app/card/[dao]/[wallet]/page.tsx
import type { Metadata } from "next";
import VineReputationShareCard from "./ui";
import { Connection, PublicKey } from "@solana/web3.js";
import { fetchProjectMetadata } from "@grapenpm/vine-reputation-client";
import grapeTheme from "@/app/utils/config/theme";

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

async function fetchOffchainJson(uri: string) {
  try {
    const r = await fetch(uri, { cache: "no-store" });
    if (!r.ok) return null;
    return (await r.json()) as any;
  } catch {
    return null;
  }
}

// ✅ IMPORTANT: set this to your deployed origin
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://vine.governance.so";

export async function generateMetadata(
  { params, searchParams }: any
): Promise<Metadata> {
  const dao = params.dao as string;
  const wallet = params.wallet as string;

  const endpoint =
    (searchParams?.endpoint as string) || "https://api.devnet.solana.com";

  let title = "Reputation Card";
  let description = "Proof of participation • DAO reputation score";
  let logo: string | null = null;

  try {
    const conn = new Connection(endpoint, "confirmed");
    const daoPk = new PublicKey(dao);
    const pm = await fetchProjectMetadata(conn, daoPk);
    const uri = extractMetadataUri(pm);

    if (uri) {
      const offchain = await fetchOffchainJson(uri);
      if (offchain?.name) title = offchain.name;
      if (offchain?.description) description = offchain.description;
      if (offchain?.image) logo = offchain.image;
    }
  } catch {
    // ignore
  }

  // ✅ This is the key: give Discord an OG image URL that your server generates.
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
    // optional: also provide a fallback icon
    icons: logo ? [{ url: logo }] : undefined,
  };
}

export default async function Page({ params, searchParams }: any) {
  const dao = params.dao as string;
  const wallet = params.wallet as string;

  const endpoint =
    (searchParams?.endpoint as string) || "https://api.devnet.solana.com";

  const conn = new Connection(endpoint, "confirmed");

  let meta: any = null;
  let resolvedTheme: any = null;

  try {
    const daoPk = new PublicKey(dao);
    const pm = await fetchProjectMetadata(conn, daoPk);
    const uri = extractMetadataUri(pm);

    if (uri) {
      const offchain = await fetchOffchainJson(uri);
      meta = offchain
        ? {
            name: offchain.name,
            symbol: offchain.symbol,
            description: offchain.description,
            image: offchain.image,
          }
        : null;

      const t: VineTheme = offchain?.vine?.theme ?? {};
      resolvedTheme = {
        primary: t.primary ?? grapeTheme.palette.primary.main,
        background: {
          image: t.background_image ?? null,
          opacity: typeof t.background_opacity === "number" ? t.background_opacity : 0.55,
          blur: typeof t.background_blur === "number" ? t.background_blur : 12,
          position: t.background_position ?? "center",
          size: t.background_size ?? "cover",
          repeat: t.background_repeat ?? "no-repeat",
        },
      };
    }
  } catch {}

  return (
    <div style={{ padding: 24, display: "flex", justifyContent: "center" }}>
      <VineReputationShareCard
        daoBase58={dao}
        walletBase58={wallet}
        endpoint={endpoint}
        historyDepth={Number(searchParams?.d ?? 4)}
        meta={meta}
        resolvedTheme={resolvedTheme}
      />
    </div>
  );
}