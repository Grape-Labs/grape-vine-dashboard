"use client";

import React, { useMemo, useState, useEffect, useId } from "react";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Alert,
  Snackbar,
  MenuItem,
  Button,
  Box,
  Typography,
  Divider,
  Chip,
  FormControlLabel,
  Switch,
} from "@mui/material";

type Provider = "irys" | "pinata" | "arweave";
type ThemeMode = "auto" | "dark" | "light";

const BG_TEMPLATES: Array<{
  id: string;
  label: string;
  url: string;
  // optional per-template defaults (tweak to taste)
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
    opacity: 0.50,
    blur: 14,
  },
  {
    id: "og",
    label: "OG",
    url: "https://gateway.irys.xyz/64msLezDRMRcFDpeWTcBsE3aEP7Pfx5e3MLEcZkFoMXz",
    mode: "dark",
    primary: "#60A5FA",
    opacity: 0.42,
    blur: 10,
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

export type MetadataJson = {
  name?: string;
  symbol?: string;
  description?: string;
  image?: string; // URL
  external_url?: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
  properties?: any;

  vine?: {
    theme?: {
      mode?: ThemeMode;
      primary?: string; // hex
      background_image?: string;
      background_opacity?: number; // 0..1
      background_blur?: number; // px
      background_position?: string;
      background_size?: string;
      background_repeat?: string;
    };
    [k: string]: any;
  };

  [k: string]: any;
};

export interface MetadataManagerProps {
  open: boolean;
  onClose: () => void;

  title?: string;
  defaultProvider?: Provider;
  defaultName?: string;
  defaultSymbol?: string;
  defaultDescription?: string;

  onMetadataReady?: (metadataUrl: string, metadataJson: MetadataJson) => void;
}

const dialogPaperSx = {
  borderRadius: "20px",
  background: "rgba(15,23,42,0.86)",
  border: "1px solid rgba(148,163,184,0.28)",
  backdropFilter: "blur(14px)",
  color: "rgba(248,250,252,0.95)",
};

const primaryBtnSx = {
  textTransform: "none",
  borderRadius: "999px",
  px: 2.2,
  background: "rgba(255,255,255,0.14)",
  border: "1px solid rgba(255,255,255,0.22)",
  color: "rgba(248,250,252,0.95)",
  "&:hover": { background: "rgba(255,255,255,0.20)" },
};

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function safeHex(v: string) {
  const s = (v || "").trim();
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(s)) return s;
  return "";
}

function safeNum(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

const chipSx = {
  height: 24,
  color: "rgba(248,250,252,0.92)",
  background: "rgba(15,23,42,0.55)",
  border: "1px solid rgba(148,163,184,0.30)",
  backdropFilter: "blur(8px)",
} as const;

const MetadataManager: React.FC<MetadataManagerProps> = ({
  open,
  onClose,
  title,
  defaultProvider = "irys",
  defaultName = "",
  defaultSymbol = "",
  defaultDescription = "",
  onMetadataReady,
}) => {
  const inputId = useId();
  const bgInputId = useId();

  const [provider, setProvider] = useState<Provider>(defaultProvider);

  const [name, setName] = useState(defaultName);
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [description, setDescription] = useState(defaultDescription);
  const [externalUrl, setExternalUrl] = useState("");

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

  // Vine Theme fields
  const [enableVineTheme, setEnableVineTheme] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>("auto");
  const [themePrimary, setThemePrimary] = useState<string>("#7c3aed");
  const [themeBgImage, setThemeBgImage] = useState<string>("");
  const [themeBgOpacity, setThemeBgOpacity] = useState<number>(0.45);
  const [themeBgBlur, setThemeBgBlur] = useState<number>(12);
  const [themeBgPosition, setThemeBgPosition] = useState<string>("center");
  const [themeBgSize, setThemeBgSize] = useState<string>("cover");
  const [themeBgRepeat, setThemeBgRepeat] = useState<string>("no-repeat");

  // Optional bg upload
  const [bgFile, setBgFile] = useState<File | null>(null);
  const [bgUploading, setBgUploading] = useState(false);

  const [customJson, setCustomJson] = useState<string>(JSON.stringify({}, null, 2));

  const [submitting, setSubmitting] = useState(false);
  const [snack, setSnack] = useState<{ msg: string; err?: boolean } | null>(null);
  const closeSnack = () => setSnack(null);

  const [logoObjectUrl, setLogoObjectUrl] = useState<string | null>(null);
  const [bgObjectUrl, setBgObjectUrl] = useState<string | null>(null);

    // Theme template selection
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  const applyTemplate = (tplId: string) => {
    const tpl = BG_TEMPLATES.find((t) => t.id === tplId);
    if (!tpl) return;

    setEnableVineTheme(true);
    setSelectedTemplateId(tpl.id);

    // set background to template
    setThemeBgImage(tpl.url);

    // apply optional defaults
    if (tpl.mode) setThemeMode(tpl.mode);
    if (tpl.primary) setThemePrimary(tpl.primary);
    if (typeof tpl.opacity === "number") setThemeBgOpacity(clamp01(tpl.opacity));
    if (typeof tpl.blur === "number") setThemeBgBlur(Math.max(0, tpl.blur));

    // stable defaults
    setThemeBgPosition("center");
    setThemeBgSize("cover");
    setThemeBgRepeat("no-repeat");

    setSnack({ msg: `Applied template: ${tpl.label}` });
  };

  const clearTemplate = () => {
    setSelectedTemplateId("");
    setThemeBgImage("");
    setSnack({ msg: "Template cleared" });
  };

  useEffect(() => {
    if (!open) return;

    setSelectedTemplateId("");

    setProvider(defaultProvider);
    setName(defaultName);
    setSymbol(defaultSymbol);
    setDescription(defaultDescription);

    setExternalUrl("");
    setImageFile(null);
    setUploadedUrl(null);

    setSubmitting(false);
    setSnack(null);

    // Theme defaults
    setEnableVineTheme(false);
    setThemeMode("auto");
    setThemePrimary("#cccccc");
    setThemeBgImage("");
    setThemeBgOpacity(0.45);
    setThemeBgBlur(12);
    setThemeBgPosition("center");
    setThemeBgSize("cover");
    setThemeBgRepeat("no-repeat");

    setBgFile(null);
    setBgUploading(false);

    // keep custom json stable but reset to empty object
    setCustomJson(JSON.stringify({}, null, 2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultProvider, defaultName, defaultSymbol, defaultDescription]);

  const canUseProvider = useMemo(() => provider === "irys", [provider]);

  const safeClose = () => {
    if (!submitting && !bgUploading) onClose();
  };

  function safeParseCustomJson(): any {
    const raw = (customJson || "").trim();
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Custom JSON must be an object");
    }
    return parsed;
  }

  async function uploadViaApi(file: File, contentType?: string): Promise<string> {
    const fd = new FormData();
    fd.append("file", file);
    if (contentType) fd.append("contentType", contentType);

    const res = await fetch(`/api/storage/upload?provider=${provider}`, {
      method: "POST",
      body: fd,
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.ok) {
      throw new Error(json?.error || `Upload failed (${res.status})`);
    }
    return json.url as string;
  }

  const resolvedTheme = useMemo(() => {
    const primary = safeHex(themePrimary) || "#cccccc";
    const opacity = clamp01(safeNum(themeBgOpacity, 0.45));
    const blur = Math.max(0, safeNum(themeBgBlur, 12));

    return {
      mode: themeMode,
      primary,
      bg: {
        image: (themeBgImage || "").trim(),
        opacity,
        blur,
        position: (themeBgPosition || "center").trim() || "center",
        size: (themeBgSize || "cover").trim() || "cover",
        repeat: (themeBgRepeat || "no-repeat").trim() || "no-repeat",
      },
    };
  }, [
    themeMode,
    themePrimary,
    themeBgImage,
    themeBgOpacity,
    themeBgBlur,
    themeBgPosition,
    themeBgSize,
    themeBgRepeat,
  ]);

  const handleUploadThemeBgFile = async () => {
    try {
      if (!canUseProvider) throw new Error(`${provider} not enabled yet`);
      if (!bgFile) throw new Error("Choose a background image file first");

      setBgUploading(true);
      const url = await uploadViaApi(bgFile, bgFile.type || "image/*");
      setThemeBgImage(url);
      setSnack({ msg: "Background image uploaded & applied" });
    } catch (e: any) {
      setSnack({ msg: e?.message ?? "Background upload failed", err: true });
    } finally {
      setBgUploading(false);
    }
  };

  const handleUpload = async () => {
    try {
      if (!canUseProvider) throw new Error(`${provider} not enabled yet`);
      if (!imageFile) throw new Error("Please choose an image file");

      setSubmitting(true);

      // 1) Upload image
      const imageUrl = await uploadViaApi(imageFile, imageFile.type || "image/*");

      // 2) Merge custom JSON
      const extra = safeParseCustomJson();

      // 3) Optional vine theme
      const vineTheme = {
        mode: resolvedTheme.mode,
        primary: resolvedTheme.primary,
        ...(resolvedTheme.bg.image ? { background_image: resolvedTheme.bg.image } : {}),
        background_opacity: resolvedTheme.bg.opacity,
        background_blur: resolvedTheme.bg.blur,
        background_position: resolvedTheme.bg.position,
        background_size: resolvedTheme.bg.size,
        background_repeat: resolvedTheme.bg.repeat,
      };

      const metadata: MetadataJson = {
        ...(name ? { name } : {}),
        ...(symbol ? { symbol } : {}),
        ...(description ? { description } : {}),
        ...(externalUrl ? { external_url: externalUrl } : {}),
        image: imageUrl,

        // common NFT-ish fields (keep if you use them)
        seller_fee_basis_points: extra?.seller_fee_basis_points ?? 0,
        animation_url: extra?.animation_url,
        attributes: extra?.attributes ?? [],

        properties: {
          ...(extra?.properties ?? {}),
          files: [
            { uri: imageUrl, type: imageFile.type || "image/*" },
            ...(enableVineTheme &&
            resolvedTheme.bg.image &&
            resolvedTheme.bg.image !== imageUrl
              ? [{ uri: resolvedTheme.bg.image, type: "image/*" }]
              : []),
          ],
          category: "image",
        },

        ...(enableVineTheme
          ? {
              vine: {
                ...(extra?.vine ?? {}),
                theme: {
                  ...vineTheme,
                  ...(extra?.vine?.theme ?? {}), // allow override/extra keys
                },
              },
            }
          : {}),

        // finally spread extra (so custom top-level keys survive)
        ...extra,
      };

      // 4) Upload metadata.json
      const metaFile = new File([JSON.stringify(metadata, null, 2)], "metadata.json", {
        type: "application/json",
      });

      const metadataUrl = await uploadViaApi(metaFile, "application/json");

      setUploadedUrl(metadataUrl);
      setSnack({ msg: `Metadata uploaded: ${metadataUrl}` });
      onMetadataReady?.(metadataUrl, metadata);
    } catch (e: any) {
      setSnack({ msg: e?.message ?? "Upload failed", err: true });
    } finally {
      setSubmitting(false);
    }
  };

  // --- helpers (add near your other helpers) ---
function rgbToHex(r: number, g: number, b: number) {
  const to = (n: number) => n.toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}
function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2*l - 1));
    switch (max) {
      case r: h = ((g - b) / d) % 6; break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60; if (h < 0) h += 360;
  }
  return { h, s, l };
}

async function loadImageToCanvas(src: string): Promise<HTMLCanvasElement> {
  const img = new Image();
  img.crossOrigin = "anonymous"; // works if server allows CORS; for local object URLs it's fine
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load image for color analysis"));
    img.src = src;
  });

  const canvas = document.createElement("canvas");
    const maxW = 320;
    const scale = Math.min(1, maxW / img.width);
    canvas.width = Math.max(1, Math.floor(img.width * scale));
    canvas.height = Math.max(1, Math.floor(img.height * scale));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas not supported");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  function srgbToLinear(c: number) {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  function relLuminance(r: number, g: number, b: number) {
    const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
  }
  function contrastRatio(l1: number, l2: number) {
    const L1 = Math.max(l1, l2), L2 = Math.min(l1, l2);
    return (L1 + 0.05) / (L2 + 0.05);
  }
  function hexToRgb(hex: string) {
    const h = hex.replace("#", "");
    const v = h.length === 3
      ? h.split("").map(ch => ch + ch).join("")
      : h.length >= 6
        ? h.slice(0, 6)
        : "";
    if (!v) return null;
    const n = parseInt(v, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  function mix(a: number, b: number, t: number) {
    return Math.round(a + (b - a) * t);
  }
  function mixRgb(rgb: {r:number;g:number;b:number}, target: {r:number;g:number;b:number}, t: number) {
    return { r: mix(rgb.r, target.r, t), g: mix(rgb.g, target.g, t), b: mix(rgb.b, target.b, t) };
  }

  // Given a background color, choose a readable foreground.
  // Prefers white/black, otherwise nudges the accent toward contrast.
  function readableOn(bgHex: string, prefer: "white" | "black" = "white") {
    const bg = hexToRgb(bgHex);
    if (!bg) return "#ffffff";

    const Lbg = relLuminance(bg.r, bg.g, bg.b);

    const white = { r: 255, g: 255, b: 255 };
    const black = { r: 0, g: 0, b: 0 };
    const Lw = relLuminance(255,255,255);
    const Lb = relLuminance(0,0,0);

    const crWhite = contrastRatio(Lbg, Lw);
    const crBlack = contrastRatio(Lbg, Lb);

    // aim for >= 4.5:1 (WCAG normal text). For small nav buttons, this matters.
    if (crWhite >= 4.5 && crBlack >= 4.5) {
      return prefer === "white" ? "#ffffff" : "#000000";
    }
    if (crWhite >= 4.5) return "#ffffff";
    if (crBlack >= 4.5) return "#000000";

    // If neither passes (rare mid-gray), nudge toward the better one.
    return crWhite > crBlack ? "#ffffff" : "#000000";
  }

  function pickAccentFromCanvas(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const buckets = new Map<string, { count: number; r: number; g: number; b: number; score: number }>();

    const step = Math.max(1, Math.floor((width * height) / 9000));
    for (let i = 0; i < data.length; i += 4 * step) {
      const a = data[i + 3] / 255;
      if (a < 0.6) continue;

      const r = data[i], g = data[i + 1], b = data[i + 2];
      const { s, l } = rgbToHsl(r, g, b);

      if (l < 0.08 || l > 0.92) continue;
      if (s < 0.18) continue;

      const rq = (r >> 4), gq = (g >> 4), bq = (b >> 4);
      const key = `${rq}-${gq}-${bq}`;

      const score = (s * 0.75) + ((1 - Math.abs(l - 0.55)) * 0.25);

      const cur = buckets.get(key);
      if (!cur) buckets.set(key, { count: 1, r, g, b, score });
      else {
        cur.count += 1;
        cur.r = cur.r + (r - cur.r) / cur.count;
        cur.g = cur.g + (g - cur.g) / cur.count;
        cur.b = cur.b + (b - cur.b) / cur.count;
        cur.score = Math.max(cur.score, score);
      }
    }

    let best: any = null;
    buckets.forEach((b) => {
      const v = b.count * b.score;
      if (!best || v > best.v) best = { ...b, v };
    });

    const accent = best
      ? rgbToHex(clamp(Math.round(best.r), 0, 255), clamp(Math.round(best.g), 0, 255), clamp(Math.round(best.b), 0, 255))
      : "#7c3aed";

    // IMPORTANT: since your "primary" is used as TEXT/BORDER color,
    // return a readable inverse against the button fill (accent).
    return readableOn(accent, "white");
  }



  const handleRecommendPrimary = async () => {
    try {
      // Prefer logo first (your governance mark defines brand). Fall back to BG.
      const src =
        logoObjectUrl ||
        (themeBgImage.startsWith("blob:") ? themeBgImage : "") ||
        bgObjectUrl ||
        (themeBgImage || "");

      if (!src) throw new Error("Upload a logo or background image first.");

      const canvas = await loadImageToCanvas(src);
      const hex = pickAccentFromCanvas(canvas);
      setThemePrimary(hex);
      setSnack({ msg: `Recommended primary: ${hex}` });
    } catch (e: any) {
      setSnack({ msg: e?.message ?? "Could not recommend a color", err: true });
    }
  };

  useEffect(() => {
    // logo (imageFile)
    if (imageFile) {
      const u = URL.createObjectURL(imageFile);
      setLogoObjectUrl(u);
      return () => URL.revokeObjectURL(u);
    } else setLogoObjectUrl(null);
  }, [imageFile]);

  useEffect(() => {
    // bg file
    if (bgFile) {
      const u = URL.createObjectURL(bgFile);
      setBgObjectUrl(u);
      return () => URL.revokeObjectURL(u);
    } else setBgObjectUrl(null);
  }, [bgFile]);

  return (
    <>
      <Dialog
        open={open}
        onClose={safeClose}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: dialogPaperSx }}
      >
        <DialogTitle>{title ?? "Metadata Manager"}</DialogTitle>

        <DialogContent sx={{ display: "grid", gap: 1.4, pt: 2 }}>
          <TextField
            select
            label="Storage Provider"
            value={provider}
            onChange={(e) => setProvider(e.target.value as Provider)}
          >
            <MenuItem value="irys">Irys (recommended)</MenuItem>
            <MenuItem value="pinata" disabled>
              Pinata (coming soon)
            </MenuItem>
            <MenuItem value="arweave" disabled>
              Arweave direct (coming soon)
            </MenuItem>
          </TextField>

          {!canUseProvider && (
            <Alert severity="warning" sx={{ borderRadius: "14px" }}>
              This provider isn’t enabled yet. Use Irys for now.
            </Alert>
          )}

          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <TextField label="Symbol" value={symbol} onChange={(e) => setSymbol(e.target.value)} />
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            minRows={2}
          />
          <TextField
            label="External URL (optional)"
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
          />

          {/* Token/project image */}
          <Box sx={{ display: "grid", gap: 0.6 }}>
            <Typography variant="body2" sx={{ opacity: 0.85 }}>
              Image
            </Typography>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
              <Button
                component="label"
                htmlFor={inputId}
                disabled={submitting || bgUploading}
                sx={{
                  textTransform: "none",
                  borderRadius: "999px",
                  border: "1px solid rgba(255,255,255,0.22)",
                  color: "rgba(248,250,252,0.95)",
                }}
              >
                Choose file
                <input
                  id={inputId}
                  hidden
                  type="file"
                  accept="image/*"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const f = e.target.files?.[0] ?? null;
                    setImageFile(f);
                    e.target.value = "";
                  }}
                />
              </Button>

              <Typography variant="caption" sx={{ opacity: 0.75 }}>
                {imageFile ? imageFile.name : "No file selected"}
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ borderColor: "rgba(148,163,184,0.25)" }} />

          <FormControlLabel
            control={
              <Switch
                checked={enableVineTheme}
                onChange={(e) => setEnableVineTheme(e.target.checked)}
              />
            }
            label="Enable Vine theme customization"
          />

          {enableVineTheme && (
            <>
              <Box sx={{ display: "grid", gap: 1.1 }}>
                <TextField
                  select
                  label="Theme mode"
                  value={themeMode}
                  onChange={(e) => setThemeMode(e.target.value as ThemeMode)}
                >
                  <MenuItem value="auto">Auto</MenuItem>
                  <MenuItem value="dark">Dark</MenuItem>
                  <MenuItem value="light">Light</MenuItem>
                </TextField>

                <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                  <TextField
                    label="Primary color"
                    value={themePrimary}
                    onChange={(e) => setThemePrimary(e.target.value)}
                    placeholder="#7c3aed"
                    helperText="Pick or paste hex (#RGB, #RRGGBB, #RRGGBBAA)"
                    sx={{ flex: 1, minWidth: 240 }}
                  />

                  {/* Native picker */}
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: "10px",
                        border: "1px solid rgba(255,255,255,0.22)",
                        background: safeHex(themePrimary) || "#cccccc",
                        boxShadow: `0 0 0 4px rgba(0,0,0,0.18)`,
                      }}
                    />
                    <input
                      type="color"
                      value={safeHex(themePrimary) || "#cccccc"}
                      onChange={(e) => setThemePrimary(e.target.value)}
                      style={{
                        width: 42,
                        height: 42,
                        border: "none",
                        background: "transparent",
                        padding: 0,
                        cursor: "pointer",
                      }}
                      aria-label="Pick primary color"
                    />
                  </Box>

                  <Button
                    onClick={handleRecommendPrimary}
                    disabled={submitting || bgUploading}
                    sx={{ ...primaryBtnSx, py: 0.9 }}
                  >
                    Recommend
                  </Button>
                </Box>

                {/* Background Templates */}
                <Box sx={{ display: "grid", gap: 0.8 }}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 1,
                    }}
                  >
                    <Typography variant="body2" sx={{ opacity: 0.88 }}>
                      Background templates
                    </Typography>

                    <Box sx={{ display: "flex", gap: 1 }}>
                      <Button
                        size="small"
                        onClick={handleRecommendPrimary}
                        disabled={submitting || bgUploading || !themeBgImage}
                        sx={{ textTransform: "none" }}
                      >
                        Auto primary
                      </Button>

                      <Button
                        size="small"
                        onClick={clearTemplate}
                        disabled={submitting || bgUploading || (!selectedTemplateId && !themeBgImage)}
                        sx={{ textTransform: "none" }}
                      >
                        Clear
                      </Button>
                    </Box>
                  </Box>

                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(3, 1fr)" },
                      gap: 1,
                    }}
                  >
                    {BG_TEMPLATES.map((t) => {
                      const active = selectedTemplateId === t.id || themeBgImage === t.url;
                      return (
                        <Box
                          key={t.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => applyTemplate(t.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") applyTemplate(t.id);
                          }}
                          sx={{
                            cursor: "pointer",
                            borderRadius: "14px",
                            overflow: "hidden",
                            border: active
                              ? "1px solid rgba(248,250,252,0.55)"
                              : "1px solid rgba(148,163,184,0.28)",
                            background: "rgba(2,6,23,0.35)",
                            boxShadow: active ? "0 0 0 2px rgba(255,255,255,0.18)" : "none",
                          }}
                        >
                          <Box
                            sx={{
                              height: 78,
                              backgroundImage: `url("${t.url}")`,
                              backgroundSize: "cover",
                              backgroundPosition: "center",
                              filter: "saturate(1.05)",
                            }}
                          />
                          <Box
                            sx={{
                              px: 1,
                              py: 0.8,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 1,
                            }}
                          >
                            <Typography variant="caption" sx={{ opacity: 0.9 }}>
                              {t.label}
                            </Typography>
                            {active && (
                              <Chip
                                size="small"
                                label="Active"
                                sx={{
                                  height: 20,
                                  fontSize: 11,
                                  color: "rgba(248,250,252,0.92)",
                                  background: "rgba(255,255,255,0.14)",
                                  border: "1px solid rgba(255,255,255,0.22)",
                                }}
                              />
                            )}
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>

                  <Typography variant="caption" sx={{ opacity: 0.7 }}>
                    Click a template to instantly set the background + defaults. You can still paste a custom URL or upload.
                  </Typography>
                </Box>

                <TextField
                  label="Background image URL (custom)"
                  value={themeBgImage}
                  onChange={(e) => setThemeBgImage(e.target.value)}
                  placeholder="https://..."
                />

                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
                  <Button
                    component="label"
                    htmlFor={bgInputId}
                    disabled={submitting || bgUploading}
                    sx={{
                      textTransform: "none",
                      borderRadius: "999px",
                      border: "1px solid rgba(255,255,255,0.22)",
                      color: "rgba(248,250,252,0.95)",
                    }}
                  >
                    Choose BG file
                    <input
                      id={bgInputId}
                      hidden
                      type="file"
                      accept="image/*"
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const f = e.target.files?.[0] ?? null;
                        setBgFile(f);
                        e.target.value = "";
                      }}
                    />
                  </Button>

                  <Typography variant="caption" sx={{ opacity: 0.75 }}>
                    {bgFile ? bgFile.name : "No BG file selected"}
                  </Typography>

                  <Button
                    onClick={handleUploadThemeBgFile}
                    disabled={!canUseProvider || submitting || bgUploading || !bgFile}
                    sx={{ ...primaryBtnSx, py: 0.7 }}
                  >
                    {bgUploading ? "Uploading…" : "Upload BG"}
                  </Button>
                </Box>

                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                    gap: 1.1,
                  }}
                >
                  <TextField
                    label="Background opacity (0..1)"
                    type="number"
                    value={themeBgOpacity}
                    onChange={(e) => setThemeBgOpacity(safeNum(e.target.value, 0.45))}
                  />
                  <TextField
                    label="Background blur (px)"
                    type="number"
                    value={themeBgBlur}
                    onChange={(e) => setThemeBgBlur(Math.max(0, safeNum(e.target.value, 12)))}
                  />
                  <TextField
                    label="Background position"
                    value={themeBgPosition}
                    onChange={(e) => setThemeBgPosition(e.target.value)}
                    placeholder="center / top / 50% 50%"
                  />
                  <TextField
                    label="Background size"
                    value={themeBgSize}
                    onChange={(e) => setThemeBgSize(e.target.value)}
                    placeholder="cover / contain / 100% 100%"
                  />
                  <TextField
                    label="Background repeat"
                    value={themeBgRepeat}
                    onChange={(e) => setThemeBgRepeat(e.target.value)}
                    placeholder="no-repeat / repeat"
                  />
                </Box>

                {/* Live preview */}
                <Box
                  sx={{
                    mt: 0.5,
                    borderRadius: "18px",
                    overflow: "hidden",
                    border: "1px solid rgba(148,163,184,0.35)",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
                  }}
                >
                  <Box
                    sx={{
                      position: "relative",
                      height: 190,
                      backgroundImage: resolvedTheme.bg.image
                        ? `url("${resolvedTheme.bg.image}")`
                        : "linear-gradient(135deg, rgba(124,58,237,0.30), rgba(56,189,248,0.18))",
                      backgroundSize: resolvedTheme.bg.size,
                      backgroundPosition: resolvedTheme.bg.position,
                      backgroundRepeat: resolvedTheme.bg.repeat,
                    }}
                  >
                    <Box
                      sx={{
                        position: "absolute",
                        inset: 0,
                        background: `rgba(0,0,0,${resolvedTheme.bg.opacity})`,
                        backdropFilter: `blur(${resolvedTheme.bg.blur}px)`,
                      }}
                    />

                    <Box
                      sx={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 44,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        px: 1.5,
                        borderBottom: "1px solid rgba(255,255,255,0.12)",
                        background: "rgba(15,23,42,0.55)",
                        backdropFilter: "blur(10px)",
                      }}
                    >
                      <Typography variant="caption" sx={{ opacity: 0.9, letterSpacing: 0.3 }}>
                        VINE • Preview
                      </Typography>
                      <Box sx={{ display: "flex", gap: 0.8, alignItems: "center" }}>
                        <Chip size="small" label={`mode: ${resolvedTheme.mode}`} sx={chipSx} />
                        <Chip size="small" label={resolvedTheme.primary} sx={chipSx} />
                      </Box>
                    </Box>

                    <Box
                      sx={{
                        position: "absolute",
                        inset: 0,
                        pt: "54px",
                        px: 2,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        gap: 1,
                      }}
                    >
                      <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
                        Live Theme Preview
                      </Typography>

                      <Typography variant="caption" sx={{ opacity: 0.85, maxWidth: 420 }}>
                        Background + overlay + blur + primary color.
                      </Typography>

                      <Box sx={{ display: "flex", gap: 1, mt: 0.5 }}>
                        <Button
                          size="small"
                          variant="contained"
                          sx={{
                            textTransform: "none",
                            borderRadius: "999px",
                            background: resolvedTheme.primary,
                            "&:hover": { background: resolvedTheme.primary },
                          }}
                        >
                          Primary
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          sx={{
                            textTransform: "none",
                            borderRadius: "999px",
                            borderColor: "rgba(255,255,255,0.35)",
                            color: "rgba(248,250,252,0.92)",
                          }}
                        >
                          Secondary
                        </Button>
                      </Box>
                    </Box>
                  </Box>
                </Box>
              </Box>
            </>
          )}

          <Divider sx={{ borderColor: "rgba(148,163,184,0.25)" }} />

          <TextField
            label="Custom JSON (optional, merged into metadata)"
            value={customJson}
            onChange={(e) => setCustomJson(e.target.value)}
            multiline
            minRows={6}
            sx={{ fontFamily: "monospace" }}
          />

          {uploadedUrl && (
            <Box
              sx={{
                mt: 1.5,
                p: 1.4,
                borderRadius: "14px",
                border: "1px solid rgba(148,163,184,0.35)",
                background: "rgba(0,0,0,0.25)",
                display: "grid",
                gap: 0.8,
              }}
            >
              <Typography variant="caption" sx={{ opacity: 0.75 }}>
                Metadata URL
              </Typography>

              <TextField
                value={uploadedUrl}
                fullWidth
                InputProps={{
                  readOnly: true,
                  sx: { fontFamily: "monospace" },
                }}
              />

              <Box sx={{ display: "flex", gap: 1 }}>
                <Button
                  size="small"
                  onClick={() => {
                    navigator.clipboard.writeText(uploadedUrl);
                    setSnack({ msg: "Copied to clipboard" });
                  }}
                  sx={{ textTransform: "none" }}
                >
                  Copy
                </Button>

                <Button
                  size="small"
                  component="a"
                  href={uploadedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ textTransform: "none" }}
                >
                  Open
                </Button>
              </Box>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button
            onClick={safeClose}
            disabled={submitting || bgUploading}
            sx={{ textTransform: "none", color: "rgba(248,250,252,0.85)" }}
          >
            Close
          </Button>

          <Button
            onClick={handleUpload}
            disabled={submitting || bgUploading || !canUseProvider}
            sx={primaryBtnSx}
          >
            {submitting ? "Uploading…" : "Upload"}
          </Button>
        </DialogActions>
      </Dialog>

      {snack && (
        <Snackbar open autoHideDuration={6500} onClose={closeSnack}>
          <Alert severity={snack.err ? "error" : "success"} onClose={closeSnack}>
            {snack.msg}
          </Alert>
        </Snackbar>
      )}
    </>
  );
};

export default MetadataManager;