"use client";

import { useParams, useRouter } from "next/navigation";
import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { PublicKey } from "@solana/web3.js";

import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

import { InstallAppButton } from "@/app/components/InstallApp";
import LeaderboardSwitch from "./LeaderboardSwitch";
import { VINE_LOGO, FALLBACK_VINE_MINT, VINE_REP_PROGRAM_ID } from "../constants";

import {
  fetchAllSpaces,
  fetchProjectMetadata,
  type VineSpace,
} from "@grapenpm/vine-reputation-client";

import {
  CssBaseline,
  AppBar,
  Container,
  Toolbar,
  Typography,
  Avatar,
  Paper,
  Box,
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  useTheme,
  useMediaQuery,
  IconButton,
  Tooltip,
} from "@mui/material";
import { keyframes } from "@mui/system";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import grapeTheme from "../utils/config/theme";

import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import AddIcon from "@mui/icons-material/Add";
import SettingsSuggestIcon from "@mui/icons-material/SettingsSuggest";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import TollOutlinedIcon from "@mui/icons-material/TollOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import LogoutIcon from "@mui/icons-material/Logout";

import CreateReputationSpace from "../CreateReputationSpace";
import ReputationManager from "../ReputationManager";
import TokenManager from "../TokenManager";
import MetadataManager from "../MetadataManager";

/* ---------------- animations ---------------- */

const float = keyframes`
  0% { transform: translateY(0px); opacity: 0.85; }
  50% { transform: translateY(-6px); opacity: 1; }
  100% { transform: translateY(0px); opacity: 0.85; }
`;

const shimmer = keyframes`
  0% { transform: translateX(-60%); opacity: 0; }
  20% { opacity: 1; }
  100% { transform: translateX(60%); opacity: 0; }
`;

/* ---------------- types ---------------- */

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

type SpaceUiMeta = {
  dao: string;
  uri?: string | null;
  offchain?: OffchainTokenMeta | null;
};

/* ---------------- helpers ---------------- */

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

async function fetchOffchainJson(
  uri: string,
  signal?: AbortSignal
): Promise<OffchainTokenMeta | null> {
  try {
    const r = await fetch(uri, { cache: "no-store", signal });
    if (!r.ok) return null;
    return (await r.json()) as OffchainTokenMeta;
  } catch {
    return null;
  }
}

function safePk(s?: string | null) {
  if (!s) return null;
  try {
    return new PublicKey(s.trim());
  } catch {
    return null;
  }
}

function shorten(s: string, a = 6, b = 6) {
  if (!s) return "";
  if (s.length <= a + b) return s;
  return `${s.slice(0, a)}…${s.slice(-b)}`;
}

function Copyright() {
  return (
    <Typography
      variant="caption"
      sx={{
        display: "block",
        textAlign: "center",
        color: "rgba(255,255,255,0.7)",
        mt: 3,
        mb: 1,
      }}
    >
      Powered by Grape
    </Typography>
  );
}

const glassPillSx = {
  borderRadius: "999px",
  background: "rgba(15,23,42,0.9)",
  border: "1px solid rgba(248,250,252,0.4)",
  textTransform: "none",
  fontSize: "0.85rem",
  px: 1.6,
  py: 0.8,
  "&:hover": {
    background: "rgba(15,23,42,0.95)",
    borderColor: "rgba(248,250,252,0.55)",
  },
};

function HeaderActions(props: {
  onCreateSpace: () => void;
  onManageSpace: () => void;
  onOpenTokenManager: () => void;
  onOpenMetadataManager: () => void;
  manageDisabled?: boolean;
}) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { connected, disconnect } = useWallet();
  const { setVisible } = useWalletModal();

  if (!connected) {
    return (
      <Tooltip title="Connect wallet">
        <IconButton
          onClick={() => setVisible(true)}
          sx={{
            ...glassPillSx,
            borderRadius: "50%",
            width: 40,
            height: 40,
            p: 0,
            display: "grid",
            placeItems: "center",
          }}
        >
          <AccountBalanceWalletIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    );
  }

  return (
    <>
      {isMobile ? (
        <IconButton
          onClick={(e) => setAnchorEl(e.currentTarget)}
          sx={{ ...glassPillSx, borderRadius: "50%", width: 40, height: 40, p: 0 }}
        >
          <MoreVertIcon />
        </IconButton>
      ) : (
        <Button
          onClick={(e) => setAnchorEl(e.currentTarget)}
          endIcon={<KeyboardArrowDownIcon />}
          sx={glassPillSx}
        >
          Actions
        </Button>
      )}

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        PaperProps={{
          sx: {
            borderRadius: "16px",
            background: "rgba(15,23,42,0.92)",
            border: "1px solid rgba(148,163,184,0.35)",
            backdropFilter: "blur(14px)",
            color: "rgba(248,250,252,0.95)",
            mt: 1,
            minWidth: 280,
          },
        }}
      >
        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            props.onCreateSpace();
          }}
        >
          <ListItemIcon sx={{ color: "inherit", minWidth: 36 }}>
            <AddIcon fontSize="small" />
          </ListItemIcon>
          Create reputation space
        </MenuItem>

        <MenuItem
          disabled={!!props.manageDisabled}
          onClick={() => {
            setAnchorEl(null);
            props.onManageSpace();
          }}
        >
          <ListItemIcon sx={{ color: "inherit", minWidth: 36 }}>
            <SettingsSuggestIcon fontSize="small" />
          </ListItemIcon>
          Manage reputation space
        </MenuItem>

        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            props.onOpenTokenManager();
          }}
        >
          <ListItemIcon sx={{ color: "inherit", minWidth: 36 }}>
            <TollOutlinedIcon fontSize="small" />
          </ListItemIcon>
          Token manager
        </MenuItem>

        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            props.onOpenMetadataManager();
          }}
        >
          <ListItemIcon sx={{ color: "inherit", minWidth: 36 }}>
            <ImageOutlinedIcon fontSize="small" />
          </ListItemIcon>
          Metadata manager
        </MenuItem>
        {connected && (
            <MenuItem
                onClick={async () => {
                setAnchorEl(null);
                try {
                    await disconnect();
                } catch {}
                }}
            >
                <ListItemIcon sx={{ color: "inherit", minWidth: 36 }}>
                <LogoutIcon fontSize="small" />
                </ListItemIcon>
                Disconnect wallet
            </MenuItem>
        )}
      </Menu>
    </>
  );
}

/* ---------------- component ---------------- */

const HomeInner: React.FC = () => {
  const router = useRouter();
  const { connection } = useConnection();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));

  const params = useParams<{ dao?: string }>();
  const daoFromUrl = (params?.dao as string) || "";
  const daoFromUrlPk = useMemo(() => safePk(daoFromUrl), [daoFromUrl]);

  const [createOpen, setCreateOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [tokenOpen, setTokenOpen] = useState(false);
  const [metadataOpen, setMetadataOpen] = useState(false);

  const [spaces, setSpaces] = useState<VineSpace[]>([]);
  const [spacesLoading, setSpacesLoading] = useState(false);
  const [activeDao, setActiveDao] = useState<string>("");

  const [spaceUiMeta, setSpaceUiMeta] = useState<Record<string, SpaceUiMeta>>({});

  // space selector menu anchor (THIS WAS MISSING)
  const [spaceAnchor, setSpaceAnchor] = useState<null | HTMLElement>(null);
  const spaceMenuOpen = Boolean(spaceAnchor);

  // keep latest activeDao to avoid stale closure
  const activeDaoRef = useRef("");
  useEffect(() => {
    activeDaoRef.current = activeDao;
  }, [activeDao]);

  const hydrateAbortRef = useRef<AbortController | null>(null);

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

      // hydrate offchain ui metadata
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
          for (const r of results) {
            if (r.status === "fulfilled") next[r.value.dao] = r.value;
          }
          return next;
        });
      }

      // choose active dao
      const urlDao = daoFromUrlPk?.toBase58() || "";
      const urlExists = !!urlDao && list.some((s) => s.daoId.toBase58() === urlDao);

      let nextDao = "";
      if (list.length > 0) {
        if (urlExists) nextDao = urlDao;
        else if (
          activeDaoRef.current &&
          list.some((s) => s.daoId.toBase58() === activeDaoRef.current)
        )
          nextDao = activeDaoRef.current;
        else nextDao = list[0].daoId.toBase58();
      }

      if (nextDao && nextDao !== activeDaoRef.current) setActiveDao(nextDao);
    } finally {
      if (!ac.signal.aborted) setSpacesLoading(false);
    }
  }, [connection, daoFromUrlPk]);

  // initial load
  useEffect(() => {
    refreshSpaces();
    return () => hydrateAbortRef.current?.abort();
  }, [refreshSpaces]);

  // keep URL in /dao/[dao] (and ONLY that)
  useEffect(() => {
    if (!activeDao) return;
    if (!spaces.some((s) => s.daoId.toBase58() === activeDao)) return;

    const current = (params?.dao as string) || "";
    if (current === activeDao) return;

    router.replace(`/dao/${activeDao}`, { scroll: false });
  }, [activeDao, spaces, router, params]);

  const activeSpace = useMemo(
    () => spaces.find((s) => s.daoId.toBase58() === activeDao) || null,
    [spaces, activeDao]
  );

  const activeMint = useMemo(() => {
    const mint = activeSpace?.repMint?.toBase58?.() || "";
    const zero = PublicKey.default.toBase58();
    if (!mint || mint === zero) return FALLBACK_VINE_MINT;
    return mint;
  }, [activeSpace]);

  const activeUi = useMemo(() => (activeDao ? spaceUiMeta[activeDao] ?? null : null), [activeDao, spaceUiMeta]);

  // "first boot" loader only (prevents most blinking on later changes)
  const hasBootedRef = useRef(false);
  useEffect(() => {
    if (!hasBootedRef.current && activeDao && activeSpace && activeUi?.offchain) {
      hasBootedRef.current = true;
    }
  }, [activeDao, activeSpace, activeUi]);

  // ✅ App can render with just on-chain space + activeDao
    const uiReady = !!activeDao && !!activeSpace;

    // ✅ Metadata is optional
    const metaReady = !!activeUi?.offchain;

    // First-boot should only care that we can render the app (not metadata)
    useEffect(() => {
    if (!hasBootedRef.current && uiReady) {
        hasBootedRef.current = true;
    }
    }, [uiReady]);

  const showFullLoader = !hasBootedRef.current && (spacesLoading || !uiReady);

  const resolvedTheme = useMemo(() => {
    const t = activeUi?.offchain?.vine?.theme ?? {};
    return {
      mode: t.mode ?? "auto",
      primary: t.primary ?? grapeTheme.palette.primary.main,
      background: {
        image: t.background_image ?? null,
        opacity: typeof t.background_opacity === "number" ? t.background_opacity : 0.45,
        blur: typeof t.background_blur === "number" ? t.background_blur : 12,
        position: t.background_position ?? "center",
        size: t.background_size ?? "cover",
        repeat: t.background_repeat ?? "no-repeat",
      },
    };
  }, [activeUi]);

  const themedMui = useMemo(() => {
    const base = grapeTheme;
    return createTheme({
      ...base,
      palette: {
        ...base.palette,
        primary: { ...base.palette.primary, main: resolvedTheme.primary },
        mode: resolvedTheme.mode === "auto" ? base.palette.mode : resolvedTheme.mode,
      },
    });
  }, [resolvedTheme]);

  const disabledSpaces = spacesLoading || spaces.length === 0;

  const spaceTitle = activeSpace ? `DAO: ${activeSpace.daoId.toBase58()}` : "No spaces found";
  const spaceLabel = activeSpace
    ? activeUi?.offchain?.name
      ? `${activeUi.offchain.name}${activeUi.offchain.symbol ? ` • ${activeUi.offchain.symbol}` : ""}`
      : `Space: ${shorten(activeSpace.daoId.toBase58(), 5, 5)}`
    : spacesLoading
    ? "Spaces: Loading…"
    : "Spaces: None";

  const manageDisabled = !activeDao || !activeSpace;

  const brandLogo = activeUi?.offchain?.image || VINE_LOGO;
  const brandName = activeUi?.offchain?.name || "Reputation Dashboard";
  const brandSymbol = activeUi?.offchain?.symbol || "";
  const brandDesc = activeUi?.offchain?.description || "";

  useEffect(() => {
    if (!brandName) return;
    document.title = brandSymbol ? `${brandName} (${brandSymbol})` : brandName;
  }, [brandName, brandSymbol]);

  const headerBg = `linear-gradient(90deg, rgba(0,0,0,0.20), ${resolvedTheme.primary}22)`;

  if (showFullLoader) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          width: "100vw",
          display: "grid",
          placeItems: "center",
          position: "relative",
          overflow: "hidden",
          background:
            "radial-gradient(1200px 600px at 20% 0%, rgba(124,58,237,0.18), transparent 60%), rgba(2,6,23,1)",
          color: "rgba(248,250,252,0.92)",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            width: 520,
            height: 520,
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 30% 25%, rgba(56,189,248,0.18), transparent 55%), radial-gradient(circle at 70% 65%, rgba(124,58,237,0.22), transparent 60%)",
            filter: "blur(28px)",
            animation: `${float} 2.8s ease-in-out infinite`,
            opacity: 0.9,
          }}
        />

        <Box sx={{ textAlign: "center", position: "relative", zIndex: 1, px: 3 }}>
          <Typography sx={{ fontWeight: 800, letterSpacing: 0.2 }}>Loading space…</Typography>
          <Typography variant="caption" sx={{ opacity: 0.75 }}>
            Fetching on-chain config + metadata
          </Typography>

          <Box
            sx={{
              mt: 2,
              mx: "auto",
              width: 220,
              height: 6,
              borderRadius: 999,
              background: "rgba(255,255,255,0.10)",
              border: "1px solid rgba(255,255,255,0.14)",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                width: "60%",
                margin: "0 auto",
                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)",
                animation: `${shimmer} 1.25s ease-in-out infinite`,
              }}
            />
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        width: "100vw",
        position: "relative",
        backgroundImage: resolvedTheme.background.image
          ? `url('${resolvedTheme.background.image}')`
          : `url('/images/background_sample_image.webp')`,
        backgroundSize: resolvedTheme.background.size,
        backgroundPosition: resolvedTheme.background.position,
        backgroundRepeat: resolvedTheme.background.repeat,
        backgroundAttachment: { xs: "scroll", md: "fixed" },
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          background: `rgba(0,0,0,${resolvedTheme.background.opacity})`,
          backdropFilter: `blur(${resolvedTheme.background.blur}px)`,
          zIndex: 1,
        }}
      />

      <ThemeProvider theme={themedMui}>
        <CssBaseline />

        <AppBar
          elevation={0}
          position="static"
          sx={{
            borderBottom: `1px solid ${resolvedTheme.primary}33`,
            zIndex: 2,
            position: "relative",
            background: headerBg,
            backdropFilter: "blur(10px)",
          }}
        >
          <Toolbar sx={{ gap: 1 }}>
            {/* Brand */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexGrow: 1, minWidth: 0 }}>
              <Avatar
                src={brandLogo}
                variant="rounded"
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: "12px",
                  border: `1px solid ${resolvedTheme.primary}55`,
                  bgcolor: "rgba(0,0,0,0.25)",
                }}
                imgProps={{ referrerPolicy: "no-referrer" }}
              />

              <Box sx={{ minWidth: 0 }}>
                <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, minWidth: 0 }}>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 800,
                      letterSpacing: 0.2,
                      textShadow: "0 1px 2px rgba(0,0,0,0.45)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      lineHeight: 1.05,
                    }}
                  >
                    {brandName}
                  </Typography>

                  {!!brandSymbol && (
                    <Typography
                      variant="body2"
                      sx={{
                        opacity: 0.85,
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: 0.8,
                        whiteSpace: "nowrap",
                      }}
                    >
                      <Box
                        component="span"
                        sx={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: resolvedTheme.primary,
                          boxShadow: `0 0 0 3px ${resolvedTheme.primary}22`,
                          display: "inline-block",
                        }}
                      />
                      <Box component="span" sx={{ fontFamily: "monospace", opacity: 0.9 }}>
                        {brandSymbol}
                      </Box>
                    </Typography>
                  )}
                </Box>

                {!isMobile && !!brandDesc && (
                  <Typography
                    variant="body2"
                    sx={{
                      mt: 0.35,
                      opacity: 0.8,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: 680,
                    }}
                  >
                    {brandDesc}
                  </Typography>
                )}
              </Box>
            </Box>

            {/* Space selector button */}
            {isMobile ? (
              <Tooltip title={spaceTitle}>
                <span>
                  <IconButton
                    onClick={(e) => setSpaceAnchor(e.currentTarget)}
                    disabled={disabledSpaces}
                    sx={{ ...glassPillSx, borderRadius: "50%", width: 40, height: 40, p: 0 }}
                  >
                    <LayersOutlinedIcon />
                  </IconButton>
                </span>
              </Tooltip>
            ) : (
              <Button
                onClick={(e) => setSpaceAnchor(e.currentTarget)}
                endIcon={<KeyboardArrowDownIcon />}
                sx={glassPillSx}
                disabled={disabledSpaces}
                title={spaceTitle}
              >
                {spaceLabel}
              </Button>
            )}

            <InstallAppButton />

            {/* Space selector menu (this must exist + be wired to spaceAnchor) */}
            <Menu
              anchorEl={spaceAnchor}
              open={spaceMenuOpen}
              onClose={() => setSpaceAnchor(null)}
              PaperProps={{
                sx: {
                  borderRadius: "16px",
                  background: "rgba(15,23,42,0.92)",
                  border: "1px solid rgba(148,163,184,0.35)",
                  backdropFilter: "blur(14px)",
                  color: "rgba(248,250,252,0.95)",
                  mt: 1,
                  minWidth: 360,
                  overflow: "hidden",
                },
              }}
            >
              {spaces.length === 0 ? (
                <MenuItem disabled>{spacesLoading ? "Loading…" : "No spaces found on-chain"}</MenuItem>
              ) : (
                spaces.map((s) => {
                  const dao = s.daoId.toBase58();
                  const ui = spaceUiMeta[dao];
                  const name = ui?.offchain?.name ?? shorten(dao, 8, 8);
                  const sym = ui?.offchain?.symbol ? ` • ${ui.offchain.symbol}` : "";
                  const img = ui?.offchain?.image ?? null;

                  const bg = ui?.offchain?.vine?.theme?.background_image ?? "";
                  const bgOpacity = ui?.offchain?.vine?.theme?.background_opacity ?? 0.55;
                  const bgBlur = ui?.offchain?.vine?.theme?.background_blur ?? 8;

                  return (
                    <MenuItem
                      key={dao}
                      selected={dao === activeDao}
                      onClick={() => {
                        setActiveDao(dao);
                        setSpaceAnchor(null);
                      }}
                      sx={{
                        position: "relative",
                        overflow: "hidden",
                        borderRadius: "16px",
                        mx: 1,
                        my: 0.6,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        gap: 0.3,
                        py: 1.1,
                        px: 1.2,
                        border: "1px solid rgba(255,255,255,0.10)",

                        "&::before, &::after": { borderRadius: "inherit" },

                        ...(bg
                          ? {
                              background: "transparent",
                              "&::before": {
                                content: '""',
                                position: "absolute",
                                inset: 0,
                                backgroundImage: `url("${bg}")`,
                                backgroundSize: "cover",
                                backgroundPosition: "center",
                                backgroundRepeat: "no-repeat",
                                filter: `blur(${bgBlur}px)`,
                                transform: "scale(1.08)",
                                zIndex: 0,
                              },
                              "&::after": {
                                content: '""',
                                position: "absolute",
                                inset: 0,
                                background: `linear-gradient(
                                  180deg,
                                  rgba(2,6,23,${Math.min(0.96, bgOpacity + 0.30)}) 0%,
                                  rgba(2,6,23,${Math.min(0.99, bgOpacity + 0.55)}) 100%
                                )`,
                                zIndex: 0,
                              },
                            }
                          : { background: "rgba(255,255,255,0.04)" }),

                        "& > *": { position: "relative", zIndex: 1 },

                        ...(dao === activeDao
                          ? {
                              border: "1px solid rgba(255,255,255,0.18)",
                              boxShadow: "0 10px 30px rgba(0,0,0,0.30)",
                            }
                          : {}),

                        "&:hover": {
                          backgroundColor: "transparent",
                          border: "1px solid rgba(255,255,255,0.16)",
                        },
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        {img ? (
                          <Avatar
                            src={img}
                            sx={{ width: 28, height: 28, bgcolor: "rgba(0,0,0,0.25)" }}
                            imgProps={{ referrerPolicy: "no-referrer" }}
                          />
                        ) : (
                          <Avatar sx={{ width: 28, height: 28, bgcolor: "rgba(0,0,0,0.25)" }}>
                            {name.slice(0, 1)}
                          </Avatar>
                        )}
                        <Typography variant="body2" sx={{ fontWeight: 650, textShadow: "0 1px 2px rgba(0,0,0,0.55)" }}>
                          {name}
                          {sym}
                        </Typography>
                      </Box>

                      <Typography variant="caption" sx={{ opacity: 0.82, textShadow: "0 1px 2px rgba(0,0,0,0.55)" }}>
                        DAO {shorten(dao, 6, 6)} • Season {s.currentSeason}
                      </Typography>
                    </MenuItem>
                  );
                })
              )}
            </Menu>
            
            <HeaderActions
              onCreateSpace={() => setCreateOpen(true)}
              onManageSpace={() => setManageOpen(true)}
              onOpenTokenManager={() => setTokenOpen(true)}
              onOpenMetadataManager={() => setMetadataOpen(true)}
              manageDisabled={manageDisabled}
            />
          </Toolbar>
        </AppBar>

        <TokenManager open={tokenOpen} onClose={() => setTokenOpen(false)} />
        <MetadataManager open={metadataOpen} onClose={() => setMetadataOpen(false)} />

        <CreateReputationSpace
          open={createOpen}
          onClose={async () => {
            setCreateOpen(false);
            await refreshSpaces();
          }}
          defaultDaoIdBase58={activeDao || ""}
          defaultRepMintBase58={activeMint || FALLBACK_VINE_MINT}
          defaultInitialSeason={(activeSpace?.currentSeason ?? 1) + 1}
        />

        <ReputationManager
          open={manageOpen}
          onClose={() => setManageOpen(false)}
          daoIdBase58={activeDao}
          onChanged={async () => {
            await refreshSpaces();
          }}
        />

        <Container component="main" maxWidth="lg" sx={{ mt: 4, mb: 6, position: "relative", zIndex: 2 }}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2, md: 3 },
              borderRadius: "20px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              backdropFilter: "blur(10px)",
            }}
          >
            {/* Keep the UI mounted; optionally dim while switching */}
            <Box sx={{ opacity: uiReady ? 1 : 0.65, transition: "opacity 180ms ease" }}>
              
                <LeaderboardSwitch
                    programId={activeMint}
                    activeDaoIdBase58={activeDao}
                    //activeSeason={season}
                    endpoint={"https://api.devnet.solana.com"}
                    meta={activeUi?.offchain ?? null}
                    resolvedTheme={resolvedTheme}
                    />
            </Box>
          </Paper>
        </Container>

        <Copyright />
      </ThemeProvider>
    </Box>
  );
};

export default HomeInner;