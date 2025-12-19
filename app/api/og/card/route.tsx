import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { fetchProjectMetadata } from "@grapenpm/vine-reputation-client";

export const runtime = "nodejs";

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
    const r = await fetch(uri, { cache: "no-store" });
    if (!r.ok) return null;
    return await r.json();
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
  const u = normalizeUrl(url);
  if (!u) return null;

  try {
    const res = await fetch(u, { cache: "no-store" });
    if (!res.ok) return null;

    const ct = res.headers.get("content-type") || "image/png";
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:${ct};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const dao = req.nextUrl.searchParams.get("dao") || "";
  const wallet = req.nextUrl.searchParams.get("wallet") || "";
  const endpoint =
    req.nextUrl.searchParams.get("endpoint") || "https://api.devnet.solana.com";

  const size = { width: 1200, height: 630 };

  let meta: any = null;
  let theme: any = null;

  try {
    if (dao) {
      const conn = new Connection(endpoint, "confirmed");
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
              vineTheme: offchain?.vine?.theme,
            }
          : null;

        const t = offchain?.vine?.theme ?? {};
        theme = {
          primary: t.primary ?? "#7c3aed",
          background_image: t.background_image ?? null,
          background_opacity:
            typeof t.background_opacity === "number" ? t.background_opacity : 0.45,
          background_blur:
            typeof t.background_blur === "number" ? t.background_blur : 10,
        };
      }
    }
  } catch {
    // ignore — will fall back to defaults
  }

  const primary = theme?.primary ?? "#7c3aed";
  const bgOpacity = Math.min(Math.max(theme?.background_opacity ?? 0.45, 0.2), 0.7);
  const bgBlur = theme?.background_blur ?? 10;

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
        {/* Background */}
        {bgDataUrl ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url(${bgDataUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: `blur(${bgBlur}px) saturate(1.1)`,
              transform: "scale(1.08)",
              opacity: 1,
            }}
          />
        ) : null}

        {/* Overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(180deg,
              rgba(2,6,23,${Math.min(0.96, bgOpacity + 0.20)}) 0%,
              rgba(2,6,23,${Math.min(0.98, bgOpacity + 0.45)}) 55%,
              rgba(2,6,23,${Math.min(0.99, bgOpacity + 0.70)}) 100%)`,
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
            <div
              style={{
                width: 64,
                height: 64,
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
              Wallet{" "}
              <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                {shortenPk(wallet)}
              </span>
            </div>
            <div style={{ fontSize: 22, opacity: 0.9 }}>
              DAO{" "}
              <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
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
    {
      ...size,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}