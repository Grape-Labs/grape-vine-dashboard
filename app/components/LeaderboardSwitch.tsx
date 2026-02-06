"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import TokenLeaderboard from "../TokenLeaderboard";
import ReputationLeaderboard from "../ReputationLeaderboard";

type Props = {
  programId: string;
  activeDaoIdBase58: string;
  activeSeason?: number;
  endpoint?: string;
  meta?: any;
  resolvedTheme?: any;
};

import { useConnection } from "@solana/wallet-adapter-react";
// use this connection for all RPC calls

export default function LeaderboardSwitch(props: Props) {
  const sp = useSearchParams();
  const { connection } = useConnection();

  // ✅ default to the NEW reputation leaderboard
  // ✅ allow always-accessible legacy:
  //    ?legacy=1  OR ?mode=token
  const mode = sp.get("mode");
  const legacy = sp.get("legacy") === "1" || mode === "token";

  if (legacy) {
    return (
      <TokenLeaderboard
        programId={props.programId}
        activeDaoIdBase58={props.activeDaoIdBase58}
        activeSeason={props.activeSeason}
        meta={props.meta}
        resolvedTheme={props.resolvedTheme}
      />
    );
  }

  return (
    <ReputationLeaderboard
      programId={props.programId}
      activeDaoIdBase58={props.activeDaoIdBase58}
      activeSeason={props.activeSeason}
      endpoint={props.endpoint}
    />
  );
}