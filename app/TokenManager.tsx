"use client";

import React, { useEffect, useMemo, useState } from "react";
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
  Typography,
  IconButton,
  Tooltip,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

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
import { createMetadataAccountV3, mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { publicKey as UmiPK, createNoopSigner, none } from "@metaplex-foundation/umi";
import { toWeb3JsInstruction } from "@metaplex-foundation/umi-web3js-adapters";

import { Buffer } from "buffer";

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

function shorten(s: string, a = 6, b = 6) {
  if (!s) return "";
  if (s.length <= a + b) return s;
  return `${s.slice(0, a)}…${s.slice(-b)}`;
}

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

function TabPanel(props: { value: number; index: number; children: React.ReactNode }) {
  if (props.value !== props.index) return null;
  return <Box sx={{ pt: 2, display: "grid", gap: 1.2 }}>{props.children}</Box>;
}

/* ---------------------------------- */
/* Component                          */
/* ---------------------------------- */
export interface TokenManagerProps {
  open: boolean;
  onClose: () => void;
  // optional: when you want to pre-fill mint or token details later
  defaultMintBase58?: string;
}

const TokenManager: React.FC<TokenManagerProps> = ({ open, onClose, defaultMintBase58 }) => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();

  const [tab, setTab] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // mint state
  const [mintPk, setMintPk] = useState<PublicKey | null>(null);

  // keep as number, but validate/clamp
  const [decimals, setDecimals] = useState<number>(6);

  // store as string so typing "0." doesn't break UX
  const [mintAmountStr, setMintAmountStr] = useState<string>("");

  // metadata
  const [name, setName] = useState("My Token");
  const [symbol, setSymbol] = useState("TKN");
  const [uri, setUri] = useState("");

  // authority
  const [newAuthority, setNewAuthority] = useState("");

  // feedback
  const [snack, setSnack] = useState<{ msg: string; err?: boolean } | null>(null);
  const closeSnack = () => setSnack(null);

  const safeClose = () => {
    if (!submitting) onClose();
  };

  // reset on open (like ReputationManager)
  useEffect(() => {
    if (!open) return;

    setTab(0);
    setSubmitting(false);
    setSnack(null);

    // optional prefill mint
    if (defaultMintBase58) {
      try {
        setMintPk(new PublicKey(defaultMintBase58));
      } catch {
        setMintPk(null);
      }
    } else {
      setMintPk(null);
    }

    setDecimals(6);
    setMintAmountStr("");

    setName("My Token");
    setSymbol("TKN");
    setUri("");

    setNewAuthority("");
  }, [open, defaultMintBase58]);

  const mintBase58 = useMemo(() => (mintPk ? mintPk.toBase58() : ""), [mintPk]);

  const handleCopy = async (txt: string) => {
    try {
      await navigator.clipboard.writeText(txt);
      setSnack({ msg: "Copied to clipboard" });
    } catch {
      setSnack({ msg: "Copy failed", err: true });
    }
  };

  const parseMintAmount = (): number => {
    const v = Number(mintAmountStr);
    if (!Number.isFinite(v)) return 0;
    return v;
  };

  /* ---------------- CREATE MINT ---------------- */
  const handleCreateMint = async () => {
    try {
      if (!publicKey) throw new Error("Connect wallet");

      const dec = Number(decimals);
      if (!Number.isInteger(dec) || dec < 0 || dec > 9) {
        throw new Error("Decimals must be an integer between 0 and 9");
      }

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
        createInitializeMintInstruction(mintPubkey, dec, publicKey, publicKey, TOKEN_PROGRAM_ID)
      );

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
      if (!publicKey) throw new Error("Connect wallet");
      if (!mintPk) throw new Error("Create or paste a mint first");
      if (!uri?.trim()) throw new Error("Metadata URI is required (upload metadata.json first)");

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
          uri: uri.trim(),
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
      if (!publicKey) throw new Error("Connect wallet");
      if (!mintPk) throw new Error("Missing mint");

      const amount = parseMintAmount();
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount must be > 0");

      const dec = Number(decimals);
      if (!Number.isInteger(dec) || dec < 0 || dec > 9) {
        throw new Error("Decimals must be an integer between 0 and 9");
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

      // safest conversion: use integer base units; still keep it simple
      const baseUnits = BigInt(Math.floor(amount * Math.pow(10, dec)));
      if (baseUnits <= BigInt(0)) throw new Error("Amount too small for the chosen decimals");
      
      tx.add(createMintToCheckedInstruction(mintPk, ata, publicKey, baseUnits, dec));

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
      if (!publicKey) throw new Error("Connect wallet");
      if (!mintPk) throw new Error("Missing mint");
      if (!newAuthority.trim()) throw new Error("Enter a new authority pubkey");

      setSubmitting(true);

      const nextAuth = new PublicKey(newAuthority.trim());

      const tx = new Transaction().add(
        createSetAuthorityInstruction(
          mintPk,
          publicKey,
          0, // AuthorityType.MintTokens
          nextAuth
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
      <Dialog
        open={open}
        onClose={safeClose}
        fullWidth
        maxWidth="md"
        PaperProps={{ sx: glassDialogPaperSx }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          Token Manager
          {mintPk && (
            <Tooltip title={`Copy mint: ${mintBase58}`}>
              <IconButton
                size="small"
                onClick={() => handleCopy(mintBase58)}
                sx={{ color: "rgba(248,250,252,0.9)" }}
              >
                <ContentCopyIcon fontSize="inherit" />
              </IconButton>
            </Tooltip>
          )}
        </DialogTitle>

        <DialogContent>
          {!connected && (
            <Alert severity="info" sx={{ borderRadius: "14px", mb: 1.5 }}>
              Connect wallet to manage tokens
            </Alert>
          )}

          {mintPk && (
            <Box sx={{ mb: 1.5 }}>
              <Typography variant="caption" sx={{ opacity: 0.75 }}>
                Current mint
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                {shorten(mintBase58, 10, 10)}
              </Typography>
            </Box>
          )}

          <Tabs value={tab} onChange={(_, v) => setTab(v)}>
            <Tab label="Create Mint" />
            <Tab label="Metadata" />
            <Tab label="Mint Tokens" />
            <Tab label="Authority" />
          </Tabs>

          <TabPanel value={tab} index={0}>
            <TextField
              label="Decimals (0–9)"
              type="number"
              value={decimals}
              onChange={(e) => setDecimals(Number(e.target.value))}
              InputProps={{ sx: glassFieldSx }}
            />

            <Button onClick={handleCreateMint} disabled={submitting || !connected} sx={glassPrimaryBtnSx}>
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
              label="Metadata URI (from MetadataManager)"
              value={uri}
              onChange={(e) => setUri(e.target.value)}
              InputProps={{ sx: glassFieldSx }}
              placeholder="https://.../metadata.json"
            />

            <Button
              onClick={handleCreateMetadata}
              disabled={submitting || !mintPk || !connected}
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
              value={mintAmountStr}
              onChange={(e) => setMintAmountStr(e.target.value)}
              InputProps={{ sx: glassFieldSx }}
            />
            <Button onClick={handleMintTokens} disabled={submitting || !mintPk || !connected} sx={glassPrimaryBtnSx}>
              Mint Tokens
            </Button>
          </TabPanel>

          <TabPanel value={tab} index={3}>
            <TextField
              label="New Mint Authority"
              value={newAuthority}
              onChange={(e) => setNewAuthority(e.target.value)}
              InputProps={{ sx: glassFieldSx }}
              placeholder="Base58 public key"
            />
            <Button
              onClick={handleTransferAuthority}
              disabled={submitting || !mintPk || !connected}
              sx={glassPrimaryBtnSx}
            >
              Transfer Authority
            </Button>
          </TabPanel>
        </DialogContent>

        <DialogActions>
          <Button onClick={safeClose} disabled={submitting} sx={glassSecondaryBtnSx}>
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
};

export default TokenManager;