"use client";

import React from "react";
import { clusterApiUrl } from "@solana/web3.js";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import HomeInner from "./HomeInner";
import { resolveRpcEndpoint } from "../utils/rpcSettings";

export default function DaoApp() {
  const wallets = React.useMemo(() => [new PhantomWalletAdapter()], []);

  const computeEndpoint = () => {
    const resolved = resolveRpcEndpoint();
    if (resolved?.trim()) return resolved.trim();

    const envDefault = process.env.NEXT_PUBLIC_RPC_ENDPOINT?.trim();
    if (envDefault) return envDefault;

    return clusterApiUrl("mainnet-beta");
  };

  const [endpoint, setEndpoint] = React.useState<string>(computeEndpoint);

  React.useEffect(() => {
    const recompute = () => setEndpoint(computeEndpoint());

    window.addEventListener("grape:rpc-settings", recompute as any);

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
        <WalletModalProvider>
          <HomeInner />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}