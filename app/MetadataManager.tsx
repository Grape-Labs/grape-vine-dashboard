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
} from "@mui/material";

type Provider = "irys" | "pinata" | "arweave";
type ThemeMode = "auto" | "dark" | "light";

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

  // ✅ Theme fields
  const [themeMode, setThemeMode] = useState<ThemeMode>("auto");
  const [themePrimary, setThemePrimary] = useState<string>("#7c3aed");
  const [themeBgImage, setThemeBgImage] = useState<string>("");
  const [themeBgOpacity, setThemeBgOpacity] = useState<number>(0.45);
  const [themeBgBlur, setThemeBgBlur] = useState<number>(12);
  const [themeBgPosition, setThemeBgPosition] = useState<string>("center");
  const [themeBgSize, setThemeBgSize] = useState<string>("cover");
  const [themeBgRepeat, setThemeBgRepeat] = useState<string>("no-repeat");

  // ✅ Optional: allow user to upload a background image file (it will upload to Irys and set themeBgImage)
  const [bgFile, setBgFile] = useState<File | null>(null);
  const [bgUploading, setBgUploading] = useState(false);
  const [enableVineTheme, setEnableVineTheme] = useState(false);

  const [customJson, setCustomJson] = useState<string>(
    JSON.stringify(
      {
        // vine: { theme: { ... } }
      },
      null,
      2
    )
  );

  const [submitting, setSubmitting] = useState(false);
  const [snack, setSnack] = useState<{ msg: string; err?: boolean } | null>(null);
  const closeSnack = () => setSnack(null);

  useEffect(() => {
    if (!open) return;

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
    setThemeMode("auto");
    setThemePrimary("#7c3aed");
    setThemeBgImage("");
    setThemeBgOpacity(0.45);
    setThemeBgBlur(12);
    setThemeBgPosition("center");
    setThemeBgSize("cover");
    setThemeBgRepeat("no-repeat");

    setBgFile(null);
    setBgUploading(false);
    setEnableVineTheme(false); // ✅ opt-in reset
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultProvider, defaultName, defaultSymbol, defaultDescription]);

  const canUseProvider = useMemo(() => provider === "irys", [provider]);

  const safeClose = () => {
    if (!submitting && !bgUploading) onClose();
  };

  function safeParseCustomJson(): any {
    const raw = (customJson || "").trim();
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
      throw new Error("Custom JSON must be an object");
    } catch {
      throw new Error("Custom JSON is not valid JSON");
    }
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

  // ✅ Resolved theme (for preview + metadata)
  const resolvedTheme = useMemo(() => {
    const primary = safeHex(themePrimary) || "#7c3aed";
    const opacity = clamp01(safeNum(themeBgOpacity, 0.45));
    const blur = Math.max(0, safeNum(themeBgBlur, 12));

    return {
      mode: themeMode,
      primary,
      bg: {
        image: (themeBgImage || "").trim() || "",
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
      setSnack({ msg: "Background image uploaded & applied to preview" });
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

      // 1) Upload token/project image
      const imageUrl = await uploadViaApi(imageFile, imageFile.type || "image/*");

      // 2) Build metadata JSON
      const extra = safeParseCustomJson();

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
                  ...(extra?.vine?.theme ?? {}),
                },
              },
            }
          : {}),

        ...extra,
      };

      // 3) Upload metadata.json
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

  // ✅ Chips readable on dark preview
  const chipSx = {
    height: 24,
    color: "rgba(248,250,252,0.92)",
    background: "rgba(15,23,42,0.55)",
    border: "1px solid rgba(148,163,184,0.30)",
    backdropFilter: "blur(8px)",
  } as const;

  return (
    <>
      <Dialog open={open} onClose={safeClose} fullWidth maxWidth="sm" PaperProps={{ sx: dialogPaperSx }}>
        <DialogTitle>{title ?? "Metadata Manager"}</DialogTitle>

        <DialogContent sx={{ display: "grid", gap: 1.4, pt: 2 }}>
          <TextField
            select
            label="Storage Provider"
            value={provider}
            onChange={(e) => setProvider(e.target.value as Provider)}
          >
            <MenuItem value="irys">Irys (recommended)</MenuItem>
            <MenuItem value="pinata" disabled>Pinata (coming soon)</MenuItem>
            <MenuItem value="arweave" disabled>Arweave direct (coming soon)</MenuItem>
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
            <Typography variant="body2" sx={{ opacity: 0.85 }}>Image</Typography>
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
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <input
              type="checkbox"
              checked={enableVineTheme}
              onChange={(e) => setEnableVineTheme(e.target.checked)}
              id="enable-vine-theme"
            />
            <label htmlFor="enable-vine-theme">
              Enable Vine theme customization
            </label>
          </Box>

          {enableVineTheme && (
          <>
            <Typography variant="subtitle2" sx={{ opacity: 0.9 }}>
              Theme (optional)
            </Typography>

            <TextField
              select
              label="Mode"
              value={themeMode}
              onChange={(e) => setThemeMode(e.target.value as ThemeMode)}
            >
              <MenuItem value="auto">Auto</MenuItem>
              <MenuItem value="dark">Dark</MenuItem>
              <MenuItem value="light">Light</MenuItem>
            </TextField>

            <Box sx={{ display: "grid", gap: 1 }}>
              <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                <TextField
                  label="Primary color"
                  value={themePrimary}
                  onChange={(e) => setThemePrimary(e.target.value)}
                  placeholder="#7c3aed"
                  fullWidth
                />
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: "12px",
                    border: "1px solid rgba(148,163,184,0.35)",
                    background: safeHex(themePrimary) || "#7c3aed",
                  }}
                  title="Preview"
                />
              </Box>

              <TextField
                label="Background image URL (optional)"
                value={themeBgImage}
                onChange={(e) => setThemeBgImage(e.target.value)}
                placeholder="https://.../background.webp"
                fullWidth
              />

              {/* ✅ Optional background file upload */}
              <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                <Button
                  component="label"
                  htmlFor={bgInputId}
                  disabled={bgUploading || !canUseProvider}
                  sx={{
                    textTransform: "none",
                    borderRadius: "999px",
                    border: "1px solid rgba(255,255,255,0.22)",
                    color: "rgba(248,250,252,0.95)",
                  }}
                >
                  Choose background file
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
                  {bgFile ? bgFile.name : "No background selected"}
                </Typography>

                <Button
                  size="small"
                  onClick={handleUploadThemeBgFile}
                  disabled={!bgFile || bgUploading || !canUseProvider}
                  sx={{ textTransform: "none" }}
                >
                  {bgUploading ? "Uploading…" : "Upload & apply"}
                </Button>
              </Box>

              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
                <TextField
                  label="Overlay opacity (0–1)"
                  type="number"
                  value={themeBgOpacity}
                  onChange={(e) => setThemeBgOpacity(Number(e.target.value))}
                  inputProps={{ step: 0.05, min: 0, max: 1 }}
                />
                <TextField
                  label="Blur (px)"
                  type="number"
                  value={themeBgBlur}
                  onChange={(e) => setThemeBgBlur(Number(e.target.value))}
                  inputProps={{ step: 1, min: 0, max: 40 }}
                />
              </Box>

              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1 }}>
                <TextField
                  label="Position"
                  value={themeBgPosition}
                  onChange={(e) => setThemeBgPosition(e.target.value)}
                  placeholder="center"
                />
                <TextField
                  label="Size"
                  value={themeBgSize}
                  onChange={(e) => setThemeBgSize(e.target.value)}
                  placeholder="cover"
                />
                <TextField
                  label="Repeat"
                  value={themeBgRepeat}
                  onChange={(e) => setThemeBgRepeat(e.target.value)}
                  placeholder="no-repeat"
                />
              </Box>
            </Box>
                
                {/* ✅ LIVE PREVIEW */}
                  <Box
                    sx={{
                      mt: 1,
                      borderRadius: "18px",
                      overflow: "hidden",
                      border: "1px solid rgba(148,163,184,0.35)",
                      boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
                      height: 200,
                    }}
                  >
                    <Box
                      sx={{
                        position: "relative",
                        height: 190,
                        backgroundImage: resolvedTheme.bg.image
                          ? `url('${resolvedTheme.bg.image}')`
                          : "linear-gradient(135deg, rgba(124,58,237,0.30), rgba(56,189,248,0.18))",
                        backgroundSize: resolvedTheme.bg.size,
                        backgroundPosition: resolvedTheme.bg.position,
                        backgroundRepeat: resolvedTheme.bg.repeat,
                      }}
                    >
                      <Box
                        sx={{
                          borderRadius: "18px",
                          position: "absolute",
                          inset: 0,
                          background: `rgba(0,0,0,${resolvedTheme.bg.opacity})`,
                          backdropFilter: `blur(${resolvedTheme.bg.blur}px)`,
                        }}
                      />

                      {/* App bar */}
                      <Box
                        sx={{
                          borderRadius: "18px",
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
                        <Typography variant="caption">VINE • Preview</Typography>
                        <Box sx={{ display: "flex", gap: 0.8 }}>
                          <Chip size="small" label={`mode: ${resolvedTheme.mode}`} sx={chipSx} />
                          <Chip size="small" label={resolvedTheme.primary} sx={chipSx} />
                        </Box>
                      </Box>

                      {/* Content */}
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
                        <Typography variant="h6" sx={{ fontWeight: 800 }}>
                          Live Theme Preview
                        </Typography>

                        <Typography variant="caption" sx={{ opacity: 0.85 }}>
                          Background + overlay + blur + primary button color.
                        </Typography>

                        <Box sx={{ display: "flex", gap: 1 }}>
                          <Button
                            size="small"
                            variant="contained"
                            sx={{
                              borderRadius: "999px",
                              background: resolvedTheme.primary,
                            }}
                          >
                            Primary
                          </Button>
                          <Button size="small" variant="outlined">
                            Secondary
                          </Button>
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
}

export default MetadataManager;