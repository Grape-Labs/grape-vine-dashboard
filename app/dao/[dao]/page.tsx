import DaoApp from "../../components/DaoApp";
import type { Metadata } from "next";

export async function generateMetadata({ params, searchParams }: any): Promise<Metadata> {
  const dao = params.dao as string;
  const endpoint = (searchParams?.endpoint as string) || "https://api.devnet.solana.com";

  const title = "Vine Reputation DAO";
  const description = "Vine Reputation dashboard";

  const ogImage = `/dao/${dao}/opengraph-image?endpoint=${encodeURIComponent(endpoint)}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default function Page() {
  // server-rendered shell
  //console.log("SERVER: /dao/[dao] rendered");
  return <DaoApp />;
}