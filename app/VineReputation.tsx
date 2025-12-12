"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Box, Typography, CircularProgress, Divider } from "@mui/material";
import { Connection, PublicKey } from "@solana/web3.js";

import {
  fetchUserReputation,
  fetchConfig,
  GRAPE_DAO_ID,
} from "./utils/grapeTools/vineReputationClient";
import { REACT_APP_RPC_DEVNET_ENDPOINT } from "./constants";

type VineReputationProps = {
  walletAddress: string | null;
  daoIdBase58?: string;          // defaults to GRAPE_DAO_ID
  endpoint?: string;             // defaults to devnet
  historyDepth?: number;         // how many seasons back to show (default 3)
  decayBase?: number;            // decay per season (default 0.7)
};

function shortenPk(base58: string, start = 6, end = 6) {
  if (!base58) return "";
  if (base58.length <= start + end) return base58;
  return `${base58.slice(0, start)}...${base58.slice(-end)}`;
}

function bnLikeToNumber(v: any): number {
  if (v == null) return 0;
  // Anchor BN
  if (typeof v?.toNumber === "function") return v.toNumber();
  // Bigint
  if (typeof v === "bigint") return Number(v);
  // string/number
  const n = Number(v.toString?.() ?? v);
  return Number.isFinite(n) ? n : 0;
}

type SeasonRow = {
  season: number;
  points: number;
  lastUpdateSlot: number;
  weight: number;
  effectivePoints: number;
};

const VineReputation: React.FC<VineReputationProps> = ({
  walletAddress,
  daoIdBase58,
  endpoint,
  historyDepth = 3,
  decayBase = 0.7,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [daoBase58, setDaoBase58] = useState<string>("");
  const [currentSeason, setCurrentSeason] = useState<number | null>(null);
  const [rows, setRows] = useState<SeasonRow[]>([]);

  const conn = useMemo(() => {
    const url = endpoint || REACT_APP_RPC_DEVNET_ENDPOINT;
    return new Connection(url, "confirmed");
  }, [endpoint]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setError(null);
        setRows([]);
        setCurrentSeason(null);

        if (!walletAddress) return;

        setLoading(true);

        const userPk = new PublicKey(walletAddress);
        const daoPk = daoIdBase58 ? new PublicKey(daoIdBase58) : GRAPE_DAO_ID;

        setDaoBase58(daoPk.toBase58());

        // 1) load config once to get currentSeason
        const cfg = await fetchConfig(conn, daoPk);
        if (!cfg) {
          if (!cancelled) setError("No config found for this DAO.");
          return;
        }
        const current = bnLikeToNumber(cfg.currentSeason);
        if (!cancelled) setCurrentSeason(current);

        // 2) choose seasons to show
        const depth = Math.max(1, Math.floor(historyDepth));
        const startSeason = Math.max(1, current - depth + 1);

        const seasons: number[] = [];
        for (let s = startSeason; s <= current; s++) seasons.push(s);

        // 3) fetch each season via your working decoder
        // (sequential keeps it simple + avoids rate limiting)
        const nextRows: SeasonRow[] = [];
        for (const s of seasons) {
          if (cancelled) return;

          const r = await fetchUserReputation(conn, userPk, daoPk, s);
          const rep = r?.reputation;

          const points = bnLikeToNumber(rep?.points);
          const lastUpdateSlot = bnLikeToNumber(rep?.lastUpdateSlot);

          const diff = current - s;
          const weight = diff < 0 ? 0 : Math.pow(decayBase, diff);
          const effectivePoints = Math.round(points * weight);

          nextRows.push({
            season: s,
            points,
            lastUpdateSlot,
            weight,
            effectivePoints,
          });
        }

        if (!cancelled) setRows(nextRows);
      } catch (e: any) {
        if (!cancelled) {
          console.error("[VineReputation] load error", e);
          setError(e?.message ?? "Failed to load reputation history");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [conn, walletAddress, daoIdBase58, historyDepth, decayBase]);

  if (!walletAddress) return null;

  const totalRaw = rows.reduce((acc, r) => acc + r.points, 0);
  const totalDecayed = rows.reduce((acc, r) => acc + r.effectivePoints, 0);

  const daoShort = shortenPk(daoBase58 || (daoIdBase58 ?? GRAPE_DAO_ID.toBase58()), 6, 6);
  const walletShort = shortenPk(walletAddress, 6, 6);

  return (
    <Box
      sx={{
        p: 1.6,
        background: "rgba(15,23,42,0.82)",
        border: "1px solid rgba(148,163,184,0.35)",
        backdropFilter: "blur(14px)",
        width: "100%",
      }}
    >
      <Typography variant="overline" sx={{ letterSpacing: 1, opacity: 0.7 }}>
        Vine Reputation (devnet)
      </Typography>

      <Typography variant="caption" sx={{ opacity: 0.8, display: "block" }}>
        Wallet: <span style={{ fontFamily: "monospace" }}>{walletShort}</span>
      </Typography>
      <Typography variant="caption" sx={{ opacity: 0.8, display: "block" }}>
        DAO: <span style={{ fontFamily: "monospace" }}>{daoShort}</span>
      </Typography>

      {loading && (
        <Box sx={{ mt: 1.2, display: "flex", alignItems: "center", gap: 1 }}>
          <CircularProgress size={14} />
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            Loading seasons…
          </Typography>
        </Box>
      )}

      {error && !loading && (
        <Typography variant="caption" color="error" sx={{ mt: 1.2, display: "block" }}>
          {error}
        </Typography>
      )}

      {!loading && !error && (
        <>
          <Box sx={{ mt: 1.2, display: "flex", justifyContent: "space-between" }}>
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              Current season
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              {currentSeason ?? "—"}
            </Typography>
          </Box>

          <Divider sx={{ my: 1.2, borderColor: "rgba(148,163,184,0.35)" }} />

          {/* Season breakdown */}
          {rows.length === 0 ? (
            <Typography variant="caption" sx={{ opacity: 0.75 }}>
              No reputation history found for the selected seasons.
            </Typography>
          ) : (
            <Box sx={{ display: "grid", gap: 0.8 }}>
              {rows
                .slice()
                .reverse() // show latest first
                .map((r) => {
                  const isCurrent = r.season === currentSeason;
                  return (
                    <Box
                      key={r.season}
                      sx={{
                        p: 1,
                        borderRadius: "12px",
                        border: "1px solid rgba(148,163,184,0.25)",
                        background: isCurrent ? "rgba(56,189,248,0.10)" : "rgba(255,255,255,0.03)",
                      }}
                    >
                      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                        <Typography variant="caption" sx={{ opacity: 0.8 }}>
                          Season {r.season}
                        </Typography>
                        <Typography variant="caption" sx={{ opacity: 0.8 }}>
                          Weight {r.weight.toFixed(2)}
                        </Typography>
                      </Box>

                      <Box sx={{ mt: 0.4, display: "flex", justifyContent: "space-between" }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {r.points.toLocaleString()} pts
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {r.effectivePoints.toLocaleString()} effective
                        </Typography>
                      </Box>

                      <Typography variant="caption" sx={{ opacity: 0.65, display: "block", mt: 0.3 }}>
                        Last update slot: {r.lastUpdateSlot ? r.lastUpdateSlot.toLocaleString() : "—"}
                      </Typography>
                    </Box>
                  );
                })}
            </Box>
          )}

          <Divider sx={{ my: 1.2, borderColor: "rgba(148,163,184,0.35)" }} />

          {/* Totals */}
          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              Total (raw)
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 800 }}>
              {totalRaw.toLocaleString()}
            </Typography>
          </Box>

          <Box sx={{ mt: 0.4, display: "flex", justifyContent: "space-between" }}>
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              Total (decayed)
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 800 }}>
              {totalDecayed.toLocaleString()}
            </Typography>
          </Box>
        </>
      )}
    </Box>
  );
};

export default VineReputation;