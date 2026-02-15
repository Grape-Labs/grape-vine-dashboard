"use client";

import React, { FC, useEffect, useMemo, useRef, useState } from "react";
import { PublicKey, Connection } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { styled, useTheme } from "@mui/material/styles";
import moment from "moment";
import { CopyToClipboard } from "react-copy-to-clipboard";
import html2canvas from "html2canvas";
// @ts-ignore
//import confetti from "canvas-confetti";
import bs58 from "bs58";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

import {
  FormControlLabel, 
  Switch,
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
  Avatar,
  TextField,
} from "@mui/material";

import DownloadIcon from "@mui/icons-material/Download";
import LiveTvIcon from "@mui/icons-material/LiveTv";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import DescriptionIcon from "@mui/icons-material/Description";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ScreenshotMonitorIcon from "@mui/icons-material/ScreenshotMonitor";
import FileCopyIcon from "@mui/icons-material/FileCopy";
import HourglassBottomIcon from "@mui/icons-material/HourglassBottom";
import LoopIcon from "@mui/icons-material/Loop";
import FirstPageIcon from "@mui/icons-material/FirstPage";
import KeyboardArrowLeft from "@mui/icons-material/KeyboardArrowLeft";
import KeyboardArrowRight from "@mui/icons-material/KeyboardArrowRight";
import LastPageIcon from "@mui/icons-material/LastPage";

import { readRpcSettings, resolveRpcEndpoint } from "./utils/rpcSettings"; // adjust path
import { VINE_REP_PROGRAM_ID, getConfigPda, fetchReputationsForDaoSeason } from "@grapenpm/vine-reputation-client";

import VineReputation from "./VineReputation";

import {
  buildRepDistribution,
  percentileForRep,
  getReputationTier,
} from "./utils/vineReputation/tiers";

const StyledTable = styled(Table)(() => ({
  "& .MuiTableCell-root": {
    border: "none",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
  },
}));

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

  return (
    <Box sx={{ flexShrink: 0, ml: 2.5 }}>
      <IconButton onClick={(e) => onPageChange(e, 0)} disabled={page === 0} aria-label="first page">
        {theme.direction === "rtl" ? <LastPageIcon /> : <FirstPageIcon />}
      </IconButton>
      <IconButton onClick={(e) => onPageChange(e, page - 1)} disabled={page === 0} aria-label="previous page">
        {theme.direction === "rtl" ? <KeyboardArrowRight /> : <KeyboardArrowLeft />}
      </IconButton>
      <IconButton
        onClick={(e) => onPageChange(e, page + 1)}
        disabled={page >= Math.ceil(count / rowsPerPage) - 1}
        aria-label="next page"
      >
        {theme.direction === "rtl" ? <KeyboardArrowLeft /> : <KeyboardArrowRight />}
      </IconButton>
      <IconButton
        onClick={(e) => onPageChange(e, Math.max(0, Math.ceil(count / rowsPerPage) - 1))}
        disabled={page >= Math.ceil(count / rowsPerPage) - 1}
        aria-label="last page"
      >
        {theme.direction === "rtl" ? <FirstPageIcon /> : <LastPageIcon />}
      </IconButton>
    </Box>
  );
}

type ReputationLeaderboardProps = {
  programId: string;              // MAINNET mint (wallet discovery source)
  activeDaoIdBase58: string;      // DEVNET Vine DAO for reputation reads
  activeSeason?: number;          // OPTIONAL override; if omitted, use config.currentSeason
  endpoint?: string;              // OPTIONAL devnet endpoint override
  meta?: {
    name?: string;
    symbol?: string;
    description?: string;
    image?: string;
  } | null;
};

type HolderRow = { address: string; balance: string }; // balance is raw string
type WinnerEntry = { address: string; ts: string };

const BI_ZERO = BigInt(0);
const BI_EIGHT = BigInt(8);
const DEFAULT_DRAW_COUNT = 4;
const MIN_DRAW_COUNT = 1;
const MAX_DRAW_COUNT = 100;

function shortenString(input: string, startChars = 6, endChars = 6) {
  if (!input) return "";
  if (input.length <= startChars + endChars) return input;
  return `${input.slice(0, startChars)}...${input.slice(-endChars)}`;
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

// --- Anchor discriminator utils (cached) ---
async function sha256(u8: Uint8Array): Promise<Uint8Array> {
  const view = u8.byteOffset === 0 && u8.byteLength === u8.buffer.byteLength ? u8 : u8.slice();
  const hash = await crypto.subtle.digest("SHA-256", view as unknown as BufferSource);
  return new Uint8Array(hash);
}
async function anchorAccountDiscriminator(name: string): Promise<Uint8Array> {
  const preimage = new TextEncoder().encode(`account:${name}`);
  const hash = await sha256(preimage);
  return hash.slice(0, 8);
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
  for (let i = 7; i >= 0; i--) x = (x << BI_EIGHT) + BigInt(u8[off + i]);
  return x;
}

async function decodeConfigStrict(data: Uint8Array) {
  const disc = await anchorAccountDiscriminator("ReputationConfig");
  if (data.length < 113 || !u8eq(data.subarray(0, 8), disc)) return null;

  let o = 8;
  const version = data[o]; o += 1;
  // daoId (skip) + authority (skip) + repMint (skip)
  o += 32 + 32 + 32;

  const currentSeason = readU16LE(data, o); o += 2;
  const decayBps = readU16LE(data, o); o += 2;
  const bump = data[o];

  return { version, currentSeason, decayBps, bump };
}

async function decodeReputationStrict(data: Uint8Array) {
  const disc = await anchorAccountDiscriminator("Reputation");
  // needs ~92 bytes with dao included
  if (data.length < 92 || !u8eq(data.subarray(0, 8), disc)) return null;

  let o = 8;
  const version = data[o]; o += 1;

  // dao pubkey (NEW)
  const daoBytes = data.subarray(o, o + 32); o += 32;
  const dao = new PublicKey(daoBytes);

  // user pubkey
  const userBytes = data.subarray(o, o + 32); o += 32;
  const user = new PublicKey(userBytes);

  const season = readU16LE(data, o); o += 2;
  const points = readU64LE(data, o); o += 8;
  const lastUpdateSlot = readU64LE(data, o); o += 8;
  const bump = data[o];

  return { version, dao, user, season, points, lastUpdateSlot, bump };
}

const ReputationLeaderboard: FC<ReputationLeaderboardProps> = (props) => {
  const meta = props.meta || null;
  const rpcEndpoint = useRpcEndpoint();
  // mainnet: discover token holders
  const connection = useMemo(() => new Connection(rpcEndpoint, "confirmed"), [rpcEndpoint]);
  const token = useMemo(() => new PublicKey(props.programId), [props.programId]);

  // devnet: read reputation
  const repConn = useMemo(() => {
    const url = props.endpoint || rpcEndpoint;
    return new Connection(url, "confirmed");
  }, [props.endpoint, rpcEndpoint]);

  // --- STATE ---
  const [holders, setHolders] = useState<HolderRow[]>([]);
  const [loading, setLoading] = useState(true);

  // reputation data (current season)
  const [repSeason, setRepSeason] = useState<number | null>(null);
  const [repByWallet, setRepByWallet] = useState<Record<string, bigint>>({});
  const [repLoading, setRepLoading] = useState(false);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  // draw state
  const [loadingSpin, setLoadingSpin] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const [markdownCopied, setMarkdownCopied] = useState(false);
  const [snapshotCopied, setSnapshotCopied] = useState(false);

  const [streamMode, setStreamMode] = useState(false);
  const [showRandomizer, setShowRandomizer] = useState(false);

  const [highlightedAddress, setHighlightedAddress] = useState<string | null>(null);

  const isMobile = useMediaQuery("(max-width:600px)");

  // wallet drawer
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [selectedRank, setSelectedRank] = useState<number | null>(null);

  const [csvCopied, setCsvCopied] = useState(false);

  const [decayBps, setDecayBps] = useState<number | null>(null);

  // raffle
  const winnersRef = useRef<HTMLDivElement | null>(null);
  const [targetDrawCount, setTargetDrawCount] = useState<number>(DEFAULT_DRAW_COUNT);
  const [winner, setWinner] = useState<string>("");
  const [timestamp, setTimestamp] = useState<string>("");
  const [winners, setWinners] = useState<WinnerEntry[]>([]);
  const currentWinner = winners[winners.length - 1] ?? null;

  const winnerRef = useRef<string>("");
  useEffect(() => { winnerRef.current = winner; }, [winner]);

  const timeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current); }, []);

  const excludedWallets = [
    { address: "CBkJ9y9qRfYixCdSChqrVxYebgSEBCNbhnPk8GRdEtFk", reason: "Treasury" },
    { address: "6jEQpEnoSRPP8A2w6DWDQDpqrQTJvG4HinaugiBGtQKD", reason: "Governance Wallet" },
    { address: "AWaMVkukciGYPEpJbnmSXPJzVxuuMFz1gWYBkznJ2qbq", reason: "System" },
  ];
  const excludeArr = excludedWallets.map((w) => w.address);

  // --- LEADERBOARD STATS (token-side) ---
  const effectiveHolders = useMemo(
    () => holders.filter((h) => h?.address && !excludeArr.includes(h.address)),
    [holders, excludeArr]
  );
  const totalEffective = effectiveHolders.length;
  const excludedCount = holders.length - totalEffective;

  let top10SharePct = 0;
  let medianBalance = 0;

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

  function weightedPickByBigInt(
    entries: Array<{ address: string; weight: bigint }>,
    exclude: Set<string>
  ): string | null {
    const eligible = entries.filter((e) => !exclude.has(e.address) && e.weight > BI_ZERO);
    if (eligible.length === 0) return null;

    const total = eligible.reduce((acc, e) => acc + e.weight, BI_ZERO);
    if (total <= BI_ZERO) return null;

    // cryptographically strong-ish randomness not needed; Math.random ok for UI raffles
    // but we MUST map to bigint range safely:
    const r = BigInt(Math.floor(Math.random() * 1_000_000_000)); // 0..1e9-1
    const target = (total * r) / BigInt(1_000_000_000);

    let running = BI_ZERO;
    for (const e of eligible) {
      running += e.weight;
      if (running > target) return e.address;
    }
    return eligible[eligible.length - 1].address;
  }

  // --- Fetch current-season reputation for all holders ---
  type HolderRow = { address: string; balance: string }; // keep shape if you don’t want to refactor UI

  function u16ToLeBytes(n: number) {
    return new Uint8Array([n & 0xff, (n >> 8) & 0xff]);
  }

  const MAX_REP_ACCOUNTS = 10000; // cap like you did

useEffect(() => {
  if (!props.activeDaoIdBase58) return;

  let cancelled = false;

  (async () => {
    try {
      setLoading(true);
      setRepLoading(true);
      setHolders([]);
      setRepByWallet({});
      setRepSeason(null);

      const daoPk = new PublicKey(props.activeDaoIdBase58);

      // keep your existing config read (season + decayBps)
      const [configPda] = getConfigPda(daoPk);
      const cfgAi = await repConn.getAccountInfo(configPda, "confirmed");
      if (!cfgAi?.data) return;

      const cfg = await decodeConfigStrict(new Uint8Array(cfgAi.data));
      if (!cfg) return;

      setDecayBps(cfg.decayBps ?? null);

      const season =
        props.activeSeason && props.activeSeason > 0
          ? props.activeSeason
          : cfg.currentSeason;

      setRepSeason(season);

      // ✅ ONE call: package does filters + decode for you
      const repRows = await fetchReputationsForDaoSeason({
        conn: repConn,
        daoId: daoPk,
        season,
        programId: new PublicKey(VINE_REP_PROGRAM_ID), // or omit if helper default is fine
        commitment: "confirmed",
        limit: MAX_REP_ACCOUNTS,
      });

      if (cancelled) return;

      const out: Record<string, bigint> = {};
      const rows: HolderRow[] = [];

      for (const r of repRows as any[]) {
        const addr: string =
          typeof r.address === "string"
            ? r.address
            : r.user?.toBase58
            ? r.user.toBase58()
            : String(r.user); // last-resort

        if (!addr) continue;
        if (excludeArr.includes(addr)) continue;

        const points: bigint = (r.points ?? BI_ZERO) as bigint;

        out[addr] = points;
        rows.push({ address: addr, balance: "0" });
      }

      // de-dupe just in case
      const seen = new Set<string>();
      const uniqueRows = rows.filter((x) =>
        seen.has(x.address) ? false : (seen.add(x.address), true)
      );

      if (!cancelled) {
        setRepByWallet(out);
        setHolders(uniqueRows);
      }
    } catch (e) {
      console.error("[ReputationLeaderboard] rep-enum error", e);
      if (!cancelled) {
        setHolders([]);
        setRepByWallet({});
      }
    } finally {
      if (!cancelled) {
        setRepLoading(false);
        setLoading(false);
      }
    }
  })();

  return () => {
    cancelled = true;
  };
}, [repConn, props.activeDaoIdBase58, props.activeSeason]);

  // --- “reputation-first” sorted list ---
  const sortedRows = useMemo(() => {
    const eligible = holders.filter((h) => h?.address && !excludeArr.includes(h.address));

    // Sort: rep desc, then token balance desc as tie-breaker
    return [...eligible].sort((a, b) => {
      const ra = repByWallet[a.address] ?? BI_ZERO;
      const rb = repByWallet[b.address] ?? BI_ZERO;
      if (ra !== rb) return ra > rb ? -1 : 1;
      return 0;
    });
  }, [holders, repByWallet, excludeArr]);

  const repEntries = useMemo(
    () =>
      holders
        .filter((h) => h?.address)
        .map((h) => ({
          address: h.address,
          weight: repByWallet[h.address] ?? BI_ZERO,
        })),
    [holders, repByWallet]
  );

  const raffleEligibleCount = useMemo(
    () => repEntries.filter((e) => !excludeArr.includes(e.address) && e.weight > BI_ZERO).length,
    [repEntries, excludeArr]
  );

  const drawGoal = raffleEligibleCount > 0 ? Math.min(targetDrawCount, raffleEligibleCount) : targetDrawCount;
  const drawGoalCapped = raffleEligibleCount > 0 && targetDrawCount > raffleEligibleCount;
  const drawLimitReached = raffleEligibleCount > 0 && winners.length >= drawGoal;

  const handleDrawCountChange = (raw: string) => {
    const next = Number(raw);
    if (!Number.isFinite(next)) return;
    const clamped = Math.max(MIN_DRAW_COUNT, Math.min(MAX_DRAW_COUNT, Math.floor(next)));
    setTargetDrawCount(clamped);
  };

  const handleOpenWalletDrawer = (address: string, rank: number) => {
    setSelectedWallet(address);
    setSelectedRank(rank);
  };

  const handleCloseWalletDrawer = () => {
    setSelectedWallet(null);
    setSelectedRank(null);
  };

  const handleCloseSnackbar = () => setIsCopied(false);
  const handleCopy = () => setIsCopied(true);

  // --- DRAW: markdown + snapshot ---
  const buildWinnersMarkdown = () => {
    if (!winners || winners.length === 0) return "";
    const headerDate = moment(winners[0].ts).format("LLLL");

    let md = `### 🍇 Raffle Results\n`;
    md += `*${headerDate}*\n\n`;

    winners.forEach((w, idx) => {
      const safeTime = moment(w.ts).format("HH:mm:ss");
      md += `${idx + 1}. \`${w.address}\` — \`${safeTime}\`\n`;
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

  const handleCapture = async () => {
    if (!winnersRef.current) return;

    try {
      const element = winnersRef.current as HTMLElement;

      const canvas = await html2canvas(element, {
        backgroundColor: "#020617",
        scale: Math.max((window as any).devicePixelRatio || 2, 2),
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
            const item = new (window as any).ClipboardItem({ "image/png": blob });
            await (navigator as any).clipboard.write([item]);
            setSnapshotCopied(true);
          } catch (err) {
            console.error("Clipboard write failed, falling back to download:", err);
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `vine-raffle-winners-${timestamp || "vine-raffle-winners"}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          }
        } else {
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `vine-raffle-winners-${timestamp || "vine-raffle-winners"}.png`;
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

  // CSV: wallet,reputation
const buildHoldersCsv = () => {
  if (!sortedRows || sortedRows.length === 0) return "";

  const header = "wallet,reputation";

  const lines = sortedRows.map((h) => {
    const rep = repByWallet[h.address] ?? BI_ZERO;
    return `${h.address},${rep.toString(10)}`;
  });

  return [header, ...lines].join("\n");
};

const handleCopyCsv = async () => {
  const csv = buildHoldersCsv();
  if (!csv) return;

  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(csv);
    } else {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = csv;
      textarea.setAttribute("readonly", "true");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
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
  const csv = buildHoldersCsv();
  if (!csv) return;

  try {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `vine-reputation-leaderboard-season-${repSeason ?? "unknown"}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  } catch (e) {
    console.error("Failed to download CSV:", e);
  }
};

const handleGetRaffleSelection = () => {
  const exclude = new Set<string>([...excludeArr, ...winners.map((w) => w.address)]);

  const picked = weightedPickByBigInt(repEntries, exclude);

  if (picked) {
    setWinner(picked);
    setHighlightedAddress(picked);
    setTimeout(() => setHighlightedAddress(null), 2500);
  } else {
    console.warn("No eligible wallets left to draw (rep-weighted).");
  }
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
          colors: ["#8A2BE2", "#C084FC", "#00FFA3", "#03E1FF", "#FFFFFF"],
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
            origin: { x: randomInRange(0.15, 0.35), y: randomInRange(0.15, 0.35) },
          });
          confetti({
            ...defaults,
            particleCount,
            origin: { x: randomInRange(0.65, 0.85), y: randomInRange(0.15, 0.35) },
          });
        }, 180);
      })
      .catch(() => {});
  };
  

  // SPIN LOGIC with roulette effect
  const spinRoulette = () => {
    if (loadingSpin || drawLimitReached || raffleEligibleCount === 0) return;

    const alreadyWon = new Set(winners.map((w) => w.address));
    const remainingEligible = holders.filter(
      (h) =>
        h?.address &&
        !excludeArr.includes(h.address) &&
        !alreadyWon.has(h.address) &&
        (repByWallet[h.address] ?? BI_ZERO) > BI_ZERO
    );

    if (remainingEligible.length === 0 || drawLimitReached) {
      console.warn("No more eligible wallets to draw.");
      return;
    }

    const interval = 100;
    const spins = 30;
    let spinCount = 0;

    setLoadingSpin(true);
    setTimestamp("");

    const spinIteration = () => {
      handleGetRaffleSelection();
      spinCount++;

      if (spinCount < spins) {
        timeoutIdRef.current = setTimeout(spinIteration, interval);
      } else {
        const finalTs = moment().toString();
        setTimestamp(finalTs);

        setWinners((prev) => [...prev, { address: winnerRef.current, ts: finalTs }]);
        setLoadingSpin(false);
        setOpen(true);
        fireConfetti();
        timeoutIdRef.current = null;
      }
    };

    spinIteration();
  };

  const handleResetRaffle = () => {
    if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
    timeoutIdRef.current = null;

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

    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Spacebar" || e.key === "Enter") {
        e.preventDefault();
        spinRoulette();
      }
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        handleResetRaffle();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setStreamMode(false);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamMode, winners.length, loadingSpin]);

  useEffect(() => {
    if (!streamMode) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [streamMode]);

  // --- Selected wallet derived info ---
  const selectedRep = selectedWallet ? (repByWallet[selectedWallet] ?? BI_ZERO) : BI_ZERO;

  // pill content
  const pillHasWinner = loadingSpin ? !!winner : !!currentWinner || !!winner;
  const pillAddress = loadingSpin ? winner : currentWinner?.address || winner;
  const pillTimestamp = !loadingSpin ? currentWinner?.ts || timestamp : null;

  const totalRepPool = useMemo(() => {
    return holders
      .filter((h) => h?.address && !excludeArr.includes(h.address))
      .reduce((acc, h) => acc + (repByWallet[h.address] ?? BI_ZERO), BI_ZERO);
  }, [holders, repByWallet, excludeArr]);

  const repStats = useMemo(() => {
    const eligible = holders.filter((h) => h?.address && !excludeArr.includes(h.address));
    const eligibleCount = eligible.length;

    const repsAll = eligible.map((h) => repByWallet[h.address] ?? BI_ZERO);
    const active = repsAll.filter((v) => v > BI_ZERO);

    const activeCount = active.length;
    const participationRate = eligibleCount > 0 ? (activeCount / eligibleCount) * 100 : 0;

    // sort ascending for median / quantiles
    const activeAsc = [...active].sort((a, b) => (a === b ? 0 : a < b ? -1 : 1));

    const medianActive = (() => {
      if (activeAsc.length === 0) return BI_ZERO;
      const mid = Math.floor(activeAsc.length / 2);
      if (activeAsc.length % 2 === 1) return activeAsc[mid];
      // even: average (bigint-safe)
      return (activeAsc[mid - 1] + activeAsc[mid]) / BigInt(2);
    })();

    const q = (p: number) => {
      if (activeAsc.length === 0) return BI_ZERO;
      const idx = Math.min(activeAsc.length - 1, Math.max(0, Math.floor(p * (activeAsc.length - 1))));
      return activeAsc[idx];
    };

    const p90 = q(0.9);
    const top10Threshold = q(0.9); // same thing phrased differently

    return {
      eligibleCount,
      activeCount,
      participationRate,
      totalPool: totalRepPool,
      medianActive,
      p90,
      top10Threshold,
    };
  }, [holders, repByWallet, excludeArr, totalRepPool]);

  const selectedDrawChancePct = useMemo(() => {
    if (!selectedWallet) return null;
    if (totalRepPool <= BI_ZERO) return null;

    const rep = repByWallet[selectedWallet] ?? BI_ZERO;
    if (rep <= BI_ZERO) return 0;

    // percentage with 2 decimals
    const pct = Number((rep * BigInt(10_000)) / totalRepPool) / 100;
    return pct;
  }, [selectedWallet, repByWallet, totalRepPool]);

  const repValuesSorted = useMemo(() => {
    const vals = holders
      .filter((h) => h?.address && !excludeArr.includes(h.address))
      .map((h) => repByWallet[h.address] ?? BI_ZERO);

    // Sort descending
    vals.sort((a, b) => (a === b ? 0 : a > b ? -1 : 1));
    return vals;
  }, [holders, repByWallet, excludeArr]);

  function percentileForRep(rep: bigint, sortedDesc: bigint[]) {
    if (!sortedDesc.length) return null;

    // Find first index where value <= rep (descending)
    // (simple linear scan is fine for a few thousand; can binary search later)
    let idx = 0;
    while (idx < sortedDesc.length && sortedDesc[idx] > rep) idx++;

    // idx=0 => top, idx=end => bottom
    const pct = 1 - idx / sortedDesc.length; // 0..1 where 1 = top
    return pct;
  }

  const repDist = useMemo(() => {
    return buildRepDistribution(repByWallet, { includeZeros: false });
  }, [repByWallet]);

  const selectedPct = useMemo(() => {
    if (!selectedWallet) return null;
    const rep = repByWallet[selectedWallet] ?? BI_ZERO;
    return percentileForRep(rep, repDist); // ✅ use repDist
  }, [selectedWallet, repByWallet, repDist]);

  const selectedTier = useMemo(() => {
    return getReputationTier(selectedRep, repDist);
  }, [selectedRep, repDist]);

  return (
    <Box sx={{ flexGrow: 1, border: "none" }}>
      {/* STREAM MODE */}
      {streamMode && (
        <Box
          sx={{
            position: "fixed",
            inset: 0,
            width: "100vw",
            height: "100dvh",
            maxHeight: "100dvh",
            zIndex: 1400,
            background: "radial-gradient(circle at top, #020617 0%, #020617 40%, #020617 100%)",
            color: "#e5e7eb",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start",
            p: { xs: 1.5, md: 3 },
            overflowY: "auto",
            overflowX: "hidden",
            gap: 1.25,
          }}
        >
          <Box
            sx={{
              position: "sticky",
              top: 0,
              zIndex: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "min(1100px, 100%)",
              py: 0.75,
              px: 1,
              borderRadius: "12px",
              background: "rgba(2,6,23,0.68)",
              backdropFilter: "blur(8px)",
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Live Draw
            </Typography>

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
              minWidth: { xs: 0, sm: 360 },
              width: { xs: "100%", sm: "auto" },
              maxWidth: "min(100%, 900px)",
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
            <Typography
              variant="h5"
              sx={{
                fontFamily: "monospace",
                letterSpacing: 1,
                opacity: pillAddress ? 0.95 : 0.55,
              }}
            >
              {pillAddress
                ? isMobile
                  ? shortenString(pillAddress, 8, 8)
                  : pillAddress
                : loadingSpin
                ? "Drawing winner…"
                : "Ready to draw"}
            </Typography>
          </Box>

          {/* Winners list in stream mode */}
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
                width: "min(100%, 800px)",
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
                <Typography variant="subtitle1" sx={{ letterSpacing: 1.2, textTransform: "uppercase" }}>
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
                      idx === winners.length - 1 ? "none" : "1px dashed rgba(75,85,99,0.7)",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Typography variant="body1" sx={{ width: 26, opacity: 0.75, textAlign: "right" }}>
                      {idx + 1}.
                    </Typography>
                    <Typography variant="body1" sx={{ fontFamily: "monospace", letterSpacing: 0.4 }}>
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

          <Box
            sx={{
              position: "sticky",
              bottom: 0,
              zIndex: 2,
              display: "flex",
              justifyContent: "space-between",
              alignItems: { xs: "stretch", md: "center" },
              flexDirection: { xs: "column", md: "row" },
              width: "min(1100px, 100%)",
              gap: 1,
              p: 1,
              borderRadius: "12px",
              background: "rgba(2,6,23,0.72)",
              backdropFilter: "blur(8px)",
            }}
          >
            <Typography variant="caption" sx={{ opacity: 0.65 }}>
              Draws: {winners.length}/{drawGoal} • Eligible: {raffleEligibleCount}
              {drawGoalCapped ? " (capped by eligibility)" : ""} • Chance ∝ reputation points
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
                disabled={loadingSpin || drawLimitReached || repLoading || raffleEligibleCount === 0}
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
                {loadingSpin ? <HourglassBottomIcon sx={{ mr: 1 }} fontSize="small" /> : <LoopIcon sx={{ mr: 1 }} fontSize="small" />}
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

      {/* REPUTATION SUMMARY */}
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
        {/* Optional meta header */}
        {meta?.name || meta?.image ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            {meta?.image ? (
              <Avatar src={meta.image} sx={{ width: 36, height: 36 }} />
            ) : (
              <Avatar sx={{ width: 36, height: 36 }}>{(meta?.symbol || "V")[0]}</Avatar>
            )}
            <Box sx={{ textAlign: "right" }}>
              <Typography variant="subtitle1" sx={{ lineHeight: 1.1 }}>
                {meta?.name ?? "Reputation Leaderboard"}
                {meta?.symbol ? ` • ${meta.symbol}` : ""}
              </Typography>
              {meta?.description ? (
                <Typography variant="caption" sx={{ opacity: 0.75 }}>
                  {meta.description}
                </Typography>
              ) : null}
            </Box>
          </Box>
        ) : null}

        {/* DAO address copy pill */}
        <CopyToClipboard text={props.activeDaoIdBase58} onCopy={handleCopy}>
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
            <Typography variant="body2" sx={{ fontWeight: 500, opacity: 0.9 }}>
              {shortenString(props.activeDaoIdBase58, 8, 8)}
            </Typography>
          </Box>
        </CopyToClipboard>

        
        <Box
          sx={{
            px: 1,
            py: 0.6,
            borderRadius: "12px",
            background: "rgba(15,23,42,0.28)",
            border: "1px solid rgba(148,163,184,0.14)",
            backdropFilter: "blur(8px)",
            ml: "auto",
          }}
        >
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 1,
            }}
          >
            {[
              { label: "Season", value: repSeason ?? "—" },
              { label: "Eligible", value: repStats.eligibleCount.toLocaleString() },
              {
                label: "Active",
                value: `${repStats.activeCount.toLocaleString()} (${repStats.participationRate.toFixed(0)}%)`,
                primary: true,
              },
              { label: "Pool", value: formatBigInt(repStats.totalPool) },
              { label: "Median", value: formatBigInt(repStats.medianActive) },
              { label: "Top 10%", value: `≥ ${formatBigInt(repStats.top10Threshold)}` },
              ...(decayBps != null
                ? [{ label: "Decay", value: `${(decayBps / 100).toFixed(2)}%` }]
                : []),
            ].map(({ label, value, primary }, i) => (
              <Box
                key={i}
                sx={{
                  display: "inline-flex",
                  alignItems: "baseline",
                  gap: 0.35,
                  whiteSpace: "nowrap",
                  opacity: primary ? 1 : 0.85,
                }}
              >
                <Typography
                  sx={{
                    fontSize: "9.5px",
                    letterSpacing: 0.7,
                    textTransform: "uppercase",
                    opacity: primary ? 0.7 : 0.5,
                  }}
                >
                  {label}
                </Typography>

                <Typography
                  sx={{
                    fontSize: primary ? "0.82rem" : "0.78rem",
                    fontWeight: primary ? 800 : 600,
                    fontFeatureSettings: '"tnum" 1',
                    opacity: 0.95,
                  }}
                >
                  {String(value)}
                </Typography>

                {/* soft separator */}
                <Box
                  sx={{
                    width: 1,
                    height: 12,
                    bgcolor: "rgba(148,163,184,0.18)",
                    mx: 0.6,
                    display: i === 6 ? "none" : "block",
                  }}
                />
              </Box>
            ))}
          </Box>
        </Box>

      </Box>

      {/* HEADER */}
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
        <Box>
          <Typography variant="h5">Reputation Leaderboard</Typography>
          <Typography variant="caption" sx={{ opacity: 0.75 }}>
            Season: {repSeason ?? "—"} {repLoading ? "• loading…" : ""}
          </Typography>

          {/*repStats.eligibleCount > 0 && (
            <Typography variant="caption" sx={{ opacity: 0.65, display: "block", mt: 0.25 }}>
              {repStats.eligibleCount.toLocaleString()} eligible
              {excludedCount > 0 ? ` • ${excludedCount} excluded` : ""}
              {` • ${repStats.activeCount.toLocaleString()} active`}
              {` • Median(active): ${formatBigInt(repStats.medianActive)}`}
              {` • Top 10% ≥ ${formatBigInt(repStats.top10Threshold)}`}
            </Typography>
          )*/}
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          
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
          
          {holders.length > 0 && (
            <>
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
                  }}
                >
                  <LoopIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Box>
      </Box>

      {/* RANDOMIZER (WITH DRAW LIST + COPY IMAGE + COPY MARKDOWN) */}
      {!loading && showRandomizer && (
        <Collapse in={showRandomizer} timeout={220} unmountOnExit>
          <Box
            sx={{
              m: 2,
              p: 2.5,
              borderRadius: "20px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              backdropFilter: "blur(12px)",
              boxShadow: loadingSpin ? "0 0 18px rgba(0,200,255,0.25)" : "0 0 8px rgba(0,0,0,0.4)",
              transition: "0.3s ease",
              position: "relative",
              overflow: "hidden",
            }}
          >
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

            <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", mb: 1.5, gap: 1 }}>
              <Tooltip
                title="Chance to be drawn is proportional to points. P(win) = points / totalEligiblePoints"
                arrow
              >
                <Typography variant="subtitle2" sx={{ opacity: 0.9, cursor: "help" }}>
                  Randomizer
                </Typography>
              </Tooltip>

              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, opacity: 0.85, fontSize: "0.75rem" }}>
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
            </Box>

            {/* Winner pill + actions */}
            {pillHasWinner && pillAddress && (
              <Fade in timeout={450}>
                <Box sx={{ textAlign: "center", mb: 2 }}>
                  <Box
                    key={(loadingSpin ? "spin-" : "final-") + (pillAddress || "")}
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
                    <CopyToClipboard text={pillAddress} onCopy={handleCopy}>
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
                          "&:hover": { background: "rgba(255,255,255,0.05)" },
                        }}
                        startIcon={<FileCopyIcon fontSize="small" />}
                      >
                        {isMobile ? shortenString(pillAddress, 8, 8) : pillAddress}
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
                          <IconButton sx={{ color: "white", mr: 0.2 }} onClick={handleCapture}>
                            <ScreenshotMonitorIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Copy winners as Markdown (for Discord/notes)">
                          <IconButton sx={{ color: "white", mr: 0.2 }} onClick={handleCopyWinnersMarkdown}>
                            <DescriptionIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>

                        <Typography variant="caption" sx={{ opacity: 0.8, whiteSpace: "nowrap" }}>
                          {moment(pillTimestamp).format("LLLL")}
                        </Typography>
                      </Box>
                    </Fade>
                  )}
                </Box>
              </Fade>
            )}

            {/* WINNERS SNAPSHOT AREA (target for html2canvas) */}
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
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", mb: 1.5 }}>
                  <Typography variant="subtitle2" sx={{ letterSpacing: 0.6, textTransform: "uppercase" }}>
                    The Vine List
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    {moment(winners[0].ts).format("LL")}
                  </Typography>
                </Box>

                <Box sx={{ mt: 0.5 }}>
                  {winners.map((w, idx) => (
                    <Box
                      key={`${w.address}-${w.ts}`}
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        py: 0.5,
                        borderBottom: idx === winners.length - 1 ? "none" : "1px dashed rgba(75,85,99,0.6)",
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            lineHeight: 2,
                            fontFamily:
                              '"Roboto Mono","SFMono-Regular",ui-monospace,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace',
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            pr: 1.5,
                          }}
                        >
                          <span style={{ opacity: 0.8, minWidth: 18 }}>{idx + 1}.</span>
                          <span>{isMobile ? shortenString(w.address, 6, 6) : w.address}</span>

                          <CopyToClipboard text={w.address} onCopy={handleCopy}>
                            <IconButton
                              size="small"
                              sx={{
                                color: "rgba(248,250,252,0.85)",
                                p: 0.3,
                                "&:hover": { backgroundColor: "rgba(148,163,184,0.25)" },
                              }}
                            >
                              <FileCopyIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                          </CopyToClipboard>
                        </Typography>
                      </Box>

                      <Typography
                        variant="caption"
                        sx={{ opacity: 0.8, fontFeatureSettings: '"tnum" 1', ml: 1, flexShrink: 0 }}
                      >
                        {moment(w.ts).format("HH:mm:ss")}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {/* Controls */}
            <Box sx={{ display: "flex", gap: 1, mt: 2, alignItems: "center", flexWrap: "wrap" }}>
              <TextField
                size="small"
                type="number"
                value={targetDrawCount}
                onChange={(e) => handleDrawCountChange(e.target.value)}
                inputProps={{ min: MIN_DRAW_COUNT, max: MAX_DRAW_COUNT, step: 1, "aria-label": "target draws" }}
                sx={{
                  width: 92,
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
                }}
              >
                {loadingSpin ? <HourglassBottomIcon sx={{ mr: 1 }} fontSize="small" /> : <LoopIcon sx={{ mr: 1 }} fontSize="small" />}
                {raffleEligibleCount === 0
                  ? "No eligible wallets"
                  : drawLimitReached
                  ? "All winners drawn"
                  : "Draw"}
              </Button>

              {winners.length > 0 && (
                <Button
                  onClick={handleResetRaffle}
                  size="small"
                  variant="text"
                  sx={{
                    textTransform: "none",
                    opacity: 0.7,
                    "&:hover": { opacity: 1, textDecoration: "underline" },
                  }}
                >
                  Reset
                </Button>
              )}

              <Box sx={{ flex: 1 }} />

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
          </Box>
        </Collapse>
      )}

      {/* TABLE */}
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
              <TableContainer component={Box} sx={{ background: "transparent" }}>
                <StyledTable size="small" aria-label="Vine Reputation Leaderboard Table">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: 56 }}><Typography variant="caption">#</Typography></TableCell>
                      <TableCell><Typography variant="caption">Owner</Typography></TableCell>
                      <TableCell align="right"><Typography variant="caption">Reputation</Typography></TableCell>
                      <TableCell align="right"><Typography variant="caption">Status</Typography></TableCell>
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {(rowsPerPage > 0
                      ? sortedRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                      : sortedRows
                    ).map((item: HolderRow, index: number) => {
                      const rank = page * rowsPerPage + index + 1;
                      const rep = repByWallet[item.address] ?? BI_ZERO;
                      const tier = getReputationTier(rep, repDist);
                      const pct = percentileForRep(rep, repValuesSorted);
                      
                      
                      const rankBadgeColor =
                        rank === 1 ? "#facc15" : rank === 2 ? "#e5e7eb" : rank === 3 ? "#a855f7" : null;

                      return (
                        <TableRow
                          key={`${item.address}-${rank}`}
                          id={`holder-row-${item.address}`}
                          sx={{
                            borderBottom: "none",
                            "&:hover": { backgroundColor: "rgba(148,163,184,0.08)" },
                            ...(highlightedAddress === item.address && {
                              animation: "winnerRowPulse 1.4s ease-out",
                              backgroundColor: "rgba(56,189,248,0.12)",
                            }),
                          }}
                        >
                          <TableCell>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                              <Typography variant="caption" sx={{ opacity: 0.75 }}>{rank}</Typography>
                              {rankBadgeColor && (
                                <Box
                                  sx={{
                                    width: 10,
                                    height: 10,
                                    borderRadius: "50%",
                                    bgcolor: rankBadgeColor,
                                    boxShadow: "0 0 0 1px rgba(15,23,42,0.6)",
                                  }}
                                />
                              )}
                            </Box>
                          </TableCell>

                          <TableCell>
                            <Typography variant="body2">
                              <CopyToClipboard text={item.address} onCopy={handleCopy}>
                                <Button
                                  variant="text"
                                  color="inherit"
                                  sx={{
                                    borderRadius: "17px",
                                    textTransform: "none",
                                    px: 1.4,
                                    "&:hover .MuiSvgIcon-root": { opacity: 1 },
                                  }}
                                  onClick={() => handleOpenWalletDrawer(item.address, rank)}
                                  endIcon={
                                    <FileCopyIcon
                                      sx={{
                                        color: "rgba(255,255,255,0.25)",
                                        opacity: 0,
                                        transition: "opacity 0.2s ease",
                                      }}
                                    />
                                  }
                                >
                                  {shortenString(item.address, 8, 8)}
                                </Button>
                              </CopyToClipboard>
                            </Typography>
                          </TableCell>

                          {/* Reputation */}
                          <TableCell align="right">
                            {repLoading ? (
                              <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
                                <CircularProgress size={14} />
                              </Box>
                            ) : (
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                {formatBigInt(rep)}
                              </Typography>
                            )}
                          </TableCell>

                          <TableCell align="right">
                            <Box
                              sx={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "flex-end",
                                gap: 1,
                                minWidth: 0,
                              }}
                            >
                              {/* Optional “Top x%” */}
                              {rep > BI_ZERO && pct != null && (
                                <Typography variant="caption" sx={{ opacity: 0.7, whiteSpace: "nowrap" }}>
                                  Top {(pct * 100).toFixed(1)}%
                                </Typography>
                              )}

                              {/* Tier badge */}
                              <Box
                                sx={{
                                  px: 1,
                                  py: 0.2,
                                  borderRadius: "999px",
                                  fontSize: "0.65rem",
                                  textTransform: "uppercase",
                                  letterSpacing: 0.6,
                                  backgroundColor: tier.tone,
                                  color: "rgba(241,245,249,0.9)",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {tier.label}
                              </Box>
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>

                  <TableFooter>
                    <TableRow>
                      <TablePagination
                        rowsPerPageOptions={[20]}
                        colSpan={5}
                        count={sortedRows.length}
                        rowsPerPage={rowsPerPage}
                        page={page}
                        SelectProps={{ inputProps: { "aria-label": "rows per page" }, native: true }}
                        onPageChange={(_, newPage) => setPage(newPage)}
                        onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
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
          BackdropProps: { sx: { backgroundColor: "rgba(0,0,0,0.5)" } },
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
                "&:hover": { backgroundColor: "rgba(255,255,255,0.14)", color: "white" },
              }}
            >
              ✕
            </IconButton>
          </Box>

          <Typography variant="overline" sx={{ opacity: 0.7, letterSpacing: 1, textTransform: "uppercase" }}>
            Holder profile
          </Typography>

          <Box sx={{ mt: 1, mb: 2 }}>
            <CopyToClipboard text={selectedWallet || ""} onCopy={handleCopy}>
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
                <span>{selectedWallet ? shortenString(selectedWallet, 6, 8) : ""}</span>
                <FileCopyIcon sx={{ fontSize: 16, opacity: 0.8 }} />
              </Button>
            </CopyToClipboard>

            {selectedRank != null && (
              <Typography variant="caption" sx={{ mt: 0.75, display: "block", opacity: 0.75 }}>
                Rank #{selectedRank}
              </Typography>
            )}
          </Box>

          <Divider sx={{ mb: 2, borderColor: "rgba(148,163,184,0.4)" }} />

          {/* Quick metrics */}
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5, mb: 2 }}>
            <Box>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>Current season rep</Typography>
              <Typography variant="body1" sx={{ fontWeight: 800 }}>
                {repLoading ? "…" : formatBigInt(selectedRep)}
              </Typography>
            </Box>

            <Box>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>Season</Typography>
              <Typography variant="body1" sx={{ fontWeight: 800 }}>
                {repSeason ?? "—"}
              </Typography>
            </Box>

            <Box>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                Draw chance
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 800 }}>
                {repLoading || selectedDrawChancePct == null
                  ? "—"
                  : `${selectedDrawChancePct.toFixed(2)}%`}
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
                  backgroundColor: selectedTier.tone,
                  color: "rgba(241,245,249,0.95)",
                }}
              >
                {selectedTier.label}
              </Box>

              {selectedPct != null && (
                <Typography variant="caption" sx={{ display: "block", opacity: 0.65, mt: 0.5 }}>
                  Top {(selectedPct * 100).toFixed(1)}%
                </Typography>
              )}
            </Box>
          </Box>

          {/* Full reputation panel (your existing component) */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" sx={{ opacity: 0.7 }}>Reputation history</Typography>
            <Box sx={{ mt: 1 }}>
              <VineReputation
                walletAddress={selectedWallet ?? null}
                daoIdBase58={props.activeDaoIdBase58}
                endpoint={rpcEndpoint}
              />
            </Box>
          </Box>

          <Divider sx={{ mb: 2, borderColor: "rgba(148,163,184,0.4)" }} />

          {selectedWallet && (
            <Stack spacing={1.2} sx={{ mt: 2 }}>
              <Button
                variant="outlined"
                color="inherit"
                size="small"
                href={`/card/${props.activeDaoIdBase58}/${selectedWallet}`}
                target="_blank"
                rel="noreferrer"
                sx={{ borderRadius: "12px", justifyContent: "space-between", textTransform: "none" }}
              >
                Open public reputation card
              </Button>

              <Button
                variant="outlined"
                color="inherit"
                size="small"
                href={`https://solscan.io/account/${selectedWallet}`}
                target="_blank"
                rel="noreferrer"
                sx={{ borderRadius: "12px", justifyContent: "space-between", textTransform: "none" }}
                endIcon={<OpenInNewIcon sx={{ fontSize: 15, opacity: 0.85 }} />}
              >
                View on Solscan
              </Button>

              <Button
                variant="outlined"
                color="inherit"
                size="small"
                href={`https://www.governance.so/profile/${selectedWallet}`}
                target="_blank"
                rel="noreferrer"
                sx={{ borderRadius: "12px", justifyContent: "space-between", textTransform: "none" }}
                endIcon={<OpenInNewIcon sx={{ fontSize: 15, opacity: 0.85 }} />}
              >
                View on Governance.so
              </Button>
            </Stack>
          )}
        </Box>
      </Drawer>

      {/* Snackbars */}
      <Snackbar open={isCopied} autoHideDuration={2000} onClose={handleCloseSnackbar}>
        <Alert onClose={handleCloseSnackbar} severity="success">Copied to clipboard!</Alert>
      </Snackbar>

      <Snackbar open={snapshotCopied} autoHideDuration={2000} onClose={() => setSnapshotCopied(false)}>
        <Alert onClose={() => setSnapshotCopied(false)} severity="success">
          Snapshot copied to clipboard!
        </Alert>
      </Snackbar>

      <Snackbar open={markdownCopied} autoHideDuration={2000} onClose={() => setMarkdownCopied(false)}>
        <Alert onClose={() => setMarkdownCopied(false)} severity="success">
          Markdown copied!
        </Alert>
      </Snackbar>

      <Snackbar
        open={csvCopied}
        autoHideDuration={2000}
        onClose={() => setCsvCopied(false)}
      >
        <Alert onClose={() => setCsvCopied(false)} severity="success">
          CSV copied!
        </Alert>
      </Snackbar>

      <Snackbar open={open} autoHideDuration={3000} onClose={() => setOpen(false)} TransitionComponent={Zoom}>
        <Alert onClose={() => setOpen(false)} severity="success">
          Operation randomizer successful!
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ReputationLeaderboard;
