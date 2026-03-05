"use client";

import { useEffect, useState, useCallback } from "react";
import { useAccount } from "wagmi";
import { GNARS_NFT_ADDRESS, ERC721_ABI } from "@/lib/contracts";

export function useInventory(ownerAddress?: string) {
  const { chainId } = useAccount();
  const nftAddress = chainId ? GNARS_NFT_ADDRESS[chainId] : undefined;

  const [tokens, setTokens] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  const target = ownerAddress?.toLowerCase();

  const refetch = useCallback(() => {
    setFetchTrigger((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!nftAddress || !target || !chainId) {
      setTokens([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    async function scan() {
      const { createPublicClient, http } = await import("viem");
      const { baseSepolia, base } = await import("viem/chains");

      const chain = chainId === 84532 ? baseSepolia : base;
      const client = createPublicClient({ chain, transport: http() });

      let balance = 0;
      try {
        const bal = await client.readContract({
          address: nftAddress!,
          abi: ERC721_ABI,
          functionName: "balanceOf",
          args: [target as `0x${string}`],
        });
        balance = Number(bal);
      } catch {
        // fallback: scan anyway
      }

      if (balance === 0) {
        if (!cancelled) {
          setTokens([]);
          setIsLoading(false);
        }
        return;
      }

      const found: number[] = [];
      const SCAN_MAX = 100;
      const batchSize = 10;

      for (let start = 0; start < SCAN_MAX && found.length < balance; start += batchSize) {
        const promises = [];
        for (let i = start; i < start + batchSize && i < SCAN_MAX; i++) {
          promises.push(
            client
              .readContract({
                address: nftAddress!,
                abi: ERC721_ABI,
                functionName: "ownerOf",
                args: [BigInt(i)],
              })
              .then((owner) => {
                if ((owner as string).toLowerCase() === target) return i;
                return null;
              })
              .catch(() => null)
          );
        }
        const results = await Promise.all(promises);
        for (const r of results) {
          if (r !== null) found.push(r);
        }
      }

      if (!cancelled) {
        setTokens(found.sort((a, b) => a - b));
        setIsLoading(false);
      }
    }

    scan();
    return () => {
      cancelled = true;
    };
  }, [nftAddress, target, chainId, fetchTrigger]);

  return { tokens, isLoading, refetch };
}
