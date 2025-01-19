// Import necessary modules and components from libraries
import { FC, useEffect, useState, useRef, useCallback } from "react";
import { PublicKey, Connection } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { GRAPE_RPC_ENDPOINT } from "./constants";
import { styled, useTheme } from "@mui/material/styles";
import moment from "moment";
import { CopyToClipboard } from "react-copy-to-clipboard";
import html2canvas from "html2canvas";

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
} from "@mui/material";

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

// Custom styled table
const StyledTable = styled(Table)(({ theme }) => ({
  "& .MuiTableCell-root": {
    border: "none",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
  },
}));

// Custom pagination actions
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
        {theme.direction === "rtl" ? <KeyboardArrowRight /> : <KeyboardArrowLeft />}
      </IconButton>
      <IconButton
        onClick={handleNextButtonClick}
        disabled={page >= Math.ceil(count / rowsPerPage) - 1}
        aria-label="next page"
      >
        {theme.direction === "rtl" ? <KeyboardArrowLeft /> : <KeyboardArrowRight />}
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

interface Holder {
  address: string;
  balance: number;
}

// Define a React functional component named TokenLeaderboard
const TokenLeaderboard: FC<{ programId: string }> = ({ programId }) => {
  const connection = new Connection(GRAPE_RPC_ENDPOINT);
  const token = new PublicKey(programId);

  // States for token info, holders, and UI controls
  const [tokenInfo, setTokenInfo] = useState<any | null>(null);
  const [totalTokensHeld, setTotalTokensHeld] = useState(0);
  const [holders, setHolders] = useState<Holder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [winner, setWinner] = useState("");
  const [loadingSpin, setLoadingSpin] = useState(false);
  const [timestamp, setTimestamp] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const componentRef = useRef<HTMLDivElement>(null);
  const spinTimeout = useRef<NodeJS.Timeout | null>(null);
  const isMobile = useMediaQuery("(max-width:600px)");

  // Exclude these addresses from calculations/raffles
  const excludeArr = [
    "CBkJ9y9qRfYixCdSChqrVxYebgSEBCNbhnPk8GRdEtFk",
    "6jEQpEnoSRPP8A2w6DWDQDpqrQTJvG4HinaugiBGtQKD",
    "AWaMVkukciGYPEpJbnmSXPJzVxuuMFz1gWYBkznJ2qbq",
  ];

  // Snackbar handlers
  const handleCopy = () => setIsCopied(true);
  const handleCloseSnackbar = () => setIsCopied(false);
  const handleClose = () => setOpen(false);

  // Capture screenshot of a component
  const handleCapture = () => {
    if (componentRef.current) {
      html2canvas(componentRef.current)
        .then((canvas) => {
          const screenshotUrl = canvas.toDataURL();
          console.log("Screenshot taken:", screenshotUrl);
          const downloadLink = document.createElement("a");
          downloadLink.href = screenshotUrl;
          downloadLink.download = "vine_screenshot_" + timestamp + ".png";
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
        })
        .catch((error) => console.error("Error capturing screenshot:", error));
    }
  };

  // Shorten a long string for display
  const shortenString = (input: string, startChars = 6, endChars = 6): string => {
    if (input.length <= startChars + endChars) {
      return input;
    }
    return `${input.slice(0, startChars)}...${input.slice(-endChars)}`;
  };

  // Get raffle winner using a weighted random choice function
  const handleGetRaffleSelection = useCallback(() => {
    const won = weightedRandomChoice(holders, excludeArr);
    if (won) setWinner(won.address);
  }, [holders, excludeArr]);

  // Fetch token info and holders data
  useEffect(() => {
    const fetchTokenData = async () => {
      setLoading(true);
      try {
        // Fetch token details
        const tokenDetails = await connection.getParsedAccountInfo(token);
        if (tokenDetails?.value?.data?.parsed?.info) {
          setTokenInfo(tokenDetails.value.data.parsed.info);
        }

        // Fetch all token accounts for this mint
        const tokenAccounts = await connection.getProgramAccounts(TOKEN_PROGRAM_ID, {
          filters: [
            { dataSize: 165 },
            { memcmp: { offset: 0, bytes: token.toBase58() } },
          ],
        });
        const holdersAta = tokenAccounts.map(({ pubkey }) => pubkey);

        // Chunk accounts for parallel fetching
        const chunkSize = 100;
        const chunks = [];
        for (let i = 0; i < holdersAta.length; i += chunkSize) {
          chunks.push(holdersAta.slice(i, i + chunkSize));
        }

        // Fetch account infos in parallel
        const accountInfos = await Promise.all(
          chunks.map((chunk) => connection.getMultipleParsedAccounts(chunk))
        );

        // Flatten the results
        const holderArr: Holder[] = accountInfos.flatMap((infoChunk: any) =>
          infoChunk.value.map((data: any) => ({
            address: data.data.parsed.info.owner,
            balance: Number(data.data.parsed.info.tokenAmount.amount),
          }))
        );

        // Sort by balance descending
        const sortedHolders = holderArr.sort((a, b) => b.balance - a.balance);
        setHolders(sortedHolders);

        // Compute total tokens (excluding addresses in excludeArr) and adjust by decimals
        const decimals = tokenDetails.value.data.parsed.info.decimals;
        const totalTokens = sortedHolders
          .filter((holder) => !excludeArr.includes(holder.address))
          .reduce((acc, holder) => acc + holder.balance, 0);
        setTotalTokensHeld(totalTokens / 10 ** decimals);
      } catch (err) {
        console.error("Error fetching token info:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTokenData();

    // Cleanup any pending timeouts if unmounting
    return () => {
      if (spinTimeout.current) {
        clearTimeout(spinTimeout.current);
      }
    };
  }, [connection, token, excludeArr]);

  // Pagination change handlers
  const handleChangePage = (event: any, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: any) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Simulate spinning/roulette logic for selecting a winner
  const spinRoulette = () => {
    const interval = 100; // milliseconds between spins
    const spins = 30;
    let spinCount = 0;
    setLoadingSpin(true);
    setTimestamp("");

    const spinIteration = () => {
      handleGetRaffleSelection();
      spinCount++;

      if (spinCount < spins) {
        spinTimeout.current = setTimeout(spinIteration, interval);
      } else {
        setTimestamp(moment().toString());
        setLoadingSpin(false);
        setOpen(true);
      }
    };

    spinIteration();
  };

  return (
    <Box sx={{ flexGrow: 1, border: "none" }}>
      {/* Token Info */}
      <Grid container justifyContent="flex-end">
        <Typography variant="caption" sx={{ textAlign: "right" }}>
          {tokenInfo && (
            <>
              <CopyToClipboard text={token.toBase58()} onCopy={handleCopy}>
                <Button
                  variant="text"
                  color="inherit"
                  sx={{
                    fontSize: "12px",
                    borderRadius: "17px",
                    textTransform: "none",
                    "&:hover .MuiSvgIcon-root": { opacity: 1 },
                  }}
                  startIcon={
                    <FileCopyIcon
                      fontSize="small"
                      sx={{ color: "rgba(255,255,255,0.25)", opacity: 0, fontSize: "10px" }}
                    />
                  }
                >
                  {shortenString(token.toBase58(), 8, 8)}
                </Button>
              </CopyToClipboard>
              <br />
              Supply: {(tokenInfo.supply / 10 ** tokenInfo.decimals).toLocaleString()} <br />
              Decimals: {tokenInfo.decimals}
              <br />
              Tokens Held: {totalTokensHeld}
              <br />
            </>
          )}
        </Typography>
      </Grid>

      {/* Winner / Randomizer Section */}
      {!loading && (
        <Box
          textAlign="center"
          ref={componentRef}
          sx={{
            m: 2,
            p: 1,
            background: "rgba(0,0,0,0.2)",
            border: "none",
            borderRadius: "17px",
          }}
        >
          {winner && (
            <Box>
              <CopyToClipboard text={winner} onCopy={handleCopy}>
                <Button
                  variant="text"
                  color="inherit"
                  sx={{ borderRadius: "17px", textTransform: "none" }}
                  startIcon={<FileCopyIcon />}
                >
                  {isMobile ? shortenString(winner, 8, 8) : winner}
                </Button>
              </CopyToClipboard>
              {timestamp && (
                <>
                  <Tooltip title="Save Screenshot">
                    <IconButton onClick={handleCapture}>
                      <ScreenshotMonitorIcon />
                    </IconButton>
                  </Tooltip>
                  <Grid>
                    <Fade in={Boolean(timestamp)}>
                      <Typography variant="caption">
                        {moment(timestamp).format("LLLL")}
                      </Typography>
                    </Fade>
                  </Grid>
                </>
              )}
            </Box>
          )}
          <Box textAlign="right">
            <Button
              onClick={spinRoulette}
              color="inherit"
              disabled={loadingSpin}
              sx={{ textTransform: "none", borderRadius: "17px" }}
            >
              {loadingSpin ? (
                <HourglassBottomIcon fontSize="small" sx={{ mr: 1 }} />
              ) : (
                <LoopIcon fontSize="small" sx={{ mr: 1 }} />
              )}
              Randomizer<sup>beta</sup>
            </Button>
          </Box>
        </Box>
      )}

      {/* Leaderboard Table */}
      <Typography variant="h4">Leaderboard</Typography>
      <Box sx={{ overflow: "auto" }}>
        {loading ? (
          <Grid sx={{ textAlign: "center" }}>
            <CircularProgress color="inherit" />
          </Grid>
        ) : (
          <Table sx={{ border: "none" }}>
            <TableContainer component={Paper} sx={{ background: "none", border: "none" }}>
              <StyledTable size="small" aria-label="Vine Leaderboard Table">
                <TableHead>
                  <TableRow>
                    <TableCell>
                      <Typography variant="caption">Owner</Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="caption">Amount</Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="caption">% of Supply</Typography>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(rowsPerPage > 0
                    ? holders.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    : holders
                  )
                    .filter((item) => !excludeArr.includes(item.address))
                    .map((item, index) => (
                      <TableRow key={index} sx={{ borderBottom: "none" }}>
                        <TableCell>
                          <Typography variant="body2">
                            <CopyToClipboard text={item.address} onCopy={handleCopy}>
                              <Button
                                variant="text"
                                color="inherit"
                                sx={{
                                  borderRadius: "17px",
                                  textTransform: "none",
                                  "&:hover .MuiSvgIcon-root": { opacity: 1 },
                                }}
                                endIcon={
                                  <FileCopyIcon sx={{ color: "rgba(255,255,255,0.25)", opacity: 0 }} />
                                }
                              >
                                {shortenString(item.address, 8, 8)}
                              </Button>
                            </CopyToClipboard>
                          </Typography>
                        </TableCell>

                        <TableCell align="center">
                          <Typography variant="body2">
                            {(item.balance / 10 ** tokenInfo?.decimals).toLocaleString()}
                          </Typography>
                        </TableCell>

                        <TableCell align="center">
                          <Typography variant="body2">
                            {tokenInfo?.supply &&
                              ((item.balance / tokenInfo.supply) * 100).toFixed(2)}
                            %
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TablePagination
                      rowsPerPageOptions={[20]}
                      colSpan={5}
                      count={holders.length}
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
          </Table>
        )}
      </Box>

      {/* Snackbars for copy and randomizer success notifications */}
      <Snackbar open={isCopied} autoHideDuration={2000} onClose={handleCloseSnackbar}>
        <Alert onClose={handleCloseSnackbar} severity="success">
          Copied to clipboard!
        </Alert>
      </Snackbar>

      <Snackbar open={open} autoHideDuration={3000} onClose={handleClose} TransitionComponent={Zoom}>
        <Alert onClose={handleClose} severity="success">
          Operation randomizer successful!
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default TokenLeaderboard;
