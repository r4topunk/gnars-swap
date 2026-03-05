"use client";

import { SwapCard } from "@/components/swap-card";
import type { SwapData } from "@/hooks/use-swaps";

export function SwapList({
  swaps,
  emptyMessage,
  onSwapAction,
}: {
  swaps: SwapData[];
  emptyMessage: string;
  onSwapAction?: (swapId: number, newStatus: number) => void;
}) {
  if (swaps.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {swaps.map((swap) => (
        <SwapCard
          key={swap.swapId}
          swap={swap}
          onSwapAction={onSwapAction}
        />
      ))}
    </div>
  );
}
