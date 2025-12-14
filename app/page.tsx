"use client";

import { useRouter, useSearchParams } from "next/navigation";
import React, { useMemo, useState, useEffect } from "react";
import { clusterApiUrl, PublicKey } from "@solana/web3.js";

import {
  ConnectionProvider,
  WalletProvider,
  useWallet,
  useConnection,
} from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { WalletModalProvider, WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import {
  fetchProjectMetadata, getConfigPda
} from "@grapenpm/vine-reputation-client";
import TokenLeaderboard from "./TokenLeaderboard";
import { VINE_LOGO, FALLBACK_VINE_MINT, VINE_REP_PROGRAM_ID } from "./constants";
import { fetchAllSpaces, VineSpace } from "./vineRegistry";

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
  Tooltip
} from "@mui/material";

import { createTheme } from "@mui/material/styles";

import AddIcon from "@mui/icons-material/Add";
import SettingsSuggestIcon from "@mui/icons-material/SettingsSuggest";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import TollOutlinedIcon from "@mui/icons-material/TollOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";

import { ThemeProvider } from "@mui/material/styles";
import grapeTheme from "./utils/config/theme";

import CreateReputationSpace from "./CreateReputationSpace";
import ReputationManager from "./ReputationManager";
import TokenManager from './TokenManager';
import MetadataManager from './MetadataManager';

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

function safePk(s?: string | null) {
  if (!s) return null;
  try {
    return new PublicKey(s.trim());
  } catch {
    return null;
  }
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

function shorten(s: string, a = 6, b = 6) {
  if (!s) return "";
  if (s.length <= a + b) return s;
  return `${s.slice(0, a)}…${s.slice(-b)}`;
}

function HeaderActions({
  onCreateSpace,
  onManageSpace,
  onOpenTokenManager,
  onOpenMetadataManager,
  manageDisabled,
}: {
  onCreateSpace: () => void;
  onManageSpace: () => void;
  onOpenTokenManager: () => void;
  onOpenMetadataManager: () => void;
  manageDisabled?: boolean;
}) {
  const { connected } = useWallet();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  if (!connected) {
    return (
      <WalletMultiButton
        style={{
          borderRadius: 999,
          background: "rgba(15,23,42,0.9)",
          border: "1px solid rgba(248,250,252,0.4)",
          fontSize: "0.8rem",
        }}
      />
    );
  }

  return (
          <>
            {isMobile ? (
        <IconButton
          onClick={(e) => setAnchorEl(e.currentTarget)}
          sx={{
            ...glassPillSx,
            borderRadius: "50%",
            width: 40,
            height: 40,
            padding: 0,
          }}
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
            onCreateSpace();
          }}
        >
          <ListItemIcon sx={{ color: "inherit", minWidth: 36 }}>
            <AddIcon fontSize="small" />
          </ListItemIcon>
          Create reputation space
        </MenuItem>

        <MenuItem
          disabled={!!manageDisabled}
          onClick={() => {
            setAnchorEl(null);
            onManageSpace();
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
            onOpenTokenManager();
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
            onOpenMetadataManager();
          }}
        >
          <ListItemIcon sx={{ color: "inherit", minWidth: 36 }}>
            <ImageOutlinedIcon fontSize="small" />
          </ListItemIcon>
          Metadata manager
        </MenuItem>
      </Menu>
    </>
  );
}

const HomeInner: React.FC = () => {
  const router = useRouter();                 // ✅ NEW
  const searchParams = useSearchParams();     // ✅ NEW

  const [createOpen, setCreateOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [tokenOpen, setTokenOpen] = useState(false);
  const [metadataOpen, setMetadataOpen] = useState(false);

  const { connection } = useConnection();

  // spaces from chain
  const [spaces, setSpaces] = useState<VineSpace[]>([]);
  const [activeDao, setActiveDao] = useState<string>(""); // base58
  const [spacesLoading, setSpacesLoading] = useState(false);

  // space selector UI
  const [spaceAnchor, setSpaceAnchor] = useState<null | HTMLElement>(null);
  const spaceMenuOpen = Boolean(spaceAnchor);

  // ✅ NEW: read dao from URL once (or when URL changes)
  const daoFromUrl = searchParams?.get("dao") || "";
  const daoFromUrlPk = useMemo(() => safePk(daoFromUrl), [daoFromUrl]);

  // ✅ NEW: prevent URL write loops
  const lastUrlDaoRef = React.useRef<string>("");

  const [projectMeta, setProjectMeta] = useState<any | null>(null);

  function pickDefaultSpace(spaces: VineSpace[]): VineSpace | null {
    if (!spaces.length) return null;

    return [...spaces].sort((a, b) => {
      if (a.currentSeason !== b.currentSeason) {
        return a.currentSeason - b.currentSeason;
      }
      return a.daoId.toBase58().localeCompare(b.daoId.toBase58());
    })[0];
  }

  const refreshSpaces = async () => {
    try {
      setSpacesLoading(true);
      const pid = new PublicKey(VINE_REP_PROGRAM_ID);
      const list = await fetchAllSpaces(connection, pid);

      // keep only entries whose config account actually exists and is owned by your program
      const filtered = (
        await Promise.all(
          list.map(async (s) => {
            try {
              const [configPda] = getConfigPda(s.daoId);
              const ai = await connection.getAccountInfo(configPda);
              if (!ai) return null;
              if (!ai.owner.equals(pid)) return null;
              if (!ai.data || ai.data.length < 8) return null;
              return s;
            } catch {
              return null;
            }
          })
        )
      ).filter(Boolean) as VineSpace[];

      setSpaces(filtered);

      // ✅ NEW: choose active space (URL wins, otherwise default)
      if (filtered.length > 0) {
        const urlDao = daoFromUrlPk?.toBase58() || "";
        const urlExists = urlDao && filtered.some((s) => s.daoId.toBase58() === urlDao);

        if (urlExists) {
          setActiveDao(urlDao);
        } else if (!activeDao) {
          // keep your old behavior
          setActiveDao(filtered[0].daoId.toBase58());
        }
      }
    } finally {
      setSpacesLoading(false);
    }
  };

  const resolvedTheme = useMemo(() => {
    const t = projectMeta?.vine?.theme ?? {};

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
  }, [projectMeta]);

  const themedMui = useMemo(() => {
    const base = grapeTheme;

    return createTheme({
      ...base,
      palette: {
        ...base.palette,
        primary: {
          ...base.palette.primary,
          main: resolvedTheme.primary,
        },
        mode:
          resolvedTheme.mode === "auto"
            ? base.palette.mode
            : resolvedTheme.mode,
      },
    });
  }, [resolvedTheme]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!activeDao) {
        setProjectMeta(null);
        return;
      }

      try {
        const daoPk = new PublicKey(activeDao);
        const meta = await fetchProjectMetadata(connection, daoPk);
        if (!cancelled) setProjectMeta(meta);
      } catch {
        if (!cancelled) setProjectMeta(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeDao, connection]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (cancelled) return;
      await refreshSpaces();
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection]);

  const activeSpace = spaces.find((s) => s.daoId.toBase58() === activeDao) || null;

  const activeMint = useMemo(() => {
    const mint = activeSpace?.repMint?.toBase58?.() || "";
    const zero = PublicKey.default.toBase58();
    if (!mint || mint === zero) return FALLBACK_VINE_MINT;
    return mint;
  }, [activeSpace]);

  // ✅ NEW: whenever activeDao changes, update URL (?dao=...)
  useEffect(() => {
    if (!activeDao) return;

    // avoid repeatedly writing the same URL
    if (lastUrlDaoRef.current === activeDao) return;
    lastUrlDaoRef.current = activeDao;

    // preserve other params, only set dao
    const p = new URLSearchParams(searchParams?.toString() || "");
    p.set("dao", activeDao);

    router.replace(`?${p.toString()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDao]);

  const spaceLabel = activeSpace
    ? `Space: ${shorten(activeSpace.daoId.toBase58(), 5, 5)}`
    : spacesLoading
    ? "Spaces: Loading…"
    : "Spaces: None";

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const disabledSpaces = spacesLoading || spaces.length === 0;
  const spaceTitle =
    activeSpace ? `DAO: ${activeSpace.daoId.toBase58()}` : "No spaces found";

  const manageDisabled = !activeDao || !activeSpace;

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
            borderBottom: "1px solid rgba(255,255,255,0.12)",
            zIndex: 2,
            position: "relative",
          }}
        >
          <Toolbar sx={{ gap: 1 }}>
            <Typography
              component="h1"
              variant="h6"
              color="inherit"
              display="flex"
              className="vine-logo"
              sx={{ ml: 1, mr: 1 }}
            >
              <Avatar>
                <img src={VINE_LOGO} width="50px" className="header-logo" alt="Powered by Grape" />
              </Avatar>
            </Typography>

            <Typography
              variant="h6"
              color="inherit"
              className="vine-wrapper"
              sx={{
                ml: 1,
                mr: 1,
                flexGrow: 1,
                textShadow: "1px 1px 2px black",
              }}
            >
              <div className="vine-title">
                <div data-text="Vine">Vine Dashboard</div>
              </div>
            </Typography>

            {/* Space selector pill */}
            {isMobile ? (
              <Tooltip title={spaceTitle}>
                <span>
                  <IconButton
                    onClick={(e) => setSpaceAnchor(e.currentTarget)}
                    disabled={disabledSpaces}
                    sx={{
                      ...glassPillSx,
                      borderRadius: "50%",
                      width: 40,
                      height: 40,
                      padding: 0,
                    }}
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
                  minWidth: 340,
                },
              }}
            >
              {spaces.length === 0 ? (
                <MenuItem disabled>{spacesLoading ? "Loading…" : "No spaces found on-chain"}</MenuItem>
              ) : (
                spaces.map((s) => {
                  const dao = s.daoId.toBase58();
                  const mint = s.repMint.toBase58();
                  return (
                    <MenuItem
                      key={dao}
                      selected={dao === activeDao}
                      onClick={() => {
                        setActiveDao(dao);      // ✅ this now also updates the URL via the effect
                        setSpaceAnchor(null);
                      }}
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        gap: 0.3,
                        py: 1,
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <SwapHorizIcon fontSize="small" sx={{ opacity: 0.8 }} />
                        <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                          {shorten(dao, 8, 8)}
                        </Typography>
                      </Box>

                      <Typography variant="caption" sx={{ opacity: 0.75 }}>
                        Season {s.currentSeason} • Mint {shorten(mint, 6, 6)}
                      </Typography>
                    </MenuItem>
                  );
                })
              )}
            </Menu>

            {/* Actions pill */}
            <HeaderActions
              onCreateSpace={() => setCreateOpen(true)}
              onManageSpace={() => setManageOpen(true)}
              onOpenTokenManager={() => setTokenOpen(true)}
              onOpenMetadataManager={() => setMetadataOpen(true)}
              manageDisabled={manageDisabled}
            />
          </Toolbar>
        </AppBar>

        {/* Token Manager Dialog */}
        <TokenManager open={tokenOpen} onClose={() => setTokenOpen(false)} />

        {/* Metadata Manager Dialog */}
        <MetadataManager open={metadataOpen} onClose={() => setMetadataOpen(false)} />

        {/* Create Space Dialog */}
        <CreateReputationSpace
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          defaultDaoIdBase58={activeSpace?.daoId?.toBase58?.() || ""}
          defaultRepMintBase58={activeMint || FALLBACK_VINE_MINT}
          defaultInitialSeason={(activeSpace?.currentSeason ?? 1) + 1}
        />

        {/* Manage Space Dialog */}
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
            <TokenLeaderboard
              key={`${activeMint}-${activeDao}`}
              programId={activeMint}
              activeDaoIdBase58={activeDao}
            />
          </Paper>
        </Container>

        <Copyright />
      </ThemeProvider>
    </Box>
  );
};

const Home: React.FC = () => {
  const endpoint = useMemo(() => clusterApiUrl("devnet"), []);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter({ network: WalletAdapterNetwork.Devnet }),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <HomeInner />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default Home;