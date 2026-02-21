"use client";

import React from "react";
import { clusterApiUrl } from "@solana/web3.js";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import HomeInner from "./HomeInner";
import { resolveRpcEndpoint } from "../utils/rpcSettings";

type VineTheme = {
  mode?: "auto" | "light" | "dark";
  primary?: string;
  background_image?: string | null;
  background_opacity?: number;
  background_blur?: number;
  background_position?: string;
  background_size?: string;
  background_repeat?: string;
};

type OffchainTokenMeta = {
  name?: string;
  symbol?: string;
  description?: string;
  image?: string;
  vine?: { theme?: VineTheme };
};

type SpaceUiMetaWire = {
  dao: string;
  uri?: string | null;
  offchain?: OffchainTokenMeta | null;
};

type VineSpaceWire = {
  version: number;
  daoId: string;
  authority: string;
  repMint: string;
  currentSeason: number;
  decayBps: number;
  configPda: string;
};

type DaoInitialState = {
  activeDao: string;
  spaces: VineSpaceWire[];
  spaceUiMeta: Record<string, SpaceUiMetaWire>;
} | null;

export default function DaoApp(props: { initialEndpoint?: string; initialState?: DaoInitialState }) {
  const { initialEndpoint, initialState } = props;
  const wallets = React.useMemo(() => [new PhantomWalletAdapter()], []);

  const computeEndpoint = () => {
    if (initialEndpoint?.trim()) return initialEndpoint.trim();

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
          <HomeInner initialState={initialState ?? undefined} />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
