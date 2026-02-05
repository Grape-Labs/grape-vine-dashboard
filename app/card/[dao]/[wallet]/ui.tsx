// app/card/[dao]/[wallet]/ui.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Typography,
  CircularProgress,
  Divider,
  Chip,
  Tooltip,
  IconButton,
  Snackbar,
  Alert,
  LinearProgress,
  Avatar,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DownloadIcon from "@mui/icons-material/Download";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { Connection, PublicKey } from "@solana/web3.js";

import { getConfigPda, getReputationPda } from "@grapenpm/vine-reputation-client";
import { REACT_APP_RPC_DEVNET_ENDPOINT } from "@/app/constants";

/** ---------- Types ---------- */

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

/** ---------- BigInt helpers ---------- */

const BI_ZERO = BigInt(0);
const BI_EIGHT = BigInt(8);

function shortenPk(base58: string, start = 6, end = 6) {
  if (!base58) return "";
  if (base58.length <= start + end) return base58;
  return `${base58.slice(0, start)}…${base58.slice(-end)}`;
}

function readU16LE(u8: Uint8Array, off: number) {
  return u8[off] | (u8[off + 1] << 8);
}

function readU64LE(u8: Uint8Array, off: number): bigint {
  let x = BI_ZERO;
  for (let i = 7; i >= 0; i--) x = (x << BI_EIGHT) + BigInt(u8[off + i]);
  return x;
}

function u8eq(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function formatBigInt(bi: bigint): string {
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

/** ---------- Anchor discriminators ---------- */

async function sha256(u8: Uint8Array): Promise<Uint8Array> {
  const view =
    u8.byteOffset === 0 && u8.byteLength === u8.buffer.byteLength ? u8 : u8.slice();
  const hash = await crypto.subtle.digest("SHA-256", view as unknown as BufferSource);
  return new Uint8Array(hash);
}

async function anchorAccountDiscriminator(name: string): Promise<Uint8Array> {
  const preimage = new TextEncoder().encode(`account:${name}`);
  const hash = await sha256(preimage);
  return hash.slice(0, 8);
}

/** ---------- Decoders ---------- */

async function decodeConfigStrict(data: Uint8Array): Promise<DecodedConfig> {
  const disc = await anchorAccountDiscriminator("ReputationConfig");
  if (data.length < 113 || !u8eq(data.subarray(0, 8), disc)) {
    throw new Error("Not a ReputationConfig account (bad discriminator/len)");
  }

  let o = 8;
  const version = data[o];
  o += 1;

  const daoId = new PublicKey(data.subarray(o, o + 32));
  o += 32;
  const authority = new PublicKey(data.subarray(o, o + 32));
  o += 32;
  const repMint = new PublicKey(data.subarray(o, o + 32));
  o += 32;

  const currentSeason = readU16LE(data, o);
  o += 2;
  const decayBps = readU16LE(data, o);
  o += 2;

  const bump = data[o];

  return { version, daoId, authority, repMint, currentSeason, decayBps, bump };
}

async function decodeReputationStrict(data: Uint8Array) {
  const disc = await anchorAccountDiscriminator("Reputation");
  if (data.length < 64 || !u8eq(data.subarray(0, 8), disc)) return null;

  let o = 8;
  const version = data[o];
  o += 1;

  const user = new PublicKey(data.subarray(o, o + 32));
  o += 32;
  const season = readU16LE(data, o);
  o += 2;

  const points = readU64LE(data, o);
  o += 8;
  const lastUpdateSlot = readU64LE(data, o);
  o += 8;

  const bump = data[o];

  return { version, user, season, points, lastUpdateSlot, bump };
}

/** ---------- Fetchers ---------- */

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
  if (rep && !rep.user.equals(userPk)) return { rep: null as any, repPda };

  return { rep, repPda };
}

/** ---------- UI Component ---------- */

type CardMeta = {
  name?: string;
  symbol?: string;
  description?: string;
  image?: string;
} | null;

type ResolvedTheme = {
  primary: string;
  background: {
    image: string | null;
    opacity: number;
    blur: number;
    position: string;
    size: string;
    repeat: string;
  } | null;
} | null;

export default function VineReputationShareCard(props: {
  daoBase58: string;
  walletBase58: string;
  endpoint?: string;
  historyDepth?: number; // default 4
  decayBase?: number; // override 0..1
  title?: string; // fallback title
  subtitle?: string; // fallback subtitle
  meta?: CardMeta; // <-- you pass this from page.tsx
  resolvedTheme?: ResolvedTheme;
}) {
  const {
    daoBase58,
    walletBase58,
    endpoint,
    historyDepth = 4,
    decayBase,
    title = "Vine Reputation",
    subtitle = "Proof of participation • DAO reputation score",
    meta,
  } = props;

  const cardRef = useRef<HTMLDivElement | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentSeason, setCurrentSeason] = useState<number | null>(null);
  const [decayBps, setDecayBps] = useState<number | null>(null);
  const [rows, setRows] = useState<SeasonRow[]>([]);

  const [snack, setSnack] = useState<{
    open: boolean;
    msg: string;
    sev: "success" | "error";
  }>({ open: false, msg: "", sev: "success" });

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

        if (!daoBase58?.trim() || !walletBase58?.trim()) return;

        setLoading(true);

        const daoPk = new PublicKey(daoBase58.trim());
        const userPk = new PublicKey(walletBase58.trim());

        const cfg = await fetchConfigStrict(conn, daoPk);
        if (!cfg) {
          if (!cancelled) setError("No config found for this DAO.");
          return;
        }

        if (!Number.isFinite(cfg.currentSeason) || cfg.currentSeason <= 0) {
          if (!cancelled) setError(`Config currentSeason is invalid: ${cfg.currentSeason}`);
          return;
        }

        const onchainDecay = Number.isFinite(cfg.decayBps) ? cfg.decayBps : 7000;
        setCurrentSeason(cfg.currentSeason);
        setDecayBps(onchainDecay);

        const decayFactor =
          typeof decayBase === "number" && Number.isFinite(decayBase)
            ? Math.max(0, Math.min(1, decayBase))
            : Math.max(0, Math.min(1, onchainDecay / 10000));

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

          let effectivePoints = BI_ZERO;
          const ptsNum = bigintToSafeNumber(points);
          if (ptsNum != null) effectivePoints = BigInt(Math.round(ptsNum * weight));
          else effectivePoints = points;

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
          console.error("[VineReputationShareCard] load error", e);
          setError(e?.message ?? "Failed to load reputation history");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [conn, daoBase58, walletBase58, historyDepth, decayBase]);

  const totalRaw = rows.reduce((acc, r) => acc + r.points, BI_ZERO);
  const totalDecayed = rows.reduce((acc, r) => acc + r.effectivePoints, BI_ZERO);

  const daoShort = shortenPk(daoBase58, 6, 6);
  const walletShort = shortenPk(walletBase58, 6, 6);

  const handleCopy = async (text: string, okMsg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setSnack({ open: true, msg: okMsg, sev: "success" });
    } catch {
      setSnack({ open: true, msg: "Copy failed (clipboard blocked).", sev: "error" });
    }
  };

  const handleDownload = async () => {
    try {
      const mod: any = await import("html-to-image");
      const toPng = mod?.toPng || mod?.default?.toPng;
      if (!toPng) throw new Error("html-to-image not found");

      if (!cardRef.current) throw new Error("Missing card ref");
      const dataUrl = await toPng(cardRef.current, { cacheBust: true });

      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `vine-reputation-${walletShort}.png`;
      a.click();
    } catch {
      setSnack({
        open: true,
        sev: "error",
        msg: "Download requires the optional 'html-to-image' package (or capture via screenshot).",
      });
    }
  };

  const explorerDao = `https://explorer.solana.com/address/${daoBase58}?cluster=devnet`;
  const explorerWallet = `https://explorer.solana.com/address/${walletBase58}?cluster=devnet`;

  const maxPts = useMemo(() => {
    const nums = rows.map((r) => bigintToSafeNumber(r.effectivePoints) ?? 0);
    return Math.max(1, ...nums);
  }, [rows]);

  const bg = props.resolvedTheme?.background;
  const primary = props.resolvedTheme?.primary ?? "#cccccc";

  const hasBg = !!bg?.image;
  const cardBgImage = hasBg ? `url("${bg!.image}")` : "none";

  const bgOpacity = hasBg ? Math.min(Math.max(bg?.opacity ?? 0.35, 0.18), 0.55) : 0;
  const bgBlur = hasBg ? Math.min(Math.max(bg?.blur ?? 14, 8), 22) : 0;

  // ---- Metadata-driven header text ----
  const brandName = meta?.name?.trim() || title;
  const brandSymbol = meta?.symbol?.trim() || "";
  const brandDesc = meta?.description?.trim() || subtitle;
  const brandImage = meta?.image || "";

  const brandTitleLine = brandSymbol ? `${brandName} • ${brandSymbol}` : brandName;

  return (
    <>
      <Box
        ref={cardRef}
        sx={{
          position: "relative",
          width: "100%",
          maxWidth: 720,
          borderRadius: "28px",
          overflow: "hidden",
          border: `1px solid ${primary}33`,
          boxShadow: "0 24px 80px rgba(0,0,0,0.55)",
          color: "rgba(248,250,252,0.96)",

          // keep everything above background layers
          "& .MuiTypography-root": { color: "rgba(248,250,252,0.96)", position: "relative", zIndex: 1 },
          "& .MuiIconButton-root": { color: "rgba(248,250,252,0.84)", position: "relative", zIndex: 1 },
          "& .MuiSvgIcon-root": { position: "relative", zIndex: 1 },
        }}
      >
        {/* Background image */}
        {hasBg && (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              backgroundImage: cardBgImage,
              backgroundSize: bg?.size ?? "cover",
              backgroundPosition: bg?.position ?? "center",
              backgroundRepeat: bg?.repeat ?? "no-repeat",
              filter: `blur(${bgBlur}px) saturate(1.1)`,
              transform: "scale(1.08)",
              opacity: 0.95,
              zIndex: 0,
              pointerEvents: "none",
            }}
          />
        )}

        {/* Dimming */}
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            background: hasBg
              ? `linear-gradient(180deg,
                  rgba(2,6,23,${bgOpacity + 0.25}) 0%,
                  rgba(2,6,23,${bgOpacity + 0.45}) 55%,
                  rgba(2,6,23,${bgOpacity + 0.70}) 100%)`
              : "radial-gradient(900px 380px at 15% 0%, rgba(56,189,248,0.22), transparent 60%)," +
                "radial-gradient(900px 420px at 85% 5%, rgba(167,139,250,0.22), transparent 60%)," +
                "linear-gradient(180deg, rgba(2,6,23,0.96), rgba(2,6,23,0.80))",
            zIndex: 1,
            pointerEvents: "none",
          }}
        />

        {/* CONTENT LAYER */}
        <Box
          sx={{
            position: "relative",
            zIndex: 2,
            display: "flex",
            flexDirection: "column",
            background: "rgba(2,6,23,0.72)",
            backdropFilter: "blur(16px) saturate(1.1)",
          }}
        >
          {/* HEADER */}
          <Box sx={{ p: 3, display: "flex", justifyContent: "space-between", gap: 2 }}>
            <Box sx={{ minWidth: 0 }}>
              {/* Brand row: logo + name/symbol */}
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
                <Avatar
                  src={brandImage || undefined}
                  alt={brandName}
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: "12px",
                    border: "1px solid rgba(255,255,255,0.18)",
                    background: "rgba(255,255,255,0.06)",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
                    flex: "0 0 auto",
                  }}
                  imgProps={{ referrerPolicy: "no-referrer" }}
                >
                  {brandName?.slice(0, 1)?.toUpperCase() || "V"}
                </Avatar>

                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    variant="overline"
                    sx={{
                      letterSpacing: 1.6,
                      opacity: 0.9,
                      display: "block",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      lineHeight: 1.1,
                    }}
                    title={brandTitleLine}
                  >
                    {brandTitleLine}
                  </Typography>

                  <Typography
                    variant="body2"
                    sx={{
                      opacity: 0.82,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                    title={brandDesc}
                  >
                    {brandDesc}
                  </Typography>
                </Box>
              </Box>

              {/* Badges */}
              {/*
              <Box sx={{ mt: 1.25, display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                {decayBps != null && (
                  <Chip
                    size="small"
                    label={`Decay ${(decayBps / 100).toFixed(2)}%`}
                    sx={{
                      borderRadius: "999px",
                      border: "1px solid rgba(148,163,184,0.22)",
                      background: "rgba(255,255,255,0.04)",
                      color: "rgba(248,250,252,0.82)",
                    }}
                  />
                )}
              </Box>
              */}

              {/* Big number */}
              <Typography variant="h5" sx={{ mt: 1.15, fontWeight: 1000, lineHeight: 1.08 }}>
                {formatBigInt(totalDecayed)}{" "}
                <Box component="span" sx={{ opacity: 0.85, fontWeight: 900 }}>
                  effective points
                </Box>
              </Typography>

              {/* Addresses */}
              <Box sx={{ mt: 1.2, display: "grid", gap: 0.35 }}>
                <Box sx={{ display: "flex", gap: 1, alignItems: "center", minWidth: 0 }}>
                  <Typography variant="caption" sx={{ opacity: 0.75, width: 64 }}>
                    Wallet
                  </Typography>
                  <Tooltip title="Copy wallet">
                    <Typography
                      variant="caption"
                      sx={{
                        fontFamily: "monospace",
                        opacity: 0.95,
                        cursor: "pointer",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        flex: 1,
                      }}
                      onClick={() => handleCopy(walletBase58, "Wallet copied")}
                    >
                      {walletShort}
                    </Typography>
                  </Tooltip>
                  <Tooltip title="Open in Explorer">
                    <IconButton size="small" onClick={() => window.open(explorerWallet, "_blank")}>
                      <OpenInNewIcon fontSize="inherit" />
                    </IconButton>
                  </Tooltip>
                </Box>

                <Box sx={{ display: "flex", gap: 1, alignItems: "center", minWidth: 0 }}>
                  <Typography variant="caption" sx={{ opacity: 0.75, width: 64 }}>
                    DAO
                  </Typography>
                  <Tooltip title="Copy DAO">
                    <Typography
                      variant="caption"
                      sx={{
                        fontFamily: "monospace",
                        opacity: 0.95,
                        cursor: "pointer",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        flex: 1,
                      }}
                      onClick={() => handleCopy(daoBase58, "DAO copied")}
                    >
                      {daoShort}
                    </Typography>
                  </Tooltip>
                  <Tooltip title="Open in Explorer">
                    <IconButton size="small" onClick={() => window.open(explorerDao, "_blank")}>
                      <OpenInNewIcon fontSize="inherit" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            </Box>

            {/* Actions */}
            <Box sx={{ display: "flex", gap: 0.75, alignItems: "flex-start" }}>
              <Tooltip title="Copy share link">
                <IconButton onClick={() => handleCopy(window.location.href, "Share link copied")}>
                  <ContentCopyIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Download PNG (optional)">
                <IconButton onClick={handleDownload}>
                  <DownloadIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          <Divider sx={{ borderColor: "rgba(255,255,255,0.14)" }} />

          {/* BODY */}
          <Box sx={{ p: 2.2 }}>
            {loading && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <CircularProgress size={16} />
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Loading on-chain reputation…
                </Typography>
              </Box>
            )}

            {error && !loading && (
              <Alert severity="error" variant="outlined" sx={{ background: "rgba(2,6,23,0.45)" }}>
                {error}
              </Alert>
            )}

            {!loading && !error && (
              <>
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                  <Typography variant="caption" sx={{ opacity: 0.85 }}>
                    Season history
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.85 }}>
                    Current season: <b>{currentSeason ?? "—"}</b>
                  </Typography>
                </Box>

                {rows.length === 0 ? (
                  <Typography variant="body2" sx={{ opacity: 0.85 }}>
                    No reputation history found for the selected seasons.
                  </Typography>
                ) : (
                  <Box sx={{ display: "grid", gap: 1 }}>
                    {rows
                      .slice()
                      .reverse()
                      .map((r) => {
                        const isCurrent = r.season === currentSeason;
                        const pts = bigintToSafeNumber(r.effectivePoints) ?? 0;
                        const pct = Math.max(0, Math.min(100, (pts / maxPts) * 100));

                        return (
                          <Box
                            key={r.season}
                            sx={{
                              p: 1.2,
                              borderRadius: "16px",
                              background: isCurrent
                                ? "rgba(56,189,248,0.10)"
                                : "rgba(255,255,255,0.04)",
                              border: "1px solid rgba(148,163,184,0.20)",
                              opacity: r.found ? 1 : 0.6,
                            }}
                          >
                            <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
                              <Typography variant="body2" sx={{ fontWeight: 800 }}>
                                Season {r.season}{" "}
                                {!r.found && (
                                  <Box component="span" sx={{ opacity: 0.8, fontWeight: 600 }}>
                                    • no account
                                  </Box>
                                )}
                              </Typography>
                              <Typography variant="caption" sx={{ opacity: 0.85 }}>
                                weight {r.weight.toFixed(2)}
                              </Typography>
                            </Box>

                            <Box sx={{ mt: 0.6 }}>
                              <LinearProgress
                                variant="determinate"
                                value={r.found ? pct : 0}
                                sx={{
                                  height: 8,
                                  borderRadius: 99,
                                  backgroundColor: "rgba(148,163,184,0.14)",
                                  "& .MuiLinearProgress-bar": {
                                    borderRadius: 99,
                                    backgroundImage:
                                      "linear-gradient(90deg, rgba(56,189,248,0.95), rgba(167,139,250,0.95))",
                                  },
                                }}
                              />
                            </Box>

                            <Box
                              sx={{
                                mt: 0.8,
                                display: "flex",
                                justifyContent: "space-between",
                                gap: 1,
                                flexWrap: "wrap",
                              }}
                            >
                              <Typography variant="caption" sx={{ opacity: 0.9 }}>
                                Raw: <b>{r.found ? `${formatBigInt(r.points)} pts` : "—"}</b>
                              </Typography>
                              <Typography variant="caption" sx={{ opacity: 0.9 }}>
                                Effective: <b>{r.found ? `${formatBigInt(r.effectivePoints)}` : "—"}</b>
                              </Typography>
                            </Box>
                          </Box>
                        );
                      })}
                  </Box>
                )}

                <Divider sx={{ my: 2, borderColor: "rgba(255,255,255,0.14)" }} />

                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography variant="caption" sx={{ opacity: 0.82 }}>
                    Total (raw)
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 900 }}>
                    {formatBigInt(totalRaw)}
                  </Typography>
                </Box>

                <Box sx={{ mt: 0.6, display: "flex", justifyContent: "space-between" }}>
                  <Typography variant="caption" sx={{ opacity: 0.82 }}>
                    Total (effective)
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 900 }}>
                    {formatBigInt(totalDecayed)}
                  </Typography>
                </Box>

                <Typography variant="caption" sx={{ mt: 1.4, display: "block", opacity: 0.85 }}>
                  Powered by OG Reputation Spaces
                </Typography>
              </>
            )}
          </Box>
        </Box>
      </Box>

      <Snackbar
        open={snack.open}
        autoHideDuration={2200}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snack.sev} variant="filled" onClose={() => setSnack((s) => ({ ...s, open: false }))}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </>
  );
}