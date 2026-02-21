import { ImageResponse } from "next/og";
import { Connection, PublicKey } from "@solana/web3.js";
import { fetchProjectMetadata } from "@grapenpm/vine-reputation-client";
import { GRAPE_RPC_ENDPOINT } from "@/app/constants";

export const runtime = "nodejs";
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };

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

function shortenPk(base58: string, start = 6, end = 6) {
  if (!base58) return "";
  if (base58.length <= start + end) return base58;
  return `${base58.slice(0, start)}…${base58.slice(-end)}`;
}

async function fetchAsDataUrl(url?: string | null) {
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "image/png";
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:${ct};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function OpenGraphImage({
  params,
  searchParams,
}: {
  params: { dao: string; wallet: string };
  searchParams?: { endpoint?: string };
}) {
  const dao = params.dao;
  const wallet = params.wallet;

  const endpoint = searchParams?.endpoint?.trim() || GRAPE_RPC_ENDPOINT;
  const conn = new Connection(endpoint, "confirmed");

  let meta: any = null;
  let theme: any = null;

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
            vineTheme: offchain?.vine?.theme as VineTheme | undefined,
          }
        : null;

      const t: VineTheme = offchain?.vine?.theme ?? {};
      theme = {
        primary: t.primary ?? "#7c3aed",
        background_image: t.background_image ?? null,
        background_opacity:
          typeof t.background_opacity === "number" ? t.background_opacity : 0.45,
      };
    }
  } catch {
    // ignore
  }

  const primary = theme?.primary ?? "#7c3aed";
  const bgOpacity = Math.min(Math.max(theme?.background_opacity ?? 0.45, 0.2), 0.7);

  // Convert remote images to data URLs (most reliable for OG rendering)
  const bgDataUrl = await fetchAsDataUrl(theme?.background_image);
  const logoDataUrl = await fetchAsDataUrl(meta?.image);

  const brandName = meta?.name || "Vine Reputation";
  const brandSymbol = meta?.symbol ? ` • ${meta.symbol}` : "";
  const brandDesc = meta?.description || "Proof of participation • DAO reputation score";

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          position: "relative",
          display: "flex",
          padding: "64px",
          boxSizing: "border-box",
          color: "white",
          background: "linear-gradient(135deg, #020617, #0b1220)",
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial',
        }}
      >
        {/* Background image */}
        {bgDataUrl ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url(${bgDataUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: "blur(8px) saturate(1.1)",
              transform: "scale(1.06)",
              opacity: 0.95,
            }}
          />
        ) : null}

        {/* Overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(180deg,
              rgba(2,6,23,${bgOpacity + 0.20}) 0%,
              rgba(2,6,23,${bgOpacity + 0.45}) 55%,
              rgba(2,6,23,${bgOpacity + 0.70}) 100%)`,
          }}
        />

        {/* Card */}
        <div
          style={{
            position: "relative",
            zIndex: 2,
            width: "100%",
            borderRadius: 36,
            border: `1px solid rgba(255,255,255,0.14)`,
            background: "rgba(2,6,23,0.72)",
            padding: 48,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            boxShadow: "0 40px 120px rgba(0,0,0,0.55)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {/* Logo */}
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 18,
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(255,255,255,0.06)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {logoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoDataUrl} width={64} height={64} style={{ objectFit: "cover" }} />
              ) : (
                <div style={{ fontSize: 28, fontWeight: 800 }}>{brandName.slice(0, 1)}</div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 18, letterSpacing: 2, opacity: 0.85 }}>
                VINE REPUTATION
              </div>
              <div style={{ fontSize: 40, fontWeight: 900, lineHeight: 1.05 }}>
                {brandName}
                <span style={{ opacity: 0.82, fontWeight: 800 }}>{brandSymbol}</span>
              </div>
              <div style={{ fontSize: 22, opacity: 0.85, marginTop: 10 }}>{brandDesc}</div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 34 }}>
            <div style={{ fontSize: 22, opacity: 0.9 }}>
              Wallet <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                {shortenPk(wallet)}
              </span>
            </div>
            <div style={{ fontSize: 22, opacity: 0.9 }}>
              DAO <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                {shortenPk(dao)}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.16)",
                background: "rgba(255,255,255,0.06)",
                fontSize: 18,
              }}
            >
              Proof of participation
            </div>
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 999,
                border: `1px solid ${primary}55`,
                background: `${primary}22`,
                fontSize: 18,
              }}
            >
              Reputation score
            </div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
