"use client";

import * as React from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  MenuItem,
  IconButton,
} from "@mui/material";

import SettingsIcon from "@mui/icons-material/Settings";
import PublicIcon from "@mui/icons-material/Public";
import LinkIcon from "@mui/icons-material/Link";
import CloseIcon from "@mui/icons-material/Close";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

import type { RpcSettings, SolanaNetwork, RpcMode } from "../utils/rpcSettings";
import { readRpcSettings, writeRpcSettings, getRpcPresets, getRpcLabel } from "../utils/rpcSettings";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function RpcSettingsDialog({ open, onClose }: Props) {
  const [settings, setSettings] = React.useState<RpcSettings>(() => readRpcSettings());
  const [error, setError] = React.useState<string>("");

  React.useEffect(() => {
    if (open) {
      setSettings(readRpcSettings());
      setError("");
    }
  }, [open]);

  const presets = React.useMemo(() => getRpcPresets()[settings.network], [settings.network]);
  const effectiveLabel = getRpcLabel(settings);

    function setNetwork(network: SolanaNetwork) {
    const nextPresets = getRpcPresets()[network];
    const nextKey = nextPresets?.[settings.predefinedKey] ? settings.predefinedKey : "default";
    setSettings((p) => ({ ...p, network, predefinedKey: nextKey }));
    }

  function setMode(mode: RpcMode) {
    setError("");
    setSettings((p) => ({ ...p, mode }));
  }

  function validate(): boolean {
    setError("");
    if (settings.mode === "custom") {
      const u = settings.customRpc.trim();
      if (!u) {
        setError("Please enter a custom RPC URL.");
        return false;
      }
      if (!/^https?:\/\//i.test(u)) {
        setError("Custom RPC must start with http:// or https://");
        return false;
      }
    }
    return true;
  }

  function save() {
    if (!validate()) return;
    writeRpcSettings(settings);
    window.location.reload();
  }

  const Section = ({
    icon,
    title,
    children,
  }: {
    icon: React.ReactNode;
    title: string;
    children: React.ReactNode;
  }) => (
    <Box
      sx={{
        borderRadius: "18px",
        p: 2,
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "0 18px 55px rgba(0,0,0,0.45)",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.25 }}>
        <Box
          sx={{
            width: 34,
            height: 34,
            borderRadius: "12px",
            display: "grid",
            placeItems: "center",
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.14)",
          }}
        >
          {icon}
        </Box>

        <Typography sx={{ fontWeight: 900, letterSpacing: -0.2 }}>
          {title}
        </Typography>
      </Box>

      {children}
    </Box>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          borderRadius: "22px",
          overflow: "hidden",
          color: "rgba(248,250,252,0.92)",
          background:
            "radial-gradient(900px 420px at 20% 0%, rgba(56,189,248,0.18), transparent 60%)," +
            "radial-gradient(700px 380px at 95% 30%, rgba(250,204,21,0.12), transparent 55%)," +
            "linear-gradient(180deg, rgba(2,6,23,0.92), rgba(2,6,23,0.88))",
          border: "1px solid rgba(255,255,255,0.14)",
          boxShadow: "0 40px 120px rgba(0,0,0,0.65)",
          backdropFilter: "blur(14px)",
        },
      }}
    >
      <DialogTitle sx={{ py: 2, px: 2.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: "14px",
                display: "grid",
                placeItems: "center",
                background: "rgba(255,255,255,0.10)",
                border: "1px solid rgba(255,255,255,0.16)",
              }}
            >
              <SettingsIcon sx={{ fontSize: 18, opacity: 0.9 }} />
            </Box>

            <Box>
              <Typography sx={{ fontWeight: 950, letterSpacing: -0.3, lineHeight: 1.1 }}>
                Settings
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.75 }}>
                Configure network + RPC provider for this browser
              </Typography>
            </Box>
          </Box>

          <IconButton
            onClick={onClose}
            size="small"
            sx={{
              color: "rgba(248,250,252,0.78)",
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.06)",
              "&:hover": { background: "rgba(255,255,255,0.10)" },
            }}
          >
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 0, px: 2.5, pb: 2.25 }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.6 }}>
          <Section icon={<PublicIcon sx={{ fontSize: 18, opacity: 0.9 }} />} title="Network">
            <ToggleButtonGroup
              exclusive
              value={settings.network}
              onChange={(_, v) => v && setNetwork(v)}
              size="small"
              sx={{
                borderRadius: "999px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                p: 0.5,
                "& .MuiToggleButton-root": {
                  border: 0,
                  borderRadius: "999px",
                  textTransform: "none",
                  fontWeight: 800,
                  color: "rgba(248,250,252,0.75)",
                  px: 2,
                  py: 0.9,
                },
                "& .MuiToggleButton-root.Mui-selected": {
                  color: "rgba(248,250,252,0.95)",
                  background: "rgba(255,255,255,0.14)",
                  boxShadow: "0 10px 28px rgba(0,0,0,0.35)",
                },
              }}
            >
              <ToggleButton value="mainnet">Mainnet</ToggleButton>
              <ToggleButton value="devnet">Devnet</ToggleButton>
            </ToggleButtonGroup>
          </Section>

          <Section icon={<LinkIcon sx={{ fontSize: 18, opacity: 0.9 }} />} title="RPC Provider">
            {/* Mode segmented control */}
            <ToggleButtonGroup
              exclusive
              value={settings.mode}
              onChange={(_, v) => v && setMode(v)}
              size="small"
              sx={{
                borderRadius: "14px",
                mb: 1.25,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                overflow: "hidden",
                "& .MuiToggleButton-root": {
                  flex: 1,
                  border: 0,
                  borderRadius: 0,
                  textTransform: "none",
                  fontWeight: 800,
                  color: "rgba(248,250,252,0.72)",
                  py: 1.05,
                },
                "& .MuiToggleButton-root.Mui-selected": {
                  color: "rgba(248,250,252,0.95)",
                  background: "rgba(255,255,255,0.14)",
                },
              }}
            >
              <ToggleButton value="predefined">Predefined</ToggleButton>
              <ToggleButton value="custom">Custom</ToggleButton>
            </ToggleButtonGroup>

            {settings.mode === "predefined" ? (
              <TextField
                select
                fullWidth
                size="small"
                label="Provider"
                value={settings.predefinedKey}
                onChange={(e) =>
                  setSettings((p) => ({ ...p, predefinedKey: String(e.target.value) }))
                }
                helperText={
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <CheckCircleIcon sx={{ fontSize: 14, color: "rgba(248,250,252,0.75)" }} />
                        <Typography component="span" sx={{ fontSize: 12, color: "rgba(248,250,252,0.70)" }}>
                        Selected:
                        </Typography>
                        <Typography component="span" sx={{ fontSize: 12, fontWeight: 900, color: "rgba(248,250,252,0.95)" }}>
                        {presets?.[settings.predefinedKey]?.label || "Provider"}
                        </Typography>
                    </Box>
                }
                FormHelperTextProps={{
                    sx: { mt: 1, color: "rgba(248,250,252,0.70)" }, // ensures baseline helper text is light
                    }}
                sx={{
                "& .MuiInputLabel-root": { color: "rgba(248,250,252,0.72)" },

                "& .MuiOutlinedInput-root": {
                    color: "rgba(248,250,252,0.92)",
                    background: "rgba(255,255,255,0.06)",
                    borderRadius: "14px",
                    "& fieldset": { borderColor: "rgba(255,255,255,0.14)" },
                    "&:hover fieldset": { borderColor: "rgba(255,255,255,0.22)" },
                    "&.Mui-focused fieldset": { borderColor: "rgba(56,189,248,0.55)" },
                },

                // 🔥 important for Select display text
                "& .MuiSelect-select": {
                    color: "rgba(248,250,252,0.95)",
                },

                // icon color
                "& .MuiSvgIcon-root": {
                    color: "rgba(248,250,252,0.70)",
                },
                }}
                SelectProps={{
                MenuProps: {
                    PaperProps: {
                    sx: {
                        mt: 1,
                        borderRadius: "14px",
                        color: "rgba(248,250,252,0.92)",
                        background:
                        "linear-gradient(180deg, rgba(2,6,23,0.96), rgba(2,6,23,0.90))",
                        border: "1px solid rgba(255,255,255,0.14)",
                        backdropFilter: "blur(14px)",
                        boxShadow: "0 30px 90px rgba(0,0,0,0.70)",
                    },
                    },
                },
                }}
              >
                {Object.entries(presets).map(([key, v]) => (
                    <MenuItem
                    key={key}
                    value={key}
                    sx={{
                        color: "rgba(248,250,252,0.92)",
                        "&.Mui-selected": { background: "rgba(56,189,248,0.14)" },
                        "&.Mui-selected:hover": { background: "rgba(56,189,248,0.18)" },
                    }}
                    >
                    {v.label}
                    </MenuItem>
                ))}
              </TextField>
            ) : (
              <TextField
                fullWidth
                size="small"
                label="Custom RPC URL"
                placeholder="https://…"
                value={settings.customRpc}
                onChange={(e) => setSettings((p) => ({ ...p, customRpc: e.target.value }))}
                helperText={error ? error : "Saved locally in your browser."}
                error={!!error}
                sx={{
                  "& .MuiInputLabel-root": { color: "rgba(248,250,252,0.72)" },
                  "& .MuiOutlinedInput-root": {
                    color: "rgba(248,250,252,0.92)",
                    background: "rgba(255,255,255,0.06)",
                    borderRadius: "14px",
                    "& fieldset": { borderColor: "rgba(255,255,255,0.14)" },
                    "&:hover fieldset": { borderColor: "rgba(255,255,255,0.22)" },
                    "&.Mui-focused fieldset": { borderColor: "rgba(56,189,248,0.55)" },
                  },
                  "& .MuiFormHelperText-root": {
                    color: error ? "rgba(239,68,68,0.9)" : "rgba(248,250,252,0.65)",
                  },
                }}
              />
            )}

            <Divider sx={{ my: 2, borderColor: "rgba(255,255,255,0.10)" }} />

            {/* Effective settings pill */}
            <Box
              sx={{
                borderRadius: "16px",
                p: 1.5,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              <Typography variant="caption" sx={{ opacity: 0.75 }}>
                Effective settings
              </Typography>
              <Typography sx={{ fontWeight: 950, mt: 0.25, letterSpacing: -0.2 }}>
                {settings.network.toUpperCase()} • {effectiveLabel}
              </Typography>
            </Box>
          </Section>
        </Box>
      </DialogContent>

      <DialogActions
        sx={{
          px: 2.5,
          pb: 2.25,
          pt: 0.5,
          gap: 1,
          justifyContent: "space-between",
        }}
      >
        <Button
          onClick={onClose}
          sx={{
            textTransform: "none",
            color: "rgba(248,250,252,0.78)",
            borderRadius: "999px",
            px: 2,
            "&:hover": { background: "rgba(255,255,255,0.06)" },
          }}
        >
          Cancel
        </Button>

        <Button
          onClick={save}
          variant="contained"
          sx={{
            textTransform: "none",
            borderRadius: "999px",
            px: 2.2,
            py: 1.05,
            fontWeight: 900,
            background: "rgba(255,255,255,0.14)",
            border: "1px solid rgba(255,255,255,0.22)",
            backdropFilter: "blur(10px)",
            boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
            "&:hover": {
              background: "rgba(255,255,255,0.20)",
              boxShadow: "0 22px 70px rgba(0,0,0,0.55)",
            },
          }}
        >
          Save & Reload
        </Button>
      </DialogActions>
    </Dialog>
  );
}