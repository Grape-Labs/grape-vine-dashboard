// Import necessary modules and components from libraries
import { FC, useEffect, useState, useRef } from "react";
import { PublicKey, Connection } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { GRAPE_RPC_ENDPOINT } from "./constants";
import { styled, useTheme } from "@mui/material/styles";
import moment from "moment";
import { CopyToClipboard } from 'react-copy-to-clipboard';
import html2canvas from 'html2canvas';


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
  // Create a connection to the Solana blockchain using the specified RPC endpoint
  const connection = new Connection(GRAPE_RPC_ENDPOINT);
  // Define the token's public key based on the provided programId prop
  const token = new PublicKey(props.programId);

  // Define state variables for token information, holders, and loading status
  const [tokenInfo, setTokenInfo] = useState<any | null>(null);
  const [totalTokensHeld, setTotalTokensHeld] = useState(0);
  const [holders, setHolders] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [winner, setWinner] = useState('');
  const [loadingSpin, setLoadingSpin] = useState(false);
  const [timestamp, setTimestamp] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const componentRef = useRef(null);
  const [open, setOpen] = useState(false);

  const isMobile = useMediaQuery('(max-width:600px)');

  const handleClose = () => {
    setOpen(false);
  };

  const handleCapture = () => {
    if (componentRef.current) {
      html2canvas(componentRef.current)
        .then((canvas) => {
          const screenshotUrl = canvas.toDataURL(); // This is the screenshot image URL
          console.log('Screenshot taken:', screenshotUrl);
          // You can save or display the screenshot as needed
          // Create a temporary anchor element
          const downloadLink = document.createElement('a');
          downloadLink.href = screenshotUrl;
          downloadLink.download = 'vine_screenshot_'+timestamp+'.png'; // Set the filename

          // Trigger a click on the anchor to initiate the download
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
        })
        .catch((error) => {
          console.error('Error capturing screenshot:', error);
        });
    }
  };

  const handleCopy = () => {
    setIsCopied(true);
  };

  const handleCloseSnackbar = () => {
    setIsCopied(false);
  };

  const excludeArr = [
    "CBkJ9y9qRfYixCdSChqrVxYebgSEBCNbhnPk8GRdEtFk",
    "6jEQpEnoSRPP8A2w6DWDQDpqrQTJvG4HinaugiBGtQKD",
    "AWaMVkukciGYPEpJbnmSXPJzVxuuMFz1gWYBkznJ2qbq"
  ]

  const handleGetRaffleSelection = () => {
    const won = weightedRandomChoice(holders, excludeArr);
    if (won)
      setWinner(won.address);
  };

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
      }
    };

    spinIteration();
  };

  const shortenString = (input: any, startChars = 6, endChars = 6) => {
    if (input.length <= startChars + endChars) {
      return input;
    }
  
    const start = input.slice(0, startChars);
    const end = input.slice(-endChars);
  
    return `${start}...${end}`;
  };

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
      
      {!loading &&
        <Box
          textAlign='center'
          ref={componentRef}
          sx={{
            m:2,
            p:1,
            background:'rgba(0,0,0,0.2)',
            border:'none',
            borderRadius:'17px',
          }}
        >
          {(winner && winner.length > 0) &&
            <>
              <Box>
              <CopyToClipboard text={winner} onCopy={handleCopy}>
                <Button
                  variant="text"
                  color="inherit"
                  sx={{ 
                    borderRadius:'17px',
                    textTransform:'none',
                  }}
                  startIcon={<FileCopyIcon />}
                >
                  
                  {isMobile ? `${shortenString(winner,8,8)}` : winner}

                </Button>
              </CopyToClipboard>
              
              {(timestamp && timestamp.length > 0) ? 
                <>
                  <Tooltip title="Save Screenshot">
                    <IconButton onClick={handleCapture}>
                      <ScreenshotMonitorIcon />
                    </IconButton>
                  </Tooltip>
                  <Grid>
                    <Fade in={timestamp ? true : false}>
                      <Typography variant="caption">
                          {moment(timestamp).format('LLLL')}
                      </Typography>
                    </Fade>
                  </Grid>
                </>
                : ""}
              </Box>
            </>
          }

          <Box textAlign="right">
            <Button 
              onClick={spinRoulette}
              color='inherit'
              disabled={loadingSpin ? true:false}
              sx={{
                textTransform:'none',
                borderRadius:'17px'
              }}
            >
              {loadingSpin ?
                <HourglassBottomIcon fontSize='small' sx={{mr:1}} /> 
              :
                <LoopIcon fontSize='small' sx={{mr:1}} /> 
              }
              Randomizer<sup>beta</sup>
            </Button>
          </Box>
        </Box>
      }

      <Typography variant="h4">Leaderboard</Typography>
      <Box sx={{ overflow: "auto" }}>
         <Box sx={{ width: "100%", display: "table", tableLayout: "fixed" }}>
          {loading ?
            <>
              <Grid alignContent={"center"} sx={{textAlign:'center'}}>
                <CircularProgress color="inherit"/>
              </Grid>
            </>
          :
            <Table
              sx={{
                border: "none"}}
            >
              <TableContainer 
                component={Paper} 
                sx={{ 
                  background: "none",
                  border:"none"
                }}>
                <StyledTable
                  size="small"
                  aria-label="Vine Leaderboard Table"
                >
                  <TableHead>
                    <TableRow>
                      <TableCell key={'ttitle'}>
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
                        .map((item: any, index: number) => (
                          <>
                            {item?.address && (
                              <TableRow key={index} sx={{ borderBottom: "none" }}>
                                <TableCell>
                                  <Typography variant="body2">
                                    <CopyToClipboard text={item.address} onCopy={handleCopy}>
                                      <Button
                                        variant="text"
                                        color="inherit"
                                        sx={{ 
                                          borderRadius:'17px',
                                          textTransform:'none',
                                          '&:hover .MuiSvgIcon-root': {
                                            opacity: 1,
                                          },
                                        }}
                                        endIcon={
                                          <FileCopyIcon sx={{
                                            color:'rgba(255,255,255,0.25)',
                                            opacity: 0}} />
                                        }
                                      >
                                    
                                      {shortenString(item.address,8,8)}
                                      </Button>
                                    </CopyToClipboard>
                                  
                                  
                                  </Typography>
                                </TableCell>

                                <TableCell align="center">
                                  <Typography variant="body2">
                                    {(item.balance / 10 ** tokenInfo?.decimals).toLocaleString()}
                                    
                                    {/*getFormattedNumberToLocale(
                                      formatAmount(
                                        +(
                                          item.balance /
                                          Math.pow(10, tokenInfo?.decimals)
                                        ).toFixed(0)
                                      )
                                    )*/}
                                  </Typography>
                                </TableCell>

                                <TableCell align="center">
                                  <Typography variant="body2">
                                    {tokenInfo?.supply &&
                                      (
                                        (+item.balance / tokenInfo?.supply) *
                                        100
                                      ).toFixed(2)}
                                    %
                                  </Typography>
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        ))}
                      </>
                    )}
                  </TableBody>

                  <TableFooter>
                    <TableRow key={'tfooter'}>
                      <TablePagination
                        rowsPerPageOptions={[20]}
                        colSpan={5}
                        count={holders && holders.length}
                        rowsPerPage={rowsPerPage}
                        page={page}
                        SelectProps={{
                          inputProps: {
                            "aria-label": "rows per page",
                          },
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
          }
        </Box>
      </Box>

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
