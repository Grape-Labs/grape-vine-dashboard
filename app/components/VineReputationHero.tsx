"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Box, Typography, Chip } from "@mui/material";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";

// ✅ use the same client your VineReputation uses
// Adjust import path to wherever these live:
import {
  fetchReputation, // should return { points/score/... } for wallet+dao+season
} from "@grapenpm/vine-reputation-client";

type Props = {
  wallet: string;
  daoIdBase58: string;
  season?: number;
  endpoint?: string;
  primary: string;
};

function formatCompact(n: number) {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function tierFromScore(score: number) {
  if (!Number.isFinite(score)) return { label: "Unknown", tone: "default" as const };
  if (score >= 10_000) return { label: "Whale", tone: "success" as const };
  if (score >= 2_500) return { label: "Gold", tone: "warning" as const };
  if (score >= 500) return { label: "Silver", tone: "info" as const };
  if (score > 0) return { label: "Bronze", tone: "default" as const };
  return { label: "New", tone: "default" as const };
}

export type VineReputationHeroProps = {
  wallet: string;
  daoIdBase58: string;
  season?: number;
  endpoint?: string;

  /** UI customization */
  primary?: string;
  compact?: boolean;
};

export default function VineReputationHero({
  wallet,
  daoIdBase58,
  season,
  endpoint,
  primary = "#cccccc",
  compact = false,
}: VineReputationHeroProps) {
  const [loading, setLoading] = useState(true);
  const [score, setScore] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const tier = useMemo(() => tierFromScore(score ?? NaN), [score]);
    const { connection } = useConnection();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        // Whatever your fetch returns, map it to a number here
        const res: any = await fetchReputation(
          connection,
          new PublicKey(daoIdBase58),
          new PublicKey(wallet),
          season ?? 1,
        );

        // Common possibilities: res.points, res.score, res.reputation
        const value =
          Number(res?.points ?? res?.score ?? res?.reputation ?? res?.value ?? NaN);

        if (mounted) setScore(Number.isFinite(value) ? value : 0);
      } catch (e: any) {
        if (mounted) {
          setErr(e?.message ?? "Failed to load reputation");
          setScore(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [wallet, daoIdBase58, season, endpoint]);

  return (
    <Box sx={{ mt: 2 }}>
      <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 2 }}>
        <Typography sx={{ fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", opacity: 0.85 }}>
          Reputation Score
        </Typography>

        <Chip
          size="small"
          label={loading ? "Loading…" : tier.label}
          sx={{
            borderRadius: "999px",
            border: `1px solid ${primary}55`,
            background: `${primary}18`,
            color: "rgba(248,250,252,0.9)",
            fontWeight: 800,
          }}
        />
      </Box>

      <Typography
        sx={{
          mt: 0.8,
          fontSize: 76,
          lineHeight: 1,
          fontWeight: 950,
          letterSpacing: -1.5,
          textShadow: "0 10px 40px rgba(0,0,0,0.45)",
        }}
      >
        {loading ? "…" : score == null ? "—" : formatCompact(score)}
      </Typography>

      <Box sx={{ mt: 1.2, display: "flex", gap: 1, flexWrap: "wrap" }}>
        <Chip
          size="small"
          label={`Season ${season ?? "Current"}`}
          sx={{
            borderRadius: "999px",
            background: "rgba(0,0,0,0.22)",
            border: "1px solid rgba(148,163,184,0.25)",
            color: "rgba(248,250,252,0.82)",
          }}
        />
        <Chip
          size="small"
          label={endpoint ? "Custom RPC" : "Default RPC"}
          sx={{
            borderRadius: "999px",
            background: "rgba(0,0,0,0.22)",
            border: "1px solid rgba(148,163,184,0.25)",
            color: "rgba(248,250,252,0.82)",
          }}
        />
      </Box>

      {err ? (
        <Typography sx={{ mt: 1, fontSize: 12, opacity: 0.75 }}>
          {err}
        </Typography>
      ) : null}
    </Box>
  );
}