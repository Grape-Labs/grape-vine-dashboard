"use client";
import React, { useState } from "react";
import TokenLeaderboard from "./TokenLeaderboard";
import { tokens, VINE_LOGO } from "./constants";
import {
  CssBaseline,
  AppBar,
  Container,
  Toolbar,
  Paper,
  Typography,
} from "@mui/material";
import grapeTheme from "./utils/config/theme";
import { ThemeProvider } from "@mui/material/styles";

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
          style={{ background: "rgba(0,0,0,0.5)" }}
        >
          <Toolbar>
            <Typography
              component="h1"
              variant="h6"
              color="inherit"
              display="flex"
              sx={{ ml: 1, mr: 1 }}
            >
              <img
                src={VINE_LOGO}
                width="50px"
                className="header-logo"
                alt="Powered by Grape"
              />
            </Typography>

            <Typography
              component="h1"
              variant="h6"
              color="inherit"
              display="flex"
              sx={{ ml: 1, mr: 1 }}
            >
              Vine Dashboard
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
    </React.Fragment>
  );
};

export default Home;
