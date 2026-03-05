"use client";

import { useState, useCallback } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
} from "wagmi";
import { parseEther } from "viem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { InventoryGrid } from "@/components/inventory-grid";
import { useInventory } from "@/hooks/use-inventory";
import {
  GNARS_SWAP_ABI,
  GNARS_SWAP_ADDRESS,
  ERC721_ABI,
  GNARS_NFT_ADDRESS,
} from "@/lib/contracts";
import type { SwapData } from "@/hooks/use-swaps";

type TradeStatus =
  | "idle"
  | "approving"
  | "waiting-approve"
  | "proposing"
  | "waiting-propose"
  | "done"
  | "error";

export function TradePanel({ onTradeComplete }: { onTradeComplete?: (swap: SwapData) => void }) {
  const { address, chainId } = useAccount();
  const publicClient = usePublicClient();

  const [selectedMyToken, setSelectedMyToken] = useState<number | undefined>();
  const [selectedTheirToken, setSelectedTheirToken] = useState<
    number | undefined
  >();
  const [counterparty, setCounterparty] = useState("");
  const [ethSweetener, setEthSweetener] = useState("");
  const [status, setStatus] = useState<TradeStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const swapAddress = chainId ? GNARS_SWAP_ADDRESS[chainId] : undefined;
  const nftAddress = chainId ? GNARS_NFT_ADDRESS[chainId] : undefined;

  // Fetch inventories
  const { tokens: myTokens, isLoading: myLoading, refetch: refetchMyInventory } = useInventory(address);
  const counterpartyValid =
    counterparty.length === 42 && counterparty.startsWith("0x");
  const { tokens: theirTokens, isLoading: theirLoading } = useInventory(
    counterpartyValid ? counterparty : undefined
  );

  // Approval check
  const { data: approvedAddress, refetch: refetchApproval } = useReadContract({
    address: nftAddress,
    abi: ERC721_ABI,
    functionName: "getApproved",
    args:
      selectedMyToken !== undefined ? [BigInt(selectedMyToken)] : undefined,
    query: { enabled: selectedMyToken !== undefined && !!nftAddress },
  });

  const isApproved =
    approvedAddress?.toLowerCase() === swapAddress?.toLowerCase();

  const { writeContractAsync } = useWriteContract();

  const canPropose =
    selectedMyToken !== undefined &&
    selectedTheirToken !== undefined &&
    counterpartyValid &&
    swapAddress &&
    nftAddress;

  const busy = status !== "idle" && status !== "done" && status !== "error";

  const handleTrade = useCallback(async () => {
    if (
      !canPropose ||
      !publicClient ||
      !swapAddress ||
      !nftAddress ||
      selectedMyToken === undefined ||
      selectedTheirToken === undefined
    )
      return;

    setErrorMsg("");

    try {
      // Pre-flight: verify both parties still own their tokens
      const [myOwner, theirOwner] = await Promise.all([
        publicClient.readContract({
          address: nftAddress,
          abi: ERC721_ABI,
          functionName: "ownerOf",
          args: [BigInt(selectedMyToken)],
        }),
        publicClient.readContract({
          address: nftAddress,
          abi: ERC721_ABI,
          functionName: "ownerOf",
          args: [BigInt(selectedTheirToken)],
        }),
      ]);

      if ((myOwner as string).toLowerCase() !== address!.toLowerCase()) {
        throw new Error(`You no longer own Gnar #${selectedMyToken}`);
      }
      if ((theirOwner as string).toLowerCase() !== counterparty.toLowerCase()) {
        throw new Error(`Counterparty no longer owns Gnar #${selectedTheirToken}`);
      }

      // Step 1: Approve if needed
      if (!isApproved) {
        setStatus("approving");
        const approveTx = await writeContractAsync({
          address: nftAddress,
          abi: ERC721_ABI,
          functionName: "approve",
          args: [swapAddress, BigInt(selectedMyToken)],
        });

        setStatus("waiting-approve");
        await publicClient.waitForTransactionReceipt({ hash: approveTx });

        // Refetch approval state
        await refetchApproval();
      }

      // Step 2: Propose
      setStatus("proposing");
      const proposeTx = await writeContractAsync({
        address: swapAddress,
        abi: GNARS_SWAP_ABI,
        functionName: "proposeSwap",
        args: [
          BigInt(selectedMyToken),
          BigInt(selectedTheirToken),
          counterparty as `0x${string}`,
        ],
        value: ethSweetener ? parseEther(ethSweetener) : 0n,
      });

      setStatus("waiting-propose");
      const receipt = await publicClient.waitForTransactionReceipt({ hash: proposeTx });

      // Read the new swap ID from the receipt logs
      const { decodeEventLog } = await import("viem");
      let newSwapId = 0;
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: GNARS_SWAP_ABI,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === "SwapProposed") {
            newSwapId = Number((decoded.args as { swapId: bigint }).swapId);
            break;
          }
        } catch {
          // not our event
        }
      }

      setStatus("done");
      onTradeComplete?.({
        swapId: newSwapId,
        proposer: address!,
        counterparty,
        tokenIdOffered: BigInt(selectedMyToken),
        tokenIdWanted: BigInt(selectedTheirToken),
        ethAmount: ethSweetener ? parseEther(ethSweetener) : 0n,
        status: 0,
      });
      refetchMyInventory();
    } catch (err: unknown) {
      setStatus("error");
      const message =
        err instanceof Error ? err.message : "Transaction failed";
      // Shorten wallet rejection messages
      if (message.includes("User rejected") || message.includes("denied")) {
        setErrorMsg("Transaction rejected");
      } else {
        setErrorMsg(message.slice(0, 100));
      }
    }
  }, [
    canPropose,
    publicClient,
    swapAddress,
    nftAddress,
    selectedMyToken,
    selectedTheirToken,
    counterparty,
    ethSweetener,
    isApproved,
    writeContractAsync,
    refetchApproval,
    onTradeComplete,
    refetchMyInventory,
  ]);

  function handleReset() {
    setSelectedMyToken(undefined);
    setSelectedTheirToken(undefined);
    setCounterparty("");
    setEthSweetener("");
    setStatus("idle");
    setErrorMsg("");
  }

  if (!address) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Connect your wallet to start trading
      </div>
    );
  }

  if (status === "done") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 border border-border bg-card p-8">
        <div className="text-sm font-semibold uppercase tracking-wider">
          Trade proposed
        </div>
        <p className="text-xs text-muted-foreground">
          Gnar #{selectedMyToken} offered for Gnar #{selectedTheirToken}
          {ethSweetener && Number(ethSweetener) > 0
            ? ` + ${ethSweetener} ETH`
            : ""}
        </p>
        <p className="text-xs text-muted-foreground">
          Waiting for counterparty to accept.
        </p>
        <Button variant="outline" size="sm" onClick={handleReset}>
          New Trade
        </Button>
      </div>
    );
  }

  const STATUS_TEXT: Record<TradeStatus, string> = {
    idle: "",
    approving: "Approve in wallet...",
    "waiting-approve": "Waiting for approval...",
    proposing: "Confirm proposal in wallet...",
    "waiting-propose": "Waiting for proposal...",
    done: "",
    error: "",
  };

  return (
    <div className="border border-border bg-card/50">
      {/* Title bar */}
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Trade Window
        </span>
        <div className="flex items-center gap-2">
          {busy && (
            <span className="text-[10px] text-muted-foreground animate-pulse">
              {STATUS_TEXT[status]}
            </span>
          )}
          {selectedMyToken !== undefined &&
            selectedTheirToken !== undefined &&
            !busy && (
              <Badge variant="outline" className="text-[10px]">
                Ready
              </Badge>
            )}
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr]">
        {/* LEFT: Your inventory */}
        <div className="p-3">
          <InventoryGrid
            tokens={myTokens}
            selectedToken={selectedMyToken}
            onSelect={
              busy
                ? undefined
                : (id) =>
                    setSelectedMyToken(
                      id === selectedMyToken ? undefined : id
                    )
            }
            isLoading={myLoading}
            label="Your Inventory"
            sublabel={`${address.slice(0, 6)}...${address.slice(-4)}`}
          />

          {/* ETH sweetener */}
          <div className="mt-3 border border-border bg-background/50 p-2">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              + ETH sweetener
            </label>
            <Input
              type="number"
              step="0.01"
              min={0}
              placeholder="0.00"
              value={ethSweetener}
              onChange={(e) => setEthSweetener(e.target.value)}
              className="mt-1 h-7 text-xs"
              disabled={busy}
            />
          </div>
        </div>

        {/* Center divider */}
        <div className="hidden md:flex items-center">
          <Separator orientation="vertical" className="h-full" />
        </div>
        <Separator className="md:hidden" />

        {/* RIGHT: Their inventory */}
        <div className="p-3">
          {/* Counterparty selector */}
          <div className="mb-3 border border-border bg-background/50 p-2">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Trade with
            </label>
            <Input
              type="text"
              placeholder="0x... holder address"
              value={counterparty}
              onChange={(e) => {
                setCounterparty(e.target.value);
                setSelectedTheirToken(undefined);
              }}
              className="mt-1 h-7 text-xs font-mono"
              disabled={busy}
            />
          </div>

          {counterpartyValid ? (
            <InventoryGrid
              tokens={theirTokens}
              selectedToken={selectedTheirToken}
              onSelect={
                busy
                  ? undefined
                  : (id) =>
                      setSelectedTheirToken(
                        id === selectedTheirToken ? undefined : id
                      )
              }
              isLoading={theirLoading}
              label="Their Inventory"
              sublabel={`${counterparty.slice(0, 6)}...${counterparty.slice(-4)}`}
            />
          ) : (
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground px-0.5">
                Their Inventory
              </span>
              <div className="border border-dashed border-border/50 p-1">
                <div className="grid grid-cols-4 gap-px">
                  {Array.from({ length: 16 }).map((_, i) => (
                    <div
                      key={i}
                      className="aspect-square border border-border/20 bg-muted/20"
                    />
                  ))}
                </div>
              </div>
              <span className="px-0.5 text-[10px] text-muted-foreground/40">
                Enter a holder address to see their items
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Offer summary + action bar */}
      <div className="border-t border-border bg-muted/30 px-3 py-2">
        <div className="flex items-center justify-between gap-4">
          {/* Summary */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground min-w-0">
            {status === "error" ? (
              <span className="text-destructive">{errorMsg}</span>
            ) : selectedMyToken !== undefined ? (
              <span>
                Offering{" "}
                <span className="font-mono font-bold text-foreground">
                  #{selectedMyToken}
                </span>
                {ethSweetener && Number(ethSweetener) > 0 && (
                  <span className="text-foreground">
                    {" "}
                    + {ethSweetener} ETH
                  </span>
                )}
              </span>
            ) : (
              <span>Select an item from your inventory</span>
            )}

            {selectedMyToken !== undefined &&
              selectedTheirToken !== undefined &&
              status !== "error" && (
                <>
                  <span className="text-muted-foreground/40">&rarr;</span>
                  <span>
                    For{" "}
                    <span className="font-mono font-bold text-foreground">
                      #{selectedTheirToken}
                    </span>
                  </span>
                </>
              )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 shrink-0">
            {(selectedMyToken !== undefined ||
              selectedTheirToken !== undefined ||
              status === "error") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                disabled={busy}
              >
                Clear
              </Button>
            )}
            <Button
              size="sm"
              disabled={!canPropose || busy}
              onClick={handleTrade}
            >
              {!isApproved && selectedMyToken !== undefined
                ? "Approve & Trade"
                : "Propose Trade"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
