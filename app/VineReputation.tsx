// app/VineReputation.tsx
"use client";

import React, { useEffect, useState } from "react";
import { Box, Typography, CircularProgress, Tooltip } from "@mui/material";
import { Connection, PublicKey } from "@solana/web3.js";

import {
  fetchUserReputation,
  GRAPE_DAO_ID,
  ReputationAccount,
  ReputationConfigAccount,
} from "./utils/grapeTools/vineReputationClient";
import { REACT_APP_RPC_DEVNET_ENDPOINT } from "./constants";

const connection = new Connection(REACT_APP_RPC_DEVNET_ENDPOINT);

type VineReputationProps = {
  walletAddress: string | null;   // pass selected wallet or winner
  daoIdBase58?: string;           // optional override, defaults to GRAPE_DAO_ID
};

const VineReputation: React.FC<VineReputationProps> = ({
  walletAddress,
  daoIdBase58,
}) => {
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<ReputationConfigAccount | null>(null);
  const [reputation, setReputation] = useState<ReputationAccount | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!walletAddress) {
      setConfig(null);
      setReputation(null);
      setError(null);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const userPk = new PublicKey(walletAddress);
        const daoPk = daoIdBase58
          ? new PublicKey(daoIdBase58)
          : GRAPE_DAO_ID;

        const { config, reputation } = await fetchUserReputation(
          connection,
          userPk,
          daoPk
        );

        setConfig(config);
        setReputation(reputation);
      } catch (e: any) {
        console.error("[VineReputation] load error", e);
        setError(e?.message ?? "Failed to load reputation");
      } finally {
        setLoading(false);
      }
    })();
  }, [walletAddress, daoIdBase58]);

  // Nothing to show if no wallet yet
  if (!walletAddress) return null;

  return (
    <Box
      sx={{
        p: 2,
        background: "rgba(15,23,42,0.96)",
        border: "1px solid rgba(148,163,184,0.4)",
      }}
    >
      <Typography
        variant="overline"
        sx={{
          letterSpacing: 1,
          opacity: 0.7,
          textTransform: "uppercase",
        }}
      >
        Vine Reputation (devnet)
      </Typography>

      <Typography
        variant="body2"
        sx={{ mt: 0.5, opacity: 0.85, wordBreak: "break-all" }}
      >
        {walletAddress}
      </Typography>

      {loading && (
        <Box
          sx={{
            mt: 2,
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          <CircularProgress size={16} />
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            Loading reputation…
          </Typography>
        </Box>
      )}

      {error && !loading && (
        <Typography
          variant="caption"
          color="error"
          sx={{ mt: 2, display: "block" }}
        >
          {error}
        </Typography>
      )}

      {!loading && !error && config && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            DAO ID:
          </Typography>
          <Typography
            variant="body2"
            sx={{ opacity: 0.9, wordBreak: "break-all" }}
          >
            {config.daoId.toBase58()}
          </Typography>

          <Box
            sx={{
              mt: 1.5,
              display: "flex",
              flexWrap: "wrap",
              gap: 2,
            }}
          >
            <Box>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                Season
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                {config.currentSeason}
              </Typography>
            </Box>

            <Box>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                Points
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                {reputation ? reputation.points.toString() : "0"}
              </Typography>
            </Box>

            <Box>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                Last update slot
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                {reputation ? reputation.lastUpdateSlot.toString() : "—"}
              </Typography>
            </Box>
          </Box>

          {!reputation && (
            <Typography
              variant="caption"
              sx={{ mt: 1.5, display: "block", opacity: 0.7 }}
            >
              No reputation entry yet for this wallet in the current season.
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
};

export default VineReputation;