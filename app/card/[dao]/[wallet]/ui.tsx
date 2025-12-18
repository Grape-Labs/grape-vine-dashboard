"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Container,
  Paper,
  Snackbar,
  Alert,
  Typography,
  IconButton,
  Tooltip,
  Divider,
  Chip,
  Stack,
  TextField,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DownloadIcon from "@mui/icons-material/Download";
import ImageIcon from "@mui/icons-material/Image";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import html2canvas from "html2canvas";
import { ReputationCard } from "../../../components/ReputationCard";

type VineTheme = {
  primary?: string;
  background_image?: string | null;
  background_opacity?: number;
  background_blur?: number;
  background_position?: string;
  background_size?: string;
  background_repeat?: string;
};

function getTheme(meta: any | null): VineTheme {
  return (meta?.vine?.theme ?? {}) as VineTheme;
}

export default function CardPageClient({
  dao,
  wallet,
  meta,
}: {
  dao: string;
  wallet: string;
  meta: any | null;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedImg, setCopiedImg] = useState(false);

  const theme = useMemo(() => getTheme(meta), [meta]);
  const primary = theme.primary ?? "#7c3aed";

  const daoName = meta?.name ?? "Vine Reputation Space";
  const symbol = meta?.symbol ?? "";
  const description = meta?.description ?? "";

  const publicUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/card/${dao}/${wallet}`;
  }, [dao, wallet]);

  const copyText = async (txt: string) => {
    try {
      await navigator.clipboard.writeText(txt);
      setCopied(true);
    } catch {}
  };

  const capturePngBlob = async () => {
    if (!cardRef.current) return null;

    const canvas = await html2canvas(cardRef.current as HTMLElement, {
      backgroundColor: "#020617",
      scale: Math.max(window.devicePixelRatio || 2, 2),
    });

    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/png")
    );
  };

  return (
    
        <ReputationCard
        ref={cardRef as any}
        wallet={wallet}
        daoIdBase58={dao}
        meta={meta}
        // If you added themeOverride support, pass it too:
        // themeOverride={theme}
        endpoint={
            process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC || "https://api.devnet.solana.com"
        }
        />
  );
}