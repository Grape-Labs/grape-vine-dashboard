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
} from "@mui/material";

type Provider = "irys" | "pinata" | "arweave";

export type MetadataJson = {
  name?: string;
  symbol?: string;
  description?: string;
  image?: string; // URL
  external_url?: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
  properties?: any;
  [k: string]: any; // allow custom fields
};

export interface MetadataManagerProps {
  open: boolean;
  onClose: () => void;

  title?: string;
  defaultProvider?: Provider;
  defaultName?: string;
  defaultSymbol?: string;
  defaultDescription?: string;

  // Called when metadata.json is uploaded and you have a URL you can store
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

  const [provider, setProvider] = useState<Provider>(defaultProvider);

  const [name, setName] = useState(defaultName);
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [description, setDescription] = useState(defaultDescription);
  const [externalUrl, setExternalUrl] = useState("");

  const [imageFile, setImageFile] = useState<File | null>(null);

  const [customJson, setCustomJson] = useState<string>(
    JSON.stringify(
      {
        // program: "vine",
        // version: 1,
      },
      null,
      2
    )
  );

  const [submitting, setSubmitting] = useState(false);
  const [snack, setSnack] = useState<{ msg: string; err?: boolean } | null>(
    null
  );
  const closeSnack = () => setSnack(null);

  // If you want the dialog to "pick up" new defaults each time it opens:
  useEffect(() => {
    if (!open) return;

    setProvider(defaultProvider);
    setName(defaultName);
    setSymbol(defaultSymbol);
    setDescription(defaultDescription);

    setExternalUrl("");
    setImageFile(null);

    setSubmitting(false);
    setSnack(null);
    // keep customJson as-is so you don't lose work between opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultProvider, defaultName, defaultSymbol, defaultDescription]);

  const canUseProvider = useMemo(() => provider === "irys", [provider]);

  const safeClose = () => {
    if (!submitting) onClose();
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

  const handleUpload = async () => {
    try {
      if (!canUseProvider) throw new Error(`${provider} not enabled yet`);
      if (!imageFile) throw new Error("Please choose an image file");

      setSubmitting(true);

      // 1) Upload image
      const imageUrl = await uploadViaApi(imageFile, imageFile.type || "image/*");

      // 2) Build metadata JSON
      const extra = safeParseCustomJson();

      const metadata: MetadataJson = {
        ...(name ? { name } : {}),
        ...(symbol ? { symbol } : {}),
        ...(description ? { description } : {}),
        ...(externalUrl ? { external_url: externalUrl } : {}),
        image: imageUrl,

        // prefer explicit attributes/properties from extra if provided
        attributes: extra?.attributes ?? [],
        properties: {
          ...(extra?.properties ?? {}),
          files: [{ uri: imageUrl, type: imageFile.type || "image/*" }],
          category: "image",
        },

        // merge any extra custom fields on top-level (your own program)
        ...extra,
      };

      // 3) Upload metadata.json
      const metaFile = new File([JSON.stringify(metadata, null, 2)], "metadata.json", {
        type: "application/json",
      });

      const metadataUrl = await uploadViaApi(metaFile, "application/json");

      setSnack({ msg: `Metadata uploaded: ${metadataUrl}` });
      onMetadataReady?.(metadataUrl, metadata);

      // Optional: auto-close on success
      onClose();
    } catch (e: any) {
      setSnack({ msg: e?.message ?? "Upload failed", err: true });
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
          <TextField
            label="Symbol"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
          />
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

          {/* File picker (better than TextField type=file) */}
          <Box sx={{ display: "grid", gap: 0.6 }}>
            <Typography variant="body2" sx={{ opacity: 0.85 }}>
              Image
            </Typography>

            <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
              <Button
                component="label"
                htmlFor={inputId}
                disabled={submitting}
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
                    // allow re-selecting the same file
                    e.target.value = "";
                  }}
                />
              </Button>

              <Typography variant="caption" sx={{ opacity: 0.75 }}>
                {imageFile ? imageFile.name : "No file selected"}
              </Typography>
            </Box>
          </Box>

          <TextField
            label="Custom JSON (optional, merged into metadata)"
            value={customJson}
            onChange={(e) => setCustomJson(e.target.value)}
            multiline
            minRows={6}
            sx={{ fontFamily: "monospace" }}
          />
        </DialogContent>

        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button
            onClick={safeClose}
            disabled={submitting}
            sx={{ textTransform: "none", color: "rgba(248,250,252,0.85)" }}
          >
            Close
          </Button>

          <Button
            onClick={handleUpload}
            disabled={submitting || !canUseProvider}
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