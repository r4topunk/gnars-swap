"use client";

import { useState, useCallback } from "react";
import { useAccount, useWriteContract, useReadContract, usePublicClient, useEnsName } from "wagmi";
import { mainnet } from "wagmi/chains";
import { formatEther } from "viem";
import {
  Card,
  CardHeader,
  CardTitle,
  CardAction,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GNARS_SWAP_ABI, GNARS_SWAP_ADDRESS, ERC721_ABI, GNARS_NFT_ADDRESS } from "@/lib/contracts";
import type { SwapData } from "@/hooks/use-swaps";

type CardStatus =
  | "idle"
  | "approving"
  | "waiting-approve"
  | "accepting"
  | "waiting-accept"
  | "cancelling"
  | "waiting-cancel"
  | "error";

const STATUS_MAP: Record<number, { label: string; variant: "default" | "secondary" | "outline" }> = {
  0: { label: "Open", variant: "outline" },
  1: { label: "Executed", variant: "default" },
  2: { label: "Cancelled", variant: "secondary" },
};

const STEP_TEXT: Record<CardStatus, string> = {
  idle: "",
  approving: "Approve in wallet...",
  "waiting-approve": "Confirming approval...",
  accepting: "Accept in wallet...",
  "waiting-accept": "Confirming swap...",
  cancelling: "Cancel in wallet...",
  "waiting-cancel": "Confirming cancel...",
  error: "",
};

function AddressDisplay({ address }: { address: string }) {
  const { data: ensName } = useEnsName({
    address: address as `0x${string}`,
    chainId: mainnet.id,
  });
  return (
    <span className="font-mono">
      {ensName ?? `${address.slice(0, 6)}...${address.slice(-4)}`}
    </span>
  );
}

function TokenBadge({ tokenId, label }: { tokenId: bigint; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex size-14 items-center justify-center border border-border bg-card font-mono text-sm font-bold">
        #{Number(tokenId)}
      </div>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

export function SwapCard({
  swap,
  onSwapAction,
}: {
  swap: SwapData;
  onSwapAction?: (swapId: number, newStatus: number) => void;
}) {
  const { address, chainId } = useAccount();
  const publicClient = usePublicClient();
  const swapAddress = chainId ? GNARS_SWAP_ADDRESS[chainId] : undefined;
  const nftAddress = chainId ? GNARS_NFT_ADDRESS[chainId] : undefined;

  const [status, setStatus] = useState<CardStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const isProposer = address?.toLowerCase() === swap.proposer.toLowerCase();
  const isCounterparty = address?.toLowerCase() === swap.counterparty.toLowerCase();
  const isOpen = swap.status === 0;

  const { data: approvedAddress } = useReadContract({
    address: nftAddress,
    abi: ERC721_ABI,
    functionName: "getApproved",
    args: [swap.tokenIdWanted],
    query: { enabled: isCounterparty && isOpen && !!nftAddress },
  });

  const isWantedApproved =
    approvedAddress?.toLowerCase() === swapAddress?.toLowerCase();

  const { writeContractAsync } = useWriteContract();

  const busy = status !== "idle" && status !== "error";

  const handleAccept = useCallback(async () => {
    if (!swapAddress || !nftAddress || !publicClient || !address) return;
    setErrorMsg("");

    try {
      // Pre-flight: verify you still own the wanted token
      const wantedOwner = await publicClient.readContract({
        address: nftAddress,
        abi: ERC721_ABI,
        functionName: "ownerOf",
        args: [swap.tokenIdWanted],
      });

      if ((wantedOwner as string).toLowerCase() !== address.toLowerCase()) {
        throw new Error(`You no longer own Gnar #${Number(swap.tokenIdWanted)}`);
      }

      if (!isWantedApproved) {
        setStatus("approving");
        const approveTx = await writeContractAsync({
          address: nftAddress,
          abi: ERC721_ABI,
          functionName: "approve",
          args: [swapAddress, swap.tokenIdWanted],
        });
        setStatus("waiting-approve");
        await publicClient.waitForTransactionReceipt({ hash: approveTx });
      }

      setStatus("accepting");
      const acceptTx = await writeContractAsync({
        address: swapAddress,
        abi: GNARS_SWAP_ABI,
        functionName: "acceptSwap",
        args: [BigInt(swap.swapId)],
      });
      setStatus("waiting-accept");
      await publicClient.waitForTransactionReceipt({ hash: acceptTx });

      // Optimistic update: mark as executed, card moves to history
      onSwapAction?.(swap.swapId, 1);
    } catch (err: unknown) {
      setStatus("error");
      const msg = err instanceof Error ? err.message : "Transaction failed";
      setErrorMsg(
        msg.includes("User rejected") || msg.includes("denied")
          ? "Transaction rejected"
          : msg.slice(0, 120)
      );
    }
  }, [swapAddress, nftAddress, publicClient, address, isWantedApproved, writeContractAsync, swap.tokenIdWanted, swap.swapId, onSwapAction]);

  const handleCancel = useCallback(async () => {
    if (!swapAddress || !publicClient) return;
    setErrorMsg("");

    try {
      setStatus("cancelling");
      const cancelTx = await writeContractAsync({
        address: swapAddress,
        abi: GNARS_SWAP_ABI,
        functionName: "cancelSwap",
        args: [BigInt(swap.swapId)],
      });
      setStatus("waiting-cancel");
      await publicClient.waitForTransactionReceipt({ hash: cancelTx });

      // Optimistic update: mark as cancelled, card moves to history
      onSwapAction?.(swap.swapId, 2);
    } catch (err: unknown) {
      setStatus("error");
      const msg = err instanceof Error ? err.message : "Transaction failed";
      setErrorMsg(
        msg.includes("User rejected") || msg.includes("denied")
          ? "Transaction rejected"
          : msg.slice(0, 120)
      );
    }
  }, [swapAddress, publicClient, writeContractAsync, swap.swapId, onSwapAction]);

  const statusInfo = STATUS_MAP[swap.status] ?? { label: "Unknown", variant: "secondary" as const };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Swap #{swap.swapId}</CardTitle>
        <CardAction>
          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3">
          <TokenBadge tokenId={swap.tokenIdOffered} label="Offered" />
          <div className="flex flex-col items-center gap-1">
            <span className="text-lg text-muted-foreground">&rarr;</span>
            {swap.ethAmount > 0n && (
              <span className="text-[10px] text-muted-foreground">
                +{formatEther(swap.ethAmount)} ETH
              </span>
            )}
          </div>
          <TokenBadge tokenId={swap.tokenIdWanted} label="Wanted" />
        </div>
        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
          <div>
            From: <AddressDisplay address={swap.proposer} />
          </div>
          <div>
            To: <AddressDisplay address={swap.counterparty} />
          </div>
        </div>
      </CardContent>

      {isOpen && (isProposer || isCounterparty) && (
        <CardFooter>
          <div className="flex w-full items-center justify-between gap-2">
            <div className="min-w-0 text-xs">
              {busy && (
                <span className="text-muted-foreground animate-pulse">
                  {STEP_TEXT[status]}
                </span>
              )}
              {status === "error" && (
                <span className="text-destructive">{errorMsg}</span>
              )}
            </div>

            <div className="flex gap-2 shrink-0">
              {status === "error" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setStatus("idle"); setErrorMsg(""); }}
                >
                  Retry
                </Button>
              )}
              {isCounterparty && (
                <Button size="sm" disabled={busy} onClick={handleAccept}>
                  {isWantedApproved ? "Accept" : "Approve & Accept"}
                </Button>
              )}
              {isProposer && (
                <Button variant="destructive" size="sm" disabled={busy} onClick={handleCancel}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
