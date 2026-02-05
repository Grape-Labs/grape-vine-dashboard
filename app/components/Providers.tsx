"use client";

import React, { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";

import "@solana/wallet-adapter-react-ui/styles.css";

// NEW: read local settings + resolve endpoint
import { resolveRpcEndpoint } from "../utils/rpcSettings";

export default function Providers({ children }: { children: React.ReactNode }) {
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  // Resolve endpoint from:
  // 1) localStorage settings (predefined/custom + mainnet/devnet)
  // 2) env fallback
  // 3) clusterApiUrl fallback
  const endpoint = useMemo(() => {
    // resolveRpcEndpoint() already handles its own defaulting logic
    const resolved = resolveRpcEndpoint();

    // Optional env override (if you want env to ALWAYS win, flip the order)
    const env = process.env.NEXT_PUBLIC_SOLANA_ENDPOINT;
    return env?.trim() ? env.trim() : resolved || clusterApiUrl("devnet");
  }, []);

  return (
    // key makes it easy to support “apply without reload” later
    <ConnectionProvider endpoint={endpoint} key={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}