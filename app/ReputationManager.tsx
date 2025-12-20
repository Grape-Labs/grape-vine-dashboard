"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
  Button,
  Box,
  Typography,
  TextField,
  Tabs,
  Tab,
  Divider,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from "@mui/material";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";

import {
  VINE_REP_PROGRAM_ID,
  getConfigPda,
  getReputationPda,
  fetchConfig,
  //fetchProjectMetadata
  buildSetDecayBpsIx,
  buildAdminCloseAnyIx,
  buildAddReputationIx,
  buildResetReputationIx,
  buildCloseReputationIx,
  type ReputationConfigAccount,
} from "@grapenpm/vine-reputation-client";
const ADMIN = new PublicKey("GScbAQoP73BsUZDXSpe8yLCteUx7MJn1qzWATZapTbWt");

import { 
  GRAPE_DAO_ID 
} from "./constants";

import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";

//import TokenManager from "./TokenManager";

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

export async function anchorIxDisc(ixName: string): Promise<Uint8Array> {
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

function shorten(pk: string, a = 6, b = 6) {
  if (!pk) return "";
  if (pk.length <= a + b) return pk;
  return `${pk.slice(0, a)}…${pk.slice(-b)}`;
}

type BulkRow = { wallet: string; amount: number };

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function parseBulkInput(input: string) {
  const lines = (input || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const errors: string[] = [];
  const map = new Map<string, number>();

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];

    // allow "wallet,amount" OR "wallet amount"
    const parts = raw.includes(",")
      ? raw.split(",").map((p) => p.trim())
      : raw.split(/\s+/).map((p) => p.trim());

    if (parts.length < 2) {
      errors.push(`Line ${i + 1}: expected "wallet,amount" (got "${raw}")`);
      continue;
    }

    const walletStr = parts[0];
    const amtStr = parts[1];

    try {
      // validate pubkey
      // eslint-disable-next-line no-new
      new PublicKey(walletStr);
    } catch {
      errors.push(`Line ${i + 1}: invalid wallet "${walletStr}"`);
      continue;
    }

    const amt = Math.floor(Number(amtStr));
    if (!Number.isFinite(amt) || amt <= 0) {
      errors.push(`Line ${i + 1}: invalid amount "${amtStr}" (must be > 0)`);
      continue;
    }

    map.set(walletStr, (map.get(walletStr) || 0) + amt);
  }

  const rows: BulkRow[] = Array.from(map.entries()).map(([wallet, amount]) => ({
    wallet,
    amount,
  }));

  return { rows, errors };
}

/** ------------------------------
 *  Project metadata PDA + decoder
 *  ------------------------------ */
function getProjectMetaPda(daoId: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("project_meta"), daoId.toBuffer()],
    VINE_REP_PROGRAM_ID
  );
}

type ProjectMetadataAccount = {
  pubkey: PublicKey;
  daoId: PublicKey;
  metadataUri: string;
  bump: number;
};

function decodeProjectMetadataAccount(
  pubkey: PublicKey,
  data: Buffer
): ProjectMetadataAccount {
  const DISC = 8;

  // need: disc + version + dao + strlen + bump at least
  if (data.length < DISC + 1 + 32 + 4 + 1) {
    throw new Error("ProjectMetadata data too small");
  }

  let o = DISC;

  // ✅ version byte exists on-chain
  const version = data.readUInt8(o);
  o += 1;

  const daoId = new PublicKey(data.slice(o, o + 32));
  o += 32;

  const strLen = data.readUInt32LE(o);
  o += 4;

  // ✅ allow padding after bump; only require that the string bytes exist
  if (o + strLen > data.length) {
    throw new Error(`ProjectMetadata string length out of bounds (len=${strLen}, dataLen=${data.length})`);
  }

  const strBytes = data.slice(o, o + strLen);
  o += strLen;

  const metadataUri = new TextDecoder().decode(strBytes);

  // bump is 1 byte after the string
  if (o + 1 > data.length) throw new Error("ProjectMetadata bump out of bounds");
  const bump = data.readUInt8(o);

  return { pubkey, daoId, metadataUri, bump };
}

async function fetchProjectMetadata(conn: Connection, daoId: PublicKey) {
  const [metaPda] = getProjectMetaPda(daoId);
  const ai = await conn.getAccountInfo(metaPda);
  if (!ai?.data) return null;
  return decodeProjectMetadataAccount(metaPda, ai.data);
}

function PkRow({
  label,
  value,
  suffix,
}: {
  label: string;
  value?: string | null;
  suffix?: string;
}) {
  if (!value) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {}
  };

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 1,
        p: 1.2,
        borderRadius: "14px",
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.12)",
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" sx={{ opacity: 0.75 }}>
          {label}
        </Typography>
        <Typography
          variant="body2"
          sx={{ fontFamily: "monospace", mt: 0.25, overflow: "hidden", textOverflow: "ellipsis" }}
          title={value}
        >
          {value}
        </Typography>
      </Box>

      <Tooltip title="Copy">
        <IconButton onClick={copy} size="small" sx={{ color: "rgba(248,250,252,0.85)" }}>
          <ContentCopyIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

/** ------------------------------
 *  Props
 *  ------------------------------ */
type ReputationManagerProps = {
  open: boolean;
  onClose: () => void;

  daoIdBase58?: string;

  defaultRepMintBase58?: string;
  defaultInitialSeason?: number;
  defaultMetadataUri?: string;

  onChanged?: () => void;
};

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

function TabPanel(props: {
  value: number;
  index: number;
  children: React.ReactNode;
}) {
  const { value, index, children } = props;
  if (value !== index) return null;
  return <Box sx={{ pt: 2 }}>{children}</Box>;
}

const ReputationManager: React.FC<ReputationManagerProps> = ({
  open,
  onClose,
  daoIdBase58,
  defaultRepMintBase58 = "",
  defaultInitialSeason = 1,
  defaultMetadataUri = "",
  onChanged,
}) => {
  const { connection } = useConnection();
  const { publicKey, connected, sendTransaction } = useWallet();

  const [tab, setTab] = useState(0);

  // selection / inputs
  const [daoId, setDaoId] = useState<string>(
    daoIdBase58 || new PublicKey(GRAPE_DAO_ID).toBase58()
  );
  const [repMint, setRepMint] = useState<string>(defaultRepMintBase58);
  const [initialSeason, setInitialSeason] = useState<number>(
    defaultInitialSeason
  );
  const [metadataUri, setMetadataUri] = useState<string>(defaultMetadataUri);

  // manage inputs
  const [newSeason, setNewSeason] = useState<number>(0);
  const [newMint, setNewMint] = useState<string>("");
  const [newAuthority, setNewAuthority] = useState<string>("");

  // rep ops
  const [repUser, setRepUser] = useState<string>("");
  const [repAmount, setRepAmount] = useState<number>(0);
  const [repOldWallet, setRepOldWallet] = useState<string>("");
  const [repNewWallet, setRepNewWallet] = useState<string>("");

  // decay
  const [decayBps, setDecayBps] = useState<number>(0);
  const [decayPct, setDecayPct] = useState<number>(0); // 0..100 UI convenience

  // danger zone (close)
  const [closeRecipient, setCloseRecipient] = useState<string>("");
  const [closeConfirm, setCloseConfirm] = useState<string>("");

  const [closeRepUser, setCloseRepUser] = useState<string>("");
  const [closeRepSeason, setCloseRepSeason] = useState<number>(0);

  const [closeMetaRecipient, setCloseMetaRecipient] = useState<string>("");

  // loaded state
  const [loading, setLoading] = useState(false);
  const [cfg, setCfg] = useState<ReputationConfigAccount | null>(null);
  const [meta, setMeta] = useState<ProjectMetadataAccount | null>(null);

  // feedback
  const [submitting, setSubmitting] = useState(false);
  const [snackMsg, setSnackMsg] = useState("");
  const [snackError, setSnackError] = useState("");

    // bulk import
  const [bulkText, setBulkText] = useState<string>("");
  const [bulkSeason, setBulkSeason] = useState<number>(0);
  const [bulkMode, setBulkMode] = useState<"add" | "resetAdd">("add");
  const [bulkPreview, setBulkPreview] = useState<BulkRow[]>([]);
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);
  const [bulkProgress, setBulkProgress] = useState<string>("");

  const daoPk = useMemo(() => {
    try {
      return new PublicKey((daoId || "").trim());
    } catch {
      return null;
    }
  }, [daoId]);

  const configPda = useMemo(() => {
    if (!daoPk) return null;
    try {
      const [pda] = getConfigPda(daoPk);
      return pda;
    } catch {
      return null;
    }
  }, [daoPk]);

  const authorityPk = cfg?.authority ?? null;

  const projectMetaPda = useMemo(() => {
    if (!daoPk) return null;
    try {
      const [pda] = getProjectMetaPda(daoPk);
      return pda;
    } catch {
      return null;
    }
  }, [daoPk]);

  const isAuthority = useMemo(() => {
    if (!publicKey || !cfg) return false;
    return publicKey.equals(cfg.authority);
  }, [publicKey, cfg]);

  const spaceExists = !!cfg;

  const closeSnack = () => {
    setSnackMsg("");
    setSnackError("");
  };

  const safeClose = () => {
    if (!submitting) onClose();
  };

  // reload when open or dao changes
  useEffect(() => {
    if (!open) return;

    setTab(0);
    setSubmitting(false);
    setSnackMsg("");
    setSnackError("");

    setDaoId(daoIdBase58 || new PublicKey(GRAPE_DAO_ID).toBase58());
    setRepMint(defaultRepMintBase58 || "");
    setInitialSeason(defaultInitialSeason || 1);
    setMetadataUri(defaultMetadataUri || "");

    setNewSeason(0);
    setNewMint("");
    setNewAuthority("");

    setRepUser("");
    setRepAmount(0);
    setRepOldWallet("");
    setRepNewWallet("");

    setDecayBps(0);
    setDecayPct(0);

    // bulk defaults
    setBulkText("");
    setBulkSeason(0);
    setBulkMode("add");
    setBulkPreview([]);
    setBulkErrors([]);
    setBulkProgress("");

    // danger defaults
    setCloseRecipient(publicKey?.toBase58() || "");
    setCloseConfirm("");
    setCloseRepUser("");
    setCloseRepSeason(0);
    setCloseMetaRecipient(publicKey?.toBase58() || "");
  }, [
    open,
    daoIdBase58,
    defaultRepMintBase58,
    defaultInitialSeason,
    defaultMetadataUri,
    publicKey,
  ]);

  useEffect(() => {
    if (!open) return;
    if (!daoPk) {
      setCfg(null);
      setMeta(null);
      return;
    }

    (async () => {
      try {
        setLoading(true);

        const c = await fetchConfig(connection, daoPk);
        setCfg(c);

        const m = await fetchProjectMetadata(connection, daoPk);
        setMeta(m);
        setMetadataUri(m?.metadataUri ?? ""); // ✅ keep field in sync with chain

        if (c) {
          setNewSeason(c.currentSeason + 1);
          setNewMint(c.repMint.toBase58());
          setNewAuthority(c.authority.toBase58());
          setBulkSeason(c.currentSeason);

          const bps = (c as any).decayBps ?? 0; // if your type already includes it, remove "as any"
          setDecayBps(bps);
          setDecayPct(Math.round((bps / 10000) * 100 * 100) / 100); // ex 3000 -> 30.00

          // danger defaults
          setCloseRepSeason(c.currentSeason);

          if (m?.metadataUri) setMetadataUri(m.metadataUri);
        }
      } catch (e: any) {
        setCfg(null);
        setMeta(null);
        setSnackError(e?.message ?? "Failed to load space config");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, connection, daoPk]);

  /** ------------------------------
   *  Instruction builders
   *  ------------------------------ */
  async function ixInitializeConfig(args: {
    daoId: PublicKey;
    repMint: PublicKey;
    initialSeason: number;
    authority: PublicKey;
    payer: PublicKey;
  }) {
    const disc = await anchorIxDisc("initialize_config");

    const data = new Uint8Array(8 + 32 + 32 + 2);
    let o = 0;
    data.set(disc, o);
    o += 8;
    data.set(args.daoId.toBytes(), o);
    o += 32;
    data.set(args.repMint.toBytes(), o);
    o += 32;
    data.set(u16le(args.initialSeason & 0xffff), o);
    o += 2;

    const [configPda] = getConfigPda(args.daoId);

    return new TransactionInstruction({
      programId: VINE_REP_PROGRAM_ID,
      keys: [
        { pubkey: configPda, isSigner: false, isWritable: true },
        { pubkey: args.authority, isSigner: false, isWritable: false }, // unchecked in Rust
        { pubkey: args.payer, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: Buffer.from(data),
    });
  }

  async function ixSetDecayBps(args: {
    daoId: PublicKey;
    authority: PublicKey;
    decayBps: number; // 0..=10000
  }) {
    const decay = Math.floor(Number(args.decayBps));
    if (!Number.isFinite(decay) || decay < 0 || decay > 10_000) {
      throw new Error("decayBps must be 0..=10000");
    }

    // IMPORTANT: this must be the snake_case on-chain name
    const disc = await anchorIxDisc("set_decay_bps");

    const data = new Uint8Array(8 + 2);
    data.set(disc, 0);
    data.set(u16le(decay), 8);

    const [configPda] = getConfigPda(args.daoId);

    return new TransactionInstruction({
      programId: VINE_REP_PROGRAM_ID,
      keys: [
        { pubkey: configPda, isSigner: false, isWritable: true },
        { pubkey: args.authority, isSigner: true, isWritable: false },
      ],
      data: Buffer.from(data),
    });
  }

  async function ixSetSeason(args: {
    daoId: PublicKey;
    authority: PublicKey;
    newSeason: number;
  }) {
    const disc = await anchorIxDisc("set_season");
    const data = new Uint8Array(8 + 2);
    data.set(disc, 0);
    data.set(u16le(args.newSeason & 0xffff), 8);

    const [configPda] = getConfigPda(args.daoId);

    return new TransactionInstruction({
      programId: VINE_REP_PROGRAM_ID,
      keys: [
        { pubkey: configPda, isSigner: false, isWritable: true },
        { pubkey: args.authority, isSigner: true, isWritable: false },
      ],
      data: Buffer.from(data),
    });
  }

  async function ixSetRepMint(args: {
    daoId: PublicKey;
    authority: PublicKey;
    newMint: PublicKey;
  }) {
    const disc = await anchorIxDisc("set_rep_mint");
    const data = new Uint8Array(8 + 32);
    data.set(disc, 0);
    data.set(args.newMint.toBytes(), 8);

    const [configPda] = getConfigPda(args.daoId);

    return new TransactionInstruction({
      programId: VINE_REP_PROGRAM_ID,
      keys: [
        { pubkey: configPda, isSigner: false, isWritable: true },
        { pubkey: args.authority, isSigner: true, isWritable: false },
      ],
      data: Buffer.from(data),
    });
  }

  async function ixSetAuthority(args: {
    daoId: PublicKey;
    authority: PublicKey;
    newAuthority: PublicKey;
  }) {
    const disc = await anchorIxDisc("set_authority");
    const data = new Uint8Array(8 + 32);
    data.set(disc, 0);
    data.set(args.newAuthority.toBytes(), 8);

    const [configPda] = getConfigPda(args.daoId);

    return new TransactionInstruction({
      programId: VINE_REP_PROGRAM_ID,
      keys: [
        { pubkey: configPda, isSigner: false, isWritable: true },
        { pubkey: args.authority, isSigner: true, isWritable: false },
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

  async function ixAddReputation(args: {
    daoId: PublicKey;
    authority: PublicKey;
    payer: PublicKey;
    user: PublicKey;
    amount: bigint;
    currentSeason: number;
  }) {
    const disc = await anchorIxDisc("add_reputation");

    const amt = args.amount;
    const amtBytes = new Uint8Array(8);
    const dv = new DataView(amtBytes.buffer);
    const lo = Number(amt & BigInt(0xffffffff));
    const hi = Number((amt >> BigInt(32)) & BigInt(0xffffffff));
    dv.setUint32(0, lo, true);
    dv.setUint32(4, hi, true);

    const data = new Uint8Array(8 + 8);
    data.set(disc, 0);
    data.set(amtBytes, 8);

    const [configPda] = getConfigPda(args.daoId);
    const [repPda] = getReputationPda(configPda, args.user, args.currentSeason);

    return new TransactionInstruction({
      programId: VINE_REP_PROGRAM_ID,
      keys: [
        { pubkey: configPda, isSigner: false, isWritable: false },
        { pubkey: args.authority, isSigner: true, isWritable: false },
        { pubkey: args.user, isSigner: false, isWritable: false },
        { pubkey: repPda, isSigner: false, isWritable: true },
        { pubkey: args.payer, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: Buffer.from(data),
    });
  }

  async function ixResetReputation(args: {
    daoId: PublicKey;
    authority: PublicKey;
    user: PublicKey;
    currentSeason: number;
  }) {
    const disc = await anchorIxDisc("reset_reputation");
    const data = new Uint8Array(8);
    data.set(disc, 0);

    const [configPda] = getConfigPda(args.daoId);
    const [repPda] = getReputationPda(configPda, args.user, args.currentSeason);

    return new TransactionInstruction({
      programId: VINE_REP_PROGRAM_ID,
      keys: [
        { pubkey: configPda, isSigner: false, isWritable: false },
        { pubkey: args.authority, isSigner: true, isWritable: false },
        { pubkey: repPda, isSigner: false, isWritable: true },
        { pubkey: args.user, isSigner: false, isWritable: false },
      ],
      data: Buffer.from(data),
    });
  }

  async function ixTransferReputation(args: {
    daoId: PublicKey;
    authority: PublicKey;
    payer: PublicKey;
    oldWallet: PublicKey;
    newWallet: PublicKey;
    currentSeason: number;
  }) {
    const disc = await anchorIxDisc("transfer_reputation");
    const data = new Uint8Array(8);
    data.set(disc, 0);

    const [configPda] = getConfigPda(args.daoId);
    const [repFrom] = getReputationPda(
      configPda,
      args.oldWallet,
      args.currentSeason
    );
    const [repTo] = getReputationPda(
      configPda,
      args.newWallet,
      args.currentSeason
    );

    return new TransactionInstruction({
      programId: VINE_REP_PROGRAM_ID,
      keys: [
        { pubkey: configPda, isSigner: false, isWritable: false },
        { pubkey: args.authority, isSigner: true, isWritable: false },
        { pubkey: args.oldWallet, isSigner: false, isWritable: false },
        { pubkey: args.newWallet, isSigner: false, isWritable: false },
        { pubkey: repFrom, isSigner: false, isWritable: true },
        { pubkey: repTo, isSigner: false, isWritable: true },
        { pubkey: args.payer, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: Buffer.from(data),
    });
  }

  /** ------------------------------
   *  NEW: Close instructions
   *  ------------------------------ */

  // close_config(config, authority, recipient, system_program?)
  async function ixCloseConfig(args: {
    daoId: PublicKey;
    authority: PublicKey;
    recipient: PublicKey;
  }) {
    const disc = await anchorIxDisc("close_config");
    const data = new Uint8Array(8);
    data.set(disc, 0);

    const [configPda] = getConfigPda(args.daoId);

    return new TransactionInstruction({
      programId: VINE_REP_PROGRAM_ID,
      keys: [
        { pubkey: configPda, isSigner: false, isWritable: true },
        { pubkey: args.authority, isSigner: true, isWritable: false },
        { pubkey: args.recipient, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // remove if not in Rust ctx
      ],
      data: Buffer.from(data),
    });
  }

  // close_project_metadata(config, authority, metadata, recipient, system_program?)
  async function ixCloseProjectMetadata(args: {
    daoId: PublicKey;
    authority: PublicKey;
    recipient: PublicKey;
  }) {
    const disc = await anchorIxDisc("close_project_metadata");
    const data = new Uint8Array(8);
    data.set(disc, 0);

    const [configPda] = getConfigPda(args.daoId);
    const [metaPda] = getProjectMetaPda(args.daoId);

    return new TransactionInstruction({
      programId: VINE_REP_PROGRAM_ID,
      keys: [
        { pubkey: configPda, isSigner: false, isWritable: false },
        { pubkey: metaPda, isSigner: false, isWritable: true },
        { pubkey: args.authority, isSigner: true, isWritable: false },
        { pubkey: args.recipient, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // remove if not in Rust ctx
      ],
      data: Buffer.from(data),
    });
  }

  /** ------------------------------
   *  Actions
   *  ------------------------------ */
  const commonPrecheck = () => {
    if (!connected || !publicKey) throw new Error("Connect a wallet first.");
    if (!daoPk) throw new Error("Invalid DAO id.");
  };

  const runTx = async (
    label: string,
    buildIxs: () => Promise<TransactionInstruction[]>
  ) => {
    try {
      setSubmitting(true);
      setSnackMsg("");
      setSnackError("");

      commonPrecheck();

      const ixs = await buildIxs();
      const tx = new Transaction().add(...ixs);

      const sig = await sendTransaction(tx, connection);
      setSnackMsg(`✅ ${label}. Tx: ${sig}`);

      // refresh
      if (daoPk) {
        const c = await fetchConfig(connection, daoPk);
        setCfg(c);

        const m = await fetchProjectMetadata(connection, daoPk);
        setMeta(m);

        if (c) {
          setNewSeason(c.currentSeason + 1);
          setNewMint(c.repMint.toBase58());
          setNewAuthority(c.authority.toBase58());
          setCloseRepSeason(c.currentSeason);
        }
      }

      onChanged?.();
    } catch (e: any) {
      console.error(e);
      setSnackError(e?.message ?? "Transaction failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetDecay = async () => {
    await runTx("Updated decay", async () => {
      if (!publicKey || !daoPk) throw new Error("Missing wallet/DAO");
      if (!cfg) throw new Error("Config not found");
      if (!isAuthority) throw new Error("Only authority can update decay");

      return [
        await ixSetDecayBps({
          daoId: daoPk,
          authority: publicKey,
          decayBps,
        }),
      ];
    });
  };

  const handleCreate = async () => {
    await runTx("Created reputation space", async () => {
      if (!publicKey || !daoPk) throw new Error("Missing wallet/DAO");

      const repMintPk = new PublicKey(repMint.trim());
      const season = Number(initialSeason);

      if (!Number.isFinite(season) || season <= 0 || season > 65535) {
        throw new Error("Initial season must be 1–65535");
      }

      const initIx = await ixInitializeConfig({
        daoId: daoPk,
        repMint: repMintPk,
        initialSeason: season,
        authority: publicKey,
        payer: publicKey,
      });

      const ixs: TransactionInstruction[] = [initIx];

      if (metadataUri?.trim()) {
        const metaIx = await ixUpsertProjectMetadata({
          daoId: daoPk,
          authority: publicKey,
          payer: publicKey,
          metadataUri: metadataUri.trim(),
        });
        ixs.push(metaIx);
      }

      return ixs;
    });
  };

    const handleBulkPreview = () => {
    const { rows, errors } = parseBulkInput(bulkText);
    setBulkPreview(rows);
    setBulkErrors(errors);
    setBulkProgress("");
    if (!rows.length && !errors.length) {
      setBulkErrors(["No rows found. Paste lines like: wallet,amount"]);
    }
  };

  const handleBulkImport = async () => {
  try {
    if (!connected || !publicKey) throw new Error("Connect a wallet first.");
    if (!daoPk) throw new Error("Invalid DAO id.");
    if (!cfg) throw new Error("Config not found");
    if (!isAuthority) throw new Error("Only authority can bulk import");

    setSubmitting(true);
    setSnackMsg("");
    setSnackError("");
    setBulkProgress("");

    const season = toU16(bulkSeason || cfg.currentSeason);
    if (!Number.isFinite(season) || season <= 0 || season > 65535) {
      throw new Error("Bulk season must be 1–65535");
    }

    const { rows, errors } = parseBulkInput(bulkText);
    setBulkPreview(rows);
    setBulkErrors(errors);

    if (errors.length) throw new Error(`Fix ${errors.length} parse errors first.`);
    if (!rows.length) throw new Error("No valid rows to import.");

    const MAX_ROWS = 200;
    if (rows.length > MAX_ROWS) {
      throw new Error(`Too many rows (${rows.length}). Max is ${MAX_ROWS}.`);
    }

    // ✅ Ignore 0 amounts (and negatives if parse allows them)
    const usableRows = rows.filter((r) => Number(r.amount) > 0);
    if (!usableRows.length) throw new Error("No rows with amount > 0 to import.");

    const batches = chunk(usableRows, 5); // conservative default

    for (let bi = 0; bi < batches.length; bi++) {
      const batch = batches[bi];

      const ixs: TransactionInstruction[] = [];

      for (const r of batch) {
        const amtNum = Number(r.amount);
        if (!Number.isFinite(amtNum) || amtNum <= 0) continue; // double safety

        const user = new PublicKey(r.wallet);
        const amt = BigInt(Math.floor(amtNum));

        // Build add ix so we get repPda/configPda (same as working per-wallet)
        const builtAdd = await buildAddReputationIx({
          conn: connection,
          daoId: daoPk,
          authority: publicKey,
          payer: publicKey,
          user,
          amount: amt,
          season, // must be number
        });

        // ---- Optional self-heal (ADMIN only), identical logic to handleAddRep
        let didAdminClose = false;
        const repInfo = await connection.getAccountInfo(builtAdd.repPda, "confirmed");
        const repLooksProgramOwned = !!repInfo && repInfo.owner.equals(VINE_REP_PROGRAM_ID);

        if (repLooksProgramOwned && publicKey.equals(ADMIN)) {
          // (best effort) always close if program-owned exists — same as your working code
          ixs.push(
            await buildAdminCloseAnyIx({
              authority: publicKey,
              target: builtAdd.repPda,
              recipient: publicKey,
            })
          );
          didAdminClose = true;
        }

        // If mode is resetAdd, only include reset if we DID NOT close (reset needs account to exist)
        if (bulkMode === "resetAdd" && !didAdminClose) {
          const builtReset = await buildResetReputationIx({
            conn: connection,
            daoId: daoPk,
            authority: publicKey,
            user,
            season,
          });
          ixs.push(builtReset.ix);
        }

        // Finally add reputation
        ixs.push(builtAdd.ix);
      }

      if (!ixs.length) continue;

      setBulkProgress(`Sending ${bi + 1}/${batches.length}…`);
      const tx = new Transaction().add(...ixs);
      const sig = await sendTransaction(tx, connection);

      setSnackMsg(`✅ Bulk tx ${bi + 1}/${batches.length}. Tx: ${sig}`);
    }

    setBulkProgress(`Done ✅ (${usableRows.length} wallets)`);

    // refresh (same as runTx)
    const c = await fetchConfig(connection, daoPk);
    setCfg(c);

    const m = await fetchProjectMetadata(connection, daoPk);
    setMeta(m);

    if (c) {
      setNewSeason(c.currentSeason + 1);
      setNewMint(c.repMint.toBase58());
      setNewAuthority(c.authority.toBase58());
      setCloseRepSeason(c.currentSeason);
      setBulkSeason(c.currentSeason);
    }

    onChanged?.();
  } catch (e: any) {
    console.error(e);
    setSnackError(e?.message ?? "Bulk import failed");
  } finally {
    setSubmitting(false);
  }
};

  const handleSetSeason = async () => {
    await runTx("Updated season", async () => {
      if (!publicKey || !daoPk) throw new Error("Missing wallet/DAO");
      if (!cfg) throw new Error("Config not found");
      if (!isAuthority) throw new Error("Only authority can update season");

      const s = Number(newSeason);
      if (!Number.isFinite(s) || s <= 0 || s > 65535) {
        throw new Error("Season must be 1–65535");
      }

      return [
        await ixSetSeason({
          daoId: daoPk,
          authority: publicKey,
          newSeason: s,
        }),
      ];
    });
  };

  const handleSetMint = async () => {
    await runTx("Updated mint", async () => {
      if (!publicKey || !daoPk) throw new Error("Missing wallet/DAO");
      if (!cfg) throw new Error("Config not found");
      if (!isAuthority) throw new Error("Only authority can update mint");

      const pk = new PublicKey(newMint.trim());
      return [
        await ixSetRepMint({ daoId: daoPk, authority: publicKey, newMint: pk }),
      ];
    });
  };

  const handleTransferAuthority = async () => {
    await runTx("Transferred authority", async () => {
      if (!publicKey || !daoPk) throw new Error("Missing wallet/DAO");
      if (!cfg) throw new Error("Config not found");
      if (!isAuthority) throw new Error("Only authority can transfer authority");

      const pk = new PublicKey(newAuthority.trim());
      return [
        await ixSetAuthority({
          daoId: daoPk,
          authority: publicKey,
          newAuthority: pk,
        }),
      ];
    });
  };

  const handleUpsertMetadata = async () => {
    await runTx("Updated metadata URI", async () => {
      if (!publicKey || !daoPk) throw new Error("Missing wallet/DAO");
      if (!cfg) throw new Error("Config not found");
      if (!isAuthority) throw new Error("Only authority can update metadata");

      const MAX_URI_BYTES = 200; // must match program allocation
      const uri = metadataUri.trim();
      if (!uri) throw new Error("Metadata URI cannot be empty");
      const byteLen = new TextEncoder().encode(uri).length;

      if (byteLen > MAX_URI_BYTES) {
        throw new Error(`URI too long (${byteLen} bytes). Max ${MAX_URI_BYTES}.`);
      }

      return [
        await ixUpsertProjectMetadata({
          daoId: daoPk,
          authority: publicKey,
          payer: publicKey,
          metadataUri: (metadataUri || "").trim(),
        }),
      ];
    });
  };

  function toU16(x: any): number {
    if (typeof x === "number") return x;
    if (typeof x === "bigint") return Number(x);
    if (x?.toNumber) return x.toNumber();
    return Number(x); // last resort
  }

  const handleAddRep = async () => {
    await runTx("Added reputation", async () => {
      if (!publicKey || !daoPk) throw new Error("Missing wallet/DAO");
      if (!cfg) throw new Error("Config not found");
      if (!isAuthority) throw new Error("Only authority can add reputation");

      const user = new PublicKey(repUser.trim());
      const amt = BigInt(Math.max(0, Math.floor(Number(repAmount || 0))));
      const season = toU16(cfg.currentSeason);

      // Build the add ix (also returns repPda/configPda)
      const built = await buildAddReputationIx({
        conn: connection,
        daoId: daoPk,
        authority: publicKey,
        payer: publicKey,
        user,
        amount: amt,
        // You can omit season; if you keep it, make sure it's a number:
        season,
      });

      const ixs: TransactionInstruction[] = [];

      // ---- Optional self-heal (only if wallet == ADMIN)
      const repInfo = await connection.getAccountInfo(built.repPda, "confirmed");
      const repLooksProgramOwned = !!repInfo && repInfo.owner.equals(VINE_REP_PROGRAM_ID);

      // If a legacy/bad account exists, addReputation may fail with SeasonMismatch.
      // If we are ADMIN, close it first.
      if (repLooksProgramOwned && publicKey.equals(ADMIN)) {
        // Best-effort decode; if decode fails, still close (like solpg)
        let shouldClose = false;
        try {
          // If you have a decodeReputation() helper in npm, use it. Otherwise skip decode.
          // shouldClose = decoded.season !== season;
          // If you don't decode, you can just close if account exists and program-owned.
          // But that's more aggressive.
          shouldClose = true;
        } catch {
          shouldClose = true;
        }

        if (shouldClose) {
          ixs.push(
            await buildAdminCloseAnyIx({
              authority: publicKey,
              target: built.repPda,
              recipient: publicKey,
            })
          );
        }
      } else if (repLooksProgramOwned && !publicKey.equals(ADMIN)) {
        // Not admin => we cannot repair legacy mismatch from the UI
        // (Optional) You can let it try and show SeasonMismatch, but this is clearer:
        // throw new Error("Legacy reputation PDA needs admin cleanup. Please connect ADMIN wallet to repair.");
      }

      ixs.push(built.ix);
      return ixs;
    });
  };



  
  const handleResetRep = async () => {
    await runTx("Reset reputation", async () => {
      if (!publicKey || !daoPk) throw new Error("Missing wallet/DAO");
      if (!cfg) throw new Error("Config not found");
      if (!isAuthority) throw new Error("Only authority can reset reputation");

      const user = new PublicKey(repUser.trim());
      const season = toU16(cfg.currentSeason);

      const built = await buildResetReputationIx({
        conn: connection,
        daoId: daoPk,
        authority: publicKey,
        user,
        season,
      });

      const ixs: TransactionInstruction[] = [];

      // Same repair option (ADMIN only)
      const repInfo = await connection.getAccountInfo(built.repPda, "confirmed");
      const repLooksProgramOwned = !!repInfo && repInfo.owner.equals(VINE_REP_PROGRAM_ID);

      if (repLooksProgramOwned && publicKey.equals(ADMIN)) {
        ixs.push(
          await buildAdminCloseAnyIx({
            authority: publicKey,
            target: built.repPda,
            recipient: publicKey,
          })
        );
        // After closing, reset ix isn't needed anymore (rep is gone),
        // but keeping it is harmless if reset expects account to exist.
        // In your program reset expects rep PDA exists, so:
        // better to NOT reset after close; instead just exit or re-init rep via addReputation.
        // So for reset flow, only push resetIx (no close) unless you're sure.
      }

      ixs.push(built.ix);
      return ixs;
    });
  };

  const handleTransferRep = async () => {
    await runTx("Transferred reputation", async () => {
      if (!publicKey || !daoPk) throw new Error("Missing wallet/DAO");
      if (!cfg) throw new Error("Config not found");
      if (!isAuthority) throw new Error("Only authority can transfer reputation");

      const oldW = new PublicKey(repOldWallet.trim());
      const newW = new PublicKey(repNewWallet.trim());

      return [
        await ixTransferReputation({
          daoId: daoPk,
          authority: publicKey,
          payer: publicKey,
          oldWallet: oldW,
          newWallet: newW,
          currentSeason: cfg.currentSeason,
        }),
      ];
    });
  };

  /** ------------------------------
   *  NEW: Danger handlers
   *  ------------------------------ */
  const handleCloseSpace = async () => {
    await runTx("Closed reputation space", async () => {
      if (!publicKey || !daoPk) throw new Error("Missing wallet/DAO");
      if (!cfg) throw new Error("Config not found");
      if (!isAuthority) throw new Error("Only authority can close this space");

      const recipientPk = new PublicKey(closeRecipient.trim());

      const expected = `CLOSE ${shorten(daoPk.toBase58(), 6, 6)}`;
      if (closeConfirm.trim() !== expected) {
        throw new Error(`Type exactly: ${expected}`);
      }

      return [
        await ixCloseConfig({
          daoId: daoPk,
          authority: publicKey,
          recipient: recipientPk,
        }),
      ];
    });
  };

  const handleCloseUserReputation = async () => {
    await runTx("Closed user reputation", async () => {
      if (!publicKey || !daoPk) throw new Error("Missing wallet/DAO");
      if (!cfg) throw new Error("Config not found");
      if (!isAuthority) throw new Error("Only authority can close reputations");

      const userPk = new PublicKey(closeRepUser.trim());
      const season = Number(closeRepSeason || 0);
      if (!Number.isFinite(season) || season <= 0 || season > 65535) {
        throw new Error("Season must be 1–65535");
      }

      const recipientPk = new PublicKey(closeRecipient.trim() || publicKey.toBase58());

      const { ix } = await buildCloseReputationIx({
        daoId: daoPk,
        user: userPk,
        season,
        authority: publicKey,
        recipient: recipientPk,
      });

      return [ix];
    });
  };

  const handleCloseProjectMeta = async () => {
    await runTx("Closed project metadata", async () => {
      if (!publicKey || !daoPk) throw new Error("Missing wallet/DAO");
      if (!cfg) throw new Error("Config not found");
      if (!isAuthority) throw new Error("Only authority can close metadata");

      const recipientPk = new PublicKey(
        (closeMetaRecipient || "").trim() || publicKey.toBase58()
      );

      return [
        await ixCloseProjectMetadata({
          daoId: daoPk,
          authority: publicKey,
          recipient: recipientPk,
        }),
      ];
    });
  };

  const hasSnack = Boolean(snackMsg || snackError);
  const snackSeverity: "success" | "error" = snackError ? "error" : "success";
  const snackText = snackError || snackMsg;

  const showAuthorityChip = spaceExists && cfg;
  const authLabel = cfg ? shorten(cfg.authority.toBase58()) : "";
  const yourLabel = publicKey ? shorten(publicKey.toBase58()) : "";

  const canCreate =
    !submitting &&
    connected &&
    !!publicKey &&
    !!daoPk &&
    !!repMint.trim() &&
    Number.isFinite(initialSeason) &&
    initialSeason > 0 &&
    initialSeason <= 65535;

  return (
    <>
      <Dialog
        open={open}
        onClose={safeClose}
        fullWidth
        maxWidth="md"
        PaperProps={{ sx: glassDialogPaperSx }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 2,
            }}
          >
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: 0.2 }}>
                Reputation Manager
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.75 }}>
                Devnet program • Space config + admin actions
              </Typography>
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              {showAuthorityChip && (
                <Chip
                  size="small"
                  label={
                    isAuthority ? `Authority: you (${yourLabel})` : `Authority: ${authLabel}`
                  }
                  sx={{
                    borderRadius: "999px",
                    background: isAuthority
                      ? "rgba(34,197,94,0.16)"
                      : "rgba(148,163,184,0.14)",
                    border: "1px solid rgba(148,163,184,0.35)",
                    color: "rgba(248,250,252,0.92)",
                  }}
                />
              )}
              {spaceExists && cfg && (
                <Chip
                  size="small"
                  label={`Season ${cfg.currentSeason}`}
                  sx={{
                    borderRadius: "999px",
                    background: "rgba(56,189,248,0.14)",
                    border: "1px solid rgba(56,189,248,0.35)",
                    color: "rgba(248,250,252,0.92)",
                  }}
                />
              )}
            </Box>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ display: "grid", gap: 1.5, mt: 2 }}>
            
            <Box
              sx={{
                display: "grid",
                gap: 1,
                gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
              }}
            >
              <PkRow label="DAO Pubkey" value={daoPk?.toBase58() || ""} />
              <PkRow label="Config PDA" value={configPda?.toBase58() || ""} />
              <PkRow label="Project Meta PDA" value={projectMetaPda?.toBase58() || ""} />
              {/*<PkRow label="Program ID" value={VINE_REP_PROGRAM_ID.toBase58()} />*/}

              <PkRow
                  label="Authority"
                  value={authorityPk?.toBase58() || ""}
                  suffix={
                    publicKey && authorityPk?.equals(publicKey)
                      ? "you"
                      : undefined
                  }
                />
            </Box>

            {spaceExists && cfg ? (
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                  gap: 1.5,
                }}
              >
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: "16px",
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    backdropFilter: "blur(10px)",
                  }}
                >
                  <Typography variant="caption" sx={{ opacity: 0.75 }}>
                    Rep mint (current)
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ mt: 0.3, fontFamily: "monospace" }}
                  >
                    {shorten(cfg.repMint.toBase58(), 10, 10)}
                  </Typography>
                </Box>

                <Box sx={{ p: 1.5, borderRadius: "16px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}>
                  <Typography variant="caption" sx={{ opacity: 0.75 }}>
                    Decay (per season)
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.3 }}>
                    {(( (cfg as any)?.decayBps ?? 0) / 100).toFixed(2)}% ({(cfg as any)?.decayBps ?? 0} bps)
                  </Typography>
                </Box>

                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: "16px",
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    backdropFilter: "blur(10px)",
                  }}
                >
                  <Typography variant="caption" sx={{ opacity: 0.75 }}>
                    Metadata URI
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ mt: 0.3, opacity: 0.9, wordBreak: "break-word" }}
                  >
                    {meta?.metadataUri ? meta.metadataUri : "—"}
                  </Typography>
                </Box>
              </Box>
            ) : (
              <Box
                sx={{
                  p: 1.75,
                  borderRadius: "18px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(148,163,184,0.22)",
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 650 }}>
                  Create this space
                </Typography>

                <Box sx={{ mt: 1.5, display: "grid", gap: 1.3 }}>
                  <TextField
                    label="Reputation mint"
                    fullWidth
                    value={repMint}
                    onChange={(e) => setRepMint(e.target.value)}
                    disabled={submitting}
                    InputProps={{ sx: glassFieldSx }}
                  />

                  <TextField
                    label="Initial season"
                    type="number"
                    fullWidth
                    value={initialSeason}
                    onChange={(e) =>
                      setInitialSeason(Number(e.target.value) || 1)
                    }
                    disabled={submitting}
                    InputProps={{ sx: glassFieldSx }}
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
                    InputProps={{ sx: glassFieldSx }}
                    helperText="Stored via upsert_project_metadata after creation."
                    FormHelperTextProps={{ sx: { opacity: 0.7 } }}
                  />

                  {!connected && (
                    <Alert severity="info" sx={{ borderRadius: "14px" }}>
                      Connect your wallet to create the space.
                    </Alert>
                  )}
                </Box>
              </Box>
            )}

            {spaceExists && cfg && (
              <>
                <Divider sx={{ borderColor: "rgba(148,163,184,0.25)", mt: 0.5 }} />

                <Tabs
                  value={tab}
                  onChange={(_, v) => setTab(v)}
                  sx={{
                    "& .MuiTab-root": { textTransform: "none", minHeight: 42 },
                    "& .MuiTabs-indicator": {
                      backgroundColor: "rgba(56,189,248,0.9)",
                    },
                  }}
                >
                  <Tab label="Season" />
                  <Tab label="Mint" />
                  <Tab label="Authority" />
                  <Tab label="Metadata" />
                  <Tab label="Decay" />
                  <Tab label="Reputation Ops" />
                  <Tab label="Danger" />
                </Tabs>

                <TabPanel value={tab} index={0}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 650, mb: 1 }}>
                    Set current season
                  </Typography>
                  <Box sx={{ display: "grid", gap: 1.2, maxWidth: 520 }}>
                    <TextField
                      label="New season"
                      type="number"
                      value={newSeason}
                      onChange={(e) => setNewSeason(Number(e.target.value) || 0)}
                      disabled={submitting}
                      InputProps={{ sx: glassFieldSx }}
                      helperText={`Current: ${cfg.currentSeason}`}
                      FormHelperTextProps={{ sx: { opacity: 0.7 } }}
                    />
                    <Button
                      onClick={handleSetSeason}
                      disabled={
                        !isAuthority ||
                        submitting ||
                        !Number.isFinite(newSeason) ||
                        newSeason <= 0 ||
                        newSeason > 65535
                      }
                      variant="contained"
                      sx={glassPrimaryBtnSx}
                    >
                      Update season
                    </Button>

                    {!isAuthority && (
                      <Alert severity="warning" sx={{ borderRadius: "14px" }}>
                        Admin actions require the authority wallet.
                      </Alert>
                    )}
                  </Box>
                </TabPanel>

                <TabPanel value={tab} index={1}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 650, mb: 1 }}>
                    Set reputation mint
                  </Typography>
                  <Box sx={{ display: "grid", gap: 1.2, maxWidth: 680 }}>
                    <TextField
                      label="New mint"
                      value={newMint}
                      onChange={(e) => setNewMint(e.target.value)}
                      disabled={submitting}
                      InputProps={{ sx: glassFieldSx }}
                      helperText={`Current: ${cfg.repMint.toBase58()}`}
                      FormHelperTextProps={{ sx: { opacity: 0.7 } }}
                    />
                    <Button
                      onClick={handleSetMint}
                      disabled={!isAuthority || submitting || !newMint.trim()}
                      variant="contained"
                      sx={glassPrimaryBtnSx}
                    >
                      Update mint
                    </Button>
                  </Box>
                </TabPanel>

                <TabPanel value={tab} index={2}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 650, mb: 1 }}>
                    Transfer authority
                  </Typography>
                  <Box sx={{ display: "grid", gap: 1.2, maxWidth: 680 }}>
                    <TextField
                      label="New authority pubkey"
                      value={newAuthority}
                      onChange={(e) => setNewAuthority(e.target.value)}
                      disabled={submitting}
                      InputProps={{ sx: glassFieldSx }}
                      helperText={`Current: ${cfg.authority.toBase58()}`}
                      FormHelperTextProps={{ sx: { opacity: 0.7 } }}
                    />
                    <Button
                      onClick={handleTransferAuthority}
                      disabled={!isAuthority || submitting || !newAuthority.trim()}
                      variant="contained"
                      sx={glassPrimaryBtnSx}
                    >
                      Transfer authority
                    </Button>

                    <Alert severity="info" sx={{ borderRadius: "14px" }}>
                      After transfer, your wallet will lose admin permissions for this space.
                    </Alert>
                  </Box>
                </TabPanel>

                <TabPanel value={tab} index={3}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 650, mb: 1 }}>
                    Project metadata
                  </Typography>
                  <Box sx={{ display: "grid", gap: 1.2, maxWidth: 860 }}>
                    <TextField
                      label="Metadata URI"
                      value={metadataUri}
                      onChange={(e) => setMetadataUri(e.target.value)}
                      disabled={submitting}
                      InputProps={{ sx: glassFieldSx }}
                      helperText="Off-chain JSON (name/icon/image/description/website). Stored on devnet."
                      FormHelperTextProps={{ sx: { opacity: 0.7 } }}
                    />
                    <Button
                      onClick={handleUpsertMetadata}
                      disabled={!isAuthority || submitting}
                      variant="contained"
                      sx={glassPrimaryBtnSx}
                    >
                      Save metadata URI
                    </Button>
                  </Box>
                </TabPanel>

                <TabPanel value={tab} index={4}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 650, mb: 1 }}>
                    Seasonal decay
                  </Typography>

                  <Box sx={{ display: "grid", gap: 1.2, maxWidth: 520 }}>
                    <TextField
                      label="Decay (%)"
                      type="number"
                      value={decayPct}
                      onChange={(e) => {
                        const pct = Number(e.target.value);
                        const safePct = Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : 0;
                        setDecayPct(safePct);
                        setDecayBps(Math.round((safePct / 100) * 10_000)); // percent -> bps
                      }}
                      disabled={submitting}
                      InputProps={{ sx: glassFieldSx }}
                      helperText={`Stored on-chain as ${decayBps} bps. Current: ${(cfg as any)?.decayBps ?? 0} bps`}
                      FormHelperTextProps={{ sx: { opacity: 0.7 } }}
                    />

                    <Typography variant="caption" sx={{ opacity: 0.75 }}>
                      Weight formula used by UI: weight = (1 - decay) ^ seasonsAgo
                      {" "}→ multiplier = {(1 - decayBps / 10000).toFixed(4)}
                      {" "}→ prev season weight ≈ {(1 - decayBps / 10000).toFixed(2)}
                    </Typography>

                    <Button
                      onClick={handleSetDecay}
                      disabled={!isAuthority || submitting || decayBps < 0 || decayBps > 10_000}
                      variant="contained"
                      sx={glassPrimaryBtnSx}
                    >
                      Update decay
                    </Button>

                    {!isAuthority && (
                      <Alert severity="warning" sx={{ borderRadius: "14px" }}>
                        Admin actions require the authority wallet.
                      </Alert>
                    )}
                  </Box>
                </TabPanel>

                <TabPanel value={tab} index={5}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 650, mb: 1 }}>
                    Reputation ops (current season: {cfg.currentSeason})
                  </Typography>

                  <Box sx={{ display: "grid", gap: 2 }}>
                    <Box sx={{ display: "grid", gap: 1.2, maxWidth: 860 }}>
                      <TextField
                        label="User wallet (target)"
                        value={repUser}
                        onChange={(e) => setRepUser(e.target.value)}
                        disabled={submitting}
                        InputProps={{ sx: glassFieldSx }}
                      />

                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                          gap: 1.2,
                        }}
                      >
                        <TextField
                          label="Amount (add points)"
                          type="number"
                          value={repAmount}
                          onChange={(e) => setRepAmount(Number(e.target.value) || 0)}
                          disabled={submitting}
                          InputProps={{ sx: glassFieldSx }}
                        />

                        <Box sx={{ display: "flex", gap: 1 }}>
                          <Button
                            onClick={handleAddRep}
                            disabled={!isAuthority || submitting || !repUser.trim() || repAmount <= 0}
                            variant="contained"
                            sx={glassPrimaryBtnSx}
                          >
                            Add points
                          </Button>

                          <Button
                            onClick={handleResetRep}
                            disabled={!isAuthority || submitting || !repUser.trim()}
                            variant="outlined"
                            sx={{
                              ...glassSecondaryBtnSx,
                              border: "1px solid rgba(148,163,184,0.45)",
                            }}
                          >
                            Reset
                          </Button>
                        </Box>
                      </Box>
                    </Box>

                    <Divider sx={{ borderColor: "rgba(148,163,184,0.20)" }} />

                    <Box sx={{ display: "grid", gap: 1.2, maxWidth: 860 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 650 }}>
                        Transfer reputation (wallet → wallet)
                      </Typography>
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                          gap: 1.2,
                        }}
                      >
                        <TextField
                          label="Old wallet"
                          value={repOldWallet}
                          onChange={(e) => setRepOldWallet(e.target.value)}
                          disabled={submitting}
                          InputProps={{ sx: glassFieldSx }}
                        />
                        <TextField
                          label="New wallet"
                          value={repNewWallet}
                          onChange={(e) => setRepNewWallet(e.target.value)}
                          disabled={submitting}
                          InputProps={{ sx: glassFieldSx }}
                        />
                      </Box>

                      <Button
                        onClick={handleTransferRep}
                        disabled={!isAuthority || submitting || !repOldWallet.trim() || !repNewWallet.trim()}
                        variant="contained"
                        sx={glassPrimaryBtnSx}
                      >
                        Transfer reputation
                      </Button>
                    </Box>

                                        <Divider sx={{ borderColor: "rgba(148,163,184,0.20)" }} />

                    <Box sx={{ display: "grid", gap: 1.2, maxWidth: 860 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 650 }}>
                        Bulk import (CSV / plaintext)
                      </Typography>

                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                          gap: 1.2,
                        }}
                      >
                        <TextField
                          label="Season"
                          type="number"
                          value={bulkSeason || cfg.currentSeason}
                          onChange={(e) => setBulkSeason(Number(e.target.value) || 0)}
                          disabled={submitting}
                          InputProps={{ sx: glassFieldSx }}
                          helperText={`Default: current season (${cfg.currentSeason})`}
                          FormHelperTextProps={{ sx: { opacity: 0.7 } }}
                        />

                        <FormControl fullWidth disabled={submitting} sx={{}}>
                          <InputLabel id="bulk-mode-label">Mode</InputLabel>
                          <Select
                            labelId="bulk-mode-label"
                            label="Mode"
                            value={bulkMode}
                            onChange={(e) => setBulkMode(e.target.value as any)}
                            sx={glassFieldSx as any}
                          >
                            <MenuItem value="add">Add points</MenuItem>
                            <MenuItem value="resetAdd">Reset then add</MenuItem>
                          </Select>
                        </FormControl>
                      </Box>

                      <TextField
                        label='Paste lines: "wallet,amount"'
                        value={bulkText}
                        onChange={(e) => setBulkText(e.target.value)}
                        disabled={submitting}
                        multiline
                        minRows={6}
                        placeholder={`Example:\n9xQeWvG... 10\n4Nd1mY... 25\n(or wallet,amount)`}
                        InputProps={{ sx: glassFieldSx }}
                        helperText="Duplicates are merged (summed). Amount must be > 0."
                        FormHelperTextProps={{ sx: { opacity: 0.7 } }}
                      />

                      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                        <Button
                          onClick={handleBulkPreview}
                          disabled={!isAuthority || submitting || !bulkText.trim()}
                          variant="outlined"
                          sx={{
                            ...glassSecondaryBtnSx,
                            border: "1px solid rgba(148,163,184,0.45)",
                          }}
                        >
                          Validate / Preview
                        </Button>

                        <Button
                          onClick={handleBulkImport}
                          disabled={!isAuthority || submitting || !bulkText.trim()}
                          variant="contained"
                          sx={glassPrimaryBtnSx}
                        >
                          Import (chunked)
                        </Button>

                        {bulkProgress && (
                          <Chip
                            size="small"
                            label={bulkProgress}
                            sx={{
                              borderRadius: "999px",
                              background: "rgba(56,189,248,0.14)",
                              border: "1px solid rgba(56,189,248,0.35)",
                              color: "rgba(248,250,252,0.92)",
                              alignSelf: "center",
                            }}
                          />
                        )}
                      </Box>

                      {!!bulkErrors.length && (
                        <Alert severity="error" sx={{ borderRadius: "14px" }}>
                          {bulkErrors.slice(0, 5).join(" • ")}
                          {bulkErrors.length > 5 ? ` … (+${bulkErrors.length - 5} more)` : ""}
                        </Alert>
                      )}

                      {!!bulkPreview.length && !bulkErrors.length && (
                        <Alert severity="success" sx={{ borderRadius: "14px" }}>
                          Ready: {bulkPreview.length} wallets parsed.
                          {bulkPreview.length <= 5
                            ? ` (${bulkPreview
                                .map((r) => `${shorten(r.wallet)}=${r.amount}`)
                                .join(", ")})`
                            : ""}
                        </Alert>
                      )}
                    </Box>

                    {!isAuthority && (
                      <Alert severity="warning" sx={{ borderRadius: "14px" }}>
                        Admin actions require the authority wallet.
                      </Alert>
                    )}
                  </Box>
                </TabPanel>

                {/* ---------------- Danger ---------------- */}
                <TabPanel value={tab} index={6}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                    Danger zone
                  </Typography>

                  <Alert severity="warning" sx={{ borderRadius: "14px", mb: 2 }}>
                    Closing accounts is irreversible. Use carefully.
                  </Alert>

                  <Box sx={{ display: "grid", gap: 2 }}>
                    {/* Close config */}
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: "16px",
                        border: "1px solid rgba(239,68,68,0.35)",
                        background: "rgba(239,68,68,0.08)",
                      }}
                    >
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                        Close space (config)
                      </Typography>

                      <TextField
                        label="Recipient (receives rent)"
                        value={closeRecipient}
                        onChange={(e) => setCloseRecipient(e.target.value)}
                        disabled={submitting}
                        InputProps={{ sx: glassFieldSx }}
                        sx={{ mb: 1.2 }}
                      />

                      <TextField
                        label="Type to confirm"
                        value={closeConfirm}
                        onChange={(e) => setCloseConfirm(e.target.value)}
                        disabled={submitting}
                        InputProps={{ sx: glassFieldSx }}
                        helperText={`Type: CLOSE ${shorten(daoPk?.toBase58() || "", 6, 6)}`}
                        FormHelperTextProps={{ sx: { opacity: 0.7 } }}
                        sx={{ mb: 1.2 }}
                      />

                      <Button
                        onClick={handleCloseSpace}
                        disabled={!isAuthority || submitting || !closeRecipient.trim()}
                        variant="contained"
                        sx={{
                          ...glassPrimaryBtnSx,
                          background: "rgba(239,68,68,0.22)",
                          border: "1px solid rgba(239,68,68,0.35)",
                          "&:hover": { background: "rgba(239,68,68,0.28)" },
                        }}
                      >
                        Close space
                      </Button>
                    </Box>

                    {/* Close user reputation */}
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: "16px",
                        border: "1px solid rgba(245,158,11,0.35)",
                        background: "rgba(245,158,11,0.08)",
                      }}
                    >
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                        Close a user reputation account
                      </Typography>

                      <TextField
                        label="User wallet"
                        value={closeRepUser}
                        onChange={(e) => setCloseRepUser(e.target.value)}
                        disabled={submitting}
                        InputProps={{ sx: glassFieldSx }}
                        sx={{ mb: 1.2 }}
                      />

                      <TextField
                        label="Season"
                        type="number"
                        value={closeRepSeason}
                        onChange={(e) => setCloseRepSeason(Number(e.target.value) || 0)}
                        disabled={submitting}
                        InputProps={{ sx: glassFieldSx }}
                        helperText={`Default: current season (${cfg.currentSeason})`}
                        FormHelperTextProps={{ sx: { opacity: 0.7 } }}
                        sx={{ mb: 1.2 }}
                      />

                      <Button
                        onClick={handleCloseUserReputation}
                        disabled={!isAuthority || submitting || !closeRepUser.trim()}
                        variant="contained"
                        sx={{
                          ...glassPrimaryBtnSx,
                          background: "rgba(245,158,11,0.20)",
                          border: "1px solid rgba(245,158,11,0.35)",
                          "&:hover": { background: "rgba(245,158,11,0.26)" },
                        }}
                      >
                        Close user reputation
                      </Button>
                    </Box>

                    {/* Close project meta */}
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: "16px",
                        border: "1px solid rgba(148,163,184,0.28)",
                        background: "rgba(148,163,184,0.06)",
                      }}
                    >
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                        Close project metadata account
                      </Typography>

                      <TextField
                        label="Recipient (receives rent)"
                        value={closeMetaRecipient}
                        onChange={(e) => setCloseMetaRecipient(e.target.value)}
                        disabled={submitting}
                        InputProps={{ sx: glassFieldSx }}
                        sx={{ mb: 1.2 }}
                      />

                      <Button
                        onClick={handleCloseProjectMeta}
                        disabled={!isAuthority || submitting}
                        variant="contained"
                        sx={{
                          ...glassPrimaryBtnSx,
                          background: "rgba(148,163,184,0.16)",
                          border: "1px solid rgba(148,163,184,0.30)",
                          "&:hover": { background: "rgba(148,163,184,0.22)" },
                        }}
                      >
                        Close project metadata
                      </Button>
                    </Box>

                    {!isAuthority && (
                      <Alert severity="warning" sx={{ borderRadius: "14px" }}>
                        Admin actions require the authority wallet.
                      </Alert>
                    )}
                  </Box>
                </TabPanel>
              </>
            )}
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={safeClose} disabled={submitting} sx={glassSecondaryBtnSx}>
            Close
          </Button>

          {!spaceExists && (
            <Button
              onClick={handleCreate}
              disabled={!canCreate}
              variant="contained"
              sx={glassPrimaryBtnSx}
            >
              {submitting ? "Creating…" : "Create space"}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {hasSnack && (
        <Snackbar
          open={hasSnack}
          autoHideDuration={4500}
          onClose={closeSnack}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert onClose={closeSnack} severity={snackSeverity} sx={{ width: "100%" }}>
            {snackText}
          </Alert>
        </Snackbar>
      )}
    </>
  );
};

export default ReputationManager;