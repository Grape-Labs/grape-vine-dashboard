"use client";

import React, { forwardRef, useMemo } from "react";
import { Box, Avatar, Typography, Chip } from "@mui/material";
import VineReputationHero from "./VineReputationHero";

type VineTheme = {
  primary?: string;
  background_image?: string | null;
  background_opacity?: number;
  background_blur?: number;
  background_position?: string;
  background_size?: string;
  background_repeat?: string;
};

type OffchainMeta = {
  name?: string;
  symbol?: string;
  description?: string;
  image?: string;
  vine?: { theme?: VineTheme };
};

export type ReputationCardVariant = "compact" | "share";

export type ReputationCardProps = {
  wallet: string;
  daoIdBase58: string;
  rank?: number;
  meta?: OffchainMeta | null;
  season?: number;
  endpoint?: string;

  /** compact = responsive in-app card, share = fixed 1200x630 export */
  variant?: ReputationCardVariant;

  /** optional override theme */
  themeOverride?: VineTheme;

  /** optional: hide long identity lines on compact */
  hideIdentityOnCompact?: boolean;
};

function shorten(s: string, a = 6, b = 6) {
  if (!s) return "";
  if (s.length <= a + b) return s;
  return `${s.slice(0, a)}…${s.slice(-b)}`;
}

export const ReputationCard = forwardRef<HTMLDivElement, ReputationCardProps>(
  function ReputationCard(props, ref) {
    const variant = props.variant ?? "share";
    const isShare = variant === "share";

    const theme = props.themeOverride ?? props.meta?.vine?.theme ?? {};
    const primary = theme.primary ?? "#7c3aed";

    const bg = theme.background_image ?? null;
    const fit = (theme.background_size ?? "cover") as
      | "cover"
      | "contain"
      | "fill"
      | "none"
      | "scale-down";

    const bgOpacity =
      typeof theme.background_opacity === "number" ? theme.background_opacity : 0.55;
    const bgBlur =
      typeof theme.background_blur === "number" ? theme.background_blur : 14;

    const daoName = props.meta?.name ?? "Reputation Space";
    const symbol = props.meta?.symbol ?? "";
    const logo = props.meta?.image ?? null;

    // Share card fixed export size
    const W = 1200;
    const H = 630;

    // Responsive card keeps the same aspect ratio
    const rootSx = useMemo(() => {
      const base = {
        position: "relative" as const,
        overflow: "hidden" as const,
        color: "rgba(248,250,252,0.94)",
        border: "1px solid rgba(148,163,184,0.18)",
        background: "#020617",
        borderRadius: isShare ? 28 : 22,
        boxShadow: isShare ? "0 22px 90px rgba(0,0,0,0.60)" : "0 16px 60px rgba(0,0,0,0.45)",
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial',
      };

      if (isShare) {
        return { ...base, width: W, height: H };
      }

      return {
        ...base,
        width: "100%",
        maxWidth: 980,
        aspectRatio: `${W} / ${H}`,
      };
    }, [isShare]);

    const pad = isShare ? 4.5 : 2.4;
    const logoSize = isShare ? 56 : 40;

    return (
      <Box ref={ref} sx={rootSx}>
        {/* ===== Background (always behind) ===== */}
        <Box sx={{ position: "absolute", inset: 0, zIndex: 0 }}>
          {bg ? (
            <>
              <Box
                component="img"
                src={bg}
                alt=""
                sx={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: fit,
                  objectPosition: theme.background_position ?? "center",
                  filter: `blur(${bgBlur}px)`,
                  transform: "scale(1.08)",
                  opacity: 0.95,
                }}
              />
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  background: `linear-gradient(
                    180deg,
                    rgba(2,6,23,${Math.min(0.92, bgOpacity + 0.25)}) 0%,
                    rgba(2,6,23,0.78) 48%,
                    rgba(2,6,23,0.92) 100%
                  )`,
                }}
              />
            </>
          ) : (
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                background: `
                  radial-gradient(900px 520px at 18% 18%, ${primary}2b, transparent 60%),
                  radial-gradient(800px 460px at 82% 25%, rgba(56,189,248,0.13), transparent 60%),
                  #020617
                `,
              }}
            />
          )}

          {/* quiet highlight + inset border */}
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background: `linear-gradient(135deg, ${primary}22, transparent 55%)`,
              opacity: 0.8,
            }}
          />
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              borderRadius: isShare ? 28 : 22,
              boxShadow: `inset 0 0 0 1px ${primary}22`,
            }}
          />
        </Box>

        {/* ===== Foreground content ===== */}
        <Box
          sx={{
            position: "relative",
            zIndex: 2,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            p: pad,
            gap: isShare ? 2.5 : 1.6,
          }}
        >
          {/* Header (simple, calm) */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
            <Avatar
              src={logo ?? undefined}
              variant="rounded"
              sx={{
                width: logoSize,
                height: logoSize,
                borderRadius: isShare ? "16px" : "14px",
                border: `1px solid ${primary}55`,
                bgcolor: "rgba(0,0,0,0.20)",
                flexShrink: 0,
              }}
              imgProps={{ referrerPolicy: "no-referrer" }}
            />

            <Box sx={{ minWidth: 0 }}>
              <Typography
                sx={{
                  fontWeight: 900,
                  letterSpacing: 0.15,
                  lineHeight: 1.08,
                  fontSize: isShare ? 28 : 18,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: isShare ? 820 : 460,
                  textShadow: "0 2px 16px rgba(0,0,0,0.55)",
                }}
              >
                {daoName}
              </Typography>

              <Box sx={{ display: "flex", gap: 0.8, mt: 0.6, flexWrap: "wrap" }}>
                {symbol ? (
                  <Chip
                    size="small"
                    label={symbol}
                    sx={{
                      height: 24,
                      borderRadius: "999px",
                      border: `1px solid ${primary}66`,
                      background: `${primary}18`,
                      color: "rgba(248,250,252,0.90)",
                      fontWeight: 800,
                    }}
                  />
                ) : null}

                {typeof props.rank === "number" ? (
                  <Chip
                    size="small"
                    label={`Rank #${props.rank}`}
                    sx={{
                      height: 24,
                      borderRadius: "999px",
                      border: "1px solid rgba(148,163,184,0.28)",
                      background: "rgba(15,23,42,0.55)",
                      color: "rgba(248,250,252,0.88)",
                      fontWeight: 800,
                    }}
                  />
                ) : null}

                {typeof props.season === "number" ? (
                  <Chip
                    size="small"
                    label={`Season ${props.season}`}
                    sx={{
                      height: 24,
                      borderRadius: "999px",
                      border: "1px solid rgba(148,163,184,0.26)",
                      background: "rgba(2,6,23,0.45)",
                      color: "rgba(248,250,252,0.82)",
                      fontWeight: 700,
                    }}
                  />
                ) : null}
              </Box>
            </Box>

            <Box sx={{ ml: "auto" }}>
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  bgcolor: primary,
                  boxShadow: `0 0 0 7px ${primary}22, 0 0 24px ${primary}44`,
                }}
              />
            </Box>
          </Box>

          {/* Main (single focal panel + subtle identity strip) */}
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              display: "grid",
              gap: isShare ? 2.2 : 1.4,
              gridTemplateColumns: { xs: "1fr", md: "1fr" }, // keep it simple: one hero
            }}
          >
            {/* HERO PANEL (the whole point of the card) */}
            <Box
              sx={{
                borderRadius: isShare ? 26 : 18,
                background: "rgba(15,23,42,0.74)",
                border: "1px solid rgba(148,163,184,0.22)",
                backdropFilter: "blur(16px)",
                p: isShare ? 3.2 : 2,
                position: "relative",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  pointerEvents: "none",
                  background: `radial-gradient(800px 420px at 18% 30%, ${primary}24, transparent 60%)`,
                }}
              />
              <Box sx={{ position: "relative" }}>
                <Typography
                  sx={{
                    fontWeight: 900,
                    letterSpacing: 0.8,
                    textTransform: "uppercase",
                    opacity: 0.85,
                    fontSize: 12,
                  }}
                >
                  Reputation
                </Typography>

                <Box sx={{ mt: isShare ? 1.8 : 1.2 }}>
                  <VineReputationHero
                    wallet={props.wallet}
                    daoIdBase58={props.daoIdBase58}
                    season={props.season}
                    endpoint={props.endpoint}
                    primary={primary}
                    compact={!isShare}
                  />
                </Box>
              </Box>
            </Box>

            {/* Identity strip (small + classy, not a second “panel”) */}
            {!props.hideIdentityOnCompact || isShare ? (
              <Box
                sx={{
                  mt: isShare ? 0 : 0.4,
                  display: "grid",
                  gridTemplateColumns: isShare ? "1fr 1fr 1fr" : { xs: "1fr", sm: "1fr 1fr" },
                  gap: 1,
                }}
              >
                {[
                  { k: "DAO", v: isShare ? props.daoIdBase58 : shorten(props.daoIdBase58, 10, 10) },
                  { k: "Wallet", v: isShare ? props.wallet : shorten(props.wallet, 10, 10) },
                  {
                    k: "Public",
                    v: `/card/${shorten(props.daoIdBase58, 8, 8)}/${shorten(props.wallet, 8, 8)}`,
                  },
                ].map((row) => (
                  <Box
                    key={row.k}
                    sx={{
                      borderRadius: 16,
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(148,163,184,0.16)",
                      px: 1.2,
                      py: 1,
                      minWidth: 0,
                    }}
                  >
                    <Typography sx={{ opacity: 0.68, fontSize: 11, mb: 0.3 }}>
                      {row.k}
                    </Typography>
                    <Typography
                      sx={{
                        fontFamily: "monospace",
                        fontSize: isShare ? 13 : 12,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        opacity: 0.92,
                      }}
                    >
                      {row.v}
                    </Typography>
                  </Box>
                ))}
              </Box>
            ) : null}
          </Box>

          {/* Footer */}
          <Box sx={{ display: "flex", justifyContent: "space-between", opacity: 0.78 }}>
            <Typography sx={{ fontSize: 12 }}>
              {shorten(props.daoIdBase58, 8, 8)} • {shorten(props.wallet, 8, 8)}
            </Typography>
            <Typography sx={{ fontSize: 12, fontFamily: "monospace" }}>
              Reputation Spaces
            </Typography>
          </Box>
        </Box>
      </Box>
    );
  }
);