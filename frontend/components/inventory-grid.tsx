"use client";

import { NftCard } from "@/components/nft-card";
import { cn } from "@/lib/utils";
import type { NftToken } from "@/hooks/use-inventory";

const GRID_SLOTS = 16; // 4x4 grid

interface InventoryGridProps {
  tokens: NftToken[];
  selectedToken?: number;
  onSelect?: (tokenId: number) => void;
  isLoading?: boolean;
  className?: string;
}

export function InventoryGrid({
  tokens,
  selectedToken,
  onSelect,
  isLoading,
  className,
}: InventoryGridProps) {
  // Fill remaining slots as empty
  const slots: (NftToken | null)[] = [
    ...tokens,
    ...Array(Math.max(0, GRID_SLOTS - tokens.length)).fill(null),
  ];

  return (
    <div className={cn("border border-border bg-background/50 p-1 overflow-y-auto max-h-[40vh]", className)}>
      {isLoading ? (
        <div className="grid grid-cols-4 gap-px">
          {Array.from({ length: GRID_SLOTS }).map((_, i) => (
            <div
              key={i}
              className="aspect-square animate-pulse bg-muted/40 border border-border/20"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-px">
          {slots.map((token, i) => (
            <NftCard
              key={token !== null ? `t-${token.id}` : `e-${i}`}
              tokenId={token?.id}
              imageUrl={token?.imageUrl}
              empty={token === null}
              selected={token !== null && token.id === selectedToken}
              onClick={
                token !== null && onSelect
                  ? () => onSelect(token.id)
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
