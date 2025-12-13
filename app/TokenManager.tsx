"use client";

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  TextField,
  Tabs,
  Tab,
  Alert,
  Snackbar,
  useMediaQuery,
  useTheme, 
  IconButton, 
  Tooltip 
} from "@mui/material";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, SystemProgram, Keypair } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  MintLayout,
  getMinimumBalanceForRentExemptMint,
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  createMintToCheckedInstruction,
  createSetAuthorityInstruction,
} from "@solana/spl-token";

import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  createMetadataAccountV3,
  mplTokenMetadata,
} from "@metaplex-foundation/mpl-token-metadata";
import { publicKey as UmiPK, createNoopSigner, none } from "@metaplex-foundation/umi";
import { toWeb3JsInstruction } from "@metaplex-foundation/umi-web3js-adapters";

import { Buffer } from "buffer";

import TollOutlinedIcon from "@mui/icons-material/TollOutlined"; // nice “coin” style icon

/* ---------------------------------- */
/* Styles (reuse your glass system)   */
/* ---------------------------------- */
const glassDialogPaperSx = {
  borderRadius: "20px",
  background: "rgba(15,23,42,0.86)",
  border: "1px solid rgba(148,163,184,0.28)",
  backdropFilter: "blur(14px)",
  color: "rgba(248,250,252,0.95)",
};

const glassPillSx = {
  borderRadius: "999px",
  background: "rgba(15,23,42,0.9)",
  border: "1px solid rgba(248,250,252,0.4)",
  textTransform: "none",
  fontSize: "0.85rem",
  px: 1.6,
  py: 0.8,
  "&:hover": {
    background: "rgba(15,23,42,0.95)",
    borderColor: "rgba(248,250,252,0.55)",
  },
};

const glassFieldSx = {
  borderRadius: "16px",
  background: "rgba(255,255,255,0.06)",
};

const glassPrimaryBtnSx = {
  textTransform: "none",
  borderRadius: "999px",
  px: 2.2,
  background: "rgba(255,255,255,0.14)",
  border: "1px solid rgba(255,255,255,0.22)",
  color: "rgba(248,250,252,0.95)",
  "&:hover": { background: "rgba(255,255,255,0.20)" },
};

const glassSecondaryBtnSx = {
  textTransform: "none",
  borderRadius: "999px",
  color: "rgba(248,250,252,0.85)",
};

/* ---------------------------------- */
/* Helpers                            */
/* ---------------------------------- */
function findMetadataPda(mint: PublicKey) {
  const PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
  return PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), PROGRAM_ID.toBuffer(), mint.toBuffer()],
    PROGRAM_ID
  )[0];
}

function TabPanel(props: {
  value: number;
  index: number;
  children: React.ReactNode;
}) {
  if (props.value !== props.index) return null;
  return <Box sx={{ pt: 2, display: "grid", gap: 1.2 }}>{props.children}</Box>;
}

/* ---------------------------------- */
/* Component                          */
/* ---------------------------------- */
export default function TokenManager() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();

  // ✅ Fix: internal open state (no function props crossing boundary)
  const [open, setOpen] = useState(false);
  const onClose = () => {
    if (!submitting) setOpen(false);
  };

  const [tab, setTab] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // mint state
  const [mintPk, setMintPk] = useState<PublicKey | null>(null);
  const [decimals, setDecimals] = useState(6);
  const [mintAmount, setMintAmount] = useState(0);

  // metadata
  const [name, setName] = useState("My Token");
  const [symbol, setSymbol] = useState("TKN");
  const [uri, setUri] = useState("");

  // authority
  const [newAuthority, setNewAuthority] = useState("");

  // feedback
  const [snack, setSnack] = useState<{ msg: string; err?: boolean } | null>(null);
  const closeSnack = () => setSnack(null);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  // optional: reset tab/submission when opening
  useEffect(() => {
    if (!open) return;
    setTab(0);
    setSubmitting(false);
  }, [open]);

  /* ---------------- CREATE MINT ---------------- */
  const handleCreateMint = async () => {
    try {
      if (!publicKey) throw new Error("Connect wallet");

      setSubmitting(true);

      const mintKeypair = Keypair.generate();
      const mintPubkey = mintKeypair.publicKey;

      const lamports = await getMinimumBalanceForRentExemptMint(connection);

      const tx = new Transaction().add(
        SystemProgram.createAccount({
          fromPubkey: publicKey,
          newAccountPubkey: mintPubkey,
          space: MintLayout.span,
          lamports,
          programId: TOKEN_PROGRAM_ID,
        }),
        createInitializeMintInstruction(
          mintPubkey,
          decimals,
          publicKey,
          publicKey,
          TOKEN_PROGRAM_ID
        )
      );

      // ✅ IMPORTANT: sign with mintKeypair
      const sig = await sendTransaction(tx, connection, { signers: [mintKeypair] });

      setMintPk(mintPubkey);
      setSnack({ msg: `Mint created: ${sig}` });
    } catch (e: any) {
      setSnack({ msg: e?.message ?? "Create mint failed", err: true });
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------------- METADATA ---------------- */
  const handleCreateMetadata = async () => {
    try {
      if (!publicKey || !mintPk) throw new Error("Missing mint");

      setSubmitting(true);

      const umi = createUmi(connection).use(mplTokenMetadata());
      const metadataPda = findMetadataPda(mintPk);

      const umiIxs = createMetadataAccountV3(umi, {
        metadata: UmiPK(metadataPda.toBase58()),
        mint: UmiPK(mintPk.toBase58()),
        mintAuthority: createNoopSigner(UmiPK(publicKey.toBase58())),
        payer: createNoopSigner(UmiPK(publicKey.toBase58())),
        updateAuthority: UmiPK(publicKey.toBase58()),
        isMutable: true,
        collectionDetails: none(),
        data: {
          name,
          symbol,
          uri,
          sellerFeeBasisPoints: 0,
          creators: none(),
          collection: none(),
          uses: none(),
        },
      }).getInstructions();

      const tx = new Transaction();
      umiIxs.forEach((ix) => tx.add(toWeb3JsInstruction(ix)));

      const sig = await sendTransaction(tx, connection);
      setSnack({ msg: `Metadata created: ${sig}` });
    } catch (e: any) {
      setSnack({ msg: e?.message ?? "Metadata failed", err: true });
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------------- MINT TOKENS ---------------- */
  const handleMintTokens = async () => {
    try {
      if (!publicKey || !mintPk) throw new Error("Missing mint");
      if (!Number.isFinite(mintAmount) || mintAmount <= 0) {
        throw new Error("Amount must be > 0");
      }

      setSubmitting(true);

      const ata = await getAssociatedTokenAddress(
        mintPk,
        publicKey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      const tx = new Transaction();

      // ✅ Fix: only create ATA if it doesn't exist
      const ataInfo = await connection.getAccountInfo(ata);
      if (!ataInfo) {
        tx.add(
          createAssociatedTokenAccountInstruction(
            publicKey,
            ata,
            publicKey,
            mintPk,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
        );
      }

      tx.add(
        createMintToCheckedInstruction(
          mintPk,
          ata,
          publicKey,
          BigInt(Math.floor(mintAmount * Math.pow(10, decimals))),
          decimals
        )
      );

      const sig = await sendTransaction(tx, connection);
      setSnack({ msg: `Minted tokens: ${sig}` });
    } catch (e: any) {
      setSnack({ msg: e?.message ?? "Mint failed", err: true });
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------------- TRANSFER AUTH ---------------- */
  const handleTransferAuthority = async () => {
    try {
      if (!publicKey || !mintPk) throw new Error("Missing mint");
      if (!newAuthority.trim()) throw new Error("Enter a new authority pubkey");

      setSubmitting(true);

      const tx = new Transaction().add(
        createSetAuthorityInstruction(
          mintPk,
          publicKey,
          0, // AuthorityType.MintTokens
          new PublicKey(newAuthority.trim())
        )
      );

      const sig = await sendTransaction(tx, connection);
      setSnack({ msg: `Authority transferred: ${sig}` });
    } catch (e: any) {
      setSnack({ msg: e?.message ?? "Transfer failed", err: true });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* ✅ You can swap this for a MenuItem if you want */}
      {isMobile ? (
        <Tooltip title="Token manager">
          <IconButton
            onClick={() => setOpen(true)}
            size="small"
            sx={{
              ...glassPillSx,
              borderRadius: "50%",
              width: 40,
              height: 40,
              padding: 0,
            }}
          >
            <TollOutlinedIcon />
          </IconButton>
        </Tooltip>
      ) : (
        <Button
          onClick={() => setOpen(true)}
          startIcon={<TollOutlinedIcon fontSize="small" />}
          sx={{
            ...glassPillSx,
          }}
        >
          Token
        </Button>
      )}

      <Dialog
        open={open}
        onClose={onClose}
        fullWidth
        maxWidth="md"
        PaperProps={{ sx: glassDialogPaperSx }}
      >
        <DialogTitle>Token Manager</DialogTitle>

        <DialogContent>
          {!connected && (
            <Alert severity="info" sx={{ borderRadius: "14px", mb: 1.5 }}>
              Connect wallet to manage tokens
            </Alert>
          )}

          <Tabs value={tab} onChange={(_, v) => setTab(v)}>
            <Tab label="Create Mint" />
            <Tab label="Metadata" />
            <Tab label="Mint Tokens" />
            <Tab label="Authority" />
          </Tabs>

          <TabPanel value={tab} index={0}>
            <TextField
              label="Decimals"
              type="number"
              value={decimals}
              onChange={(e) => setDecimals(+e.target.value)}
              InputProps={{ sx: glassFieldSx }}
            />
            <Button
              onClick={handleCreateMint}
              disabled={submitting || !connected}
              sx={glassPrimaryBtnSx}
            >
              {submitting ? "Working…" : "Create Mint"}
            </Button>
          </TabPanel>

          <TabPanel value={tab} index={1}>
            <TextField
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              InputProps={{ sx: glassFieldSx }}
            />
            <TextField
              label="Symbol"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              InputProps={{ sx: glassFieldSx }}
            />
            <TextField
              label="Metadata URI"
              value={uri}
              onChange={(e) => setUri(e.target.value)}
              InputProps={{ sx: glassFieldSx }}
            />
            <Button
              onClick={handleCreateMetadata}
              disabled={submitting || !mintPk}
              sx={glassPrimaryBtnSx}
            >
              Create Metadata
            </Button>
            {!mintPk && (
              <Alert severity="warning" sx={{ borderRadius: "14px" }}>
                Create a mint first.
              </Alert>
            )}
          </TabPanel>

          <TabPanel value={tab} index={2}>
            <TextField
              label="Amount"
              type="number"
              value={mintAmount}
              onChange={(e) => setMintAmount(+e.target.value)}
              InputProps={{ sx: glassFieldSx }}
            />
            <Button
              onClick={handleMintTokens}
              disabled={submitting || !mintPk}
              sx={glassPrimaryBtnSx}
            >
              Mint Tokens
            </Button>
          </TabPanel>

          <TabPanel value={tab} index={3}>
            <TextField
              label="New Mint Authority"
              value={newAuthority}
              onChange={(e) => setNewAuthority(e.target.value)}
              InputProps={{ sx: glassFieldSx }}
            />
            <Button
              onClick={handleTransferAuthority}
              disabled={submitting || !mintPk}
              sx={glassPrimaryBtnSx}
            >
              Transfer Authority
            </Button>
          </TabPanel>
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose} disabled={submitting} sx={glassSecondaryBtnSx}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {snack && (
        <Snackbar open autoHideDuration={5000} onClose={closeSnack}>
          <Alert severity={snack.err ? "error" : "success"} onClose={closeSnack}>
            {snack.msg}
          </Alert>
        </Snackbar>
      )}
    </>
  );
}