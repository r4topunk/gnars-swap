"use client";

import { useAccount, useReadContract } from "wagmi";
import { useEffect, useState, useCallback } from "react";
import { GNARS_SWAP_ABI, GNARS_SWAP_ADDRESS } from "@/lib/contracts";

export interface SwapData {
  swapId: number;
  proposer: string;
  counterparty: string;
  tokenIdOffered: bigint;
  tokenIdWanted: bigint;
  ethAmount: bigint;
  status: number;
}

export function useSwaps() {
  const { address, chainId } = useAccount();
  const swapAddress = chainId ? GNARS_SWAP_ADDRESS[chainId] : undefined;

  const { data: nextSwapId, refetch: refetchNextId } = useReadContract({
    address: swapAddress,
    abi: GNARS_SWAP_ABI,
    functionName: "nextSwapId",
    query: {
      enabled: !!swapAddress,
      refetchInterval: 15_000,
    },
  });

  const [swaps, setSwaps] = useState<SwapData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  const totalSwaps = nextSwapId ? Number(nextSwapId) : 0;

  // Optimistic update — instantly change a swap's status in local state
  const markSwap = useCallback((swapId: number, newStatus: number) => {
    setSwaps((prev) =>
      prev.map((s) => (s.swapId === swapId ? { ...s, status: newStatus } : s))
    );
  }, []);

  // Add a new swap optimistically (after propose)
  const addSwap = useCallback((swap: SwapData) => {
    setSwaps((prev) => [...prev, swap]);
  }, []);

  // Background sync — doesn't reset loading state, merges silently
  const syncFromChain = useCallback(() => {
    refetchNextId();
    setFetchTrigger((n) => n + 1);
  }, [refetchNextId]);

  useEffect(() => {
    if (!swapAddress || totalSwaps === 0 || !chainId) {
      setSwaps([]);
      return;
    }

    let cancelled = false;
    // Only show loading skeleton on first load, not background syncs
    if (swaps.length === 0) setIsLoading(true);

    async function fetchSwaps() {
      const { createPublicClient, http } = await import("viem");
      const { baseSepolia, base } = await import("viem/chains");

      const chain = chainId === 84532 ? baseSepolia : base;
      const client = createPublicClient({ chain, transport: http() });

      const results: SwapData[] = [];
      for (let i = 0; i < totalSwaps; i++) {
        try {
          const data = await client.readContract({
            address: swapAddress!,
            abi: GNARS_SWAP_ABI,
            functionName: "getSwap",
            args: [BigInt(i)],
          });
          results.push({
            swapId: i,
            proposer: data.proposer,
            counterparty: data.counterparty,
            tokenIdOffered: data.tokenIdOffered,
            tokenIdWanted: data.tokenIdWanted,
            ethAmount: data.ethAmount,
            status: data.status,
          });
        } catch {
          // skip invalid swaps
        }
      }

      if (!cancelled) {
        setSwaps(results);
        setIsLoading(false);
      }
    }

    fetchSwaps();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swapAddress, totalSwaps, chainId, fetchTrigger]);

  const myProposals = swaps.filter(
    (s) => s.proposer.toLowerCase() === address?.toLowerCase()
  );

  const incoming = swaps.filter(
    (s) =>
      s.counterparty.toLowerCase() === address?.toLowerCase() &&
      s.status === 0
  );

  const history = swaps.filter((s) => s.status !== 0);

  return {
    swaps,
    myProposals,
    incoming,
    history,
    isLoading,
    markSwap,
    addSwap,
    syncFromChain,
    totalSwaps,
  };
}
