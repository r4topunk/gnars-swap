"use client";

import { useState, useCallback } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
  useEnsAddress,
  useEnsName,
  useEnsAvatar,
} from "wagmi";
import { mainnet } from "wagmi/chains";
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

function addressToColor(addr: string): string {
  const hex = addr.slice(2, 8);
  return `#${hex}`;
}

function AddressAvatar({ ensAvatar, address, size = 20 }: { ensAvatar?: string | null; address?: string; size?: number }) {
  if (ensAvatar) {
    return (
      <img
        src={ensAvatar}
        alt=""
        className="rounded-full shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  const bg = address ? addressToColor(address) : "#666";
  return (
    <div
      className="rounded-full shrink-0"
      style={{ width: size, height: size, backgroundColor: bg }}
    />
  );
}

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
  const [addressInput, setAddressInput] = useState("");
  const [ethSweetener, setEthSweetener] = useState("");
  const [status, setStatus] = useState<TradeStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const swapAddress = chainId ? GNARS_SWAP_ADDRESS[chainId] : undefined;
  const nftAddress = chainId ? GNARS_NFT_ADDRESS[chainId] : undefined;

  // ENS resolution — own address
  const { data: myEnsName } = useEnsName({
    address,
    chainId: mainnet.id,
    query: { enabled: !!address },
  });
  const { data: myEnsAvatar } = useEnsAvatar({
    name: myEnsName ?? undefined,
    chainId: mainnet.id,
    query: { enabled: !!myEnsName },
  });

  // ENS resolution — counterparty
  const isEnsName = addressInput.toLowerCase().endsWith(".eth") && addressInput.length > 4;
  const isRawAddress = addressInput.length === 42 && addressInput.startsWith("0x");
  const { data: ensAddress, isLoading: ensLoading } = useEnsAddress({
    name: isEnsName ? addressInput : undefined,
    chainId: mainnet.id,
    query: { enabled: isEnsName },
  });
  const counterparty = isEnsName
    ? (ensAddress ?? "")
    : isRawAddress
    ? addressInput
    : "";
  const counterpartyValid = counterparty.length === 42 && counterparty.startsWith("0x");

  const counterpartyEnsName = isEnsName ? addressInput : undefined;
  const { data: counterpartyEnsAvatar } = useEnsAvatar({
    name: counterpartyEnsName,
    chainId: mainnet.id,
    query: { enabled: !!counterpartyEnsName },
  });

  // Fetch inventories
  const { tokens: myTokens, isLoading: myLoading, refetch: refetchMyInventory } = useInventory(address);
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
    setAddressInput("");
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
    <div className="border border-border bg-card/50 flex-1 min-h-0 flex flex-col">
      {/* Title bar */}
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-1.5 shrink-0">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Trade Window
        </span>
        <div className="flex items-center gap-2 h-6">
          {busy && (
            <span className="text-[10px] text-muted-foreground animate-pulse">
              {STATUS_TEXT[status]}
            </span>
          )}
          {(selectedMyToken !== undefined || selectedTheirToken !== undefined || status === "error") &&
            !busy && (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-2 text-[10px]"
                onClick={handleReset}
              >
                Clear
              </Button>
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

      {/* Controls bar — spans full width */}
      <div className="grid grid-cols-[1fr_40px_1fr] border-b border-border shrink-0">
        {/* LEFT: your identity */}
        <div className="p-3 flex items-center gap-2.5 min-w-0">
          <AddressAvatar ensAvatar={myEnsAvatar} address={address} size={32} />
          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">You</p>
            <p className="text-xs font-mono font-semibold truncate leading-tight">
              {myEnsName ?? `${address!.slice(0, 6)}…${address!.slice(-4)}`}
            </p>
            {myEnsName && (
              <p className="text-[10px] font-mono text-muted-foreground/60 leading-tight">
                {`${address!.slice(0, 6)}…${address!.slice(-4)}`}
              </p>
            )}
          </div>
        </div>

        {/* Center: ⇄ */}
        <div className="flex items-center justify-center border-x border-border">
          <span className="text-sm text-muted-foreground select-none">⇄</span>
        </div>

        {/* RIGHT: counterparty — card when resolved, input otherwise */}
        <div className="p-3 flex items-center gap-2.5 min-w-0">
          {counterpartyValid ? (
            <>
              <AddressAvatar ensAvatar={counterpartyEnsAvatar} address={counterparty} size={32} />
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">Trade With</p>
                <p className="text-xs font-mono font-semibold truncate leading-tight">
                  {counterpartyEnsName ?? `${counterparty.slice(0, 6)}…${counterparty.slice(-4)}`}
                </p>
                {counterpartyEnsName && (
                  <p className="text-[10px] font-mono text-muted-foreground/60 leading-tight">
                    {ensLoading ? "…" : `${counterparty.slice(0, 6)}…${counterparty.slice(-4)}`}
                  </p>
                )}
              </div>
              {!busy && (
                <button
                  type="button"
                  className="shrink-0 text-muted-foreground/50 hover:text-muted-foreground text-base leading-none"
                  onClick={() => { setAddressInput(""); setSelectedTheirToken(undefined); }}
                  title="Change"
                >
                  ×
                </button>
              )}
            </>
          ) : (
            <>
              <AddressAvatar ensAvatar={counterpartyEnsAvatar} address={ensAddress ?? undefined} size={32} />
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">Trade With</p>
                <Input
                  type="text"
                  placeholder="0x… or name.eth"
                  value={addressInput}
                  onChange={(e) => {
                    setAddressInput(e.target.value);
                    setSelectedTheirToken(undefined);
                  }}
                  className="h-6 text-xs font-mono w-full"
                  disabled={busy}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] flex-1 min-h-0">
        {/* LEFT: Your inventory */}
        <div className="min-h-0">
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
          />
        </div>

        {/* Center divider */}
        <div className="hidden md:flex items-center">
          <Separator orientation="vertical" className="h-full" />
        </div>
        <Separator className="md:hidden" />

        {/* RIGHT: Their inventory */}
        <div className="min-h-0">
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
            />
          ) : (
            <div className="border border-dashed border-border/50 p-1 h-full overflow-y-auto">
              <div className="grid grid-cols-4 gap-px">
                {Array.from({ length: 16 }).map((_, i) => (
                  <div
                    key={i}
                    className="aspect-square border border-border/20 bg-muted/20"
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Offer summary + action bar */}
      <div className="border-t border-border bg-muted/30 px-3 py-2 shrink-0">
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
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center border border-border bg-background/50 h-8 px-2 gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                + ETH
              </span>
              <Input
                type="number"
                step="0.01"
                min={0}
                placeholder="0.00"
                value={ethSweetener}
                onChange={(e) => setEthSweetener(e.target.value)}
                className="h-5 text-xs border-0 bg-transparent px-1 py-0 focus-visible:ring-0 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                style={{ width: `calc(${Math.max(4, (ethSweetener || "").length || 4)}ch + 0.5rem)` }}
                disabled={busy}
              />
            </div>
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
