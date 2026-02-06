// src/utils/rpcSettings.ts
import {
  GRAPE_RPC_ENDPOINT,
  REACT_APP_RPC_DEVNET_ENDPOINT,
  RPC_SOLANA_MAINNET,
  RPC_SOLANA_DEVNET,
  RPC_SHYFT_MAINNET,
  RPC_SHYFT_DEVNET,
  RPC_ALCHEMY_MAINNET,
} from "@/app/constants";

export type SolanaNetwork = "mainnet" | "devnet";
export type RpcMode = "predefined" | "custom";

export type RpcSettings = {
  network: SolanaNetwork;
  mode: RpcMode;
  predefinedKey: string;
  customRpc: string;
};

const LS_KEY = "grape_rpc_settings_v1";

// ✅ Default: DEVNET + Solana Public
const DEFAULT_SETTINGS: RpcSettings = {
  network: "devnet",
  mode: "predefined",
  predefinedKey: "solana",
  customRpc: "",
};

export type RpcPreset = { label: string; url: string };

// Safe env access (prevents "process is not defined" in some client bundles)
function getEnv(key: string): string | undefined {
  try {
    const p: any = (globalThis as any).process;
    return p?.env?.[key];
  } catch {
    return undefined;
  }
}

// Helper: only add a preset if url exists
function addPreset(
  map: Record<string, RpcPreset>,
  key: string,
  label: string,
  url?: string | null
) {
  const u = String(url || "").trim();
  if (!u) return;
  map[key] = { label, url: u };
}

// Build presets dynamically
export function getRpcPresets(): Record<SolanaNetwork, Record<string, RpcPreset>> {
  const mainnet: Record<string, RpcPreset> = {};
  const devnet: Record<string, RpcPreset> = {};

  // Defaults from constants.tsx (these are your "fallback / legacy" values)
addPreset(mainnet, "default", "Default (Mainnet)", RPC_SHYFT_MAINNET || RPC_ALCHEMY_MAINNET || RPC_SOLANA_MAINNET);
addPreset(devnet, "default", "Default (Devnet)", RPC_SOLANA_DEVNET);

  addPreset(mainnet, "shyft", "Shyft", RPC_SHYFT_MAINNET);
  addPreset(mainnet, "alchemy", "Alchemy", RPC_ALCHEMY_MAINNET);

// keep solana too
addPreset(mainnet, "solana", "Solana Public", RPC_SOLANA_MAINNET);
addPreset(devnet, "solana", "Solana Public", RPC_SOLANA_DEVNET);

  return { mainnet, devnet };
}

export function readRpcSettings(): RpcSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;

  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_SETTINGS;

    const parsed = JSON.parse(raw) as Partial<RpcSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      network: parsed.network === "devnet" ? "devnet" : "mainnet",
      mode: parsed.mode === "custom" ? "custom" : "predefined",
      predefinedKey: String(parsed.predefinedKey || DEFAULT_SETTINGS.predefinedKey),
      customRpc: String(parsed.customRpc || ""),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function writeRpcSettings(next: RpcSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LS_KEY, JSON.stringify(next));
}

export function resolveRpcEndpoint(settings?: RpcSettings): string {
  const s = settings ?? (typeof window !== "undefined" ? readRpcSettings() : DEFAULT_SETTINGS);

  if (s.mode === "custom" && s.customRpc?.trim()) return s.customRpc.trim();

  const presets = getRpcPresets();
  const preset = presets[s.network]?.[s.predefinedKey];
  if (preset?.url) return preset.url;

  // fallback to solana public if available
  const sol = presets[s.network]?.["solana"];
  if (sol?.url) return sol.url;

  // fallback to "default"
  const fallback = presets[s.network]?.["default"];
  if (fallback?.url) return fallback.url;

  // ultimate fallback
  return s.network === "devnet" ? REACT_APP_RPC_DEVNET_ENDPOINT : GRAPE_RPC_ENDPOINT;
}

export function getRpcLabel(settings?: RpcSettings): string {
  const s = settings ?? (typeof window !== "undefined" ? readRpcSettings() : DEFAULT_SETTINGS);
  if (s.mode === "custom" && s.customRpc?.trim()) return "Custom RPC";

  const presets = getRpcPresets();
  return presets[s.network]?.[s.predefinedKey]?.label || "RPC";
}