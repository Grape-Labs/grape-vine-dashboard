'use client'
import React, { useState } from 'react';
//import { Link } from 'react-router-dom';

import TokenLeaderboard from './TokenLeaderboard'

import {
  CssBaseline,
  AppBar,
  Container,
  Toolbar,
  Paper,
  Typography,
} from '@mui/material'

function Copyright() {
  return (
    <Typography variant="body2" color="secondary" align="center">
      Powered by Grape
    </Typography>
  );
}

const Home: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  
  return (
    <React.Fragment>
      <CssBaseline />
      <AppBar
        position="absolute"
        //color="default"
        elevation={0}
        sx={{
          position: 'relative',
          borderBottom: (t) => `1px solid ${t.palette.divider}`,
          background: 'rgba(255,255,255,0.5)'
        }}
      >
        <Toolbar>
          <Typography variant="h6" color="inherit" noWrap>
            Vine Dashboard
          </Typography>
        </Toolbar>
      </AppBar>
      <Container component="main" maxWidth="sm" sx={{ mb: 4 }}>
        <Paper variant="outlined" sx={{ my: { xs: 3, md: 6 }, p: { xs: 2, md: 3 } }}>
          <TokenLeaderboard programId="A6GComqUgUZ7mTqZcDrgnigPEdYDcw5yCumbHaaQxVKK"/>
        </Paper>
      </Container>
      <Copyright />
    </React.Fragment>
  );
};

export default Home;