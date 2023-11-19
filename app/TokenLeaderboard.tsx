// Import necessary modules and components from libraries
import { FC, useEffect, useState } from "react";
import { PublicKey, Connection } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { GRAPE_RPC_ENDPOINT } from "./constants";
import { styled, useTheme } from "@mui/material/styles";
import {
  Paper,
  Box,
  Divider,
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
} from "@mui/material";
import FirstPageIcon from "@mui/icons-material/FirstPage";
import KeyboardArrowLeft from "@mui/icons-material/KeyboardArrowLeft";
import KeyboardArrowRight from "@mui/icons-material/KeyboardArrowRight";
import LastPageIcon from "@mui/icons-material/LastPage";
import {
  formatAmount,
  getFormattedNumberToLocale,
} from "./utils/grapeTools/helpers";

const StyledTable = styled(Table)(({ theme }) => ({
  "& .MuiTableCell-root": {
    borderBottom: "1px solid rgba(255,255,255,0.05)",
  },
}));

function TablePaginationActions(props: any) {
  const theme = useTheme();
  const { count, page, rowsPerPage, onPageChange } = props;

  const handleFirstPageButtonClick = (event) => {
    onPageChange(event, 0);
  };

  const handleBackButtonClick = (event) => {
    onPageChange(event, page - 1);
  };

  const handleNextButtonClick = (event) => {
    onPageChange(event, page + 1);
  };

  const handleLastPageButtonClick = (event) => {
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
  const [holders, setHolders] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Use the useEffect hook to fetch token information and holders when the component mounts
  useEffect(() => {
    // Define an asynchronous function to handle token data fetching
    (async () => {
      try {
        // Fetch parsed account information for the specified token
        let tokenDetails = await connection.getParsedAccountInfo(token);
        // If tokenDetails is available, update the state with token information
        if (tokenDetails?.value?.data?.parsed?.info) {
          setTokenInfo(tokenDetails.value.data.parsed.info);
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
                  bytes: token,
                },
              },
            ],
          }
        );
        // Extract the public keys from an array of token accounts
        const holdersAta = tokenAccounts.map(({ pubkey }) => pubkey);

        // Fetch parsed account information for multiple accounts in a single request
        const accountInfo = await connection.getMultipleParsedAccounts(
          holdersAta
        );

        // Extract relevant data from the account information and parse it to ensure deep cloning
        const holders = JSON.parse(JSON.stringify(accountInfo)).value.map(
          ({
            data: {
              parsed: { info },
            },
          }) => {
            // Map the account data to a new format, extracting address and converting balance
            return {
              address: info.owner, // Extract the owner address from the parsed account info
              balance: info.tokenAmount.amount, // Convert the balance by dividing amount by 10 raised to the power of decimals
            };
          }
        );

        // Sort the holders array based on the balance in descending order
        const sortedHolders = holders.sort((a, b) => b.balance - a.balance);
        // Update the state with the sorted holders array
        setHolders(sortedHolders);
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

  // Render the component with token information and holders
  return (
    <Box sx={{ flexGrow: 1 }}>
      <Divider>Token</Divider>

      {/* Display token information if available */}
      <Typography>
        {tokenInfo && (
          <>
            Address: {token.toBase58()}
            <br />
            Decimals: {tokenInfo?.decimals}
            <br />
            Supply: {tokenInfo?.supply}
            <br />
          </>
        )}
      </Typography>

      <Divider>Holders</Divider>
      <Table>
        <TableContainer component={Paper} sx={{ background: "none" }}>
          <StyledTable
            sx={{ minWidth: 500 }}
            size="small"
            aria-label="Portfolio Table"
          >
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
              {holders && (
                <>
                  {(rowsPerPage > 0
                    ? holders.slice(
                        page * rowsPerPage,
                        page * rowsPerPage + rowsPerPage
                      )
                    : holders
                  ).map((item: any, index: number) => (
                    <>
                      {item?.address && (
                        <TableRow key={index} sx={{ borderBottom: "none" }}>
                          <TableCell>
                            <Typography variant="h6">{item.address}</Typography>
                          </TableCell>

                          <TableCell align="center">
                            <Typography variant="h6">
                              {getFormattedNumberToLocale(
                                formatAmount(
                                  +(
                                    item.balance /
                                    Math.pow(10, tokenInfo?.decimals)
                                  ).toFixed(0)
                                )
                              )}
                            </Typography>
                          </TableCell>

                          <TableCell align="center">
                            <Typography variant="h6">
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
              <TableRow>
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
    </Box>
  );
};

// Export the TokenLeaderboard component as the default export of this module
export default TokenLeaderboard;
