import { ImageResponse } from "next/og";
import { fetchDaoBranding, shortenPk } from "../branding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 3600;

function clampSize(raw: string | null) {
  const parsed = Number(raw || "512");
  if (!Number.isFinite(parsed)) return 512;
  return Math.min(1024, Math.max(128, Math.round(parsed)));
}

async function fetchAsDataUrl(url?: string | null) {
  if (!url) return null;
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") || "image/png";
    const buffer = Buffer.from(await response.arrayBuffer());
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

function shortenName(name: string) {
  if (name.length <= 26) return name;
  return `${name.slice(0, 23)}...`;
}

export async function GET(request: Request, { params }: { params: { dao: string } }) {
  const dao = String(params.dao || "").trim();
  const url = new URL(request.url);
  const size = clampSize(url.searchParams.get("size"));
  const isMaskable = url.searchParams.get("maskable") === "1";

  const branding = await fetchDaoBranding(dao);
  const grapeFallback = new URL("/icons/grape-512.png", url.origin).toString();
  const logoDataUrl =
    (await fetchAsDataUrl(branding.image)) || (await fetchAsDataUrl(grapeFallback));

  const outerPadding = Math.round(size * (isMaskable ? 0.14 : 0.06));
  const innerRadius = Math.round(size * 0.14);
  const logoSize = Math.round(size * 0.42);
  const lineGap = Math.max(8, Math.round(size * 0.02));
  const titleFont = Math.max(22, Math.round(size * 0.085));
  const subtitleFont = Math.max(14, Math.round(size * 0.052));
  const daoFont = Math.max(12, Math.round(size * 0.042));
  const monogram = branding.name.slice(0, 1).toUpperCase();
  const shortDao = shortenPk(branding.dao, 4, 4);

  return new ImageResponse(
    (
      <div
        style={{
          width: `${size}px`,
          height: `${size}px`,
          display: "flex",
          padding: `${outerPadding}px`,
          boxSizing: "border-box",
          background: `linear-gradient(145deg, ${branding.themeColor}, ${branding.backgroundColor})`,
          color: "#f8fafc",
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial',
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: `${innerRadius}px`,
            border: "1px solid rgba(248, 250, 252, 0.24)",
            background: "rgba(2, 6, 23, 0.58)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            gap: `${lineGap}px`,
            padding: `${Math.round(size * 0.06)}px`,
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              width: `${logoSize}px`,
              height: `${logoSize}px`,
              borderRadius: `${Math.round(logoSize * 0.22)}px`,
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(255, 255, 255, 0.1)",
              border: "1px solid rgba(255, 255, 255, 0.24)",
            }}
          >
            {logoDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoDataUrl}
                width={logoSize}
                height={logoSize}
                style={{ objectFit: "cover" }}
                alt=""
              />
            ) : (
              <div style={{ fontSize: `${Math.max(26, Math.round(size * 0.16))}px`, fontWeight: 800 }}>
                {monogram}
              </div>
            )}
          </div>

          <div
            style={{
              maxWidth: "100%",
              fontSize: `${titleFont}px`,
              fontWeight: 800,
              lineHeight: 1.08,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {shortenName(branding.name)}
          </div>

          <div
            style={{
              fontSize: `${subtitleFont}px`,
              letterSpacing: "0.06em",
              opacity: 0.9,
            }}
          >
            VINE REPUTATION
          </div>

          <div
            style={{
              fontSize: `${daoFont}px`,
              opacity: 0.76,
              fontFamily: 'ui-monospace, "SFMono-Regular", Menlo, monospace',
              letterSpacing: "0.06em",
            }}
          >
            {shortDao}
          </div>
        </div>
      </div>
    ),
    {
      width: size,
      height: size,
    }
  );
}
