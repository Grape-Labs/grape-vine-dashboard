'use client'
import React, { useState } from 'react';

import { PublicKey, Connection, TokenAccountsFilter } from '@solana/web3.js'; 
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

const data = [
  'XYZXYZXYZXYZXYZXYZXYZ',
  'XYZXYZXYZXYZXYZXYZXYZ',
  'XYZXYZXYZXYZXYZXYZXYZ',
];

const VineHolderComponent: React.FC = () => {
  const connection = new Connection(GRAPE_RPC_ENDPOINT);
  const token = new PublicKey("A6GComqUgUZ7mTqZcDrgnigPEdYDcw5yCumbHaaQxVKK");

  const [tokenInfo, setTokenInfo] = React.useState(null);

  const fetchTokenInfo = async() => {
    let tokenDetails = await connection.getParsedAccountInfo(token);
    if (tokenDetails){
      setTokenInfo(tokenDetails.value.data.parsed.info);
    }

    //const tokenMint = await getMint(connection, token);
    //console.log("tokenMint: ",tokenMint);
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
        {data && data.map((item, key) => (
          <ListItem key={key}>
            <Typography>[{key}]</Typography> {item} ()
          </ListItem>
        ))}
      </List>
    </Box>
  );
}

export default VineHolderComponent;