// app/api/og/card/route.ts
import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { fetchProjectMetadata } from "@grapenpm/vine-reputation-client";
import sharp from "sharp";
import { GRAPE_RPC_ENDPOINT } from "@/app/constants";

export const runtime = "nodejs";

const SIZE = { width: 1200, height: 630 };

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
  const u = normalizeUrl(uri);
  if (!u) return null;

  try {
    const r = await fetch(u, { cache: "no-store" });
    if (!r.ok) return null;

    const ct = (r.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("text/html")) return null;

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

async function fetchImageAsPngDataUrl(
  url?: string | null,
  variant: "bg" | "logo" = "logo",
  opts?: { timeoutMs?: number; blurPx?: number }
) {
  const u = normalizeUrl(url);
  if (!u) return null;

  const timeoutMs = opts?.timeoutMs ?? 2500;
  const blurPx = Math.min(Math.max(opts?.blurPx ?? 0, 0), 30);

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);

  try {
    const res = await fetch(u, {
      cache: "no-store",
      signal: ac.signal,
      headers: { Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8" },
    });
    if (!res.ok) return null;

    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("text/html") || ct.includes("application/json")) return null;

    const input = Buffer.from(await res.arrayBuffer());
    let img = sharp(input, { failOnError: false });

    if (variant === "bg") {
      img = img.resize(SIZE.width, SIZE.height, { fit: "cover", position: "center" });
      if (blurPx > 0) img = img.blur(blurPx / 2);
    } else {
      img = img.resize(160, 160, { fit: "cover", position: "center" });
    }

    const pngBuf = await img.png().toBuffer();
    return `data:image/png;base64,${pngBuf.toString("base64")}`;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function GET(req: NextRequest) {
  const dao = req.nextUrl.searchParams.get("dao") || "";
  const wallet = req.nextUrl.searchParams.get("wallet") || "";
  const endpoint = req.nextUrl.searchParams.get("endpoint")?.trim() || GRAPE_RPC_ENDPOINT;

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
            }
          : null;

        const t = offchain?.vine?.theme ?? {};
        theme = {
          primary: t.primary ?? "#7c3aed",
          background_image: t.background_image ?? null,
          background_opacity: typeof t.background_opacity === "number" ? t.background_opacity : 0.45,
          background_blur: typeof t.background_blur === "number" ? t.background_blur : 12,
        };
      }
    }
  } catch {
    // ignore
  }

  const primary = theme?.primary ?? "#7c3aed";
  const bgOpacity = Math.min(Math.max(theme?.background_opacity ?? 0.45, 0.2), 0.75);
  const bgBlur = theme?.background_blur ?? 12;

  const bgDataUrl = await fetchImageAsPngDataUrl(theme?.background_image, "bg", {
    timeoutMs: 2600,
    blurPx: bgBlur,
  });
  const logoDataUrl = await fetchImageAsPngDataUrl(meta?.image, "logo", { timeoutMs: 2600 });

  const brandName = meta?.name || "Vine Reputation";
  const brandSymbol = meta?.symbol ? `• ${meta.symbol}` : "";
  const brandDesc = meta?.description || "Proof of participation • DAO reputation score";

  const res = new ImageResponse(
    (
      <div
        style={{
          width: `${SIZE.width}px`,
          height: `${SIZE.height}px`,
          position: "relative",
          display: "flex",
          padding: "56px",
          boxSizing: "border-box",
          color: "white",
          background: "linear-gradient(135deg, #020617, #0b1220)",
          fontFamily:
            'system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, sans-serif',
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
              opacity: 0.98,
              display: "flex", // ✅ satori-safe
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
            display: "flex", // ✅ satori-safe
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
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {/* Logo */}
            <div
              style={{
                width: 84,
                height: 84,
                borderRadius: 22,
                overflow: "hidden",
                border: `1px solid ${primary}66`,
                background: "rgba(255,255,255,0.06)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {logoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoDataUrl} width={84} height={84} style={{ objectFit: "cover" }} />
              ) : (
                <div style={{ fontSize: 34, fontWeight: 900, display: "flex" }}>
                  {brandName.slice(0, 1)}
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 16, letterSpacing: 2.4, opacity: 0.85, display: "flex" }}>
                VINE REPUTATION
              </div>

              {/* ✅ FIX: multiple children => display:flex + wrap text */}
              <div
                style={{
                  fontSize: 48,
                  fontWeight: 900,
                  lineHeight: 1.05,
                  display: "flex",
                  alignItems: "baseline",
                  gap: 10,
                }}
              >
                <span style={{ display: "flex" }}>{brandName}</span>
                {brandSymbol ? (
                  <span style={{ opacity: 0.82, fontWeight: 800, display: "flex" }}>
                    {brandSymbol}
                  </span>
                ) : null}
              </div>

              <div style={{ fontSize: 22, opacity: 0.88, marginTop: 10, display: "flex" }}>
                {brandDesc}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 30 }}>
            {/* ✅ FIX: text + span => display:flex + wrap text */}
            <div style={{ fontSize: 22, opacity: 0.94, display: "flex", gap: 10 }}>
              <span style={{ display: "flex" }}>Wallet</span>
              <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                {shortenPk(wallet)}
              </span>
            </div>

            {/* ✅ FIX: text + span => display:flex + wrap text */}
            <div style={{ fontSize: 22, opacity: 0.94, display: "flex", gap: 10 }}>
              <span style={{ display: "flex" }}>DAO</span>
              <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                {shortenPk(dao)}
              </span>
            </div>
          </div>

          <div style={{ marginTop: 26, fontSize: 16, opacity: 0.78, display: "flex" }}>
            vine.governance.so • Powered by Grape 🍇
          </div>
        </div>
      </div>
    ),
    { width: SIZE.width, height: SIZE.height }
  );

  res.headers.set("Content-Type", "image/png");
  res.headers.set("Cache-Control", "public, max-age=300");
  return res;
}
