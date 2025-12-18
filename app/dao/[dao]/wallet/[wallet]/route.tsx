import * as React from "react";
import { ImageResponse } from "next/og";
import { PublicKey, Connection } from "@solana/web3.js";
import { fetchProjectMetadata } from "@grapenpm/vine-reputation-client";
import { VINE_REP_PROGRAM_ID } from "@/app/constants"; // adjust path

export const runtime = "nodejs";        // important (Solana/web3, RPC, etc)
export const dynamic = "force-dynamic"; // cards should be generated per request

type VineTheme = {
  primary?: string;
  background_image?: string | null;
  background_opacity?: number;
  background_blur?: number;
};

type OffchainTokenMeta = {
  name?: string;
  symbol?: string;
  image?: string;
  vine?: { theme?: VineTheme };
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

async function fetchOffchainJson(uri: string): Promise<OffchainTokenMeta | null> {
  try {
    const r = await fetch(uri, { cache: "no-store" });
    if (!r.ok) return null;
    return (await r.json()) as OffchainTokenMeta;
  } catch {
    return null;
  }
}

// TODO: replace with your actual on-chain rep fetch (vine client)
async function fetchReputationForWallet(_dao: PublicKey, _wallet: PublicKey): Promise<number> {
  // e.g. fetchUserReputation(connection, dao, wallet) ...
  return 0;
}

export async function GET(
  _req: Request,
  { params }: { params: { dao: string; wallet: string } }
) {
  const daoPk = new PublicKey(params.dao);
  const walletPk = new PublicKey(params.wallet);

  const rpc = process.env.NEXT_PUBLIC_RPC_ENDPOINT || process.env.RPC_ENDPOINT;
  if (!rpc) {
    return new Response("Missing RPC endpoint env var", { status: 500 });
  }
  const connection = new Connection(rpc, "confirmed");

  // 1) DAO metadata/theme
  const projectMeta = await fetchProjectMetadata(connection, daoPk);
  const uri = extractMetadataUri(projectMeta);
  const offchain = uri ? await fetchOffchainJson(uri) : null;

  const primary = offchain?.vine?.theme?.primary ?? "#7C3AED";
  const bg = offchain?.vine?.theme?.background_image ?? null;
  const bgOpacity =
    typeof offchain?.vine?.theme?.background_opacity === "number"
      ? offchain!.vine!.theme!.background_opacity!
      : 0.55;

  const daoName = offchain?.name ?? "Vine Reputation Space";
  const symbol = offchain?.symbol ? ` • ${offchain.symbol}` : "";
  const logo = offchain?.image ?? null;

  // 2) Reputation score
  const rep = await fetchReputationForWallet(daoPk, walletPk);

  // 3) Render image
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          fontFamily: "Inter, ui-sans-serif, system-ui",
          background: "#020617",
        }}
      >
        {/* background image layer (optional) */}
        {bg ? (
          <img
            src={bg}
            width={1200}
            height={630}
            style={{
              position: "absolute",
              inset: 0,
              objectFit: "cover",
              opacity: 1,
            }}
          />
        ) : null}

        {/* dark overlay (uses theme opacity) */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `rgba(0,0,0,${bgOpacity})`,
          }}
        />

        {/* accent glow */}
        <div
          style={{
            position: "absolute",
            left: "-120px",
            top: "-120px",
            width: "520px",
            height: "520px",
            borderRadius: "999px",
            background: `${primary}`,
            opacity: 0.18,
            filter: "blur(70px)",
          }}
        />

        {/* card */}
        <div
          style={{
            position: "relative",
            margin: "56px",
            width: "calc(100% - 112px)",
            height: "calc(100% - 112px)",
            borderRadius: "32px",
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.06)",
            display: "flex",
            flexDirection: "column",
            padding: "44px",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", gap: "18px", alignItems: "center" }}>
            {/* DAO logo */}
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 18,
                background: "rgba(0,0,0,0.25)",
                border: `1px solid ${primary}55`,
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {logo ? (
                <img src={logo} width={72} height={72} />
              ) : (
                <div style={{ color: "white", fontSize: 28, fontWeight: 800 }}>
                  {daoName.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>

            {/* title */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ color: "white", fontSize: 38, fontWeight: 900, lineHeight: 1.1 }}>
                {daoName}
                <span style={{ color: "rgba(255,255,255,0.75)", fontWeight: 700, fontSize: 28 }}>
                  {symbol}
                </span>
              </div>
              <div style={{ color: "rgba(255,255,255,0.72)", fontSize: 18, marginTop: 8 }}>
                Reputation card
              </div>
            </div>
          </div>

          {/* score block */}
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 18 }}>
                Wallet
              </div>
              <div style={{ color: "white", fontSize: 22, fontFamily: "monospace" }}>
                {params.wallet.slice(0, 6)}…{params.wallet.slice(-6)}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: 8,
              }}
            >
              <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 18 }}>
                Reputation
              </div>
              <div style={{ color: "white", fontSize: 68, fontWeight: 900, lineHeight: 1 }}>
                {rep.toLocaleString()}
              </div>
              <div style={{ color: primary, fontSize: 18, fontWeight: 800 }}>
                Powered by Vine
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}