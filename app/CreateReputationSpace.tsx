"use client";

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Snackbar,
  Alert,
  Button,
  Box,
  Typography,
} from "@mui/material";
import { PublicKey, TransactionInstruction, Transaction } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";

import {
  VINE_REP_PROGRAM_ID,
  getConfigPda,
  buildInitializeConfigIx,
  buildUpsertProjectMetadataIx,
} from "@grapenpm/vine-reputation-client";

type CreateReputationSpaceProps = {
  open: boolean;
  onClose: () => void;
  defaultDaoIdBase58?: string;
  defaultRepMintBase58?: string;
  defaultInitialSeason?: number;
  defaultMetadataUri?: string;
};

const CreateReputationSpace: React.FC<CreateReputationSpaceProps> = ({
  open,
  onClose,
  defaultDaoIdBase58 = "",
  defaultRepMintBase58 = "",
  defaultInitialSeason = 1,
  defaultMetadataUri = "",
}) => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();

  const [daoId, setDaoId] = useState(defaultDaoIdBase58);
  const [repMint, setRepMint] = useState(defaultRepMintBase58);
  const [initialSeason, setInitialSeason] = useState<number>(
    defaultInitialSeason
  );
  const [metadataUri, setMetadataUri] = useState(defaultMetadataUri);

  const [submitting, setSubmitting] = useState(false);
  const [snackMsg, setSnackMsg] = useState<string>("");
  const [snackError, setSnackError] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    setDaoId(defaultDaoIdBase58 || "");
    setRepMint(defaultRepMintBase58 || "");
    setInitialSeason(defaultInitialSeason || 1);
    setMetadataUri(defaultMetadataUri || "");
    setSnackMsg("");
    setSnackError("");
    setSubmitting(false);
  }, [
    open,
    defaultDaoIdBase58,
    defaultRepMintBase58,
    defaultInitialSeason,
    defaultMetadataUri,
  ]);

  const disabled =
    submitting ||
    !connected ||
    !publicKey ||
    !daoId?.trim() ||
    !repMint?.trim() ||
    !Number.isFinite(initialSeason) ||
    initialSeason <= 0 ||
    initialSeason > 65535;

  const handleClose = () => {
    if (!submitting) onClose();
  };

  const handleSnackbarClose = () => {
    setSnackMsg("");
    setSnackError("");
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setSnackMsg("");
      setSnackError("");

      if (!publicKey) throw new Error("Connect a wallet first.");

      const daoPubkey = new PublicKey(daoId.trim());
      const repMintPubkey = new PublicKey(repMint.trim());
      const season = Number(initialSeason);

      if (!Number.isFinite(season) || season <= 0 || season > 65535) {
        throw new Error("Initial season must be 1–65535");
      }

      // prevent “already exists” confusion
      const [configPda] = getConfigPda(daoPubkey);
      const existing = await connection.getAccountInfo(configPda);
      if (existing) {
        throw new Error(
          "Config PDA already exists for this DAO. Use Manage Reputation Space instead."
        );
      }

      const ixs: TransactionInstruction[] = [];

      // ✅ init config
      ixs.push(
        await buildInitializeConfigIx({
          daoId: daoPubkey,
          repMint: repMintPubkey,
          initialSeason: season,
          authority: publicKey,
          payer: publicKey,
        })
      );

      // ✅ optional metadata
      if (metadataUri?.trim()) {
        ixs.push(
          await buildUpsertProjectMetadataIx({
            daoId: daoPubkey,
            authority: publicKey,
            payer: publicKey,
            metadataUri: metadataUri.trim(),
          })
        );
      }

      const tx = new Transaction().add(...ixs);

      // (optional) set recent blockhash yourself; wallet adapter usually handles it
      const sig = await sendTransaction(tx, connection);

      setSnackMsg(`✅ Created reputation space. Tx: ${sig}`);
      onClose();
    } catch (e: any) {
      console.error(e);
      setSnackError(e?.message ?? "Failed to create reputation space");
    } finally {
      setSubmitting(false);
    }
  };

  const hasSnack = Boolean(snackMsg || snackError);
  const snackText = snackError || snackMsg;
  const snackSeverity: "success" | "error" = snackError ? "error" : "success";

  return (
    <>
      <Dialog
        open={open}
        onClose={handleClose}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: {
            borderRadius: "20px",
            background: "rgba(15,23,42,0.86)",
            border: "1px solid rgba(148,163,184,0.28)",
            backdropFilter: "blur(14px)",
            color: "rgba(248,250,252,0.95)",
          },
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 650, letterSpacing: 0.2 }}>
            Create Reputation Space
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.75 }}>
            Devnet • Your connected wallet is authority + payer • Program{" "}
            {VINE_REP_PROGRAM_ID.toBase58()}
          </Typography>
        </DialogTitle>

        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ display: "grid", gap: 1.5 }}>
            <TextField
              label="DAO ID (realm / governance pk)"
              fullWidth
              value={daoId}
              onChange={(e) => setDaoId(e.target.value)}
              disabled={submitting}
              InputProps={{
                sx: {
                  borderRadius: "16px",
                  background: "rgba(255,255,255,0.06)",
                },
              }}
            />

            <TextField
              label="Reputation mint"
              fullWidth
              value={repMint}
              onChange={(e) => setRepMint(e.target.value)}
              disabled={submitting}
              InputProps={{
                sx: {
                  borderRadius: "16px",
                  background: "rgba(255,255,255,0.06)",
                },
              }}
            />

            <TextField
              label="Initial season"
              type="number"
              fullWidth
              value={initialSeason}
              onChange={(e) => setInitialSeason(Number(e.target.value) || 1)}
              disabled={submitting}
              InputProps={{
                sx: {
                  borderRadius: "16px",
                  background: "rgba(255,255,255,0.06)",
                },
              }}
              helperText="1–65535"
              FormHelperTextProps={{ sx: { opacity: 0.7 } }}
            />

            <TextField
              label="Metadata URI (optional)"
              fullWidth
              value={metadataUri}
              onChange={(e) => setMetadataUri(e.target.value)}
              disabled={submitting}
              placeholder="https://.../metadata.json"
              InputProps={{
                sx: {
                  borderRadius: "16px",
                  background: "rgba(255,255,255,0.06)",
                },
              }}
              helperText="If provided, we will upsert project metadata after creating the config."
              FormHelperTextProps={{ sx: { opacity: 0.7 } }}
            />
          </Box>

          {!connected && (
            <Alert severity="info" sx={{ mt: 2, borderRadius: "14px" }}>
              Connect your wallet to create the space.
            </Alert>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={handleClose}
            disabled={submitting}
            sx={{
              textTransform: "none",
              borderRadius: "999px",
              color: "rgba(248,250,252,0.85)",
            }}
          >
            Cancel
          </Button>

          <Button
            onClick={handleSubmit}
            disabled={disabled}
            variant="contained"
            sx={{
              textTransform: "none",
              borderRadius: "999px",
              px: 2.2,
              background: "rgba(255,255,255,0.14)",
              border: "1px solid rgba(255,255,255,0.22)",
              color: "rgba(248,250,252,0.95)",
              "&:hover": { background: "rgba(255,255,255,0.20)" },
            }}
          >
            {submitting ? "Creating…" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      {hasSnack && (
        <Snackbar
          open={hasSnack}
          autoHideDuration={4500}
          onClose={handleSnackbarClose}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert
            onClose={handleSnackbarClose}
            severity={snackSeverity}
            sx={{ width: "100%" }}
          >
            {snackText}
          </Alert>
        </Snackbar>
      )}
    </>
  );
};

export default CreateReputationSpace;