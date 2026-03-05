"use client";

import { useEffect, useState, useCallback } from "react";
import { useAccount } from "wagmi";
import { GNARS_NFT_ADDRESS } from "@/lib/contracts";

interface AlchemyNft {
  tokenId: string;
}

interface AlchemyResponse {
  ownedNfts: AlchemyNft[];
  pageKey?: string;
  totalCount: number;
}

async function fetchNFTsFromAlchemy(
  apiKey: string,
  chainId: number,
  owner: string,
  contractAddress: string
): Promise<number[]> {
  const base = chainId === 84532
    ? "https://base-sepolia.g.alchemy.com"
    : "https://base-mainnet.g.alchemy.com";

  const tokens: number[] = [];
  let pageKey: string | undefined;

  do {
    const url = new URL(`${base}/nft/v3/${apiKey}/getNFTsForOwner`);
    url.searchParams.set("owner", owner);
    url.searchParams.append("contractAddresses[]", contractAddress);
    url.searchParams.set("withMetadata", "false");
    url.searchParams.set("limit", "100");
    if (pageKey) url.searchParams.set("pageKey", pageKey);

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Alchemy NFT API error: ${res.status}`);

    const data: AlchemyResponse = await res.json();
    for (const nft of data.ownedNfts) {
      tokens.push(Number(nft.tokenId));
    }
    pageKey = data.pageKey;
  } while (pageKey);

  return tokens.sort((a, b) => a - b);
}

export function useInventory(ownerAddress?: string) {
  const { chainId } = useAccount();
  const nftAddress = chainId ? GNARS_NFT_ADDRESS[chainId] : undefined;

  const [tokens, setTokens] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  const refetch = useCallback(() => {
    setFetchTrigger((n) => n + 1);
  }, []);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
    if (!nftAddress || !ownerAddress || !chainId || !apiKey) {
      setTokens([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    fetchNFTsFromAlchemy(apiKey, chainId, ownerAddress, nftAddress)
      .then((found) => {
        if (!cancelled) setTokens(found);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [nftAddress, ownerAddress, chainId, fetchTrigger]);

  return { tokens, isLoading, refetch };
}
