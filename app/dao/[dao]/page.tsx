// app/dao/[dao]/page.tsx
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { PublicKey } from "@solana/web3.js";
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

export async function generateMetadata({ params }: any): Promise<Metadata> {
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

  // Make the title useful in iMessage compact previews
  const shortDao = `${dao.slice(0, 6)}…${dao.slice(-6)}`;
  const title = `Vine Reputation · ${shortDao}`;
  const description = "On-chain, season-based reputation dashboard for this DAO.";

  // IMPORTANT: Open Graph image must be absolute
  // Next will serve this automatically if you have:
  // app/dao/[dao]/opengraph-image.tsx  (or .tsx route handler)
  const ogImageUrl = new URL(`/dao/${dao}/opengraph-image`, metadataBase).toString();
  const pageUrl = new URL(`/dao/${dao}`, metadataBase).toString();

  return {
    metadataBase,
    title,
    description,
    alternates: { canonical: pageUrl },

    openGraph: {
      type: "website",
      url: pageUrl,
      title,
      description,
      siteName: "Vine Reputation",
      locale: "en_US",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
        },
      ],
    },

    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },

    // This can help iMessage show a better icon in compact mode
    // (make sure these files exist in /public)
    icons: {
      icon: "/favicon-32x32.png",
      apple: "/apple-touch-icon.png",
    },
  };
}

export default function Page({ params }: any) {
  const dao = String(params.dao || "");
  if (!isValidPk(dao)) redirect("/?notfound=1");
  return <DaoApp />;
}