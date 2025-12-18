// app/card/[dao]/[wallet]/page.tsx
import { PublicKey, Connection } from "@solana/web3.js";
import CardPageClient from "./ui";

import { fetchProjectMetadata } from "@grapenpm/vine-reputation-client";

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

async function fetchOffchainJson(uri: string): Promise<any | null> {
  try {
    const r = await fetch(uri, { cache: "no-store" });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: { dao: string; wallet: string };
}) {
  const dao = params.dao;
  const wallet = params.wallet;

  let meta: any | null = null;

  try {
    const endpoint = process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC || "https://api.devnet.solana.com";
    const connection = new Connection(endpoint);

    const daoPk = new PublicKey(dao);
    const projectMeta = await fetchProjectMetadata(connection, daoPk);
    const uri = extractMetadataUri(projectMeta);

    if (uri) meta = await fetchOffchainJson(uri);
  } catch {
    meta = null;
  }

  return <CardPageClient dao={dao} wallet={wallet} meta={meta} />;
}