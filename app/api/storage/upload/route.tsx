// app/api/storage/upload/route.ts
import { NextResponse } from "next/server";
import { createRequire } from "module";

export const runtime = "nodejs"; // IMPORTANT: force Node runtime (not edge)

const require = createRequire(import.meta.url);

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const provider = (url.searchParams.get("provider") || "irys").toLowerCase();

    if (provider !== "irys") {
      return NextResponse.json(
        { ok: false, error: "Provider not supported yet" },
        { status: 400 }
      );
    }

    const form = await req.formData();
    const file = form.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { ok: false, error: "Missing file" },
        { status: 400 }
      );
    }

    // File -> Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const contentType =
      (form.get("contentType") as string) ||
      file.type ||
      "application/octet-stream";

    // ✅ Use @irys/upload + Solana adapter
    const { Uploader } = require("@irys/upload");
    const { Solana } = require("@irys/upload-solana");

    const network = (process.env.IRYS_NETWORK || "devnet").toLowerCase(); // "devnet" | "mainnet"
    const rpcUrl = mustEnv("SOLANA_RPC_URL");

    // Your key should be the JSON array from a Solana keypair file
    // Example env value: [12,34, ...]
    const keyRaw = mustEnv("IRYS_SOLANA_PRIVATE_KEY");
    const walletKey = JSON.parse(keyRaw);

    // 🔑 IMPORTANT: await the FINAL call (devnet()/mainnet()).
    // If you await earlier, you’ll get "*.devnet is not a function".
    const uploader =
      network === "mainnet"
        ? await Uploader(Solana).withWallet(walletKey).mainnet()
        : await Uploader(Solana).withWallet(walletKey).withRpc(rpcUrl).devnet();

    const priceAny = await uploader.getPrice(buffer.length);
    const balAny = await uploader.getBalance();

    // Works whether SDK returns bigint or an object with toString()
    const price = typeof priceAny === "bigint" ? priceAny : BigInt(priceAny.toString());
    const bal = typeof balAny === "bigint" ? balAny : BigInt(balAny.toString());

    if (bal < price) {
      const deficit = price - bal;
      const topUp = deficit + price; // (deficit) + 1 more upload worth
      await uploader.fund(topUp);
    }


    // Optional: auto-fund if needed (keep off until you want it)
    // const price = await uploader.getPrice(buffer.length);
    // const bal = await uploader.getBalance();
    // if (bal.lt(price)) await uploader.fund(price);

    const receipt = await uploader.upload(buffer, {
      tags: [{ name: "Content-Type", value: contentType }],
    });

    const uploadId = receipt?.id;
    if (!uploadId) throw new Error("Upload failed: missing receipt id");

    const gateway = process.env.IRYS_GATEWAY_URL || "https://gateway.irys.xyz";
    const publicUrl = `${gateway}/${uploadId}`;

    return NextResponse.json({ ok: true, id: uploadId, url: publicUrl });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Upload failed" },
      { status: 500 }
    );
  }
}