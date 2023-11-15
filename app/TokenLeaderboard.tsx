// Import necessary modules and components from libraries
import { FC, useEffect, useState } from 'react';

import { PublicKey, Connection, TokenAccountsFilter, LAMPORTS_PER_SOL } from '@solana/web3.js'; 
import { TOKEN_PROGRAM_ID, getAccount, getMint, } from '@solana/spl-token';
import { GRAPE_RPC_ENDPOINT } from './constants';

import {
  Box,
  List,
  ListItem,
  ListItemAvatar,
  ListItemIcon,
  ListItemText,
  Divider,
  Avatar,
  IconButton,
  Typography,
} from '@mui/material'

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
        )
        // Extract the public keys from an array of token accounts
        const holdersAta = tokenAccounts.map(({ pubkey }) => pubkey);

        // Fetch parsed account information for multiple accounts in a single request
        const accountInfo = await connection.getMultipleParsedAccounts(holdersAta);

        // Extract relevant data from the account information and parse it to ensure deep cloning
        const holders = JSON.parse(JSON.stringify(accountInfo)).value.map(({ data: { parsed: { info } } }) => {
          // Map the account data to a new format, extracting address and converting balance
          return {
            address: info.owner,  // Extract the owner address from the parsed account info
            balance: +info.tokenAmount.amount / 10 ** +info.tokenAmount.decimals,
            // Convert the balance by dividing amount by 10 raised to the power of decimals
          };
        });

        // Sort the holders array based on the balance in descending order
        const sortedHolders = holders.sort((a, b) => b.balance - a.balance)  
        // Update the state with the sorted holders array
        setHolders(sortedHolders);

      } catch(err) {
        // Log an error message if there is an error fetching token information
        console.error("Error fetching token info:", err);
        // Optionally, you can set an error state or show an error message to the user
      } finally {
        // Set loading to false after fetching token information and holders
        setLoading(false);
      }
    })();
  }, []); // Empty dependencies array ensures the effect runs only once when the component mounts

  // Render the component with token information and holders
  return (
    <Box sx={{ flexGrow: 1 }}>
      <Divider>Token</Divider>

      {/* Display token information if available */}
      <Typography>
        {tokenInfo && (
          <>
            Address: {token.toBase58()}<br/>
            Decimals: {tokenInfo?.decimals}<br/>
            Supply: {tokenInfo?.supply}<br/>
          </>
        )}
      </Typography>

      <Divider>Holders</Divider>
      <List>
        {/* Display loading message while fetching data, otherwise, display the list of holders */}
        {loading ? (
          <Typography>Loading...</Typography>
        ) : (
          holders.map((item, key) => (
            // Display each holder's address and balance as a list item
            <ListItem key={key}>
              <Typography>
                Address: {item.address} Balance: {item.balance}
              </Typography>
            </ListItem>
          ))
        )}
      </List>
    </Box>
  );
}

// Export the TokenLeaderboard component as the default export of this module
export default TokenLeaderboard;
