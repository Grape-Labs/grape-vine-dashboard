"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Box, Typography, CircularProgress, Divider } from "@mui/material";
import { Connection, PublicKey } from "@solana/web3.js";

import {
  fetchConfig,
  getConfigPda,
  getReputationPda,
  decodeReputation,
} from "@grapenpm/vine-reputation-client";

import { REACT_APP_RPC_DEVNET_ENDPOINT, GRAPE_DAO_ID } from "./constants";

type VineReputationProps = {
  walletAddress: string | null;
  daoIdBase58?: string;
  endpoint?: string;
  historyDepth?: number; // default 3
  decayBase?: number; // fallback only if config.decayBps missing
};

function shortenPk(base58: string, start = 6, end = 6) {
  if (!base58) return "";
  if (base58.length <= start + end) return base58;
  return `${base58.slice(0, start)}...${base58.slice(-end)}`;
}

function resolveDefaultDaoPk(daoIdBase58?: string) {
  if (daoIdBase58?.trim()) return new PublicKey(daoIdBase58.trim());
  try {
    // @ts-ignore
    if (GRAPE_DAO_ID instanceof PublicKey) return GRAPE_DAO_ID as PublicKey;
  } catch {}
  return new PublicKey((GRAPE_DAO_ID as any).toString());
}

/**
 * Convert BN / bigint / number / string -> bigint
 * (No bigint literals used)
 */
function toBigIntSafe(v: any): bigint {
  const ZERO = BigInt(0);

  if (v == null) return ZERO;
  if (typeof v === "bigint") return v;

  // Anchor BN
  if (typeof v?.toArrayLike === "function") {
    try {
      // take 8 bytes LE
      const buf: Uint8Array = v.toArrayLike(Uint8Array, "le", 8);
      let x = BigInt(0);
      for (let i = 7; i >= 0; i--) {
        x = (x << BigInt(8)) + BigInt(buf[i]);
      }
      return x;
    } catch {
      return ZERO;
    }
  }

  try {
    return BigInt(v.toString?.() ?? v);
  } catch {
    return ZERO;
  }
}

/**
 * Display bigint nicely without bigint literals
 */
function formatBigInt(bi: bigint): string {
  // BigInt supports toLocaleString in modern runtimes.
  try {
    return bi.toLocaleString("en-US");
  } catch {
    return bi.toString();
  }
}

type SeasonRow = {
  season: number;
  points: bigint;
  lastUpdateSlot: bigint;
  weight: number;
  effectivePoints: bigint;
  found: boolean;
};

/**
 * Anti-garbage guards:
 * - slot must be <= (current chain slot + small buffer)
 * - points must be <= a very generous ceiling
 *
 * Tune these if you ever want.
 */
const MAX_POINTS_REASONABLE = BigInt("1000000000000"); // 1e12 points (absurdly generous)
const SLOT_FUTURE_TOLERANCE = 5000; // slots

async function safeFetchReputationAccount(
  conn: Connection,
  daoPk: PublicKey,
  userPk: PublicKey,
  season: number,
  currentChainSlot: number
): Promise<{ points: bigint; lastUpdateSlot: bigint } | null> {
  const [configPda] = getConfigPda(daoPk);
  const [repPda] = getReputationPda(configPda, userPk, season);

  const ai = await conn.getAccountInfo(repPda, "confirmed");
  if (!ai?.data) return null;

  try {
    const rep: any = await decodeReputation(ai.data as any);

    const points = toBigIntSafe(rep?.points);
    const lastUpdateSlot = toBigIntSafe(rep?.lastUpdateSlot);

    // guard: absurd slot (far in the future) => treat as garbage
    const maxSlotAllowed = BigInt(String(currentChainSlot + SLOT_FUTURE_TOLERANCE));
    if (lastUpdateSlot > maxSlotAllowed) return null;

    // guard: absurd points => treat as garbage
    if (points > MAX_POINTS_REASONABLE) return null;

    return { points, lastUpdateSlot };
  } catch {
    return null;
  }
}

function parseSeasonU16Like(v: any): number | null {
  // season is u16 in your program; accept 1..65535
  let n: number;

  if (typeof v === "number") n = v;
  else {
    const s = (v?.toString?.() ?? String(v)).trim();
    n = Number(s);
  }

  if (!Number.isFinite(n)) return null;
  n = Math.floor(n);

  if (n < 1 || n > 65535) return null;
  return n;
}

function parseDecayBps(v: any): number | null {
  let n: number;
  if (typeof v === "number") n = v;
  else n = Number((v?.toString?.() ?? String(v)).trim());

  if (!Number.isFinite(n)) return null;
  n = Math.floor(n);

  if (n < 0 || n > 10000) return null;
  return n;
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

        const [configPda] = getConfigPda(daoPk);
        setConfigBase58(configPda.toBase58());

        const cfg: any = await fetchConfig(conn, daoPk);
        if (!cfg) {
          if (!cancelled) setError("No config found for this DAO.");
          return;
        }

        const seasonNow = parseSeasonU16Like(cfg.currentSeason);
        if (!seasonNow) {
          if (!cancelled) setError("Config currentSeason is invalid.");
          return;
        }
        if (!cancelled) setCurrentSeason(seasonNow);

        // Use on-chain decayBps if present; otherwise fall back to decayBase prop
        const decayBps = parseDecayBps(cfg.decayBps);
        const perSeasonFactor =
          decayBps == null
            ? decayBase
            : Math.max(0, Math.min(1, 1 - decayBps / 10000));

        const depth = Math.max(1, Math.floor(historyDepth));
        const startSeason = Math.max(1, seasonNow - depth + 1);

        // get chain slot once (used for sanity checks)
        const chainSlot = await conn.getSlot("confirmed");

        const nextRows: SeasonRow[] = [];

        for (let s = startSeason; s <= seasonNow; s++) {
          if (cancelled) return;

          const rep = await safeFetchReputationAccount(conn, daoPk, userPk, s, chainSlot);

          const points = rep?.points ?? BigInt(0);
          const lastUpdateSlot = rep?.lastUpdateSlot ?? BigInt(0);

          const diff = seasonNow - s;
          const weight = diff < 0 ? 0 : Math.pow(perSeasonFactor, diff);

          // effectivePoints as bigint:
          // we can only safely apply weight if points fits into JS number safely.
          // Otherwise show raw points as “effective” to avoid lying.
          let effectivePoints = BigInt(0);
          const maxSafe = BigInt(String(Number.MAX_SAFE_INTEGER));
          if (points <= maxSafe) {
            const eff = Math.round(Number(points) * weight);
            effectivePoints = BigInt(String(Math.max(0, eff)));
          } else {
            effectivePoints = points;
          }

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

  const totalRaw = rows.reduce((acc, r) => acc + r.points, BigInt(0));
  const totalDecayed = rows.reduce((acc, r) => acc + r.effectivePoints, BigInt(0));

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
                          {r.found ? `${formatBigInt(r.points)} pts` : "—"}
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {r.found ? `${formatBigInt(r.effectivePoints)} effective` : "—"}
                        </Typography>
                      </Box>

                      <Typography
                        variant="caption"
                        sx={{ opacity: 0.65, display: "block", mt: 0.3 }}
                      >
                        Last update slot:{" "}
                        {r.found && r.lastUpdateSlot > BigInt(0)
                          ? formatBigInt(r.lastUpdateSlot)
                          : "—"}
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
              {formatBigInt(totalRaw)}
            </Typography>
          </Box>

          <Box sx={{ mt: 0.4, display: "flex", justifyContent: "space-between" }}>
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              Total (decayed)
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 800 }}>
              {formatBigInt(totalDecayed)}
            </Typography>
          </Box>
        </>
      )}
    </Box>
  );
};

export default VineReputation;