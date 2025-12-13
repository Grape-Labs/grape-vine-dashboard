# Copilot / AI Agent Instructions for Vine Dashboard

Purpose: concise, actionable guidance so an AI coding agent can be productive immediately.

- **Project type:** Next.js 14 app using the `/app` folder (React Server + Client components). Main client entry: `app/page.tsx`.
- **Blockchain integration:** Solana-centric UI and helpers; on-chain program "Vine Reputation" with program id in `app/constants.tsx` and helpers in `app/utils/grapeTools/vineReputationClient.ts`.

Quick start (local):

```bash
yarn dev      # runs Next.js dev server
yarn build    # build for production
yarn start    # start built app
```

Required environment variables (used by source files):
- `SOLANA_RPC_URL` — RPC endpoint used by server-side upload flow (`app/api/storage/upload/route.ts`).
- `IRYS_SOLANA_PRIVATE_KEY` — JSON array string of Solana keypair for `@irys/upload` (server upload). Keep secure.
- `IRYS_NETWORK` — `devnet` or `mainnet` (defaults to `devnet`).
- `IRYS_GATEWAY_URL` — optional gateway base (defaults to `https://gateway.irys.xyz`).
- `NEXT_PUBLIC_RPC_ENDPOINT` / `NEXT_PUBLIC_RPC_DEVNET_ENDPOINT` — front-end endpoints (fall back to defaults in `app/constants.tsx`).

Key architectural notes and examples:
- UI: the app uses Material UI and is mostly client-side in `app/page.tsx` (starts with `"use client"`). Use `ThemeProvider` with theme from `app/utils/config/theme.tsx`.
- Wallets: Solana Wallet Adapter pattern is used in `app/page.tsx` — `@solana/wallet-adapter-*` packages and cluster endpoints (devnet) are used by default.
- On-chain data: `app/vineRegistry.ts` lists program accounts and decodes Anchor-style accounts (skips 8-byte Anchor discriminator). Use its decoding logic as canonical example for reading anchored accounts.
- Program helpers: `app/utils/grapeTools/vineReputationClient.ts` contains PDA helpers and binary decoders for reputation/config accounts — prefer these helpers rather than re-implementing parsing logic elsewhere.

Server/API specifics:
- `app/api/storage/upload/route.ts` is explicitly marked `export const runtime = "nodejs"` — important: it requires Node runtime (not Edge). It uses CommonJS-style `require` via `createRequire` and the `@irys/upload` + `@irys/upload-solana` packages to upload buffers to an external gateway.
- The upload route expects a `file` form field and optional `contentType` and `provider` query param. It returns `{ ok, id, url }` on success.

Conventions and patterns to follow:
- Use existing PDA and decode functions in `app/vineRegistry.ts` and `app/utils/grapeTools/*` when working with program accounts. They are the source of truth for account layouts.
- Use `.toBase58()` for logging/comparison of `PublicKey`s in the UI; code often stores the active DAO as a base58 string (see `app/page.tsx`).
- For numeric on-chain values, the project uses `bigint` when decoding 64-bit values (see `decodeReputationAccount`). Keep precision by using `bigint` rather than Number for on-chain amounts.
- The UI uses MUI theme tokens and a custom `GrapeFont` family; prefer `ThemeProvider` for styling consistency.

Notable dependencies to be aware of (examples):
- `next` 14.x, `react` 18
- `@solana/web3.js`, `@solana/wallet-adapter-*`
- `@irys/upload`, `@irys/upload-solana` (server upload adapter)
- `@metaplex-foundation/*` packages used for metadata tooling
- `@mui/material` + `@mui/icons-material`

Build/test notes:
- No dedicated test runner or tests found. Use `yarn dev` for local development and `yarn build` to verify production build.

When editing server upload route:
- Keep `export const runtime = "nodejs"` if using `@irys/upload` and `createRequire`.
- Use `Buffer.from(await file.arrayBuffer())` to convert `File` from `formData()` into a Node `Buffer` (pattern already implemented).

Files/locations to inspect for common changes:
- `app/page.tsx` — main UI and wallet integration
- `app/vineRegistry.ts` — Anchor account listing and decoding example
- `app/constants.tsx` — program IDs, token fallbacks
- `app/api/storage/upload/route.ts` — server-side upload flow, env vars required
- `app/utils/grapeTools/*` — PDA helpers and account decoders

PR guidance for AI agents:
- Do not change `VINE_REP_PROGRAM_ID` or DAO constants without explicit coordination — these are tied to on-chain programs.
- Respect `runtime = "nodejs"` in API routes that use `require` or Node-only libraries.
- Preserve existing decoding offsets and account layout code — test locally against devnet to confirm compatibility.

If any section is unclear or you'd like more examples (e.g., a template PR, test harness, or sample env file), tell me which part to expand.
