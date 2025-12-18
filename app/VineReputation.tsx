"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Box, Typography, CircularProgress, Divider } from "@mui/material";
import { Connection, PublicKey } from "@solana/web3.js";

import { getConfigPda, getReputationPda } from "@grapenpm/vine-reputation-client";
import { REACT_APP_RPC_DEVNET_ENDPOINT, GRAPE_DAO_ID } from "./constants";

type VineReputationProps = {
  walletAddress: string | null;
  daoIdBase58?: string;          // defaults to GRAPE_DAO_ID
  endpoint?: string;             // defaults to devnet
  season?: number;          
  historyDepth?: number;         // how many seasons back to show (default 3)
  decayBase?: number;            // OPTIONAL override; if omitted, use config.decayBps
};

type SeasonRow = {
  season: number;
  found: boolean;
  points: bigint;
  lastUpdateSlot: bigint;
  weight: number;
  effectivePoints: bigint;
};

type DecodedConfig = {
  version: number;
  daoId: PublicKey;
  authority: PublicKey;
  repMint: PublicKey;
  currentSeason: number;
  decayBps: number; // 0..10000
  bump: number;
};

const BI_ZERO = BigInt(0);
const BI_EIGHT = BigInt(8);
const BI_255 = BigInt(255);

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

function u8eq(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function readU16LE(u8: Uint8Array, off: number) {
  return u8[off] | (u8[off + 1] << 8);
}

function readU64LE(u8: Uint8Array, off: number): bigint {
  let x = BI_ZERO;
  for (let i = 7; i >= 0; i--) {
    x = (x << BI_EIGHT) + BigInt(u8[off + i]);
  }
  return x;
}

function formatBigInt(bi: bigint): string {
  // comma-grouping without toLocaleString (keeps TS targets happy)
  const s = bi.toString(10);
  const neg = s.startsWith("-");
  const digits = neg ? s.slice(1) : s;
  let out = "";
  for (let i = 0; i < digits.length; i++) {
    const idxFromEnd = digits.length - i;
    out += digits[i];
    if (idxFromEnd > 1 && idxFromEnd % 3 === 1) out += ",";
  }
  return neg ? `-${out}` : out;
}

function bigintToSafeNumber(bi: bigint): number | null {
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  if (bi < BI_ZERO || bi > max) return null;
  return Number(bi);
}

async function sha256(u8: Uint8Array): Promise<Uint8Array> {
  const view = u8.byteOffset === 0 && u8.byteLength === u8.buffer.byteLength
    ? u8
    : u8.slice();

  const hash = await crypto.subtle.digest("SHA-256", view as unknown as BufferSource);
  return new Uint8Array(hash);
}

async function anchorAccountDiscriminator(name: string): Promise<Uint8Array> {
  const preimage = new TextEncoder().encode(`account:${name}`);
  const hash = await sha256(preimage);
  return hash.slice(0, 8);
}

async function anchorIxDiscriminator(name: string): Promise<Uint8Array> {
  const preimage = new TextEncoder().encode(`global:${name}`);
  const hash = await sha256(preimage);
  return hash.slice(0, 8);
}

/**
 * IDL layout (ReputationConfig), as per your idl.json:
 *  0..8   disc
 *  8      version u8
 *  9..41  daoId pubkey
 *  41..73 authority pubkey
 *  73..105 repMint pubkey
 *  105..107 currentSeason u16
 *  107..109 decayBps u16
 *  109     bump u8
 *  110..113 padding [u8;3]
 */
async function decodeConfigStrict(data: Uint8Array): Promise<DecodedConfig> {
  const disc = await anchorAccountDiscriminator("ReputationConfig");
  if (data.length < 113 || !u8eq(data.subarray(0, 8), disc)) {
    throw new Error("Not a ReputationConfig account (bad discriminator/len)");
  }

  let o = 8;
  const version = data[o]; o += 1;

  const daoId = new PublicKey(data.subarray(o, o + 32)); o += 32;
  const authority = new PublicKey(data.subarray(o, o + 32)); o += 32;
  const repMint = new PublicKey(data.subarray(o, o + 32)); o += 32;

  const currentSeason = readU16LE(data, o); o += 2;
  const decayBps = readU16LE(data, o); o += 2;

  const bump = data[o]; o += 1;

  return { version, daoId, authority, repMint, currentSeason, decayBps, bump };
}

/**
 * IDL layout (Reputation), as per your idl.json:
 *  0..8   disc
 *  8      version u8
 *  9..41  user pubkey
 *  41..43 season u16
 *  43..51 points u64
 *  51..59 lastUpdateSlot u64
 *  59     bump u8
 *  60..64 padding [u8;4]
 */
async function decodeReputationStrict(data: Uint8Array) {
  const disc = await anchorAccountDiscriminator("Reputation");
  if (data.length < 64 || !u8eq(data.subarray(0, 8), disc)) {
    return null; // treat as “not a Reputation account”
  }

  let o = 8;
  const version = data[o]; o += 1;

  const user = new PublicKey(data.subarray(o, o + 32)); o += 32;
  const season = readU16LE(data, o); o += 2;

  const points = readU64LE(data, o); o += 8;
  const lastUpdateSlot = readU64LE(data, o); o += 8;

  const bump = data[o];

  return { version, user, season, points, lastUpdateSlot, bump };
}

async function fetchConfigStrict(conn: Connection, daoPk: PublicKey) {
  const [configPda] = getConfigPda(daoPk);
  const ai = await conn.getAccountInfo(configPda, "confirmed");
  if (!ai?.data) return null;
  return decodeConfigStrict(new Uint8Array(ai.data));
}

async function fetchReputationStrict(
  conn: Connection,
  daoPk: PublicKey,
  userPk: PublicKey,
  season: number
) {
  const [configPda] = getConfigPda(daoPk);
  const [repPda] = getReputationPda(configPda, userPk, season);

  const ai = await conn.getAccountInfo(repPda, "confirmed");
  if (!ai?.data) return { rep: null as any, repPda };

  const rep = await decodeReputationStrict(new Uint8Array(ai.data));
  // Extra safety: ensure decoded.user matches the seed user
  if (rep && !rep.user.equals(userPk)) {
    return { rep: null as any, repPda };
  }

  return { rep, repPda };
}

const VineReputation: React.FC<VineReputationProps> = ({
  walletAddress,
  daoIdBase58,
  endpoint,
  historyDepth = 3,
  decayBase,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [daoBase58, setDaoBase58] = useState("");
  const [configBase58, setConfigBase58] = useState("");
  const [currentSeason, setCurrentSeason] = useState<number | null>(null);
  const [decayBps, setDecayBps] = useState<number | null>(null);
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
        setDecayBps(null);

        if (!walletAddress) return;

        setLoading(true);

        const userPk = new PublicKey(walletAddress.trim());
        const daoPk = resolveDefaultDaoPk(daoIdBase58);

        setDaoBase58(daoPk.toBase58());

        const [configPda] = getConfigPda(daoPk);
        setConfigBase58(configPda.toBase58());

        const cfg = await fetchConfigStrict(conn, daoPk);
        if (!cfg) {
          if (!cancelled) setError("No config found for this DAO.");
          return;
        }

        if (!Number.isFinite(cfg.currentSeason) || cfg.currentSeason <= 0) {
          if (!cancelled) setError(`Config currentSeason is invalid: ${cfg.currentSeason}`);
          return;
        }

        const onchainDecay = (Number.isFinite(cfg.decayBps) ? cfg.decayBps : 7000);
        setCurrentSeason(cfg.currentSeason);
        setDecayBps(onchainDecay);

        // decide decay factor
        const decayFactor =
          typeof decayBase === "number" && Number.isFinite(decayBase)
            ? decayBase
            : Math.max(0, Math.min(1, onchainDecay / 10000));

        // seasons window
        const depth = Math.max(1, Math.floor(historyDepth));
        const startSeason = Math.max(1, cfg.currentSeason - depth + 1);

        const next: SeasonRow[] = [];

        for (let s = startSeason; s <= cfg.currentSeason; s++) {
          if (cancelled) return;

          const { rep } = await fetchReputationStrict(conn, daoPk, userPk, s);

          const points = rep?.points ?? BI_ZERO;
          const lastUpdateSlot = rep?.lastUpdateSlot ?? BI_ZERO;

          const diff = cfg.currentSeason - s;
          const weight = diff < 0 ? 0 : Math.pow(decayFactor, diff);

          // effectivePoints: do safe number math when possible; otherwise show raw
          let effectivePoints = BI_ZERO;
          const ptsNum = bigintToSafeNumber(points);
          if (ptsNum != null) {
            effectivePoints = BigInt(Math.round(ptsNum * weight));
          } else {
            effectivePoints = points;
          }

          next.push({
            season: s,
            found: !!rep,
            points,
            lastUpdateSlot,
            weight,
            effectivePoints,
          });
        }

        if (!cancelled) setRows(next);
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

  const totalRaw = rows.reduce((acc, r) => acc + r.points, BI_ZERO);
  const totalDecayed = rows.reduce((acc, r) => acc + r.effectivePoints, BI_ZERO);

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

      {!loading && !error && decayBps != null && (
        <Typography variant="caption" sx={{ opacity: 0.75, display: "block", mt: 0.3 }}>
          Decay: {decayBps} bps ({(decayBps / 100).toFixed(2)}%)
        </Typography>
      )}

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

                      <Typography variant="caption" sx={{ opacity: 0.65, display: "block", mt: 0.3 }}>
                        Last update slot: {r.found && r.lastUpdateSlot > BI_ZERO ? formatBigInt(r.lastUpdateSlot) : "—"}
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