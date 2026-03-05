"use client";

import { useAccount, usePublicClient, useReadContract } from "wagmi";
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
  const publicClient = usePublicClient();
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

  const markSwap = useCallback((swapId: number, newStatus: number) => {
    setSwaps((prev) =>
      prev.map((s) => (s.swapId === swapId ? { ...s, status: newStatus } : s))
    );
  }, []);

  const addSwap = useCallback((swap: SwapData) => {
    setSwaps((prev) => [...prev, swap]);
  }, []);

  const syncFromChain = useCallback(() => {
    refetchNextId();
    setFetchTrigger((n) => n + 1);
  }, [refetchNextId]);

  useEffect(() => {
    if (!swapAddress || totalSwaps === 0 || !publicClient) {
      setSwaps([]);
      return;
    }

    let cancelled = false;
    if (swaps.length === 0) setIsLoading(true);

    async function fetchSwaps() {
      const contracts = Array.from({ length: totalSwaps }, (_, i) => ({
        address: swapAddress as `0x${string}`,
        abi: GNARS_SWAP_ABI,
        functionName: "getSwap" as const,
        args: [BigInt(i)] as const,
      }));

      const results = await publicClient!.multicall({ contracts });

      const parsed: SwapData[] = [];
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r.status === "success") {
          const data = r.result;
          parsed.push({
            swapId: i,
            proposer: data.proposer,
            counterparty: data.counterparty,
            tokenIdOffered: data.tokenIdOffered,
            tokenIdWanted: data.tokenIdWanted,
            ethAmount: data.ethAmount,
            status: data.status,
          });
        }
      }

      if (!cancelled) {
        setSwaps(parsed);
        setIsLoading(false);
      }
    }

    fetchSwaps().catch(console.error);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swapAddress, totalSwaps, publicClient, fetchTrigger]);

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
