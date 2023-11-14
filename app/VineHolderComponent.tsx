'use client'
import React, { useState } from 'react';

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

// Vine Token: A6GComqUgUZ7mTqZcDrgnigPEdYDcw5yCumbHaaQxVKK

const VineHolderComponent: React.FC = () => {
  const connection = new Connection(GRAPE_RPC_ENDPOINT);
  const token = new PublicKey("A6GComqUgUZ7mTqZcDrgnigPEdYDcw5yCumbHaaQxVKK");

  const [tokenInfo, setTokenInfo] = React.useState(null);
  const [holders, setHolders] = React.useState([])

  const fetchTokenInfo = async() => {
    try {
    let tokenDetails = await connection.getParsedAccountInfo(token);
    if (tokenDetails){
      console.log("tokenDetails", tokenDetails)
      setTokenInfo(tokenDetails.value.data.parsed.info);
    }

    const tokenMint = await getMint(connection, token);
    console.log("tokenMint: ",tokenMint);

    const tokenAccounts = await connection.getProgramAccounts(
      //token program address
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
    console.log("tokenAccounts:", tokenAccounts)

    const holders = await Promise.all(tokenAccounts.map(async (account) => {
      const address = account.pubkey.toBase58()
      const accountInfo = await getAccount(connection, account.pubkey)
      return {
        address: address,
        balance: Number(accountInfo.amount)
      }
    }))
    
    const sortedHolders = holders.sort((a, b) => b.balance - a.balance)

    console.log("sortedHolders:", sortedHolders)

    setHolders(sortedHolders)
    } catch(err) {
      console.error("Error fetching token info:", err)
    }
  }

  React.useEffect(() => {   
    //if (true)
      fetchTokenInfo();
}, []);

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Divider>Token</Divider>

      <Typography>
        {tokenInfo &&
          <>
            Address: {token.toBase58()}<br/>
            Decimals: {tokenInfo.decimals}<br/>
            Supply: {tokenInfo.supply}<br/>
          </>
        }
      </Typography>

      <Divider>Holders</Divider>
      <List>
        {holders && holders.map((item, key) => (
          <ListItem key={key}>
            <Typography>Address: {item.address} Balance: {item.balance}</Typography>
          </ListItem>
        ))}
      </List>
    </Box>
  );
}

export default VineHolderComponent;