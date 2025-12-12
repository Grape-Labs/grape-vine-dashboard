"use client";

import React, { useEffect, useMemo, useState } from "react";
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
import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  Transaction,
} from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";

// ------------------ props ------------------

type CreateReputationSpaceProps = {
  open: boolean;
  onClose: () => void;
  defaultDaoIdBase58?: string;
  defaultRepMintBase58?: string;
  defaultInitialSeason?: number;
  defaultMetadataUri?: string;
};

// ------------------ program ------------------

export const VINE_REP_PROGRAM_ID = new PublicKey(
  "V1NE6WCWJPRiVFq5DtaN8p87M9DmmUd2zQuVbvLgQwX"
);

function getConfigPda(daoId: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("config"), daoId.toBuffer()],
    VINE_REP_PROGRAM_ID
  );
}

function getProjectMetaPda(daoId: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("project_meta"), daoId.toBuffer()],
    VINE_REP_PROGRAM_ID
  );
}

/** ------------------------------
 *  Anchor discriminator helpers
 *  ------------------------------ */
async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  const hashBuf = await crypto.subtle.digest("SHA-256", copy);
  return new Uint8Array(hashBuf);
}

const discCache = new Map<string, Uint8Array>();

async function anchorIxDisc(ixName: string): Promise<Uint8Array> {
  const key = `global:${ixName}`;
  const cached = discCache.get(key);
  if (cached) return cached;

  const bytes = new TextEncoder().encode(key);
  const hash = await sha256(bytes);
  const disc = hash.slice(0, 8);

  discCache.set(key, disc);
  return disc;
}

function u16le(n: number) {
  const b = new Uint8Array(2);
  b[0] = n & 0xff;
  b[1] = (n >> 8) & 0xff;
  return b;
}

function u32le(n: number) {
  const b = new Uint8Array(4);
  b[0] = n & 0xff;
  b[1] = (n >> 8) & 0xff;
  b[2] = (n >> 16) & 0xff;
  b[3] = (n >> 24) & 0xff;
  return b;
}

function encodeAnchorString(s: string) {
  const bytes = new TextEncoder().encode(s ?? "");
  return { len: u32le(bytes.length), bytes };
}

// ------------------ component ------------------

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
  const [initialSeason, setInitialSeason] = useState<number>(defaultInitialSeason);
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
  }, [open, defaultDaoIdBase58, defaultRepMintBase58, defaultInitialSeason, defaultMetadataUri]);

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

  async function ixInitializeConfig(args: {
    daoId: PublicKey;
    repMint: PublicKey;
    initialSeason: number;
    authority: PublicKey; // NOT signer (unchecked) in your Rust
    payer: PublicKey;     // signer
  }) {
    const disc = await anchorIxDisc("initialize_config");
    const data = new Uint8Array(8 + 32 + 32 + 2);

    let o = 0;
    data.set(disc, o); o += 8;
    data.set(args.daoId.toBytes(), o); o += 32;
    data.set(args.repMint.toBytes(), o); o += 32;
    data.set(u16le(args.initialSeason & 0xffff), o); o += 2;

    const [configPda] = getConfigPda(args.daoId);

    return new TransactionInstruction({
      programId: VINE_REP_PROGRAM_ID,
      keys: [
        { pubkey: configPda, isSigner: false, isWritable: true },
        { pubkey: args.authority, isSigner: false, isWritable: false }, // ✅ not signer
        { pubkey: args.payer, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: Buffer.from(data),
    });
  }

  async function ixUpsertProjectMetadata(args: {
    daoId: PublicKey;
    authority: PublicKey;
    payer: PublicKey;
    metadataUri: string;
  }) {
    const disc = await anchorIxDisc("upsert_project_metadata");
    const { len, bytes } = encodeAnchorString(args.metadataUri || "");

    const data = new Uint8Array(8 + 4 + bytes.length);
    data.set(disc, 0);
    data.set(len, 8);
    data.set(bytes, 12);

    const [configPda] = getConfigPda(args.daoId);
    const [metaPda] = getProjectMetaPda(args.daoId);

    return new TransactionInstruction({
      programId: VINE_REP_PROGRAM_ID,
      keys: [
        { pubkey: configPda, isSigner: false, isWritable: false },
        { pubkey: metaPda, isSigner: false, isWritable: true },
        { pubkey: args.authority, isSigner: true, isWritable: false },
        { pubkey: args.payer, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: Buffer.from(data),
    });
  }

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

      // Optional: prevent “already in use” confusion
      const [configPda] = getConfigPda(daoPubkey);
      const existing = await connection.getAccountInfo(configPda);
      if (existing) {
        throw new Error("Config PDA already exists for this DAO. Use Manage Reputation Space instead.");
      }

      const ixs: TransactionInstruction[] = [];

      ixs.push(
        await ixInitializeConfig({
          daoId: daoPubkey,
          repMint: repMintPubkey,
          initialSeason: season,
          authority: publicKey,
          payer: publicKey,
        })
      );

      if (metadataUri?.trim()) {
        ixs.push(
          await ixUpsertProjectMetadata({
            daoId: daoPubkey,
            authority: publicKey,
            payer: publicKey,
            metadataUri: metadataUri.trim(),
          })
        );
      }

      const tx = new Transaction().add(...ixs);
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
            Devnet • Your connected wallet is authority + payer
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
              InputProps={{ sx: { borderRadius: "16px", background: "rgba(255,255,255,0.06)" } }}
            />

            <TextField
              label="Reputation mint"
              fullWidth
              value={repMint}
              onChange={(e) => setRepMint(e.target.value)}
              disabled={submitting}
              InputProps={{ sx: { borderRadius: "16px", background: "rgba(255,255,255,0.06)" } }}
            />

            <TextField
              label="Initial season"
              type="number"
              fullWidth
              value={initialSeason}
              onChange={(e) => setInitialSeason(Number(e.target.value) || 1)}
              disabled={submitting}
              InputProps={{ sx: { borderRadius: "16px", background: "rgba(255,255,255,0.06)" } }}
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
              InputProps={{ sx: { borderRadius: "16px", background: "rgba(255,255,255,0.06)" } }}
              helperText="If provided, we will call upsert_project_metadata after creating the config."
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
            sx={{ textTransform: "none", borderRadius: "999px", color: "rgba(248,250,252,0.85)" }}
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
          <Alert onClose={handleSnackbarClose} severity={snackSeverity} sx={{ width: "100%" }}>
            {snackText}
          </Alert>
        </Snackbar>
      )}
    </>
  );
};

export default CreateReputationSpace;