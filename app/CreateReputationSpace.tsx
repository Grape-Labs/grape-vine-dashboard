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
  Divider,
  MenuItem,
  FormControlLabel,
  Switch,
  Chip,
} from "@mui/material";
import {
  Keypair,
  PublicKey,
  TransactionInstruction,
  Transaction,
  SendTransactionError,
  SystemProgram,
} from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";

import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import Tooltip from "@mui/material/Tooltip";

import {
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  createInitializeMintInstruction,
  getMinimumBalanceForRentExemptMint,
} from "@solana/spl-token";

import {
  VINE_REP_PROGRAM_ID,
  getConfigPda,
  buildInitializeConfigIx,
  buildUpsertProjectMetadataIx,
} from "@grapenpm/vine-reputation-client";

type ThemeMode = "auto" | "dark" | "light";

const DEFAULT_LOGO_URL =
  "https://gateway.irys.xyz/3Xjr1huLWYpQjNSjK3svyyNWmjJuV4DykC8JaSCCW382";

const BG_TEMPLATES: Array<{
  id: string;
  label: string;
  url: string;
  mode?: ThemeMode;
  primary?: string;
  opacity?: number; // 0..1
  blur?: number; // px
}> = [
  {
    id: "vine-bg",
    label: "Vine BG",
    url: "https://gateway.irys.xyz/BQPZ1MGv6Wo2nLKc3r4LyeUW3DdqKjUVHe3eThabXkgG",
    mode: "dark",
    primary: "#A78BFA",
    opacity: 0.48,
    blur: 14,
  },
  {
    id: "space",
    label: "Space",
    url: "https://gateway.irys.xyz/4A2AmTit1ZZ7e4ecJvNgRPoBDe7KVYyR56fkmVNrzqFx",
    mode: "dark",
    primary: "#38BDF8",
    opacity: 0.55,
    blur: 18,
  },
  {
    id: "void",
    label: "Void",
    url: "https://gateway.irys.xyz/GYfQxuQjjdT6XCKkMs8kv7iF5tUhR1QocAE9bUg2ja9S",
    mode: "dark",
    primary: "#E5E7EB",
    opacity: 0.62,
    blur: 20,
  },
  {
    id: "splatter",
    label: "Splatter",
    url: "https://gateway.irys.xyz/Gw59Crs8wpz8pPJzmPTZJoGkkj1cAAqv2e3Gjum5GfZ",
    mode: "dark",
    primary: "#F472B6",
    opacity: 0.45,
    blur: 12,
  },
  {
    id: "gold",
    label: "Gold",
    url: "https://gateway.irys.xyz/CpwWNtBBz1XdJmZ2LjXGTfnw4ARfoN1JsfufCBLhpebq",
    mode: "dark",
    primary: "#FBBF24",
    opacity: 0.5,
    blur: 14,
  },
  {
    id: "og",
    label: "OG",
    url: "https://gateway.irys.xyz/64msLezDRMRcFDpeWTcBsE3aEP7Pfx5e3MLEcZkFoMXz",
    mode: "dark",
    primary: "#60A5FA",
    opacity: 0.3,
    blur: 8,
  },
  {
    id: "comic",
    label: "Comic",
    url: "https://gateway.irys.xyz/2g4r4W7bYJAK6GrKDiatswXRV4L9iUqKGjCnyGrRgDe7",
    mode: "dark",
    primary: "#60A5FA",
    opacity: 0.42,
    blur: 10,
  },
  {
    id: "vine-pop",
    label: "Vine Pop",
    url: "https://gateway.irys.xyz/4N33hRRHbd4B2E9jrXuzFHGqpr2ha92okNn7xrgbXwxE",
    mode: "dark",
    primary: "#34D399",
    opacity: 0.42,
    blur: 10,
  },
  {
    id: "candy",
    label: "Candy",
    url: "https://gateway.irys.xyz/GHSP3Wfr6CTTYWm7GBnEaXH7oN2ecvbcDDgCsrCiWP8K",
    mode: "dark",
    primary: "#F472B6",
    opacity: 0.44,
    blur: 12,
  },
  {
    id: "universe",
    label: "Universe",
    url: "https://gateway.irys.xyz/3iyYFDfJMkAiomwHNdRgzJMKuQM1RXscUc1H6WC7DtFT",
    mode: "dark",
    primary: "#A78BFA",
    opacity: 0.55,
    blur: 18,
  },
  {
    id: "deep-sea",
    label: "Deep Sea",
    url: "https://gateway.irys.xyz/8GzeGjrt12f8q4EkmshzyXJ9dYpZt5uSToFCSBBjVr7y",
    mode: "dark",
    primary: "#22D3EE",
    opacity: 0.55,
    blur: 16,
  },
  {
    id: "matrix",
    label: "Matrix",
    url: "https://gateway.irys.xyz/6Cnuuk2BVG5ZRmB9G7zwctJYacAfyNz7Htu2pL4PcDQa",
    mode: "dark",
    primary: "#34D399",
    opacity: 0.55,
    blur: 16,
  },
];

const darkFieldSx = {
  "& .MuiInputLabel-root": { color: "rgba(248,250,252,0.78)" },
  "& .MuiInputLabel-root.Mui-focused": { color: "rgba(248,250,252,0.90)" },

  "& .MuiOutlinedInput-root": {
    borderRadius: "16px",
    background: "rgba(255,255,255,0.06)",
    color: "rgba(248,250,252,0.95)",
  },

  "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.16)" },
  "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": {
    borderColor: "rgba(255,255,255,0.26)",
  },
  "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {
    borderColor: "rgba(255,255,255,0.30)",
  },

  "& input::placeholder": { color: "rgba(248,250,252,0.45)", opacity: 1 },

  "& .MuiFormHelperText-root": { color: "rgba(248,250,252,0.60)" },
};

type CreateReputationSpaceProps = {
  open: boolean;
  onClose: () => void;
  onCreated?: (daoIdBase58: string) => void;
  defaultDaoIdBase58?: string;
  defaultRepMintBase58?: string;
  defaultInitialSeason?: number;
  defaultMetadataUri?: string;
};

function safeHex(v: string) {
  const s = (v || "").trim();
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(s)) return s;
  return "";
}
function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
function safeNum(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

async function uploadViaIrys(file: File, contentType?: string): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  if (contentType) fd.append("contentType", contentType);

  const res = await fetch(`/api/storage/upload?provider=irys`, { method: "POST", body: fd });
  const json = await res.json().catch(() => ({}));

  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || `Upload failed (${res.status})`);
  }
  return json.url as string;
}

export default function CreateReputationSpace({
  open,
  onClose,
  onCreated,
  defaultDaoIdBase58 = "",
  defaultRepMintBase58 = "",
  defaultInitialSeason = 1,
  defaultMetadataUri = "",
}: CreateReputationSpaceProps) {
  const { connection } = useConnection();
  const { publicKey, connected, signTransaction } = useWallet();

  const [daoId, setDaoId] = useState(defaultDaoIdBase58);
  const [repMint, setRepMint] = useState(defaultRepMintBase58);
  const [initialSeason, setInitialSeason] = useState<number>(defaultInitialSeason || 1);
  const [metadataUri, setMetadataUri] = useState(defaultMetadataUri);

  const [submitting, setSubmitting] = useState(false);
  const [creatingMint, setCreatingMint] = useState(false);

  const [snackMsg, setSnackMsg] = useState<string>("");
  const [snackError, setSnackError] = useState<string>("");

  // -------------------------
  // Theme (optional)
  // -------------------------
  const [enableTheme, setEnableTheme] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const [templateId, setTemplateId] = useState<string>(BG_TEMPLATES[0]?.id || "vine-bg");
  const activeTemplate = useMemo(
    () => BG_TEMPLATES.find((t) => t.id === templateId) || BG_TEMPLATES[0],
    [templateId]
  );

  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
  const [themePrimary, setThemePrimary] = useState<string>("#A78BFA");
  const [themeBgOpacity, setThemeBgOpacity] = useState<number>(0.5);
  const [themeBgBlur, setThemeBgBlur] = useState<number>(14);

  // apply defaults when template changes
  useEffect(() => {
    if (!activeTemplate) return;
    setThemeMode(activeTemplate.mode || "dark");
    setThemePrimary(activeTemplate.primary || "#A78BFA");
    setThemeBgOpacity(clamp01(safeNum(activeTemplate.opacity, 0.5)));
    setThemeBgBlur(Math.max(0, safeNum(activeTemplate.blur, 14)));
  }, [activeTemplate?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;

    const nextDao = (defaultDaoIdBase58 || "").trim() || recommendNewDaoId();

    setDaoId(nextDao);
    setRepMint((defaultRepMintBase58 || "").trim());
    setInitialSeason(Number(defaultInitialSeason) || 1);
    setMetadataUri((defaultMetadataUri || "").trim());

    setSnackMsg("");
    setSnackError("");
    setSubmitting(false);
    setCreatingMint(false);

    // theme reset
    setEnableTheme(false);
    setProjectName("");
    setProjectDescription("");
    setLogoFile(null);
    setTemplateId(BG_TEMPLATES[0]?.id || "vine-bg");
  }, [open, defaultDaoIdBase58, defaultRepMintBase58, defaultInitialSeason, defaultMetadataUri]);

  const disabled =
    submitting ||
    creatingMint ||
    !connected ||
    !publicKey ||
    !daoId?.trim() ||
    !repMint?.trim() ||
    !Number.isFinite(initialSeason) ||
    initialSeason <= 0 ||
    initialSeason > 65535;

  const handleClose = () => {
    if (!submitting && !creatingMint) onClose();
  };

  const handleSnackbarClose = () => {
    setSnackMsg("");
    setSnackError("");
  };

  function recommendNewDaoId(): string {
    return Keypair.generate().publicKey.toBase58();
  }

  const createReputationMint = async () => {
    try {
      setCreatingMint(true);
      setSnackMsg("");
      setSnackError("");

      if (!publicKey) throw new Error("Connect a wallet first.");
      if (!signTransaction) throw new Error("Wallet does not support signTransaction().");

      const mintKeypair = Keypair.generate();
      const lamports = await getMinimumBalanceForRentExemptMint(connection);
      const decimals = 0;

      const ixs: TransactionInstruction[] = [
        SystemProgram.createAccount({
          fromPubkey: publicKey,
          newAccountPubkey: mintKeypair.publicKey,
          space: MINT_SIZE,
          lamports,
          programId: TOKEN_PROGRAM_ID,
        }),
        createInitializeMintInstruction(
          mintKeypair.publicKey,
          decimals,
          publicKey,
          publicKey,
          TOKEN_PROGRAM_ID
        ),
      ];

      const tx = new Transaction().add(...ixs);
      tx.feePayer = publicKey;

      const latest = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = latest.blockhash;

      tx.partialSign(mintKeypair);

      const signed = await signTransaction(tx);

      let sig: string;
      try {
        sig = await connection.sendRawTransaction(signed.serialize(), {
          skipPreflight: false,
          preflightCommitment: "confirmed",
          maxRetries: 3,
        });
      } catch (e: any) {
        if (e instanceof SendTransactionError) {
          const logs = await e.getLogs(connection);
          console.error("MINT SEND logs:\n" + (logs || []).join("\n"));
        }
        throw e;
      }

      await connection.confirmTransaction({ signature: sig, ...latest }, "confirmed");

      setRepMint(mintKeypair.publicKey.toBase58());
      setSnackMsg(`✅ Created mint. Tx: ${sig}`);
    } catch (e: any) {
      console.error("CREATE MINT ERROR", e);
      setSnackError(e?.message ?? "Failed to create mint");
    } finally {
      setCreatingMint(false);
    }
  };

  async function ensureThemeMetadataUri(): Promise<string | null> {
    // If user already set a URI, don’t touch it.
    if (metadataUri?.trim()) return metadataUri.trim();

    // Only auto-generate when theme is enabled.
    if (!enableTheme) return null;

    // If they didn’t enter anything, don’t force metadata.
    const hasAny =
      !!projectName.trim() || !!projectDescription.trim() || !!logoFile || !!activeTemplate?.url;
    if (!hasAny) return null;

    // 1) image url (upload file if present else default)
    let imageUrl = DEFAULT_LOGO_URL;
    if (logoFile) {
      imageUrl = await uploadViaIrys(logoFile, logoFile.type || "image/*");
    }

    const primary = safeHex(themePrimary) || (activeTemplate?.primary || "#A78BFA");
    const meta: any = {
      ...(projectName.trim() ? { name: projectName.trim() } : {}),
      ...(projectDescription.trim() ? { description: projectDescription.trim() } : {}),
      image: imageUrl,
      // nice to include
      properties: {
        files: [{ uri: imageUrl, type: logoFile?.type || "image/*" }],
        category: "image",
      },
      vine: {
        theme: {
          mode: themeMode,
          primary,
          background_image: activeTemplate?.url,
          background_opacity: clamp01(safeNum(themeBgOpacity, activeTemplate?.opacity ?? 0.5)),
          background_blur: Math.max(0, safeNum(themeBgBlur, activeTemplate?.blur ?? 14)),
          background_position: "center",
          background_size: "cover",
          background_repeat: "no-repeat",
        },
      },
    };

    // 2) upload metadata.json
    const metaFile = new File([JSON.stringify(meta, null, 2)], "metadata.json", {
      type: "application/json",
    });
    const url = await uploadViaIrys(metaFile, "application/json");
    setMetadataUri(url);
    setSnackMsg("✅ Theme metadata created and attached");
    return url;
  }

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setSnackMsg("");
      setSnackError("");

      if (!publicKey) throw new Error("Connect a wallet first.");
      if (!signTransaction) throw new Error("Wallet does not support signTransaction().");

      const daoPubkey = new PublicKey(daoId.trim());
      const repMintPubkey = new PublicKey(repMint.trim());
      const season = Number(initialSeason);

      const [configPda] = getConfigPda(daoPubkey);
      const existing = await connection.getAccountInfo(configPda, "confirmed");
      if (existing) throw new Error("Config PDA already exists for this DAO.");

      // If theme enabled and no URI yet, auto-create metadata now
      const maybeMetaUri = await ensureThemeMetadataUri();

      const ixs: TransactionInstruction[] = [];
      ixs.push(
        await buildInitializeConfigIx({
          daoId: daoPubkey,
          repMint: repMintPubkey,
          initialSeason: season,
          authority: publicKey,
          payer: publicKey,
        })
      );

      const finalUri = (maybeMetaUri || metadataUri || "").trim();
      if (finalUri) {
        ixs.push(
          await buildUpsertProjectMetadataIx({
            daoId: daoPubkey,
            authority: publicKey,
            payer: publicKey,
            metadataUri: finalUri,
          })
        );
      }

      const tx = new Transaction().add(...ixs);
      tx.feePayer = publicKey;

      const latest = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = latest.blockhash;

      const signed = await signTransaction(tx);

      let sig: string;
      try {
        sig = await connection.sendRawTransaction(signed.serialize(), {
          skipPreflight: false,
          preflightCommitment: "confirmed",
          maxRetries: 3,
        });
      } catch (e: any) {
        if (e instanceof SendTransactionError) {
          const logs = await e.getLogs(connection);
          console.error("SEND logs:\n" + (logs || []).join("\n"));
        }
        throw e;
      }

      await connection.confirmTransaction({ signature: sig, ...latest }, "confirmed");

      setSnackMsg(`✅ Created reputation space. Tx: ${sig}`);
      onCreated?.(daoPubkey.toBase58());
      onClose();
    } catch (e: any) {
      console.error("CREATE SPACE ERROR", e);
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
            Your connected wallet is authority + payer • Program {VINE_REP_PROGRAM_ID.toBase58()}
          </Typography>
        </DialogTitle>

        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ display: "grid", gap: 1.5 }}>
            <Box sx={{ display: "flex", gap: 1, mt: 2, alignItems: "flex-start", flexWrap: "wrap" }}>
              <TextField
                label="DAO ID (multi-sig / governance pk)"
                fullWidth
                value={daoId}
                onChange={(e) => setDaoId(e.target.value)}
                disabled={submitting || creatingMint}
                helperText="We recommend a fresh DAO ID by default. You can paste an existing Multi-Sig Governance pk if you have one."
                FormHelperTextProps={{ sx: { opacity: 0.7 } }}
                sx={darkFieldSx}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title="Recommend a new DAO ID">
                        <IconButton
                          size="small"
                          onClick={() => {
                            const next = recommendNewDaoId();
                            setDaoId(next);
                            setSnackMsg("Suggested new DAO ID");
                            setSnackError("");
                          }}
                          disabled={submitting || creatingMint}
                          sx={{
                            mr: 0.25,
                            borderRadius: "10px",
                            border: "1px solid rgba(255,255,255,0.18)",
                            background: "rgba(255,255,255,0.06)",
                            "&:hover": { background: "rgba(255,255,255,0.10)" },
                          }}
                        >
                          <AutoAwesomeIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>

            <TextField
              label="Reputation mint"
              fullWidth
              value={repMint}
              onChange={(e) => setRepMint(e.target.value)}
              disabled={submitting || creatingMint}
              sx={darkFieldSx}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title="Create a new SPL mint and fill this field">
                      <span>
                        <IconButton
                          size="small"
                          onClick={createReputationMint}
                          disabled={submitting || creatingMint || !connected || !publicKey}
                          sx={{
                            mr: 0.25,
                            borderRadius: "10px",
                            border: "1px solid rgba(255,255,255,0.18)",
                            background: "rgba(255,255,255,0.06)",
                            "&:hover": { background: "rgba(255,255,255,0.10)" },
                          }}
                        >
                          <AutoAwesomeIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </InputAdornment>
                ),
              }}
              helperText="Paste an existing mint, or click the magic button to create one."
              FormHelperTextProps={{ sx: { opacity: 0.7 } }}
            />

            <TextField
              label="Initial season"
              type="number"
              fullWidth
              value={initialSeason}
              onChange={(e) => setInitialSeason(Number(e.target.value) || 1)}
              disabled={submitting || creatingMint}
              InputProps={{ sx: { borderRadius: "16px", background: "rgba(255,255,255,0.06)" } }}
              helperText="1–65535"
              FormHelperTextProps={{ sx: { opacity: 0.7 } }}
              sx={darkFieldSx}
            />

            <Divider sx={{ borderColor: "rgba(148,163,184,0.25)", my: 0.5 }} />

            <FormControlLabel
              control={
                <Switch checked={enableTheme} onChange={(e) => setEnableTheme(e.target.checked)} />
              }
              label="Theme (optional) • set name, description, logo, and background"
            />

            {enableTheme && (
              <Box sx={{ display: "grid", gap: 1.2 }}>
                <TextField
                  label="Project name"
                  fullWidth
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  disabled={submitting || creatingMint}
                  sx={darkFieldSx}
                />

                <TextField
                  label="Project description"
                  fullWidth
                  multiline
                  minRows={2}
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  disabled={submitting || creatingMint}
                  sx={darkFieldSx}
                />

                {/* Logo upload (optional) */}
                <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                  <Button
                    component="label"
                    disabled={submitting || creatingMint}
                    sx={{
                      textTransform: "none",
                      borderRadius: "999px",
                      border: "1px solid rgba(255,255,255,0.22)",
                      color: "rgba(248,250,252,0.95)",
                    }}
                  >
                    Choose logo (optional)
                    <input
                      hidden
                      type="file"
                      accept="image/*"
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const f = e.target.files?.[0] ?? null;
                        setLogoFile(f);
                        e.target.value = "";
                      }}
                    />
                  </Button>

                  <Typography variant="caption" sx={{ opacity: 0.75 }}>
                    {logoFile ? logoFile.name : `Default logo will be used`}
                  </Typography>

                  <Chip
                    size="small"
                    label={logoFile ? "custom logo" : "default logo"}
                    sx={{
                      height: 24,
                      color: "rgba(248,250,252,0.92)",
                      background: "rgba(15,23,42,0.55)",
                      border: "1px solid rgba(148,163,184,0.30)",
                    }}
                  />
                </Box>

                <TextField
                  select
                  label="Background template"
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  disabled={submitting || creatingMint}
                  sx={darkFieldSx}
                  helperText="Pick a preset background. Defaults (mode/primary/overlay/blur) are applied automatically."
                  FormHelperTextProps={{ sx: { opacity: 0.7 } }}
                >
                  {BG_TEMPLATES.map((t) => (
                    <MenuItem key={t.id} value={t.id}>
                      {t.label}
                    </MenuItem>
                  ))}
                </TextField>

                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                    gap: 1.1,
                  }}
                >
                  <TextField
                    select
                    label="Theme mode"
                    value={themeMode}
                    onChange={(e) => setThemeMode(e.target.value as ThemeMode)}
                    disabled={submitting || creatingMint}
                    sx={darkFieldSx}
                  >
                    <MenuItem value="auto">Auto</MenuItem>
                    <MenuItem value="dark">Dark</MenuItem>
                    <MenuItem value="light">Light</MenuItem>
                  </TextField>

                  <TextField
                    label="Primary"
                    value={themePrimary}
                    onChange={(e) => setThemePrimary(e.target.value)}
                    disabled={submitting || creatingMint}
                    sx={darkFieldSx}
                    helperText="Hex color (used by the UI)"
                    FormHelperTextProps={{ sx: { opacity: 0.7 } }}
                  />
                </Box>

                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                    gap: 1.1,
                  }}
                >
                  <TextField
                    label="Overlay opacity (0..1)"
                    type="number"
                    value={themeBgOpacity}
                    onChange={(e) => setThemeBgOpacity(clamp01(safeNum(e.target.value, themeBgOpacity)))}
                    disabled={submitting || creatingMint}
                    sx={darkFieldSx}
                  />
                  <TextField
                    label="Blur (px)"
                    type="number"
                    value={themeBgBlur}
                    onChange={(e) => setThemeBgBlur(Math.max(0, safeNum(e.target.value, themeBgBlur)))}
                    disabled={submitting || creatingMint}
                    sx={darkFieldSx}
                  />
                </Box>

                {/* Preview */}
                <Box
                  sx={{
                    borderRadius: "18px",
                    overflow: "hidden",
                    border: "1px solid rgba(148,163,184,0.35)",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
                  }}
                >
                  <Box
                    sx={{
                      position: "relative",
                      height: 140,
                      backgroundImage: `url("${activeTemplate?.url}")`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      backgroundRepeat: "no-repeat",
                    }}
                  >
                    <Box
                      sx={{
                        position: "absolute",
                        inset: 0,
                        background: `rgba(0,0,0,${clamp01(themeBgOpacity)})`,
                        backdropFilter: `blur(${Math.max(0, themeBgBlur)}px)`,
                      }}
                    />
                    <Box sx={{ position: "absolute", inset: 0, p: 1.5, display: "grid", gap: 0.6 }}>
                      <Typography variant="caption" sx={{ opacity: 0.9 }}>
                        Preview • {activeTemplate?.label} • mode: {themeMode}
                      </Typography>
                      <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                        <Box
                          sx={{
                            width: 14,
                            height: 14,
                            borderRadius: 999,
                            background: safeHex(themePrimary) || "#A78BFA",
                            border: "1px solid rgba(255,255,255,0.35)",
                          }}
                        />
                        <Typography variant="caption" sx={{ opacity: 0.85 }}>
                          {safeHex(themePrimary) || "invalid hex"}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                </Box>
              </Box>
            )}

            <Divider sx={{ borderColor: "rgba(148,163,184,0.25)", my: 0.5 }} />

            <TextField
              label="Metadata URI (optional)"
              fullWidth
              value={metadataUri}
              onChange={(e) => setMetadataUri(e.target.value)}
              disabled={submitting || creatingMint}
              placeholder="https://.../metadata.json"
              InputProps={{ sx: { borderRadius: "16px", background: "rgba(255,255,255,0.06)" } }}
              helperText={
                enableTheme
                  ? "Leave blank and we’ll auto-create metadata from the Theme section."
                  : "If provided, we will upsert project metadata after creating the config."
              }
              sx={darkFieldSx}
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
            disabled={submitting || creatingMint}
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
              color: "#ffffff",
              "&:hover": { background: "rgba(255,255,255,0.20)" },
            }}
          >
            {submitting ? "Creating…" : creatingMint ? "Creating mint…" : "Create"}
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
}