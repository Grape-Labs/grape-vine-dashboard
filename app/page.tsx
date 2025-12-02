"use client";
import React from "react";
import TokenLeaderboard from "./TokenLeaderboard";
import { tokens, VINE_LOGO } from "./constants";
import {
  CssBaseline,
  AppBar,
  Container,
  Toolbar,
  Typography,
  Avatar,
  Paper,
  Box,
} from "@mui/material";
import grapeTheme from "./utils/config/theme";
import { ThemeProvider } from "@mui/material/styles";

/* --- FOOTER --- */
function Copyright() {
  return (
    <Typography
      variant="caption"
      sx={{
        display: "block",
        textAlign: "center",
        color: "rgba(255,255,255,0.7)",
        mt: 3,
        mb: 1,
      }}
    >
      Powered by Grape
    </Typography>
  );
}

/* --- MAIN PAGE --- */
const Home: React.FC = () => {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        width: "100vw",
        position: "relative",
        backgroundImage: `url('/images/background_sample_image.webp')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: { xs: "scroll", md: "fixed" },
      }}
    >

      {/* Background overlay only */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
          backdropFilter: "blur(12px)",
          zIndex: 1, // behind everything
        }}
      />

      {/* Foreground content */}
      <ThemeProvider theme={grapeTheme}>
        <CssBaseline />

        <AppBar
          elevation={0}
          position="static"
          sx={{
            borderBottom: "1px solid rgba(255,255,255,0.12)",
            zIndex: 2, // above overlay
            position: "relative"
          }}
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

        {/* ---- CONTENT ---- */}
        <Container
          component="main"
          maxWidth="lg"
          sx={{ mt: 4, mb: 6, position: "relative", zIndex: 2 }}
        >
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2, md: 3 },
              borderRadius: "20px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              backdropFilter: "blur(10px)",
            }}
          >
            {tokens.map(({ programId }) => (
              <TokenLeaderboard key={programId} programId={programId} />
            ))}
          </Paper>
        </Container>

        <Copyright />
      </ThemeProvider>
    </Box>
  );
};

export default Home;