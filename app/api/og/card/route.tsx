// app/api/og/card/route.tsx
import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const dao = searchParams.get("dao") || "";
  const wallet = searchParams.get("wallet") || "";

  // You can also pass name/symbol/points if you want, but keep this fast.
  const title = "Vine Reputation";
  const subtitle = `DAO ${dao.slice(0, 6)}…${dao.slice(-6)} • Wallet ${wallet.slice(0, 6)}…${wallet.slice(-6)}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "64px",
          background: "linear-gradient(135deg, #020617, #0b1023)",
          color: "white",
        }}
      >
        <div style={{ fontSize: 56, fontWeight: 800, lineHeight: 1.1 }}>{title}</div>
        <div style={{ marginTop: 16, fontSize: 26, opacity: 0.85 }}>{subtitle}</div>

        <div style={{ marginTop: 40, fontSize: 22, opacity: 0.75 }}>
          Proof of participation • DAO reputation score
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}