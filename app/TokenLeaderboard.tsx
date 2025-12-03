// Import necessary modules and components from libraries
import { FC, useEffect, useState, useRef } from "react";
import { PublicKey, Connection } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { GRAPE_RPC_ENDPOINT } from "./constants";
import { styled, useTheme } from "@mui/material/styles";
import moment from "moment";
import { CopyToClipboard } from 'react-copy-to-clipboard';
import html2canvas from 'html2canvas';
// @ts-ignore
import confetti from "canvas-confetti";

import {
  Paper,
  Grid,
  Box,
  Divider,
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
  Drawer,          // ← add
} from "@mui/material";

import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ScreenshotMonitorIcon from '@mui/icons-material/ScreenshotMonitor';
import FileCopyIcon from '@mui/icons-material/FileCopy';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import LoopIcon from '@mui/icons-material/Loop';
import FirstPageIcon from "@mui/icons-material/FirstPage";
import KeyboardArrowLeft from "@mui/icons-material/KeyboardArrowLeft";
import KeyboardArrowRight from "@mui/icons-material/KeyboardArrowRight";
import LastPageIcon from "@mui/icons-material/LastPage";
import {
  weightedRandomChoice,
  formatAmount,
  getFormattedNumberToLocale,
} from "./utils/grapeTools/helpers";

const StyledTable = styled(Table)(({ theme }) => ({
  "& .MuiTableCell-root": {
    border:"none",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
  },
}));

function TablePaginationActions(props: any) {
  const theme = useTheme();
  const { count, page, rowsPerPage, onPageChange } = props;

  const handleFirstPageButtonClick = (event:any) => {
    onPageChange(event, 0);
  };

  const handleBackButtonClick = (event:any) => {
    onPageChange(event, page - 1);
  };

  const handleNextButtonClick = (event:any) => {
    onPageChange(event, page + 1);
  };

  const handleLastPageButtonClick = (event:any) => {
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
const TokenLeaderboard: FC<{ programId: string }> = (props) => {
  const connection = new Connection(GRAPE_RPC_ENDPOINT);
  const token = new PublicKey(props.programId);

  // --- STATE ---
  const [tokenInfo, setTokenInfo] = useState<any | null>(null);
  const [totalTokensHeld, setTotalTokensHeld] = useState(0);
  const [holders, setHolders] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [winner, setWinner] = useState("");
  const [loadingSpin, setLoadingSpin] = useState(false);
  const [timestamp, setTimestamp] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const componentRef = useRef(null);
  const [open, setOpen] = useState(false);

  const [highlightedAddress, setHighlightedAddress] = useState<string | null>(null);
  const [snapshotCopied, setSnapshotCopied] = useState(false);

  const isMobile = useMediaQuery("(max-width:600px)");

  // NEW: wallet drawer state
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [selectedRank, setSelectedRank] = useState<number | null>(null);

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
  const excludeArr = excludedWallets.map(w => w.address);

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
  if (!componentRef.current) return;

  try {
    const element = componentRef.current as HTMLElement;

    const canvas = await html2canvas(element, {
      backgroundColor: null, // preserve transparent / gradient BG
      scale: 2,              // higher-res snapshot
    });

    // Convert to Blob
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
          setSnapshotCopied(true); // show snackbar that it was copied
        } catch (err) {
          console.error("Clipboard write failed, falling back to download:", err);
          // Fallback: trigger download
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `vine_snapshot_${timestamp || "winner"}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }
      } else {
        // No clipboard support: download instead
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `vine_snapshot_${timestamp || "winner"}.png`;
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
    const won = weightedRandomChoice(holders, excludeArr);
    if (won){
      setWinner(won.address);
          // highlight winner row
      setHighlightedAddress(won.address);

      // optional: clear highlight after a few seconds
      setTimeout(() => {
        setHighlightedAddress(null);
      }, 2500);
    }
  };

  useEffect(() => {
    if (!winner) return;

    const rowId = `holder-row-${winner}`;
    const rowEl = document.getElementById(rowId);
    if (rowEl) {
      rowEl.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [winner]);

  // Use the useEffect hook to fetch token information and holders when the component mounts
  useEffect(() => {
    // Define an asynchronous function to handle token data fetching
    setLoading(true);
    (async () => {
      try {
        // Fetch parsed account information for the specified token
        let tokenDetails = await connection.getParsedAccountInfo(token);
        //console.log('tokenDetails: '+JSON.stringify(tokenDetails))
        // If tokenDetails is available, update the state with token information
        const parsedTokenDetails = JSON.parse(JSON.stringify(tokenDetails));
        if (parsedTokenDetails?.value?.data?.parsed?.info) {
          setTokenInfo(parsedTokenDetails.value.data.parsed.info);
        }

        // Fetch token accounts based on the token program ID and token's public key
        const tokenAccounts = await connection.getProgramAccounts(
          TOKEN_PROGRAM_ID,
          {
            filters: [
              {
                dataSize: 165, // Adjust the dataSize based on the actual size of your token account data
              },
              {
                memcmp: {
                  offset: 0, // Adjust the offset based on the actual offset of the mint field in the account data
                  bytes: token.toBase58(),
                },
              },
            ],
          }
        );

        // Extract the public keys from an array of token accounts
        const holdersAta = tokenAccounts.map(({ pubkey }) => pubkey);
        
        // Define the chunk size (100 in this case)
        const chunkSize = 100;
        const holderArr = new Array();
        // Loop through the array in chunks
        for (let i = 0; i < holdersAta.length; i += chunkSize) {
          // Slice the array to get a chunk of 100 items
          const chunk = holdersAta.slice(i, i + chunkSize);

          // Fetch parsed account information for the current chunk
          const accountInfo = await connection.getMultipleParsedAccounts(chunk);
          if (accountInfo){
            // Extract relevant data from the account information and parse it to ensure deep cloning
            const holders = JSON.parse(JSON.stringify(accountInfo)).value.map(
              (data:any, key:number) => {
                // Map the account data to a new format, extracting address and converting balance
                return {
                  address: data.data.parsed.info.owner, // Extract the owner address from the parsed account info
                  balance: data.data.parsed.info.tokenAmount.amount, // Convert the balance by dividing amount by 10 raised to the power of decimals
                };
              }
            );

            holderArr.push(...holders);
            // Process the fetched information as needed
            console.log(`Processed ${holders.length} accounts in chunk ${i / chunkSize + 1}`);
          }
        }
          
          
        // Sort the holders array based on the balance in descending order
        const sortedHolders = holderArr.sort((a:any, b:any) => b.balance - a.balance);
        // Update the state with the sorted holders array
        setHolders(sortedHolders);


        // Compute the total tokens held
        const totalTokens = sortedHolders
          .filter(holder => !excludeArr.includes(holder.address))
          .reduce((acc, holder) => acc + Number(holder.balance), 0);

        //const totalTokens = sortedHolders.reduce((acc, holder) => {
        //  return acc + Number(holder.balance);
        //}, 0);

        console.log("Total tokens held:", totalTokens);
        setTotalTokensHeld(totalTokens / 10 ** parsedTokenDetails.value.data.parsed.info?.decimals);

        setLoading(false);
      } catch (err) {
        // Log an error message if there is an error fetching token information
        console.error("Error fetching token info:", err);
        // Optionally, you can set an error state or show an error message to the user
      } finally {
        // Set loading to false after fetching token information and holders
        setLoading(false);
      }
    })();
  }, []); // Empty dependencies array ensures the effect runs only once when the component mounts

  const handleChangePage = (event: any, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: any) => {
    setRowsPerPage(parseInt(event.target.value, 200));
    setPage(0);
  };

  const fireConfetti = () => {
    // Safety: only run in browser
    if (typeof window === "undefined") return;

    const duration = 1400; // total duration in ms
    const animationEnd = Date.now() + duration;

    // Shared settings
    const defaults = {
      startVelocity: 35,
      spread: 55,
      ticks: 90,
      zIndex: 9999,
      scalar: 0.9,
      colors: [
        "#8A2BE2", // grape purple
        "#C084FC", // soft purple
        "#00FFA3", // Solana green
        "#03E1FF", // Solana cyan
        "#FFFFFF", // white accent
      ],
    };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval: any = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        clearInterval(interval);
        return;
      }

      // Adjust particle count as time runs out
      const particleCount = Math.round(50 * (timeLeft / duration));

      // Two symmetric bursts from left/right
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
  };

  let timeoutId: NodeJS.Timeout;
  const spinRoulette = () => {
    const interval = 100; // Adjust the spinning speed
    const spins = 30; // Adjust the number of spins

    let spinCount = 0;

    const spinIteration = () => {
      //setSelectedItem(getRandomItemWithWeightedBalance());
      handleGetRaffleSelection();
      spinCount++;

      setLoadingSpin(true);
      setTimestamp("");
      if (spinCount < spins) {
        timeoutId = setTimeout(spinIteration, interval);
        //timeoutId = setTimeout(spinIteration, interval);
      } else{
        setTimestamp(moment().toString());
        setLoadingSpin(false);
        setOpen(true);
        fireConfetti();
      }
    };

    spinIteration();
  };

  const getHolderTier = (percent: number) => {
    if (percent >= 5) {
      return { label: "Whale", color: "rgba(248,250,252,0.14)" };
    } else if (percent >= 1) {
      return { label: "Large", color: "rgba(129,140,248,0.20)" };
    } else if (percent >= 0.1) {
      return { label: "Mid", color: "rgba(45,212,191,0.16)" };
    } else {
      return { label: "Tail", color: "rgba(148,163,184,0.18)" };
    }
  };

  const shortenString = (input: any, startChars = 6, endChars = 6) => {
    if (input.length <= startChars + endChars) {
      return input;
    }
  
    const start = input.slice(0, startChars);
    const end = input.slice(-endChars);
  
    return `${start}...${end}`;
  };

  // --- Derived info for the selected wallet in the drawer ---
  const selectedHolder = selectedWallet
    ? holders.find(
        (h) =>
          h?.address === selectedWallet &&
          !excludeArr.includes(h.address)
      )
    : null;

  let selectedBalance = 0;
  let selectedPct = 0;
  let selectedTier: { label: string; color: string } | null = null;

  if (selectedHolder && tokenInfo?.decimals != null && tokenInfo?.supply) {
    const raw = Number(selectedHolder.balance);
    selectedBalance = raw / 10 ** tokenInfo.decimals;
    selectedPct = (raw / tokenInfo.supply) * 100;
    selectedTier = getHolderTier(selectedPct);
  }

  // Render the component with token information and holders
  return (
    <Box sx={{ 
      flexGrow: 1,
      border:'none' }}>
      {/* <Typography variant="h4">TOKEN</Typography> */}

{/* Premium Token Summary */}
{tokenInfo && (
  <Box 
    sx={{ 
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-end",
      mb: 3,
      mt: 1,
      gap: 1.5
    }}
  >

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
            transform: "translateY(-1px)"
          }
        }}
      >
        <FileCopyIcon 
          sx={{ 
            fontSize: 16,
            opacity: 0.7
          }} 
        />
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
        justifyContent: "flex-end"
      }}
    >
      {/* CARD COMPONENT */}
      {[
        {
          label: "Supply",
          value: (tokenInfo.supply / 10 ** tokenInfo.decimals).toLocaleString(),
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
          className="shimmer"
          sx={{
            minWidth: 120,
            px: 1.8,
            py: 1,
            borderRadius: "14px",
            background: "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))",
            border: "1px solid rgba(255,255,255,0.12)",
            backdropFilter: "blur(10px)",
            display: "flex",
            flexDirection: "column",
            textAlign: "right",
            boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
            overflow: "hidden",
            position: "relative",
            transition: "0.25s ease",
            "&:hover": {
              boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
              transform: "translateY(-2px)",
              borderColor: "rgba(255,255,255,0.2)",
            }
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
      
{!loading && (
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
        Randomizer
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
        <Typography variant="caption">
          {loadingSpin ? "Drawing…" : "Ready"}
        </Typography>
      </Box>
    </Box>

    {/* Content row: winner (left) + button (right) */}
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
{winner && winner.length > 0 && (
  <Fade in timeout={450}>
    <Box
      sx={{
        textAlign: "center",
        mb: 2,
      }}
    >
      <Box
        key={timestamp || winner}   // ← force remount when new draw completes
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
          boxShadow: "0 0 0px rgba(0,200,255,0)",
          animation: "winnerGlow 1.6s ease-out",
          overflow: "visible",
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
        <CopyToClipboard text={winner} onCopy={handleCopy}>
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
            {isMobile ? shortenString(winner, 8, 8) : winner}
          </Button>
        </CopyToClipboard>
      </Box>

      {timestamp && (
        <Fade in timeout={500}>
          <Box sx={{ mt: 1.2 }}>
            <Tooltip title="Save snapshot">
              <IconButton
                sx={{ color: "white", mr: 0.8 }}
                onClick={handleCapture}
              >
                <ScreenshotMonitorIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            <Typography variant="caption" sx={{ opacity: 0.8 }}>
              {moment(timestamp).format("LLLL")}
            </Typography>
          </Box>
        </Fade>
      )}
    </Box>
  </Fade>
)}
      </Box>

      {/* Button */}
      <Box sx={{ textAlign: { xs: "left", md: "right" } }}>
        <Button
          onClick={spinRoulette}
          disabled={loadingSpin}
          sx={{
            textTransform: "none",
            borderRadius: "18px",
            px: 2.6,
            py: 1,
            background: loadingSpin
              ? "rgba(0,200,255,0.3)"
              : "rgba(255,255,255,0.12)",
            "&:hover": {
              background: loadingSpin
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
            Draw wallet
          </Typography>
        </Button>
      </Box>
    </Box>
  </Box>
)}

      {/* LEADERBOARD HEADER */}
<Box
  sx={{
    mt: 3,
    mb: 1.5,
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 1,
  }}
>
  <Typography variant="h5">Leaderboard</Typography>

  {totalEffective > 0 && (
    <Typography variant="caption" sx={{ opacity: 0.75, textAlign: "right" }}>
      {totalEffective.toLocaleString()} holders
      {excludedCount > 0 && (
        <Tooltip
          title={
            <>
              <strong>Excluded wallets:</strong>
              <br />
              Treasury or system-owned accounts that should not participate
              in raffles or distort supply stats.
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
      {top10SharePct > 0 && ` • Top 10 hold ${top10SharePct.toFixed(1)}%`}
      {medianBalance > 0 &&
        ` • Median balance: ${medianBalance.toLocaleString(undefined, {
          maximumFractionDigits: 0,
        })} VINE`}
    </Typography>
  )}
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
          <StyledTable size="small" aria-label="Vine Leaderboard Table">
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
                  <Typography variant="caption">% of Supply</Typography>
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {holders && (
                <>
                  {(rowsPerPage > 0
                    ? holders.slice(
                        page * rowsPerPage,
                        page * rowsPerPage + rowsPerPage
                      )
                    : holders
                  )
                    .filter((item) => !excludeArr.includes(item.address))
                    .map((item: any, index: number) => {
                      if (!item?.address) return null;

                      const rank = page * rowsPerPage + index + 1;

                      const rankBadgeColor =
                        rank === 1
                          ? "#facc15" // gold
                          : rank === 2
                          ? "#e5e7eb" // silver
                          : rank === 3
                          ? "#a855f7" // grape / bronze-ish
                          : null;

                      return (
                        <TableRow
                          key={index}
                          id={`holder-row-${item.address}`}
                          sx={{
                            borderBottom: "none",
                            "&:hover": {
                              backgroundColor: "rgba(148,163,184,0.08)",
                            },
                            ...(highlightedAddress === item.address && {
                              animation: "winnerRowPulse 1.4s ease-out",
                              backgroundColor: "rgba(56,189,248,0.12)",
                            }),
                          }}
                        >
                          {/* RANK + BADGE */}
                          <TableCell>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                              <Typography variant="caption" sx={{ opacity: 0.75 }}>
                                {rank}
                              </Typography>
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
                            {tokenInfo?.supply && (() => {
                              const pct =
                                (+item.balance / tokenInfo.supply) * 100;
                              const tier = getHolderTier(pct);

                              return (
                                <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1, justifyContent: "flex-end" }}>
                                  <Typography variant="body2">
                                    {pct.toFixed(2)}%
                                  </Typography>
                                  <Box
                                    sx={{
                                      px: 1,
                                      py: 0.2,
                                      borderRadius: "999px",
                                      fontSize: "0.65rem",
                                      textTransform: "uppercase",
                                      letterSpacing: 0.6,
                                      backgroundColor: tier.color,
                                      color: "rgba(241,245,249,0.9)",
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
                  count={holders ? holders.length : 0}
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
    //disableSwipeToOpen={false}
    ModalProps={{
      keepMounted: true,
      BackdropProps: {
        sx: {
          backgroundColor: "rgba(0,0,0,0.5)", // required to detect click
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
            color: "rgba(255,255,255,0.8)",
            "&:hover": { color: "white" }
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

      <Divider sx={{ mb: 2, borderColor: "rgba(148,163,184,0.4)" }} />

      {/* Metrics */}
      {selectedHolder && tokenInfo && (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 1.5,
            mb: 2,
          }}
        >
          <Box>
            <Typography
              variant="caption"
              sx={{ opacity: 0.7 }}
            >
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
            <Typography
              variant="caption"
              sx={{ opacity: 0.7 }}
            >
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
            <Typography
              variant="caption"
              sx={{ opacity: 0.7 }}
            >
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
        </Box>
      )}

      <Divider sx={{ mb: 2, borderColor: "rgba(148,163,184,0.4)" }} />

      {/* External links */}
      {selectedWallet && (
        <Button
          variant="text"
          color="inherit"
          size="small"
          sx={{
            textTransform: "none",
            justifyContent: "flex-start",
            px: 0,
          }}
          href={`https://solscan.io/account/${selectedWallet}`}
          target="_blank"
          rel="noreferrer"
          endIcon={<OpenInNewIcon sx={{ fontSize: 16 }} />}
        >
          View on Solscan
        </Button>
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
        <Alert onClose={() => setSnapshotCopied(false)} severity="success">
          Snapshot copied to clipboard!
        </Alert>
      </Snackbar>

      <Snackbar
        open={open}
        autoHideDuration={3000} // Adjust the duration as needed
        onClose={handleClose}
        TransitionComponent={Zoom}
      //  anchorOrigin={{ vertical: 'top', horizontal: 'center' }} // Set anchorOrigin for top center
      >
        <Alert 
          onClose={handleClose} 
          severity="success">
          Operation randomizer successful!
        </Alert>
      </Snackbar>
    </Box>
  );
};

// Export the TokenLeaderboard component as the default export of this module
export default TokenLeaderboard;
