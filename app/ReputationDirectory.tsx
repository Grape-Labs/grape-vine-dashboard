"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PublicKey } from "@solana/web3.js";
import { useConnection } from "@solana/wallet-adapter-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

import {
  fetchAllSpaces,
  fetchProjectMetadata,
  type VineSpace,
} from "@grapenpm/vine-reputation-client";

import {
  Box,
  Container,
  Typography,
  Button,
  Avatar,
  Paper,
  CircularProgress,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import Chip from "@mui/material/Chip";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";

import { OG_LOGO, VINE_LOGO, VINE_REP_PROGRAM_ID } from "./constants";
import CreateReputationSpace from "./CreateReputationSpace";

import { keyframes } from "@mui/system";

const float = keyframes`
  0% { transform: translateY(0px) translateX(0px); opacity: 0.65; }
  50% { transform: translateY(-10px) translateX(6px); opacity: 1; }
  100% { transform: translateY(0px) translateX(0px); opacity: 0.65; }
`;

const shimmer = keyframes`
  0% { transform: translateX(-60%); opacity: 0; }
  15% { opacity: 1; }
  100% { transform: translateX(60%); opacity: 0; }
`;

type VineTheme = {
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

type SpaceUiMeta = {
  dao: string;
  uri?: string | null;
  offchain?: OffchainTokenMeta | null;
};

function PoweredByGrape() {
  return (
    <Box
      sx={{
        mt: 6,
        pb: 3,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 1,
          borderRadius: "999px",
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.12)",
          backdropFilter: "blur(10px)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        <Avatar
          src={OG_LOGO}
          sx={{
            width: 18,
            height: 18,
            bgcolor: "rgba(0,0,0,0.25)",
            border: "1px solid rgba(255,255,255,0.18)",
          }}
          imgProps={{ referrerPolicy: "no-referrer" }}
        />
        <Typography
          variant="caption"
          sx={{
            color: "rgba(248,250,252,0.8)",
            letterSpacing: 0.2,
          }}
        >
          OG Reputation Spaces by{" "}
          <Box component="span" sx={{ fontWeight: 800, color: "rgba(248,250,252,0.92)" }}>
            Grape
          </Box>
        </Typography>
      </Box>
    </Box>
  );
}

function extractMetadataUri(projectMeta: any): string | null {
  return (
    projectMeta?.metadataUri ??
    projectMeta?.metadata_uri ??
    projectMeta?.vine?.metadataUri ??
    projectMeta?.vine?.metadata_uri ??
    projectMeta?.token?.metadataUri ??
    projectMeta?.token?.metadata_uri ??
    projectMeta?.token?.uri ??
    null
  );
}

async function fetchOffchainJson(uri: string, signal?: AbortSignal) {
  try {
    const r = await fetch(uri, { cache: "no-store", signal });
    if (!r.ok) return null;
    return (await r.json()) as OffchainTokenMeta;
  } catch {
    return null;
  }
}

function shorten(s: string, a = 6, b = 6) {
  if (!s) return "";
  if (s.length <= a + b) return s;
  return `${s.slice(0, a)}…${s.slice(-b)}`;
}

export default function ReputationDirectory() {
  const router = useRouter();
  const { connection } = useConnection();

  const [createOpen, setCreateOpen] = useState(false);

  const [spaces, setSpaces] = useState<VineSpace[]>([]);
  const [spacesLoading, setSpacesLoading] = useState(false);
  const [spaceUiMeta, setSpaceUiMeta] = useState<Record<string, SpaceUiMeta>>({});

  const hydrateAbortRef = useRef<AbortController | null>(null);

  const { connected } = useWallet();
  const { setVisible } = useWalletModal();

  const refreshSpaces = useCallback(async () => {
    setSpacesLoading(true);

    hydrateAbortRef.current?.abort();
    const ac = new AbortController();
    hydrateAbortRef.current = ac;

    try {
      const pid = new PublicKey(VINE_REP_PROGRAM_ID);
      const list = await fetchAllSpaces(connection, pid);
      if (ac.signal.aborted) return;

      setSpaces(list);

      const results = await Promise.allSettled(
        list.map(async (s) => {
          const dao = s.daoId.toBase58();
          const pm = await fetchProjectMetadata(connection, s.daoId);
          const uri = extractMetadataUri(pm);
          const offchain = uri ? await fetchOffchainJson(uri, ac.signal) : null;
          return { dao, uri, offchain } as SpaceUiMeta;
        })
      );

      if (!ac.signal.aborted) {
        setSpaceUiMeta((prev) => {
          const next = { ...prev };
          for (const r of results) if (r.status === "fulfilled") next[r.value.dao] = r.value;
          return next;
        });
      }
    } finally {
      if (!ac.signal.aborted) setSpacesLoading(false);
    }
  }, [connection]);

  useEffect(() => {
    refreshSpaces();
    return () => hydrateAbortRef.current?.abort();
  }, [refreshSpaces]);

  return (
    <Box
  sx={{
    minHeight: "100vh",
    color: "rgba(248,250,252,0.92)",
    position: "relative",
    overflow: "hidden",

    // richer base background
background:
  "radial-gradient(1200px 700px at 12% 12%, rgba(56,189,248,0.16), transparent 62%)," +
  "radial-gradient(900px 600px at 88% 18%, rgba(34,211,238,0.10), transparent 60%)," +
  "radial-gradient(900px 650px at 50% 95%, rgba(250,204,21,0.05), transparent 60%)," +
  "linear-gradient(180deg, rgba(2,6,23,1), rgba(2,6,23,0.94))",
  }}
>
  {/* soft “aurora” blobs */}
      <Box
        sx={{
          position: "absolute",
          width: 560,
          height: 560,
          left: { xs: "-220px", md: "-180px" },
          top: { xs: "-240px", md: "-200px" },
          borderRadius: "50%",
          background:
            "radial-gradient(circle at 30% 25%, rgba(124,58,237,0.35), transparent 55%)," +
            "radial-gradient(circle at 70% 70%, rgba(56,189,248,0.22), transparent 58%)",
          filter: "blur(30px)",
          animation: `${float} 7.5s ease-in-out infinite`,
          opacity: 0.9,
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <Box
        sx={{
          position: "absolute",
          width: 520,
          height: 520,
          right: { xs: "-220px", md: "-180px" },
          top: { xs: "60px", md: "40px" },
          borderRadius: "50%",
          background:
            "radial-gradient(circle at 30% 25%, rgba(34,211,238,0.20), transparent 60%)," +
            "radial-gradient(circle at 70% 70%, rgba(99,102,241,0.22), transparent 60%)",
          filter: "blur(32px)",
          animation: `${float} 8.5s ease-in-out infinite`,
          opacity: 0.85,
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* subtle grain */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.035) 1px, transparent 1px)",
          backgroundSize: "18px 18px",
          opacity: 0.18,
          pointerEvents: "none",
          zIndex: 0,
          mixBlendMode: "overlay",
        }}
      />

      {/* content layer */}
      <Box sx={{ position: "relative", zIndex: 1 }}>
          <Container maxWidth="lg" sx={{ py: 5 }}>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                gap: 2,
                alignItems: { xs: "flex-start", sm: "center" },
                flexDirection: { xs: "column", sm: "row" },
                pb: 1.5,
              }}
            >
<Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
<Box
  sx={{
  }}
>
  <Box
    component="img"
    src={OG_LOGO}
    alt="OG"
    sx={{
      width: 132,        // drive size by WIDTH (important)
      height: "auto",
      display: "block",
      filter:
        "drop-shadow(0 12px 26px rgba(0,0,0,0.55)) drop-shadow(0 0 16px rgba(56,189,248,0.22))",
    }}
  />
</Box>

  <Box>
    <Typography
      variant="h4"
      sx={{
        fontWeight: 950,
        lineHeight: 1.02,
        letterSpacing: -0.6,
        textShadow: "0 10px 30px rgba(0,0,0,0.45)",
      }}
    >
      <Box component="span" sx={{ color: "rgba(248,250,252,0.96)" }}>
        Reputation
      </Box>{" "}
      <Box component="span" sx={{ color: "rgba(56,189,248,0.92)" }}>
        Spaces
      </Box>
    </Typography>
    <Typography variant="body2" sx={{ opacity: 0.85, mt: 0.75, maxWidth: 560 }}>
      Browse existing spaces or create a new one.
    </Typography>
  </Box>
</Box>

<Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
  {/* Docs */}
  <Button
    component="a"
    href="https://grape-governance.gitbook.io/gspl/vine"
    target="_blank"
    rel="noopener noreferrer"
    startIcon={<DescriptionOutlinedIcon />}
    sx={{
      textTransform: "none",
      color: "rgba(248,250,252,0.75)",
      fontWeight: 600,
      px: 1.5,
      borderRadius: "999px",
      "&:hover": {
        color: "rgba(248,250,252,0.95)",
        background: "rgba(255,255,255,0.06)",
      },
    }}
  >
    Docs
  </Button>

  {/* Discord */}
  <Button
    component="a"
    href="https://discord.gg/grapedao"
    target="_blank"
    rel="noopener noreferrer"
    startIcon={<ForumOutlinedIcon />}
    sx={{
      textTransform: "none",
      color: "rgba(248,250,252,0.75)",
      fontWeight: 600,
      px: 1.5,
      borderRadius: "999px",
      "&:hover": {
        color: "rgba(248,250,252,0.95)",
        background: "rgba(255,255,255,0.06)",
      },
    }}
  >
    Discord
  </Button>

  {/* Primary CTA */}
  <Button
    onClick={() => {
      if (!connected) {
        setVisible(true);
        return;
      }
      setCreateOpen(true);
    }}
    variant="contained"
    startIcon={<AddIcon />}
    sx={{
      ml: 0.5,
      borderRadius: "999px",
      textTransform: "none",
      px: 2.2,
      py: 1.05,
      background: "rgba(255,255,255,0.14)",
      border: "1px solid rgba(255,255,255,0.24)",
      backdropFilter: "blur(10px)",
      boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
      "&:hover": {
        background: "rgba(255,255,255,0.20)",
        boxShadow: "0 14px 40px rgba(0,0,0,0.30)",
      },
    }}
  >
    {connected ? "Create space" : "Connect"}
  </Button>
</Box>
            </Box>

            <Paper
              elevation={0}
              sx={{
                mt: 3,
                p: { xs: 1.5, md: 2 },
                borderRadius: "26px",
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))",
                border: "1px solid rgba(255,255,255,0.12)",
                overflow: "hidden",
                position: "relative",
                boxShadow: "0 30px 80px rgba(0,0,0,0.45)",

                "&::before": {
                  content: '""',
                  position: "absolute",
                  inset: 0,
                  background:
                    "radial-gradient(600px 260px at 20% 0%, rgba(124,58,237,0.18), transparent 60%)," +
                    "radial-gradient(520px 240px at 90% 25%, rgba(56,189,248,0.14), transparent 60%)",
                  opacity: 0.9,
                  pointerEvents: "none",
                },

                "&::after": {
                  content: '""',
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)",
                  width: "60%",
                  margin: "0 auto",
                  animation: `${shimmer} 2.1s ease-in-out infinite`,
                  opacity: 0.25,
                  pointerEvents: "none",
                },

                "& > *": { position: "relative", zIndex: 1 },
              }}
            >
              {spacesLoading ? (
                <Box sx={{ display: "flex", gap: 1, alignItems: "center", p: 1 }}>
                  <CircularProgress size={18} />
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>
                    Loading spaces…
                  </Typography>
                </Box>
              ) : spaces.length === 0 ? (
                <Box sx={{ p: 1 }}>
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>
                    No spaces found on-chain yet. Create the first one.
                  </Typography>
                </Box>
              ) : (
                <Box
                  sx={{
                    display: "grid",
                    gap: 2,
                    gridTemplateColumns: {
                      xs: "1fr",
                      sm: "repeat(2, minmax(0, 1fr))",
                      md: "repeat(3, minmax(0, 1fr))",
                    },
                  }}
                >
                  {spaces.map((s) => {
                    const dao = s.daoId.toBase58();
                    const off = spaceUiMeta[dao]?.offchain;

                    const t = off?.vine?.theme ?? {};
                    const primary = t.primary || "#7c3aed";
                    const bg = t.background_image || "";
                    const bgOpacity = typeof t.background_opacity === "number" ? t.background_opacity : 0.55;
                    const bgBlur = typeof t.background_blur === "number" ? t.background_blur : 10;

                    const name = off?.name ?? `Space ${shorten(dao, 6, 6)}`;
                    const sym = off?.symbol ?? "";
                    const desc =
                      off?.description ?? `SPACE ${shorten(dao, 6, 6)} • Season ${s.currentSeason}`;
                    const img = off?.image ?? VINE_LOGO;

                    return (
                      <Box
                        key={dao}
                        onClick={() => router.push(`/dao/${dao}`)}
                        sx={{
                          cursor: "pointer",
                          position: "relative",
                          borderRadius: "22px",
                          overflow: "hidden",
                          border: "1px solid rgba(255,255,255,0.12)",
                          background: "rgba(2,6,23,0.55)",
                          minHeight: 210,
                          "&:hover": {
                            borderColor: "rgba(255,255,255,0.18)",
                            transform: "translateY(-1px)",
                          },
                          transition: "transform 140ms ease, border-color 140ms ease",
                        }}
                      >
                        {/* background image layer */}
                        {bg ? (
                          <Box
                            sx={{
                              position: "absolute",
                              inset: 0,
                              backgroundImage: `url("${bg}")`,
                              backgroundSize: t.background_size || "cover",
                              backgroundPosition: t.background_position || "center",
                              backgroundRepeat: t.background_repeat || "no-repeat",
                              filter: `blur(${bgBlur}px) saturate(1.05)`,
                              transform: "scale(1.08)",
                              opacity: 0.95,
                            }}
                          />
                        ) : null}

                        {/* overlay */}
                        <Box
                          sx={{
                            position: "absolute",
                            inset: 0,
                            background: `linear-gradient(
                              180deg,
                              rgba(2,6,23,${Math.min(0.96, bgOpacity + 0.20)}) 0%,
                              rgba(2,6,23,${Math.min(0.99, bgOpacity + 0.55)}) 100%
                            )`,
                          }}
                        />

                        {/* content */}
                        <Box sx={{ position: "relative", zIndex: 1, p: 2 }}>
                          <Box sx={{ display: "flex", gap: 1.25, alignItems: "center" }}>
                            <Avatar
                              src={img}
                              variant="rounded"
                              sx={{
                                width: 48,
                                height: 48,
                                borderRadius: "16px",
                                bgcolor: "rgba(0,0,0,0.25)",
                                border: `1px solid ${primary}55`,
                              }}
                              imgProps={{ referrerPolicy: "no-referrer" }}
                            />

                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Typography
                                sx={{
                                  fontWeight: 900,
                                  lineHeight: 1.05,
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  textShadow: "0 1px 2px rgba(0,0,0,0.65)",
                                  color: "rgba(248,250,252,0.96)",
                                }}
                                >

                                {name}
                              </Typography>

                              <Typography
                                variant="body2"
                                sx={{
                                  mt: 1.25,
                                  opacity: 0.9,
                                  color: "rgba(248,250,252,0.88)",
                                  textShadow: "0 1px 2px rgba(0,0,0,0.65)",
                                  display: "-webkit-box",
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: "vertical",
                                  overflow: "hidden",
                                }}
                              >
                                {sym ? (
                                  <>&nbsp;
                                    <Box
                                      component="span"
                                      sx={{
                                        width: 6,
                                        height: 6,
                                        borderRadius: "50%",
                                        background: primary,
                                        boxShadow: `0 0 0 3px ${primary}22`,
                                        display: "inline-block",
                                      }}
                                    />
                                    <Box component="span" sx={{ fontFamily: "monospace", opacity: 0.9 }}>
                                      &nbsp;{sym}
                                    </Box>
                                  </>
                                ) : (
                                  <Box component="span" sx={{ opacity: 0.75 }}>
                                    &nbsp;{shorten(dao, 6, 6)}
                                  </Box>
                                )}
                              </Typography>
                            </Box>

                            <ArrowForwardIosIcon sx={{ opacity: 0.55, fontSize: 16, color: "#ffffff" }} />
                          </Box>

                          <Typography
                            variant="body2"
                            sx={{
                              mt: 1.25,
                              opacity: 0.9,
                              color: "rgba(248,250,252,0.88)",
                              textShadow: "0 1px 2px rgba(0,0,0,0.65)",
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            {desc}
                          </Typography>

                          <Box sx={{ mt: 1.5, display: "flex", gap: 1, flexWrap: "wrap" }}>
                            <Chip
                              label={`DAO ${shorten(dao, 5, 5)}`}
                              size="small"
                              sx={{
                                borderRadius: "999px",
                                background: "rgba(255,255,255,0.10)",
                                border: "1px solid rgba(255,255,255,0.14)",
                                color: "rgba(248,250,252,0.92)",
                              }}
                            />
                            <Chip
                              label={`Season ${s.currentSeason}`}
                              size="small"
                              sx={{
                                borderRadius: "999px",
                                background: `${primary}22`,
                                border: `1px solid ${primary}55`,
                                color: "rgba(248,250,252,0.92)",
                              }}
                            />
                          </Box>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              )}
            </Paper>
            <PoweredByGrape />
          </Container>

          <CreateReputationSpace
            open={createOpen}
            onClose={async () => {
              setCreateOpen(false);
              await refreshSpaces();
            }}
            onCreated={(dao) => router.push(`/dao/${dao}`)}   // ✅ needs the small prop change
          />
        </Box>
      </Box>
  );
}