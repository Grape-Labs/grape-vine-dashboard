// app/dao/[dao]/page.tsx
import DaoApp from "../../components/DaoApp";
import type { Metadata } from "next";

export async function generateMetadata({ params }: any): Promise<Metadata> {
  const dao = params.dao as string;

  const title = "Vine Reputation DAO";
  const description = "Vine Reputation dashboard";

  // IMPORTANT: absolute URLs for crawlers like Discord
  const base =
    process.env.NEXT_PUBLIC_SITE_URL
      ? new URL(process.env.NEXT_PUBLIC_SITE_URL)
      : undefined;

  const ogImagePath = `/dao/${dao}/opengraph-image`; // <- remove endpoint query

  const ogImageUrl = base ? new URL(ogImagePath, base).toString() : ogImagePath;
  const pageUrl = base ? new URL(`/dao/${dao}`, base).toString() : `/dao/${dao}`;

  return {
    title,
    description,
    alternates: { canonical: pageUrl },
    openGraph: {
      title,
      description,
      url: pageUrl,
      type: "website",
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default function Page() {
  return <DaoApp />;
}