"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Box, Typography, CircularProgress, Divider } from "@mui/material";
import { Connection, PublicKey } from "@solana/web3.js";
import { Buffer } from "buffer";

import {
  fetchConfig,
  fetchReputation,
  getConfigPda,
  getReputationPda,
  decodeReputation,
} from "@grapenpm/vine-reputation-client";

import { REACT_APP_RPC_DEVNET_ENDPOINT, GRAPE_DAO_ID } from "./constants";

type VineReputationProps = {
  walletAddress: string | null;
  daoIdBase58?: string; // defaults to GRAPE_DAO_ID
  endpoint?: string; // defaults to devnet
  historyDepth?: number; // how many seasons back to show (default 3)
  decayBase?: number; // decay per season (default 0.7)
};

function toBuffer(data: Uint8Array | Buffer | ArrayBuffer | ArrayBufferView): Buffer {
  if (Buffer.isBuffer(data)) return data;

  if (data instanceof Uint8Array) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  }

  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  }

  // ArrayBuffer
  return Buffer.from(data);
}

function shortenPk(base58: string, start = 6, end = 6) {
  if (!base58) return "";
  if (base58.length <= start + end) return base58;
  return `${base58.slice(0, start)}...${base58.slice(-end)}`;
}

function bnLikeToNumber(v: any): number {
  if (v == null) return 0;
  if (typeof v?.toNumber === "function") return v.toNumber(); // Anchor BN
  if (typeof v === "bigint") return Number(v);
  const n = Number(v.toString?.() ?? v);
  return Number.isFinite(n) ? n : 0;
}

type SeasonRow = {
  season: number;
  points: number;
  lastUpdateSlot: number;
  weight: number;
  effectivePoints: number;
  found: boolean;
};

function resolveDefaultDaoPk(daoIdBase58?: string) {
  if (daoIdBase58?.trim()) return new PublicKey(daoIdBase58.trim());

  // GRAPE_DAO_ID might already be a PublicKey or a string
  try {
    // @ts-ignore
    if (GRAPE_DAO_ID instanceof PublicKey) return GRAPE_DAO_ID as PublicKey;
  } catch {}
  return new PublicKey((GRAPE_DAO_ID as any).toString());
}

/**
 * This wrapper tries a few common signatures for fetchReputation.
 * If none work, it falls back to PDA -> getAccountInfo -> decodeReputation.
 */
async function safeFetchReputation(
  conn: Connection,
  daoPk: PublicKey,
  userPk: PublicKey,
  season: number
) {
  const [configPda] = getConfigPda(daoPk);

  // 1) Try (conn, user, dao, season)  [your current call]
  try {
    const r: any = await (fetchReputation as any)(conn, userPk, daoPk, season);
    if (r) return r;
  } catch {}

  // 2) Try (conn, dao, user, season)
  try {
    const r: any = await (fetchReputation as any)(conn, daoPk, userPk, season);
    if (r) return r;
  } catch {}

  // 3) Try (conn, configPda, user, season)  (very common pattern)
  try {
    const r: any = await (fetchReputation as any)(conn, configPda, userPk, season);
    if (r) return r;
  } catch {}

  // 4) Fallback: compute PDA and decode locally (most reliable)
  try {
    const [repPda] = getReputationPda(configPda, userPk, season);
    const ai = await conn.getAccountInfo(repPda, "confirmed");
    if (!ai?.data) return null;
    return decodeReputation(toBuffer(ai.data));
  } catch {}

  return null;
}

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
  const [configBase58, setConfigBase58] = useState<string>("");
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

        const userPk = new PublicKey(walletAddress.trim());
        const daoPk = resolveDefaultDaoPk(daoIdBase58);

        setDaoBase58(daoPk.toBase58());

        // Always compute and show the config PDA
        const [configPda] = getConfigPda(daoPk);
        setConfigBase58(configPda.toBase58());

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

        // 3) fetch each season safely (never break the loop)
        const nextRows: SeasonRow[] = [];

        for (const s of seasons) {
          if (cancelled) return;

          const rep = await safeFetchReputation(conn, daoPk, userPk, s);

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
            found: !!rep,
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

  const daoShort = shortenPk(daoBase58, 6, 6);
  const cfgShort = shortenPk(configBase58, 6, 6);
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
      <Typography variant="caption" sx={{ opacity: 0.8, display: "block" }}>
        Config PDA: <span style={{ fontFamily: "monospace" }}>{cfgShort}</span>
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
        <Typography
          variant="caption"
          color="error"
          sx={{ mt: 1.2, display: "block" }}
        >
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

          {rows.length === 0 ? (
            <Typography variant="caption" sx={{ opacity: 0.75 }}>
              No reputation history found for the selected seasons.
            </Typography>
          ) : (
            <Box sx={{ display: "grid", gap: 0.8 }}>
              {rows
                .slice()
                .reverse()
                .map((r) => {
                  const isCurrent = r.season === currentSeason;
                  return (
                    <Box
                      key={r.season}
                      sx={{
                        p: 1,
                        borderRadius: "12px",
                        border: "1px solid rgba(148,163,184,0.25)",
                        background: isCurrent
                          ? "rgba(56,189,248,0.10)"
                          : "rgba(255,255,255,0.03)",
                        opacity: r.found ? 1 : 0.65,
                      }}
                    >
                      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                        <Typography variant="caption" sx={{ opacity: 0.8 }}>
                          Season {r.season} {r.found ? "" : "• (no account)"}
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

                      <Typography
                        variant="caption"
                        sx={{ opacity: 0.65, display: "block", mt: 0.3 }}
                      >
                        Last update slot:{" "}
                        {r.lastUpdateSlot ? r.lastUpdateSlot.toLocaleString() : "—"}
                      </Typography>
                    </Box>
                  );
                })}
            </Box>
          )}

          <Divider sx={{ my: 1.2, borderColor: "rgba(148,163,184,0.35)" }} />

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