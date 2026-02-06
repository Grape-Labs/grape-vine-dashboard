"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";

import "@solana/wallet-adapter-react-ui/styles.css";

import { resolveRpcEndpoint } from "../utils/rpcSettings";

export default function Providers({ children }: { children: React.ReactNode }) {
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

const computeEndpoint = () => {
  // 1) user-selected endpoint (custom/predefined + network)
  const resolved = resolveRpcEndpoint();
  if (resolved?.trim()) return resolved.trim();

  // 2) fallback default from env (optional)
  const envDefault = process.env.NEXT_PUBLIC_RPC_ENDPOINT?.trim();
  if (envDefault) return envDefault;

  // 3) final fallback
  return clusterApiUrl("mainnet-beta");
};

  const [endpoint, setEndpoint] = useState<string>(computeEndpoint);

  useEffect(() => {
    const recompute = () => setEndpoint(computeEndpoint());

    // when your settings UI updates:
    window.addEventListener("grape:rpc-settings", recompute as any);

    // in case settings change in another tab:
    const onStorage = (e: StorageEvent) => {
      if (e.key === "grape_rpc_settings_v1") recompute();
    };
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("grape:rpc-settings", recompute as any);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint} key={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}