// Import necessary modules and components from libraries
import React, { FC, useEffect, useState, useRef } from "react";
import { PublicKey, Connection } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { styled, useTheme } from "@mui/material/styles";
import moment from "moment";
import { CopyToClipboard } from "react-copy-to-clipboard";
import html2canvas from "html2canvas";
// @ts-ignore
//import * as confetti from "canvas-confetti";
//import confetti from "canvas-confetti";

import { readRpcSettings, resolveRpcEndpoint } from "./utils/rpcSettings"; // adjust path
import { useRouter, usePathname, useSearchParams } from "next/navigation";

import {
  FormControlLabel, 
  Switch,
  Avatar,
  Paper,
  Grid,
  Box,
  Button,
  IconButton,
  Typography,
  Table,
  TableContainer,
  TableHead,
  TableBody,
  TableFooter,
  TableCell,
  TableRow,
  TablePagination,
  CircularProgress,
  Snackbar,
  Alert,
  Tooltip,
  Zoom,
  Fade,
  useMediaQuery,
  Drawer,
  Divider,
  Stack,
  Collapse,
  TextField,
} from "@mui/material";

import DownloadIcon from "@mui/icons-material/Download";
import LiveTvIcon from '@mui/icons-material/LiveTv';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import DescriptionIcon from '@mui/icons-material/Description';
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ScreenshotMonitorIcon from "@mui/icons-material/ScreenshotMonitor";
import FileCopyIcon from "@mui/icons-material/FileCopy";
import HourglassBottomIcon from "@mui/icons-material/HourglassBottom";
import LoopIcon from "@mui/icons-material/Loop";
import FirstPageIcon from "@mui/icons-material/FirstPage";
import KeyboardArrowLeft from "@mui/icons-material/KeyboardArrowLeft";
import KeyboardArrowRight from "@mui/icons-material/KeyboardArrowRight";
import LastPageIcon from "@mui/icons-material/LastPage";
import {
  weightedRandomChoice,
  formatAmount,
  getFormattedNumberToLocale,
} from "./utils/grapeTools/helpers";

import VineReputation from "./VineReputation";

const StyledTable = styled(Table)(({ theme }) => ({
  "& .MuiTableCell-root": {
    border: "none",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
  },
}));

const DEFAULT_DRAW_COUNT = 4;
const MIN_DRAW_COUNT = 1;
const MAX_DRAW_COUNT = 100;

function useRpcEndpoint() {
  const [endpoint, setEndpoint] = React.useState<string>(() => resolveRpcEndpoint(readRpcSettings()));

  React.useEffect(() => {
    const recompute = () => setEndpoint(resolveRpcEndpoint(readRpcSettings()));
    const onStorage = (e: StorageEvent) => {
      if (e.key === "grape_rpc_settings_v1") recompute();
    };

    window.addEventListener("grape:rpc-settings", recompute as any);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("grape:rpc-settings", recompute as any);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return endpoint;
}

function TablePaginationActions(props: any) {
  const theme = useTheme();
  const { count, page, rowsPerPage, onPageChange } = props;

  const handleFirstPageButtonClick = (event: any) => {
    onPageChange(event, 0);
  };

  const handleBackButtonClick = (event: any) => {
    onPageChange(event, page - 1);
  };

  const handleNextButtonClick = (event: any) => {
    onPageChange(event, page + 1);
  };

  const handleLastPageButtonClick = (event: any) => {
    onPageChange(event, Math.max(0, Math.ceil(count / rowsPerPage) - 1));
  };

  return (
    <Box sx={{ flexShrink: 0, ml: 2.5 }}>
      <IconButton
        onClick={handleFirstPageButtonClick}
        disabled={page === 0}
        aria-label="first page"
      >
        {theme.direction === "rtl" ? <LastPageIcon /> : <FirstPageIcon />}
      </IconButton>
      <IconButton
        onClick={handleBackButtonClick}
        disabled={page === 0}
        aria-label="previous page"
      >
        {theme.direction === "rtl" ? (
          <KeyboardArrowRight />
        ) : (
          <KeyboardArrowLeft />
        )}
      </IconButton>
      <IconButton
        onClick={handleNextButtonClick}
        disabled={page >= Math.ceil(count / rowsPerPage) - 1}
        aria-label="next page"
      >
        {theme.direction === "rtl" ? (
          <KeyboardArrowLeft />
        ) : (
          <KeyboardArrowRight />
        )}
      </IconButton>
      <IconButton
        onClick={handleLastPageButtonClick}
        disabled={page >= Math.ceil(count / rowsPerPage) - 1}
        aria-label="last page"
      >
        {theme.direction === "rtl" ? <FirstPageIcon /> : <LastPageIcon />}
      </IconButton>
    </Box>
  );
}

// Define a React functional component named TokenLeaderboard
type TokenLeaderboardProps = {
  programId: string;              // MAINNET mint
  activeDaoIdBase58: string;      // DEVNET Vine config DAO
  activeSeason?: number;          // DEVNET (optional)
  meta?: {
    name?: string;
    symbol?: string;
    description?: string;
    image?: string;
  } | null;
  resolvedTheme?: {
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
};

const TokenLeaderboard: FC<TokenLeaderboardProps> = (props) => {
  const rpcEndpoint = useRpcEndpoint();
  const connection = React.useMemo(() => new Connection(rpcEndpoint), []);
  const token = React.useMemo(() => new PublicKey(props.programId), [props.programId]);
  const meta = props.meta || null;

  // --- STATE ---
  const [tokenInfo, setTokenInfo] = useState<any | null>(null);
  const [totalTokensHeld, setTotalTokensHeld] = useState(0);
  const [holders, setHolders] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [loadingSpin, setLoadingSpin] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const componentRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [markdownCopied, setMarkdownCopied] = useState(false);
  const [streamMode, setStreamMode] = useState(false);
  const [showRandomizer, setShowRandomizer] = useState(false);
  const [csvCopied, setCsvCopied] = useState(false);

  const [highlightedAddress, setHighlightedAddress] = useState<string | null>(
    null
  );
  const [snapshotCopied, setSnapshotCopied] = useState(false);

  const isMobile = useMediaQuery("(max-width:600px)");

  // NEW: wallet drawer state
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [selectedRank, setSelectedRank] = useState<number | null>(null);

  const [tokenMeta, setTokenMeta] = useState<{
    name?: string;
    symbol?: string;
    logoURI?: string;
  } | null>(null);

  type WinnerEntry = {
    address: string;
    ts: string;
  };

  const winnersRef = useRef<HTMLDivElement | null>(null);
  const [targetDrawCount, setTargetDrawCount] = useState<number>(DEFAULT_DRAW_COUNT);

  const [winner, setWinner] = useState<string>(""); // spinning / current wallet text
  const [timestamp, setTimestamp] = useState<string>(""); // last draw timestamp (string)
  const [winners, setWinners] = useState<WinnerEntry[]>([]);
  const currentWinner = winners[winners.length - 1] ?? null;

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isLegacy = searchParams.get("legacy") === "1";

  const toggleLegacy = (checked: boolean) => {
    const params = new URLSearchParams(searchParams.toString());

    if (checked) params.set("legacy", "1");
    else params.delete("legacy");

    // keep everything else the same (dao, season, etc.)
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };


  // Build CSV string for reputation import
  // Format: wallet,points
  // Here points = floor(normalized token balance).
  // You can change this mapping later if you want a different scoring rule.
  const buildReputationCsv = () => {
    if (!holders || holders.length === 0) return "";

    const filtered = holders.filter(
      (h) => h?.address && !excludeArr.includes(h.address)
    );

    const header = "wallet,points";

    const lines = filtered.map((h) => {
      const raw = Number(h.balance) || 0;

      // Normalize by decimals if we have tokenInfo, otherwise use raw
      const normalized =
        tokenInfo && tokenInfo.decimals != null
          ? raw / 10 ** tokenInfo.decimals
          : raw;

      // For now: integer points based on balance
      const points = Math.floor(normalized);

      return `${h.address},${points}`;
    });

    return [header, ...lines].join("\n");
  };

  const handleCopyCsv = async () => {
  const csv = buildReputationCsv();
  if (!csv) return;

  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(csv);
    } else {
      // fallback
      const textarea = document.createElement("textarea");
      textarea.value = csv;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCsvCopied(true);
  } catch (e) {
    console.error("Failed to copy CSV:", e);
  }
};

  const handleDownloadCsv = () => {
    const csv = buildReputationCsv();
    if (!csv) return;

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "vine-reputation-export.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // winnerRef keeps track of the final winner during spin
  const winnerRef = useRef<string>("");
  useEffect(() => {
    winnerRef.current = winner;
  }, [winner]);

  // Timeout ref MUST be declared before any effects that use it
  const timeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear pending timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
    };
  }, []);

  const excludedWallets = [
    {
      address: "CBkJ9y9qRfYixCdSChqrVxYebgSEBCNbhnPk8GRdEtFk",
      reason: "Treasury",
    },
    {
      address: "6jEQpEnoSRPP8A2w6DWDQDpqrQTJvG4HinaugiBGtQKD",
      reason: "Governance Wallet",
    },
    {
      address: "AWaMVkukciGYPEpJbnmSXPJzVxuuMFz1gWYBkznJ2qbq",
      reason: "System",
    },
  ];
  const excludeArr = excludedWallets.map((w) => w.address);

  const raffleEligibleCount = holders.filter((h) => {
    if (!h?.address || excludeArr.includes(h.address)) return false;
    const weight = Number(h.balance);
    return Number.isFinite(weight) && weight > 0;
  }).length;
  const drawGoal = raffleEligibleCount > 0 ? Math.min(targetDrawCount, raffleEligibleCount) : targetDrawCount;
  const drawGoalCapped = raffleEligibleCount > 0 && targetDrawCount > raffleEligibleCount;
  const drawLimitReached = raffleEligibleCount > 0 && winners.length >= drawGoal;

  const handleDrawCountChange = (raw: string) => {
    const next = Number(raw);
    if (!Number.isFinite(next)) return;
    const clamped = Math.max(MIN_DRAW_COUNT, Math.min(MAX_DRAW_COUNT, Math.floor(next)));
    setTargetDrawCount(clamped);
  };

  // --- LEADERBOARD STATS ---
  const effectiveHolders = holders.filter(
    (h) => h?.address && !excludeArr.includes(h.address)
  );

  const totalEffective = effectiveHolders.length;
  const excludedCount = holders.length - totalEffective;

  let top10SharePct = 0;
  let medianBalance = 0;

  if (totalEffective > 0 && tokenInfo?.decimals != null) {
    const sortedByBalance = [...effectiveHolders].sort(
      (a, b) => Number(b.balance) - Number(a.balance)
    );

    const balancesRaw = sortedByBalance.map((h) => Number(h.balance));

    const mid = Math.floor(balancesRaw.length / 2);
    let medianRaw: number;
    if (balancesRaw.length % 2 === 0) {
      medianRaw = (balancesRaw[mid - 1] + balancesRaw[mid]) / 2;
    } else {
      medianRaw = balancesRaw[mid];
    }
    medianBalance = medianRaw / 10 ** tokenInfo.decimals;

    const top10Raw = balancesRaw.slice(0, 10).reduce((acc, v) => acc + v, 0);
    const totalHeldRaw = balancesRaw.reduce((acc, v) => acc + v, 0);

    if (totalHeldRaw > 0) {
      top10SharePct = (top10Raw / totalHeldRaw) * 100;
    }
  }

  const buildWinnersMarkdown = () => {
  if (!winners || winners.length === 0) return "";

  const headerDate = moment(winners[0].ts).format("LLLL"); // full date/time

  let md = `### 🍇 Raffle Results\n`;
  md += `*${headerDate}*\n\n`;

  winners.forEach((w, idx) => {
    md += `${idx + 1}. \`${w.address}\` — ${moment(w.ts).format("HH:mm:ss")}\n`;
  });

  return md;
};

  const handleCopyWinnersMarkdown = async () => {
    const md = buildWinnersMarkdown();
    if (!md) return;

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(md);
      } else {
        // Fallback for older browsers
        const textarea = document.createElement("textarea");
        textarea.value = md;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setMarkdownCopied(true);
    } catch (err) {
      console.error("Failed to copy markdown:", err);
    }
  };

  const handleOpenWalletDrawer = (address: string, rank: number) => {
    setSelectedWallet(address);
    setSelectedRank(rank);
  };

  const handleCloseWalletDrawer = () => {
    setSelectedWallet(null);
    setSelectedRank(null);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleCapture = async () => {
    if (!winnersRef.current) return;

    try {
      const element = winnersRef.current as HTMLElement;

      const canvas = await html2canvas(element, {
        backgroundColor: "#020617",
        scale: Math.max(window.devicePixelRatio || 2, 2),
      });

      canvas.toBlob(async (blob) => {
        if (!blob) return;

        const supportsClipboard =
          typeof navigator !== "undefined" &&
          (navigator as any).clipboard &&
          typeof (navigator as any).clipboard.write === "function" &&
          typeof (window as any).ClipboardItem !== "undefined";

        if (supportsClipboard) {
          try {
            const item = new (window as any).ClipboardItem({
              "image/png": blob,
            });
            await (navigator as any).clipboard.write([item]);
            setSnapshotCopied(true);
          } catch (err) {
            console.error(
              "Clipboard write failed, falling back to download:",
              err
            );
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `vine-raffle-winners-${
              timestamp || "vine-raffle-winners"
            }.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          }
        } else {
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `vine-raffle-winners-${
            timestamp || "vine-raffle-winners"
          }.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }
      }, "image/png");
    } catch (error) {
      console.error("Error capturing snapshot:", error);
    }
  };

  const handleCopy = () => {
    setIsCopied(true);
  };

  const handleCloseSnackbar = () => {
    setIsCopied(false);
  };

  const handleGetRaffleSelection = () => {
    // dynamic exclusion: base exclusions + already-won wallets
    const dynamicExclude = [
      ...excludeArr,
      ...winners.map((w) => w.address),
    ];

    const won = weightedRandomChoice(holders, dynamicExclude);

    if (won) {
      setWinner(won.address);

      // highlight winner row
      setHighlightedAddress(won.address);

      // clear highlight after a few seconds
      setTimeout(() => {
        setHighlightedAddress(null);
      }, 2500);
    } else {
      console.warn("No eligible wallets left to draw from.");
    }
  };

  // Fetch token info + holders
  useEffect(() => {
    setLoading(true);
    (async () => {
      try {
        const tokenDetails = await connection.getParsedAccountInfo(token);
        const parsedTokenDetails = JSON.parse(JSON.stringify(tokenDetails));
        if (parsedTokenDetails?.value?.data?.parsed?.info) {
          setTokenInfo(parsedTokenDetails.value.data.parsed.info);
        }

        const tokenAccounts = await connection.getProgramAccounts(
          TOKEN_PROGRAM_ID,
          {
            filters: [
              {
                dataSize: 165,
              },
              {
                memcmp: {
                  offset: 0,
                  bytes: token.toBase58(),
                },
              },
            ],
          }
        );

        const holdersAta = tokenAccounts.map(({ pubkey }) => pubkey);
        const chunkSize = 100;
        const holderArr: any[] = [];

        for (let i = 0; i < holdersAta.length; i += chunkSize) {
          const chunk = holdersAta.slice(i, i + chunkSize);
          const accountInfo = await connection.getMultipleParsedAccounts(chunk);
          if (accountInfo) {
            const holdersChunk = JSON.parse(
              JSON.stringify(accountInfo)
            ).value.map((data: any) => {
              return {
                address: data.data.parsed.info.owner,
                balance: data.data.parsed.info.tokenAmount.amount,
              };
            });

            holderArr.push(...holdersChunk);
            console.log(
              `Processed ${holdersChunk.length} accounts in chunk ${
                i / chunkSize + 1
              }`
            );
          }
        }

        const sortedHolders = holderArr.sort(
          (a: any, b: any) => b.balance - a.balance
        );
        setHolders(sortedHolders);

        const totalTokens = sortedHolders
          .filter((holder) => !excludeArr.includes(holder.address))
          .reduce((acc, holder) => acc + Number(holder.balance), 0);

        console.log("Total tokens held:", totalTokens);
        setTotalTokensHeld(
          totalTokens /
            10 ** parsedTokenDetails.value.data.parsed.info?.decimals
        );

        setLoading(false);
      } catch (err) {
        console.error("Error fetching token info:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [connection, token, props.programId]); // refetch if mint changes

  const handleChangePage = (event: any, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: any) => {
    setRowsPerPage(parseInt(event.target.value, 200));
    setPage(0);
  };

  const fireConfetti = () => {
    if (typeof window === "undefined") return;

    void import("canvas-confetti")
      .then((mod: any) => {
        const confetti = mod?.default ?? mod;
        const duration = 1400;
        const animationEnd = Date.now() + duration;

        const defaults = {
          startVelocity: 35,
          spread: 55,
          ticks: 90,
          zIndex: 9999,
          scalar: 0.9,
          colors: [
            "#8A2BE2",
            "#C084FC",
            "#00FFA3",
            "#03E1FF",
            "#FFFFFF",
          ],
        };

        function randomInRange(min: number, max: number) {
          return Math.random() * (max - min) + min;
        }

        const interval = window.setInterval(() => {
          const timeLeft = animationEnd - Date.now();

          if (timeLeft <= 0) {
            clearInterval(interval);
            return;
          }

          const particleCount = Math.round(50 * (timeLeft / duration));
          confetti({
            ...defaults,
            particleCount,
            origin: {
              x: randomInRange(0.15, 0.35),
              y: randomInRange(0.15, 0.35),
            },
          });

          confetti({
            ...defaults,
            particleCount,
            origin: {
              x: randomInRange(0.65, 0.85),
              y: randomInRange(0.15, 0.35),
            },
          });
        }, 180);
      })
      .catch(() => {});
  };

  // SPIN LOGIC with roulette effect
  const spinRoulette = () => {
    if (loadingSpin || drawLimitReached || raffleEligibleCount === 0) return;

    // compute how many wallets are still eligible
    const alreadyWon = new Set(winners.map((w) => w.address));
    const remainingEligible = holders.filter(
      (h) =>
        h?.address &&
        !excludeArr.includes(h.address) &&
        !alreadyWon.has(h.address) &&
        Number(h.balance) > 0
    );

    // if none left or we've already reached the max winners, bail
    if (remainingEligible.length === 0 || drawLimitReached) {
      console.warn("No more eligible wallets to draw.");
      return;
    }

    const interval = 100; // spinning speed
    const spins = 30; // number of ticks

    let spinCount = 0;

    setLoadingSpin(true);
    setTimestamp(""); // clear previous

    const spinIteration = () => {
      handleGetRaffleSelection(); // updates `winner` each tick
      spinCount++;

      if (spinCount < spins) {
        timeoutIdRef.current = setTimeout(spinIteration, interval);
      } else {
        const finalTs = moment().toString();
        setTimestamp(finalTs);

        setWinners((prev) => [
          ...prev,
          {
            address: winnerRef.current, // final winner from spin
            ts: finalTs,
          },
        ]);

        setLoadingSpin(false);
        setOpen(true);
        fireConfetti();
        timeoutIdRef.current = null;
      }
    };

    spinIteration();
  };

  const handleResetRaffle = () => {
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }

    setWinners([]);
    setWinner("");
    setTimestamp("");
    setLoadingSpin(false);
    setOpen(false);
    setHighlightedAddress(null);
  };

  // Keyboard shortcuts in stream mode
  useEffect(() => {
    if (!streamMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Space / Enter -> draw
      if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Enter') {
        e.preventDefault();
        spinRoulette();
      }
      // R -> reset
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handleResetRaffle();
      }
      // Esc -> exit stream mode
      if (e.key === 'Escape') {
        e.preventDefault();
        setStreamMode(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [streamMode, spinRoulette, handleResetRaffle]);

  useEffect(() => {
    if (!streamMode) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [streamMode]);

  const getHolderTier = (percent: number) => {
    if (percent >= 4) {
      return { label: "Whale", color: "rgba(248,250,252,0.14)" };
    } else if (percent >= 1) {
      return { label: "Large", color: "rgba(129,140,248,0.20)" };
    } else if (percent >= 0.1) {
      return { label: "Mid", color: "rgba(45,212,191,0.16)" };
    } else {
      return { label: "Tail", color: "rgba(148,163,184,0.18)" };
    }
  };

  const shortenString = (input: string, startChars = 6, endChars = 6) => {
    if (!input) return "";
    if (input.length <= startChars + endChars) {
      return input;
    }
    const start = input.slice(0, startChars);
    const end = input.slice(-endChars);
    return `${start}...${end}`;
  };

  // Derived info for selected wallet in drawer
  const selectedHolder = selectedWallet
    ? holders.find(
        (h) => h?.address === selectedWallet && !excludeArr.includes(h.address)
      )
    : null;

  let selectedBalance = 0;
  let selectedPct = 0;
  let selectedHeldPct = 0;
  let drawChance = 0;
  let selectedTier: { label: string; color: string } | null = null;

  if (selectedHolder && tokenInfo?.decimals != null && tokenInfo?.supply) {
    const raw = Number(selectedHolder.balance);
    selectedBalance = raw / 10 ** tokenInfo.decimals;
    selectedPct = (raw / tokenInfo.supply) * 100;
    //selectedHeldPct = (raw / totalTokensHeld / 10 ** tokenInfo.decimals) * 100;
    drawChance = tokenInfo && totalTokensHeld > 0
      ? (selectedBalance / totalTokensHeld) * 100
      : 0;
    selectedTier = getHolderTier(selectedPct);
  }

  // What to show in the pill:
  const pillHasWinner = loadingSpin
    ? !!winner
    : !!currentWinner || !!winner;

  const pillAddress = loadingSpin
    ? winner
    : currentWinner?.address || winner;

  const pillTimestamp = !loadingSpin
    ? currentWinner?.ts || timestamp
    : null;

  const visibleHolders = React.useMemo(() => {
    return (holders || []).filter(
      (h) => h?.address && !excludeArr.includes(h.address)
    );
  }, [holders, excludeArr]);

  const pagedHolders =
    rowsPerPage > 0
      ? visibleHolders.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
      : visibleHolders;

  // Render the component
  return (
    <Box sx={{ flexGrow: 1, border: "none" }}>

      {streamMode && (
  <Box
    sx={{
      position: "fixed",
      inset: 0,
      width: "100vw",
      height: "100dvh",
      maxHeight: "100dvh",
      zIndex: 1400,
      background:
        "radial-gradient(circle at top, #020617 0%, #020617 40%, #020617 100%)",
      color: "#e5e7eb",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      p: 3,
      overflow: "hidden",
    }}
  >
    {/* Top bar: title + exit */}
    <Box
      sx={{
        position: "absolute",
        top: 12,
        left: 24,
        right: 24,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Live Draw
        </Typography>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <Typography variant="caption" sx={{ opacity: 0.7 }}>
          Space / Enter = Draw • R = Reset • Esc = Exit
        </Typography>
        <IconButton
          onClick={() => setStreamMode(false)}
          sx={{
            color: "rgba(248,250,252,0.9)",
            borderRadius: "999px",
            border: "1px solid rgba(148,163,184,0.6)",
            p: 0.75,
          }}
        >
          <FullscreenExitIcon fontSize="small" />
        </IconButton>
      </Box>
    </Box>

      <Box
        sx={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          px: 3,
          py: 1.8,
          borderRadius: "999px",
          background: "rgba(15,23,42,0.95)",
          border: "1px solid rgba(148,163,184,0.7)",
          backdropFilter: "blur(12px)",
          minWidth: 360,
          justifyContent: "center",
          animation: loadingSpin ? "winnerGlow 1.4s ease-out infinite" : "none",
          "&::before": loadingSpin
            ? {
                content: '""',
                position: "absolute",
                inset: -10,
                borderRadius: "999px",
                border: "1px solid rgba(56,189,248,0.65)",
                boxShadow: "0 0 26px rgba(56,189,248,0.55)",
                opacity: 0.7,
              }
            : {},
        }}
      >
    {(() => {
      // While spinning, show the live roulette address.
      // After spin, show the locked winner from winners[].
      const liveDisplayAddress =
        loadingSpin && winner
          ? winner
          : currentWinner
          ? currentWinner.address
          : "";

      const text = liveDisplayAddress
        ? isMobile
          ? shortenString(liveDisplayAddress, 8, 8)
          : liveDisplayAddress
        : loadingSpin
        ? "Drawing winner…"
        : "Ready to draw";

      return (
        <Typography
          variant="h5"
          sx={{
            fontFamily: "monospace",
            letterSpacing: 1,
            opacity: liveDisplayAddress ? 0.95 : 0.55,
          }}
        >
          {text}
        </Typography>
      );
    })()}
  </Box>

    {/* Winners list on the side / bottom */}
    {winners.length > 0 && (
      <Box
        sx={{
          mt: 1,
          px: 3,
          py: 2,
          borderRadius: "18px",
          background: "rgba(15,23,42,0.96)",
          border: "1px solid rgba(148,163,184,0.6)",
          backdropFilter: "blur(14px)",
          width: { xs: "100%", sm: "80%", md: 640 },
          maxWidth: 800,
          maxHeight: { xs: "34dvh", md: "40dvh" },
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            mb: 1.5,
          }}
        >
          <Typography
            variant="subtitle1"
            sx={{ letterSpacing: 1.2, textTransform: "uppercase" }}
          >
            The Vine List
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            {moment(winners[0].ts).format("LL")}
          </Typography>
        </Box>

        {winners.map((w, idx) => (
          <Box
            key={`${w.address}-${w.ts}`}
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              py: 0.7,
              borderBottom:
                idx === winners.length - 1
                  ? "none"
                  : "1px dashed rgba(75,85,99,0.7)",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Typography
                variant="body1"
                sx={{ width: 26, opacity: 0.75, textAlign: "right" }}
              >
                {idx + 1}.
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  fontFamily: "monospace",
                  letterSpacing: 0.4,
                }}
              >
                {isMobile ? shortenString(w.address, 8, 8) : w.address}
              </Typography>
            </Box>

            <Typography
              variant="body2"
              sx={{
                opacity: 0.8,
                fontFeatureSettings: '"tnum" 1',
                minWidth: 72,
                textAlign: "right",
              }}
            >
              {moment(w.ts).format("HH:mm:ss")}
            </Typography>
          </Box>
        ))}
      </Box>
    )}

    {/* Controls row at bottom */}
    <Box
      sx={{
        position: "absolute",
        bottom: 18,
        left: 24,
        right: 24,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <Typography variant="caption" sx={{ opacity: 0.65 }}>
        Draws: {winners.length}/{drawGoal} • Eligible: {raffleEligibleCount}
        {drawGoalCapped ? " (capped by eligibility)" : ""} • Chance ∝ wallet balance
      </Typography>

      <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
        <TextField
          size="small"
          type="number"
          value={targetDrawCount}
          onChange={(e) => handleDrawCountChange(e.target.value)}
          inputProps={{ min: MIN_DRAW_COUNT, max: MAX_DRAW_COUNT, step: 1, "aria-label": "target draws" }}
          sx={{
            width: 92,
            "& .MuiOutlinedInput-root": {
              height: 36,
              color: "rgba(248,250,252,0.95)",
              background: "rgba(15,23,42,0.55)",
            },
            "& .MuiOutlinedInput-notchedOutline": {
              borderColor: "rgba(148,163,184,0.8)",
            },
            "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: "rgba(191,219,254,0.9)",
            },
          }}
        />
        <Button
          onClick={spinRoulette}
          disabled={loadingSpin || drawLimitReached || raffleEligibleCount === 0}
          sx={{
            textTransform: "none",
            borderRadius: "18px",
            px: 3,
            py: 1,
            background:
              loadingSpin || drawLimitReached || raffleEligibleCount === 0
                ? "rgba(0,200,255,0.3)"
                : "rgba(255,255,255,0.12)",
            "&:hover": {
              background:
                loadingSpin || drawLimitReached || raffleEligibleCount === 0
                  ? "rgba(0,200,255,0.35)"
                  : "rgba(255,255,255,0.2)",
            },
          }}
        >
          {loadingSpin ? (
            <HourglassBottomIcon sx={{ mr: 1 }} fontSize="small" />
          ) : (
            <LoopIcon sx={{ mr: 1 }} fontSize="small" />
          )}
          {raffleEligibleCount === 0
            ? "No eligible wallets"
            : drawLimitReached
            ? "All winners drawn"
            : "Draw next"}
        </Button>

        {winners.length > 0 && (
          <Button
            onClick={handleResetRaffle}
            variant="outlined"
            color="inherit"
            sx={{
              textTransform: "none",
              borderRadius: "18px",
              borderColor: "rgba(148,163,184,0.8)",
            }}
          >
            Reset
          </Button>
        )}
      </Box>
    </Box>
  </Box>
)}
      {/* Premium Token Summary */}
      {tokenInfo && (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            mb: 3,
            mt: 1,
            gap: 1.5,
          }}
        >
          {/*
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
            {meta?.image ? (
              <Avatar src={meta.image} sx={{ width: 44, height: 44 }} />
            ) : (
              <Avatar sx={{ width: 44, height: 44 }}>V</Avatar>
            )}
            <Box>
              <Typography variant="h6" sx={{ lineHeight: 1.1 }}>
                {meta?.name ?? "Reputation Leaderboard"}
                {meta?.symbol ? ` • ${meta.symbol}` : ""}
              </Typography>
              {meta?.description ? (
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  {meta.description}
                </Typography>
              ) : null}
            </Box>
          </Box>
          */}

          {/* TOKEN ADDRESS PANEL */}
          <CopyToClipboard text={token.toBase58()} onCopy={handleCopy}>
            <Box
              sx={{
                px: 2,
                py: 1,
                borderRadius: "14px",
                cursor: "pointer",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                backdropFilter: "blur(8px)",
                display: "flex",
                alignItems: "center",
                gap: 1,
                transition: "all 0.2s ease",
                "&:hover": {
                  background: "rgba(255,255,255,0.12)",
                  borderColor: "rgba(255,255,255,0.2)",
                  transform: "translateY(-1px)",
                },
              }}
            >
              <FileCopyIcon sx={{ fontSize: 16, opacity: 0.7 }} />
              <Typography
                variant="body2"
                sx={{ fontWeight: 500, opacity: 0.9 }}
              >
                {shortenString(token.toBase58(), 8, 8)}
              </Typography>
            </Box>
          </CopyToClipboard>

          {/* METRIC CARDS */}
          <Box
            sx={{
              display: "flex",
              gap: 1.2,
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            {[
              {
                label: "Supply",
                value: (
                  tokenInfo.supply / 10 ** tokenInfo.decimals
                ).toLocaleString(),
              },
              {
                label: "Decimals",
                value: tokenInfo.decimals,
              },
              {
                label: "Tokens Held",
                value: totalTokensHeld.toLocaleString(),
              },
            ].map(({ label, value }, i) => (
              <Box
                key={i}
                sx={{
                  minWidth: 120,
                  px: 1.8,
                  py: 1,
                  borderRadius: "14px",
                  background:
                    "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))",
                  border: "1px solid rgba(255,255,255,0.12)",
                  backdropFilter: "blur(10px)",
                  display: "flex",
                  flexDirection: "column",
                  textAlign: "right",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                  position: "relative",
                  transition: "0.25s ease",
                  "&:hover": {
                    boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
                    transform: "translateY(-2px)",
                    borderColor: "rgba(255,255,255,0.2)",
                  },
                }}
              >
                <Typography
                  variant="caption"
                  sx={{ opacity: 0.7, fontSize: "11px" }}
                >
                  {label}
                </Typography>
                <Typography
                  variant="body1"
                  sx={{ fontWeight: 600, opacity: 0.95 }}
                >
                  {value}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* RAFFLE / RANDOMIZER CARD */}
      {!loading && showRandomizer && (
        <Collapse in={showRandomizer} timeout={220} unmountOnExit>
          <Box
            ref={componentRef}
            sx={{
              m: 2,
              p: 2.5,
              borderRadius: "20px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              backdropFilter: "blur(12px)",
              boxShadow: loadingSpin
                ? "0 0 18px rgba(0,200,255,0.25)"
                : "0 0 8px rgba(0,0,0,0.4)",
              transition: "0.3s ease",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Animated top shimmer while spinning */}
            {loadingSpin && (
              <Box
                sx={{
                  position: "absolute",
                  top: 0,
                  left: "-120%",
                  height: "4px",
                  width: "60%",
                  background:
                    "linear-gradient(90deg, rgba(255,255,255,0), rgba(0,200,255,0.8), rgba(255,255,255,0))",
                  animation: "shimmerBar 1.4s infinite ease",
                }}
              />
            )}

            {/* Header / status row */}
            <Box
              sx={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                mb: 1.5,
                gap: 1,
              }}
            >
              <Typography
                variant="subtitle2"
                sx={{ letterSpacing: 0.5, opacity: 0.9 }}
              >
                <Tooltip
                    title="Chance to be drawn is proportional to token balance. P(win) = walletBalance / totalEligibleBalance"
                    arrow
                  >
                    <Typography variant="subtitle2" sx={{ opacity: 0.8 }}>
                      Randomizer
                    </Typography>
                  </Tooltip>
              </Typography>

              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.75,
                  opacity: 0.85,
                  fontSize: "0.75rem",
                }}
              >
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    bgcolor: loadingSpin ? "#22c55e" : "#9ca3af",
                  }}
                />
                <Typography variant="caption" sx={{ mr: 1 }}>
                  {loadingSpin ? "Drawing…" : "Ready"}
                </Typography>

                <Typography variant="caption" sx={{ opacity: 0.7 }}>
                  {winners.length}/{drawGoal} drawn
                </Typography>
              </Box>
              
                <Tooltip title="Open stream mode for Discord / screen share" arrow>
                  <IconButton
                    size="small"
                    sx={{
                      ml: 0.5,
                      color: "rgba(248,250,252,0.85)",
                      "&:hover": { color: "white" },
                    }}
                    onClick={() => setStreamMode(true)}
                  >
                    <LiveTvIcon fontSize="inherit" />
                  </IconButton>
                </Tooltip>
              </Box>    

            {/* Content row: winner + actions */}
            <Box
              sx={{
                display: "flex",
                flexDirection: { xs: "column", md: "row" },
                alignItems: { xs: "flex-start", md: "center" },
                justifyContent: "space-between",
                gap: 2,
              }}
            >
              {/* Winner section */}
              <Box sx={{ textAlign: "left", flex: 1 }}>
                {/* Roulette pill + glow (uses spinning winner while loadingSpin) */}
                {pillHasWinner && pillAddress && (
                  <Fade in timeout={450}>
                    <Box sx={{ textAlign: "center", mb: 2 }}>
                      <Box
                        key={
                          (loadingSpin ? "spin-" : "final-") +
                          (pillAddress || "")
                        }
                        sx={{
                          position: "relative",
                          display: "inline-flex",
                          alignItems: "center",
                          px: 2,
                          py: 1,
                          borderRadius: "14px",
                          background: "rgba(15,23,42,0.9)",
                          border: "1px solid rgba(148,163,184,0.7)",
                          backdropFilter: "blur(8px)",
                          animation: "winnerGlow 1.6s ease-out",
                          "&::before": {
                            content: '""',
                            position: "absolute",
                            inset: -6,
                            borderRadius: "999px",
                            border: "1px solid rgba(56,189,248,0.65)",
                            boxShadow: "0 0 22px rgba(56,189,248,0.55)",
                            opacity: 0,
                            animation: "pulseRing 1.3s ease-out",
                          },
                        }}
                      >
                        <CopyToClipboard
                          text={pillAddress}
                          onCopy={handleCopy}
                        >
                          <Button
                            variant="text"
                            color="inherit"
                            sx={{
                              textTransform: "none",
                              fontWeight: 500,
                              fontSize: "0.9rem",
                              letterSpacing: 0.4,
                              color: "white",
                              minWidth: 0,
                              "&:hover": {
                                background: "rgba(255,255,255,0.05)",
                              },
                            }}
                            startIcon={<FileCopyIcon fontSize="small" />}
                          >
                            {isMobile
                              ? shortenString(pillAddress, 8, 8)
                              : pillAddress}
                          </Button>
                        </CopyToClipboard>
                      </Box>

                      {!loadingSpin && pillTimestamp && (
                        <Fade in timeout={500}>
                          <Box
                            sx={{
                              mt: 1.2,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 1,
                              flexWrap: "wrap",
                            }}
                          >
                            <Tooltip title="Save winners snapshot (image)">
                              <IconButton
                                sx={{ color: "white", mr: 0.2 }}
                                onClick={handleCapture}
                              >
                                <ScreenshotMonitorIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>

                            <Tooltip title="Copy winners as Markdown (for Discord/notes)">
                              <IconButton
                                sx={{ color: "white", mr: 0.2 }}
                                onClick={handleCopyWinnersMarkdown}
                              >
                                <DescriptionIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>

                            <Typography
                              variant="caption"
                              sx={{ opacity: 0.8, whiteSpace: "nowrap" }}
                            >
                              {moment(currentWinner.ts).format("LLLL")}
                            </Typography>
                          </Box>
                        </Fade>
                      )}
                    </Box>
                  </Fade>
                )}

                {/* WINNERS SNAPSHOT AREA (screenshot target) */}
                {winners.length > 0 && (
                  <Box
                    ref={winnersRef}
                    sx={{
                      mt: 2.5,
                      p: 2,
                      borderRadius: "16px",
                      background: "rgba(15,23,42,0.96)",
                      border: "1px solid rgba(148,163,184,0.6)",
                      backdropFilter: "blur(10px)",
                      maxWidth: 520,
                    }}
                  >
                    {/* Header with date */}
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        mb: 1.5,
                      }}
                    >
                      <Typography
                        variant="subtitle2"
                        sx={{
                          letterSpacing: 0.6,
                          textTransform: "uppercase",
                        }}
                      >
                        The Vine List
                      </Typography>

                      <Typography variant="caption" sx={{ opacity: 0.8 }}>
                        {moment(winners[0].ts).format("LL")}
                      </Typography>
                    </Box>

                    {/* Winners list */}
                    <Box sx={{ mt: 0.5 }}>
                      {winners.map((w, idx) => (
                        <Box
                          key={w.ts}
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            py: 0.5,
                            borderBottom:
                              idx === winners.length - 1
                                ? "none"
                                : "1px dashed rgba(75,85,99,0.6)",
                          }}
                        >
                          {/* Left side: rank + address + copy button */}
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                              minWidth: 0,
                            }}
                          >
                            <Typography
                              variant="body2"
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                                lineHeight: 2,
                                fontFamily:
                                  '"Roboto Mono","SFMono-Regular",ui-monospace,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace',
                                letterSpacing: 0,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                pr: 1.5,
                              }}
                            >
                              <span style={{ opacity: 0.8, minWidth: 18 }}>{idx + 1}.</span>

                              <span>
                                {isMobile ? shortenString(w.address, 6, 6) : w.address}
                              </span>

                              <CopyToClipboard text={w.address} onCopy={handleCopy}>
                                <IconButton
                                  size="small"
                                  sx={{
                                    color: "rgba(248,250,252,0.85)",
                                    p: 0.3,
                                    "&:hover": {
                                      backgroundColor: "rgba(148,163,184,0.25)",
                                    },
                                  }}
                                >
                                  <FileCopyIcon sx={{ fontSize: 14 }} />
                                </IconButton>
                              </CopyToClipboard>
                            </Typography>

                            <CopyToClipboard text={w.address} onCopy={handleCopy}>
                              <IconButton
                                size="small"
                                sx={{
                                  ml: 0.25,
                                  p: 0.4,
                                  borderRadius: "999px",
                                  backgroundColor: "rgba(15,23,42,0.9)",
                                  "&:hover": {
                                    backgroundColor: "rgba(148,163,184,0.35)",
                                  },
                                }}
                              >
                                <FileCopyIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            </CopyToClipboard>
                          </Box>

                          {/* Right side: time */}
                          <Typography
                            variant="caption"
                            sx={{
                              opacity: 0.8,
                              fontFeatureSettings: '"tnum" 1',
                              ml: 1,
                              flexShrink: 0,
                            }}
                          >
                            {moment(w.ts).format("HH:mm:ss")}
                          </Typography>
                        </Box>
                      ))}
                    </Box>


                  </Box>
                )}
              </Box>

              {/* Actions: draw + reset (simple) */}
              <Box
                sx={{
                  textAlign: { xs: "left", md: "right" },
                  mt: { xs: 2, md: 0 },
                }}
              >
                <TextField
                  size="small"
                  type="number"
                  value={targetDrawCount}
                  onChange={(e) => handleDrawCountChange(e.target.value)}
                  inputProps={{ min: MIN_DRAW_COUNT, max: MAX_DRAW_COUNT, step: 1, "aria-label": "target draws" }}
                  sx={{
                    width: 92,
                    mb: 0.75,
                    "& .MuiOutlinedInput-root": {
                      height: 34,
                      color: "rgba(248,250,252,0.95)",
                      background: "rgba(15,23,42,0.55)",
                    },
                    "& .MuiOutlinedInput-notchedOutline": {
                      borderColor: "rgba(148,163,184,0.8)",
                    },
                    "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": {
                      borderColor: "rgba(191,219,254,0.9)",
                    },
                  }}
                />
                <Button
                  onClick={spinRoulette}
                  disabled={loadingSpin || drawLimitReached || raffleEligibleCount === 0}
                  sx={{
                    textTransform: "none",
                    borderRadius: "18px",
                    px: 2.6,
                    py: 1,
                    background:
                      loadingSpin || drawLimitReached || raffleEligibleCount === 0
                        ? "rgba(0,200,255,0.3)"
                        : "rgba(255,255,255,0.12)",
                    "&:hover": {
                      background:
                        loadingSpin || drawLimitReached || raffleEligibleCount === 0
                          ? "rgba(0,200,255,0.35)"
                          : "rgba(255,255,255,0.22)",
                    },
                    transition: "0.2s",
                  }}
                >
                  {loadingSpin ? (
                    <HourglassBottomIcon sx={{ mr: 1 }} fontSize="small" />
                  ) : (
                    <LoopIcon sx={{ mr: 1 }} fontSize="small" />
                  )}
                  <Typography component="span" sx={{ fontSize: "0.9rem" }}>
                    {raffleEligibleCount === 0
                      ? "No eligible wallets"
                      : drawLimitReached
                      ? "All winners drawn"
                      : "Draw"}
                  </Typography>
                </Button>

                {winners.length > 0 && (
                  <Button
                    onClick={handleResetRaffle}
                    size="small"
                    variant="text"
                    sx={{
                      mt: 0.75,
                      ml: 0.5,
                      textTransform: "none",
                      opacity: 0.7,
                      "&:hover": {
                        opacity: 1,
                        background: "transparent",
                        textDecoration: "underline",
                      },
                    }}
                  >
                    Reset
                  </Button>
                )}
              </Box>
            </Box>
          </Box>
        </Collapse>
      )}

      {/* LEADERBOARD HEADER */}
      <Box
        sx={{
          mt: 3,
          mb: 1.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <Typography variant="h5">Token Leaderboard</Typography>

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          {totalEffective > 0 && (
            <Typography
              variant="caption"
              sx={{ opacity: 0.75, textAlign: "right" }}
            >
              {totalEffective.toLocaleString()} holders
              {excludedCount > 0 && (
                <Tooltip
                  title={
                    <>
                      <strong>Excluded wallets:</strong>
                      <br />
                      Treasury or system-owned accounts that should not
                      participate in raffles or distort supply stats.
                    </>
                  }
                  placement="top"
                  arrow
                >
                  <Box
                    component="span"
                    sx={{
                      cursor: "help",
                      ml: 0.5,
                    }}
                  >
                    • {excludedCount} excluded
                  </Box>
                </Tooltip>
              )}
              {top10SharePct > 0 &&
                ` • Top 10 hold ${top10SharePct.toFixed(1)}%`}
              {medianBalance > 0 &&
                ` • Median balance: ${medianBalance.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })} Tokens`}
            </Typography>
          )}

          {(holders && holders.length > 0) && (
            <>

              <Box
                sx={{
                  ml: 0.75,
                  px: 1,
                  py: 0.35,
                  borderRadius: "12px",
                  border: "1px solid rgba(148,163,184,0.5)",
                  background: "rgba(15,23,42,0.9)",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <FormControlLabel
                  sx={{ m: 0 }}
                  label={<span style={{ fontSize: 12, opacity: 0.85 }}>{isLegacy ? "Token" : "Reputation"}</span>}
                  control={
                    <Switch
                      size="small"
                      checked={isLegacy}
                      onChange={(e) => toggleLegacy(e.target.checked)}
                    />
                  }
                />
              </Box>

              {/* CSV export actions */}
              <Tooltip title="Copy holders as CSV" arrow>
                <IconButton
                  size="small"
                  onClick={handleCopyCsv}
                  sx={{
                    ml: 0.5,
                    borderRadius: "10px",
                    border: "1px solid rgba(148,163,184,0.5)",
                    background: "rgba(15,23,42,0.9)",
                    "&:hover": {
                      background: "rgba(30,64,175,0.9)",
                      borderColor: "rgba(191,219,254,0.9)",
                    },
                  }}
                >
                  <DescriptionIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>

              <Tooltip title="Download holders CSV" arrow>
                <IconButton
                  size="small"
                  onClick={handleDownloadCsv}
                  sx={{
                    borderRadius: "10px",
                    border: "1px solid rgba(148,163,184,0.5)",
                    background: "rgba(15,23,42,0.9)",
                    "&:hover": {
                      background: "rgba(30,64,175,0.9)",
                      borderColor: "rgba(191,219,254,0.9)",
                    },
                  }}
                >
                  <DownloadIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>

              <Tooltip title="Show/Hide Randomizer" arrow>
                <IconButton
                  size="small"
                  onClick={() => setShowRandomizer((v) => !v)}
                  sx={{
                    borderRadius: "10px",
                    border: "1px solid rgba(148,163,184,0.5)",
                    background: "rgba(15,23,42,0.9)",
                    "&:hover": {
                      background: "rgba(30,64,175,0.9)",
                      borderColor: "rgba(191,219,254,0.9)",
                    },
                  }}
                >
                  <LoopIcon sx={{ fontSize: 16 }} />
                </IconButton>   
              </Tooltip> 

              </>
          )}
        </Box>
      </Box>

      {/* LEADERBOARD TABLE */}
      <Box sx={{ overflow: "auto" }}>
        <Box sx={{ width: "100%", display: "table", tableLayout: "fixed" }}>
          {loading ? (
            <Grid alignContent="center" sx={{ textAlign: "center", py: 4 }}>
              <CircularProgress color="inherit" />
            </Grid>
          ) : (
            <Paper
              elevation={0}
              sx={{
                background: "rgba(15,23,42,0.78)",
                borderRadius: "18px",
                border: "1px solid rgba(148,163,184,0.28)",
                overflow: "hidden",
              }}
            >
              <TableContainer
                component={Box}
                sx={{
                  background: "transparent",
                }}
              >
                <StyledTable
                  size="small"
                  aria-label="Vine Leaderboard Table"
                >
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: 56 }}>
                        <Typography variant="caption">#</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">Owner</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="caption">Amount</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="caption">
                          % of Supply
                        </Typography>
                      </TableCell>
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {pagedHolders && (
                      <>
                        {pagedHolders.map((item: any, index: number) => {
                            if (!item?.address) return null;

                            const rank = page * rowsPerPage + index + 1;

                            const rankBadgeColor =
                              rank === 1
                                ? "#facc15"
                                : rank === 2
                                ? "#e5e7eb"
                                : rank === 3
                                ? "#a855f7"
                                : null;

                            return (
                              <TableRow
                                key={index}
                                id={`holder-row-${item.address}`}
                                sx={{
                                  borderBottom: "none",
                                  "&:hover": {
                                    backgroundColor:
                                      "rgba(148,163,184,0.08)",
                                  },
                                  ...(highlightedAddress === item.address && {
                                    animation:
                                      "winnerRowPulse 1.4s ease-out",
                                    backgroundColor:
                                      "rgba(56,189,248,0.12)",
                                  }),
                                }}
                              >
                                {/* RANK + BADGE */}
                                <TableCell>
                                  <Box
                                    sx={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 0.75,
                                    }}
                                  >
                                    <Typography
                                      variant="caption"
                                      sx={{ opacity: 0.75 }}
                                    >
                                      {rank}
                                    </Typography>
                                    {rankBadgeColor && (
                                      <Box
                                        sx={{
                                          width: 10,
                                          height: 10,
                                          borderRadius: "50%",
                                          bgcolor: rankBadgeColor,
                                          boxShadow:
                                            "0 0 0 1px rgba(15,23,42,0.6)",
                                        }}
                                      />
                                    )}
                                  </Box>
                                </TableCell>

                                {/* OWNER */}
                                <TableCell>
                                  <Typography variant="body2">
                                    <CopyToClipboard
                                      text={item.address}
                                      onCopy={handleCopy}
                                    >
                                      <Button
                                        variant="text"
                                        color="inherit"
                                        sx={{
                                          borderRadius: "17px",
                                          textTransform: "none",
                                          px: 1.4,
                                          "&:hover .MuiSvgIcon-root": {
                                            opacity: 1,
                                          },
                                        }}
                                        onClick={() =>
                                          handleOpenWalletDrawer(
                                            item.address,
                                            rank
                                          )
                                        }
                                        endIcon={
                                          <FileCopyIcon
                                            sx={{
                                              color:
                                                "rgba(255,255,255,0.25)",
                                              opacity: 0,
                                              transition:
                                                "opacity 0.2s ease",
                                            }}
                                          />
                                        }
                                      >
                                        {shortenString(
                                          item.address,
                                          8,
                                          8
                                        )}
                                      </Button>
                                    </CopyToClipboard>
                                  </Typography>
                                </TableCell>

                                {/* AMOUNT */}
                                <TableCell align="right">
                                  <Typography variant="body2">
                                    {(
                                      item.balance /
                                      10 ** tokenInfo?.decimals
                                    ).toLocaleString()}
                                  </Typography>
                                </TableCell>

                                {/* % OF SUPPLY */}
                                <TableCell align="right">
                                  {tokenInfo?.supply &&
                                    (() => {
                                      const pct =
                                        (+item.balance /
                                          tokenInfo.supply) *
                                        100;
                                      const tier = getHolderTier(pct);

                                      return (
                                        <Box
                                          sx={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: 1,
                                            justifyContent: "flex-end",
                                          }}
                                        >
                                          <Typography variant="body2">
                                            {pct.toFixed(2)}%
                                          </Typography>
                                          <Box
                                            sx={{
                                              px: 1,
                                              py: 0.2,
                                              borderRadius: "999px",
                                              fontSize: "0.65rem",
                                              textTransform:
                                                "uppercase",
                                              letterSpacing: 0.6,
                                              backgroundColor:
                                                tier.color,
                                              color:
                                                "rgba(241,245,249,0.9)",
                                            }}
                                          >
                                            {tier.label}
                                          </Box>
                                        </Box>
                                      );
                                    })()}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                      </>
                    )}
                  </TableBody>

                  <TableFooter>
                    <TableRow>
                      <TablePagination
                        rowsPerPageOptions={[20]}
                        colSpan={4}
                        count={visibleHolders ? visibleHolders.length : 0}
                        rowsPerPage={rowsPerPage}
                        page={page}
                        SelectProps={{
                          inputProps: { "aria-label": "rows per page" },
                          native: true,
                        }}
                        onPageChange={handleChangePage}
                        onRowsPerPageChange={handleChangeRowsPerPage}
                        ActionsComponent={TablePaginationActions}
                      />
                    </TableRow>
                  </TableFooter>
                </StyledTable>
              </TableContainer>
            </Paper>
          )}
        </Box>
      </Box>

      {/* WALLET PROFILE DRAWER */}
      <Drawer
        anchor="right"
        open={!!selectedWallet}
        onClose={handleCloseWalletDrawer}
        ModalProps={{
          keepMounted: true,
          BackdropProps: {
            sx: {
              backgroundColor: "rgba(0,0,0,0.5)",
            },
          },
        }}
        PaperProps={{
          sx: {
            width: { xs: "100%", sm: 360 },
            background: "rgba(15,23,42,0.96)",
            borderLeft: "1px solid rgba(148,163,184,0.4)",
            backdropFilter: "blur(16px)",
            color: "white",
          },
        }}
      >
        <Box sx={{ p: 2.5 }}>
          <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1 }}>
            <IconButton
              onClick={handleCloseWalletDrawer}
              sx={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                color: "rgba(255,255,255,0.8)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                "&:hover": {
                  backgroundColor: "rgba(255,255,255,0.14)",
                  color: "white",
                },
                "& .MuiTouchRipple-root": {
                  borderRadius: "50%",
                },
              }}
            >
              ✕
            </IconButton>
          </Box>

          <Typography
            variant="overline"
            sx={{
              opacity: 0.7,
              letterSpacing: 1,
              textTransform: "uppercase",
            }}
          >
            Holder profile
          </Typography>

          {/* Address + rank */}
          <Box sx={{ mt: 1, mb: 2 }}>
            <CopyToClipboard
              text={selectedWallet || ""}
              onCopy={handleCopy}
            >
              <Button
                variant="outlined"
                color="inherit"
                size="small"
                fullWidth
                sx={{
                  justifyContent: "space-between",
                  borderRadius: "999px",
                  textTransform: "none",
                  borderColor: "rgba(148,163,184,0.7)",
                }}
              >
                <span>
                  {selectedWallet
                    ? shortenString(selectedWallet, 6, 8)
                    : ""}
                </span>
                <FileCopyIcon sx={{ fontSize: 16, opacity: 0.8 }} />
              </Button>
            </CopyToClipboard>

            {selectedRank != null && (
              <Typography
                variant="caption"
                sx={{ mt: 0.75, display: "block", opacity: 0.75 }}
              >
                Rank #{selectedRank}
              </Typography>
            )}
          </Box>

          <Divider
            sx={{ mb: 2, borderColor: "rgba(148,163,184,0.4)" }}
          />

          {/* Metrics */}
          {selectedHolder && tokenInfo && (
            <>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 1.5,
                  mb: 2,
                }}
              >
                <Box>
                  <Typography variant="caption" sx={{ opacity: 0.7 }}>
                    Balance
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{ fontWeight: 600 }}
                  >
                    {selectedBalance.toLocaleString()}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="caption" sx={{ opacity: 0.7 }}>
                    % of supply
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{ fontWeight: 600 }}
                  >
                    {selectedPct.toFixed(3)}%
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="caption" sx={{ opacity: 0.7 }}>
                    Tier
                  </Typography>
                  <Box
                    sx={{
                      mt: 0.4,
                      display: "inline-flex",
                      px: 1,
                      py: 0.2,
                      borderRadius: "999px",
                      fontSize: "0.7rem",
                      textTransform: "uppercase",
                      letterSpacing: 0.6,
                      backgroundColor: selectedTier?.color,
                      color: "rgba(241,245,249,0.95)",
                    }}
                  >
                    {selectedTier?.label}
                  </Box>
                </Box>

                <Box>
                  <Typography variant="caption" sx={{ opacity: 0.7 }}>
                    Draw chance
                  </Typography>
                  <Box
                    sx={{
                      mt: 0.4,
                      display: "inline-flex",
                      px: 1,
                      py: 0.2,
                      borderRadius: "999px",
                      fontSize: "0.7rem",
                      textTransform: "uppercase",
                      letterSpacing: 0.6,
                      backgroundColor: selectedTier?.color,
                      color: "rgba(241,245,249,0.95)",
                    }}
                  >
                    {drawChance.toFixed(4)}%
                  </Box>
                </Box>
              </Box>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 1.5,
                  mb: 2,
                }}
              >
                  <Box sx={{ gridColumn: "1 / -1" }}>
                    <Typography variant="caption" sx={{ opacity: 0.7 }}>
                      Reputation: 
                    </Typography>
                    <br/>
                    <Box
                      sx={{
                        display: "inline-flex",
                        fontSize: "0.7rem",
                        letterSpacing: 0.6,
                        backgroundColor: selectedTier?.color,
                        color: "rgba(241,245,249,0.95)",
                        width: "100%",
                      }}
                    >
                      <VineReputation
                        walletAddress={selectedWallet ?? null}
                        daoIdBase58={props.activeDaoIdBase58}
                        endpoint={rpcEndpoint}
                      />
                    </Box>
                  </Box>
                </Box>
              </>
          )}

          <Divider sx={{ mb: 2, borderColor: "rgba(148,163,184,0.4)" }} />

          {/* External Links */}
          {selectedWallet && (
            <Stack spacing={1.2} sx={{ mt: 2 }}>
              
              <Button
                variant="outlined"
                color="inherit"
                size="small"
                href={`/card/${props.activeDaoIdBase58}/${selectedWallet}`}
                target="_blank"
                rel="noreferrer"
                sx={{
                  borderRadius: "12px",
                  justifyContent: "space-between",
                  textTransform: "none",
                  px: 1.5,
                  py: 0.8,
                  background: "rgba(255,255,255,0.03)",
                  borderColor: "rgba(148,163,184,0.35)",
                  "&:hover": {
                    background: "rgba(255,255,255,0.07)",
                    borderColor: "rgba(255,255,255,0.6)",
                    transform: "translateY(-1px)",
                  },
                  transition: "all .18s ease",
                }}
              >
                Open public reputation card
              </Button>
              
              {/* Solscan */}
              <Button
                variant="outlined"
                color="inherit"
                size="small"
                href={`https://solscan.io/account/${selectedWallet}`}
                target="_blank"
                rel="noreferrer"
                sx={{
                  borderRadius: "12px",
                  justifyContent: "space-between",
                  textTransform: "none",
                  px: 1.5,
                  py: 0.8,
                  background: "rgba(255,255,255,0.03)",
                  borderColor: "rgba(148,163,184,0.35)",
                  "&:hover": {
                    background: "rgba(255,255,255,0.07)",
                    borderColor: "rgba(255,255,255,0.6)",
                    transform: "translateY(-1px)",
                  },
                  transition: "all .18s ease",
                }}
                endIcon={<OpenInNewIcon sx={{ fontSize: 15, opacity: 0.85 }} />}
              >
                View on Solscan
              </Button>

              {/* Governance.so */}
              <Button
                variant="outlined"
                color="inherit"
                size="small"
                href={`https://www.governance.so/profile/${selectedWallet}`}
                target="_blank"
                rel="noreferrer"
                sx={{
                  borderRadius: "12px",
                  justifyContent: "space-between",
                  textTransform: "none",
                  px: 1.5,
                  py: 0.8,
                  background: "rgba(255,255,255,0.03)",
                  borderColor: "rgba(148,163,184,0.35)",
                  "&:hover": {
                    background: "rgba(255,255,255,0.07)",
                    borderColor: "rgba(255,255,255,0.6)",
                    transform: "translateY(-1px)",
                  },
                  transition: "all .18s ease",
                }}
                endIcon={<OpenInNewIcon sx={{ fontSize: 15, opacity: 0.85 }} />}
              >
                View on Governance.so
              </Button>

            </Stack>
          )}
        </Box>
      </Drawer>

      <Snackbar
        open={isCopied}
        autoHideDuration={2000}
        onClose={handleCloseSnackbar}
      >
        <Alert onClose={handleCloseSnackbar} severity="success">
          Copied to clipboard!
        </Alert>
      </Snackbar>

      <Snackbar
        open={snapshotCopied}
        autoHideDuration={2000}
        onClose={() => setSnapshotCopied(false)}
      >
        <Alert
          onClose={() => setSnapshotCopied(false)}
          severity="success"
        >
          Snapshot copied to clipboard!
        </Alert>
      </Snackbar>

          <Snackbar
            open={markdownCopied}
            autoHideDuration={2000}
            onClose={() => setMarkdownCopied(false)}
          >
            <Alert onClose={() => setMarkdownCopied(false)} severity="success">
              Markdown copied!
            </Alert>
          </Snackbar>

      <Snackbar
        open={csvCopied}
        autoHideDuration={2000}
        onClose={() => setCsvCopied(false)}
      >
        <Alert
          onClose={() => setCsvCopied(false)}
          severity="success"
        >
          CSV copied!
        </Alert>
      </Snackbar>

      <Snackbar
        open={open}
        autoHideDuration={3000}
        onClose={handleClose}
        TransitionComponent={Zoom}
      >
        <Alert onClose={handleClose} severity="success">
          Operation randomizer successful!
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default TokenLeaderboard;
