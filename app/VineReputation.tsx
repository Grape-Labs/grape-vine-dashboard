// app/VineReputation.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  CircularProgress,
  Tooltip,
  IconButton,
} from "@mui/material";
import { Connection, PublicKey } from "@solana/web3.js";
import { CopyToClipboard } from "react-copy-to-clipboard";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

import {
  fetchUserReputation,
  GRAPE_DAO_ID,
  ReputationAccount,
  ReputationConfigAccount,
} from "./utils/grapeTools/vineReputationClient";
import { REACT_APP_RPC_DEVNET_ENDPOINT } from "./constants";

type VineReputationProps = {
  walletAddress: string | null;     // selected wallet or winner
  daoIdBase58?: string;             // override DAO id, defaults to GRAPE_DAO_ID
  season?: number;                  // OPTIONAL: view specific season (read-only)
  endpoint?: string;                // OPTIONAL: override rpc endpoint (devnet)
};

function shortenPk(base58: string, start = 6, end = 6) {
  if (!base58) return "";
  if (base58.length <= start + end) return base58;
  return `${base58.slice(0, start)}...${base58.slice(-end)}`;
}

const VineReputation: React.FC<VineReputationProps> = ({
  walletAddress,
  daoIdBase58,
  season,
  endpoint,
}) => {
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<ReputationConfigAccount | null>(null);
  const [reputation, setReputation] = useState<ReputationAccount | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [isCopied, setIsCopied] = useState(false);

  // ✅ Create connection based on endpoint (default devnet)
  const conn = useMemo(() => {
    const url = endpoint || REACT_APP_RPC_DEVNET_ENDPOINT;
    return new Connection(url, "confirmed");
  }, [endpoint]);

  useEffect(() => {
    let cancelled = false;

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
        const daoPk = daoIdBase58 ? new PublicKey(daoIdBase58) : GRAPE_DAO_ID;

        // ✅ fetch config + user rep
        // NOTE: this assumes your fetchUserReputation can accept an optional season.
        // If it can't yet, see the tiny patch note below.
        const result = await fetchUserReputation(conn, userPk, daoPk, season);

        if (cancelled) return;

        setConfig(result.config);
        setReputation(result.reputation);
      } catch (e: any) {
        if (cancelled) return;
        console.error("[VineReputation] load error", e);
        setError(e?.message ?? "Failed to load reputation");
        setConfig(null);
        setReputation(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [conn, walletAddress, daoIdBase58, season]);

  if (!walletAddress) return null;

  const shortWalletAddress = shortenPk(walletAddress, 6, 6);
  const daoBase58 = config?.daoId?.toBase58?.() || (daoIdBase58 ?? GRAPE_DAO_ID.toBase58());
  const daoShort = shortenPk(daoBase58, 6, 6);

  const shownSeason =
    typeof season === "number"
      ? season
      : config?.currentSeason;

  return (
    <Box
      sx={{
        p: 1.6,
        background: "rgba(15,23,42,0.82)",
        border: "1px solid rgba(148,163,184,0.35)",
        backdropFilter: "blur(14px)",
        width: "100%",
      }}
    >
      <Typography
        variant="overline"
        sx={{
          letterSpacing: 1,
          opacity: 0.7,
          textTransform: "uppercase",
          display: "block",
          lineHeight: 1.2,
        }}
      >
        Vine Reputation (devnet)
      </Typography>

      {/* Wallet row */}
      <Tooltip title={walletAddress} arrow>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.5 }}>
          <Typography
            variant="caption"
            sx={{
              opacity: 0.9,
              fontFamily:
                '"Roboto Mono","SFMono-Regular",ui-monospace,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace',
              letterSpacing: 0.2,
              whiteSpace: "nowrap",
            }}
          >
            {shortWalletAddress}
          </Typography>
        </Box>
      </Tooltip>

      {loading && (
        <Box sx={{ mt: 1.2, display: "flex", alignItems: "center", gap: 1 }}>
          <CircularProgress size={14} />
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            Loading…
          </Typography>
        </Box>
      )}

      {error && !loading && (
        <Typography
          variant="caption"
          color="error"
          sx={{ mt: 1.2, display: "block" }}
        >
          {error}
        </Typography>
      )}

      {!loading && !error && (
        <Box sx={{ mt: 1.2 }}>
          {/* DAO row */}
          <Typography variant="caption" sx={{ opacity: 0.65 }}>
            DAO
          </Typography>

          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Tooltip title={daoBase58} arrow>
              <Typography
                variant="caption"
                sx={{
                  opacity: 0.9,
                  fontFamily:
                    '"Roboto Mono","SFMono-Regular",ui-monospace,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace',
                  letterSpacing: 0.2,
                }}
              >
                {daoShort}
              </Typography>
            </Tooltip>

            <CopyToClipboard text={daoBase58} onCopy={() => setIsCopied(true)}>
              <IconButton size="small" sx={{ p: 0.35, opacity: 0.8 }}>
                <ContentCopyIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </CopyToClipboard>
          </Box>

          {/* Metrics */}
          <Box
            sx={{
              mt: 1.2,
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 1.2,
            }}
          >
            <Box>
              <Typography variant="caption" sx={{ opacity: 0.65 }}>
                Season
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, opacity: 0.95 }}>
                {shownSeason ?? "—"}
              </Typography>
            </Box>

            <Box>
              <Typography variant="caption" sx={{ opacity: 0.65 }}>
                Points
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, opacity: 0.95 }}>
                {reputation ? reputation.points.toString() : "0"}
              </Typography>
            </Box>

            <Box>
              <Typography variant="caption" sx={{ opacity: 0.65 }}>
                Last slot
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, opacity: 0.95 }}>
                {reputation ? reputation.lastUpdateSlot.toString() : "—"}
              </Typography>
            </Box>
          </Box>

          {!reputation && (
            <Typography
              variant="caption"
              sx={{ mt: 1.1, display: "block", opacity: 0.7 }}
            >
              No reputation entry yet for this wallet in this season.
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
};

export default VineReputation;