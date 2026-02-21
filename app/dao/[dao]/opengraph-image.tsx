import { ImageResponse } from "next/og";
import { Connection, PublicKey } from "@solana/web3.js";
import { fetchProjectMetadata } from "@grapenpm/vine-reputation-client";
import { GRAPE_RPC_ENDPOINT } from "@/app/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // important for always-generating
export const revalidate = 0;
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

function normalizeUrl(u?: string | null): string | null {
  if (!u) return null;
  if (u.startsWith("ipfs://")) return `https://ipfs.io/ipfs/${u.slice("ipfs://".length)}`;
  if (u.startsWith("ar://")) return `https://arweave.net/${u.slice("ar://".length)}`;
  return u;
}

async function fetchOffchainJson(uri: string) {
  try {
    const normalized = normalizeUrl(uri);
    if (!normalized) return null;
    const r = await fetch(normalized, { cache: "no-store" });
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

// Next/og is most reliable when images are embedded as data: URLs
async function fetchAsDataUrl(url?: string | null) {
  if (!url) return null;
  try {
    const normalized = normalizeUrl(url);
    if (!normalized) return null;
    const res = await fetch(normalized, { cache: "no-store" });
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
  params: { dao: string };
  searchParams?: { endpoint?: string };
}) {
  const dao = params.dao;
  const endpoint = searchParams?.endpoint?.trim() || GRAPE_RPC_ENDPOINT;
  const conn = new Connection(endpoint, "confirmed");

  let offchain: any = null;
  let theme: VineTheme = {};

  try {
    const daoPk = new PublicKey(dao);
    const pm = await fetchProjectMetadata(conn, daoPk);
    const uri = extractMetadataUri(pm);
    if (uri) offchain = await fetchOffchainJson(uri);
    theme = (offchain?.vine?.theme ?? {}) as VineTheme;
  } catch {
    // ignore; fallback rendering below
  }

  const brandName = offchain?.name || "Reputation Dashboard";
  const brandSymbol = offchain?.symbol ? ` • ${offchain.symbol}` : "";
  const brandDesc =
    offchain?.description || "Vine Reputation dashboard • spaces, leaderboards, and metadata";
  const primary = theme?.primary || "#7c3aed";

  const bgOpacity = Math.min(Math.max(theme?.background_opacity ?? 0.45, 0.2), 0.75);

  const bgDataUrl = await fetchAsDataUrl(theme?.background_image);
  const logoDataUrl = await fetchAsDataUrl(offchain?.image);

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          position: "relative",
          padding: "64px",
          boxSizing: "border-box",
          display: "flex",
          color: "white",
          background: "linear-gradient(135deg, #020617, #0b1220)",
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial',
        }}
      >
        {/* Background */}
        {bgDataUrl ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url(${bgDataUrl})`,
              backgroundSize: "cover",
              backgroundPosition: theme?.background_position || "center",
              filter: "blur(10px) saturate(1.1)",
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
              rgba(2,6,23,${bgOpacity + 0.50}) 55%,
              rgba(2,6,23,${bgOpacity + 0.75}) 100%)`,
          }}
        />

        {/* Card */}
        <div
          style={{
            position: "relative",
            zIndex: 2,
            width: "100%",
            borderRadius: 36,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(2,6,23,0.72)",
            padding: 48,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            boxShadow: "0 40px 120px rgba(0,0,0,0.55)",
          }}
        >
          <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 18,
                overflow: "hidden",
                border: `1px solid ${primary}55`,
                background: "rgba(255,255,255,0.06)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {logoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoDataUrl} width={72} height={72} style={{ objectFit: "cover" }} />
              ) : (
                <div style={{ fontSize: 30, fontWeight: 900 }}>{brandName.slice(0, 1)}</div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <div style={{ fontSize: 16, letterSpacing: 2, opacity: 0.85 }}>
                VINE REPUTATION • DAO SPACE
              </div>
              <div style={{ fontSize: 44, fontWeight: 950, lineHeight: 1.05 }}>
                {brandName}
                <span style={{ opacity: 0.82, fontWeight: 800 }}>{brandSymbol}</span>
              </div>
              <div
                style={{
                  fontSize: 22,
                  opacity: 0.86,
                  marginTop: 12,
                  maxWidth: 980,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {brandDesc}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 34 }}>
            <div style={{ fontSize: 20, opacity: 0.92 }}>
              DAO{" "}
              <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                {shortenPk(dao)}
              </span>
            </div>

            <div
              style={{
                fontSize: 18,
                padding: "10px 14px",
                borderRadius: 999,
                border: `1px solid ${primary}55`,
                background: `${primary}22`,
              }}
            >
              Open dashboard
            </div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
