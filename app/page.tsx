"use client";
import React, { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import TokenLeaderboard from "./TokenLeaderboard";
import { tokens, VINE_LOGO } from "./constants";
import {
  CssBaseline,
  AppBar,
  Container,
  Toolbar,
  Paper,
  Typography,
  Avatar,
} from "@mui/material";
import grapeTheme from "./utils/config/theme";
import { ThemeProvider } from "@mui/material/styles";

function Copyright() {
  return (
    <Typography 
      variant="caption" 
      color="white" // Sets text color to white
      align="center" 
      sx={{ 
        display: "block",  // Ensures it takes full width
        textAlign: "center",  // Centers text horizontally
        marginTop: 2,  // Optional spacing
      }}
    >
      Powered by Grape
    </Typography>
  );
}

const Home: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh", // Fix for mobile screen height changes
        width: "100vw",
        background: `url('/images/background_sample_image.webp')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
      }}
    >
      {/* Semi-transparent overlay */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background: "linear-gradient(to right, rgba(187, 210, 197, 0.8), rgba(83, 105, 118, 0.8), rgba(41, 46, 73, 0.8))",
          opacity: 0.98, // 98% faded effect
          zIndex: 1,
        }}
      ></div>

      {/* Content */}
      <div style={{ position: "relative", zIndex: 2, color: "white", textAlign: "center" }}>
    <ThemeProvider theme={grapeTheme}>
        <CssBaseline />
        <AppBar
          position="absolute"
          elevation={0}
          sx={{
            position: "relative",
            borderBottom: (t) => `1px solid ${t.palette.divider}`,
          }}
          color="primary"
          style={{ 
            background: "rgba(0,0,0,0.5)",
            border: "none",
            borderBottom: "1px solid rgba(0,0,0,0.25)" }}
        >
          <Toolbar>
            <Typography
              component="h1"
              variant="h6"
              color="inherit"
              display="flex"
              className="vine-logo"
              sx={{ ml: 1, mr: 1 }}
            >
              <Avatar>
                <img
                  src={VINE_LOGO}
                  width="50px"
                  className="header-logo"
                  alt="Powered by Grape"
                />
              </Avatar>
            </Typography>

            <Typography
              variant="h6"
              color="inherit"
              className="vine-wrapper"
              sx={{ ml: 1, mr: 1,
                textShadow: '1px 1px 2px black' }}
            >
              <div className="vine-title">
                <div data-text="Vine">Vine Dashboard</div>
              </div>
            </Typography>
          </Toolbar>
        </AppBar>
        <Container component="main" maxWidth="lg" sx={{ mb: 4 }}>
          <Paper
            variant="outlined"
            sx={{ my: { xs: 3, md: 6 }, p: { xs: 2, md: 3 } }}
            style={{ background: "rgba(0,0,0,0.5)", borderRadius: "20px" }}
          >
            {tokens &&
              tokens.map(({ programId }) => (
                <TokenLeaderboard key={programId} programId={programId} />
            ))}
          </Paper>
        </Container>
        <Copyright />
      </ThemeProvider>
      {/* Fix for Mobile Viewport Height Issues */}
      <style>
        {`
          @media (max-width: 768px) {
            div[style*="background-attachment: fixed"] {
              background-attachment: scroll !important;
            }
            
            div[style*="minHeight: 100vh"] {
              height: 100%;
              minHeight: -webkit-fill-available; /* Fixes height on iOS Safari */
            }
          }
        `}
      </style>
      </div>
    </div>
  );
};

export default Home;
