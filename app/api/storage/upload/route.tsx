// app/api/storage/upload/route.ts
import { NextResponse } from "next/server";
import { createRequire } from "module";

export const runtime = "nodejs"; // IMPORTANT: force Node runtime (not edge)
export const maxDuration = 60; // Vercel: allow longer upload windows than default

const require = createRequire(import.meta.url);
const TRUTHY_RE = /^(1|true|yes|on)$/i;

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function boolEnv(name: string, fallback = false) {
  const raw = process.env[name];
  if (raw == null) return fallback;
  return TRUTHY_RE.test(raw.trim());
}

function intEnv(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function toBigInt(v: any): bigint {
  return typeof v === "bigint" ? v : BigInt(v.toString());
}

async function withTimeout<T>(label: string, promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await new Promise<T>((resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      promise.then(resolve).catch(reject);
    });
  } finally {
    if (timer) clearTimeout(timer);
  }
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

    const maxUploadBytes = intEnv("IRYS_MAX_UPLOAD_BYTES", 10 * 1024 * 1024);
    if (buffer.length > maxUploadBytes) {
      return NextResponse.json(
        {
          ok: false,
          error: `File too large for server upload (${buffer.length} bytes > ${maxUploadBytes} bytes)`,
        },
        { status: 413 }
      );
    }

    // ✅ Use @irys/upload + Solana adapter
    const { Uploader } = require("@irys/upload");
    const { Solana } = require("@irys/upload-solana");

    const network = (process.env.IRYS_NETWORK || "mainnet").toLowerCase(); // "devnet" | "mainnet"
    const rpcUrl =
      process.env.IRYS_RPC_URL ||
      (network === "devnet"
        ? mustEnv("NEXT_PUBLIC_RPC_SHYFT_DEVNET")
        : mustEnv("NEXT_PUBLIC_RPC_SHYFT_MAINNET"));
    const opTimeoutMs = intEnv("IRYS_OP_TIMEOUT_MS", 8000);
    const uploadTimeoutMs = intEnv("IRYS_UPLOAD_TIMEOUT_MS", 25000);
    const autoFund = boolEnv("IRYS_AUTO_FUND", false);

    // Your key should be the JSON array from a Solana keypair file
    // Example env value: [12,34, ...]
    const keyRaw = mustEnv("IRYS_SOLANA_PRIVATE_KEY");
    let walletKey: any;
    try {
      walletKey = JSON.parse(keyRaw);
    } catch {
      throw new Error("IRYS_SOLANA_PRIVATE_KEY must be valid JSON");
    }

    // 🔑 IMPORTANT: await the FINAL call (devnet()/mainnet()).
    // If you await earlier, you’ll get "*.devnet is not a function".
    const uploader: any = await withTimeout<any>(
      "Irys client initialization",
      network === "mainnet"
        ? Uploader(Solana).withWallet(walletKey).mainnet()
        : Uploader(Solana).withWallet(walletKey).withRpc(rpcUrl).devnet(),
      opTimeoutMs
    );

    const [priceAny, balAny] = await Promise.all([
      withTimeout("Irys getPrice", uploader.getPrice(buffer.length), opTimeoutMs),
      withTimeout("Irys getBalance", uploader.getBalance(), opTimeoutMs),
    ]);

    // Works whether SDK returns bigint or an object with toString()
    const price = toBigInt(priceAny);
    const bal = toBigInt(balAny);

    if (bal < price) {
      const deficit = price - bal;
      if (!autoFund) {
        return NextResponse.json(
          {
            ok: false,
            error: `Irys balance too low. Needed ${price.toString()}, available ${bal.toString()}. Top up wallet or set IRYS_AUTO_FUND=true.`,
          },
          { status: 402 }
        );
      }
      const topUp = deficit + price; // (deficit) + 1 more upload worth
      await withTimeout("Irys fund", uploader.fund(topUp), Math.max(opTimeoutMs, 20000));
    }
    const receipt: any = await withTimeout<any>(
      "Irys upload",
      uploader.upload(buffer, {
        tags: [{ name: "Content-Type", value: contentType }],
      }),
      uploadTimeoutMs
    );

    const uploadId = receipt?.id;
    if (!uploadId) throw new Error("Upload failed: missing receipt id");

    const gateway = process.env.IRYS_GATEWAY_URL || "https://gateway.irys.xyz";
    const publicUrl = `${gateway}/${uploadId}`;

    return NextResponse.json({ ok: true, id: uploadId, url: publicUrl });
  } catch (e: any) {
    const msg = e?.message || "Upload failed";
    const status =
      /timed out/i.test(msg) ? 504 :
      /Missing env:/i.test(msg) ? 500 :
      /IRYS_SOLANA_PRIVATE_KEY/i.test(msg) ? 500 :
      500;

    console.error("[api/storage/upload] error:", msg);
    return NextResponse.json(
      { ok: false, error: msg },
      { status }
    );
  }
}
