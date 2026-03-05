"use client";

import { NftCard } from "@/components/nft-card";
import { cn } from "@/lib/utils";

const GRID_SLOTS = 16; // 4x4 grid

interface InventoryGridProps {
  tokens: number[];
  selectedToken?: number;
  onSelect?: (tokenId: number) => void;
  isLoading?: boolean;
  label: string;
  sublabel?: string;
  className?: string;
}

export function InventoryGrid({
  tokens,
  selectedToken,
  onSelect,
  isLoading,
  label,
  sublabel,
  className,
}: InventoryGridProps) {
  // Fill remaining slots as empty
  const slots: (number | null)[] = [
    ...tokens,
    ...Array(Math.max(0, GRID_SLOTS - tokens.length)).fill(null),
  ];

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Inventory header */}
      <div className="flex items-baseline justify-between px-0.5">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        {sublabel && (
          <span className="text-[10px] font-mono text-muted-foreground/60 truncate max-w-[120px]">
            {sublabel}
          </span>
        )}
      </div>

      {/* Grid container — game inventory style */}
      <div className="border border-border bg-background/50 p-1">
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
            {slots.map((tokenId, i) => (
              <NftCard
                key={tokenId !== null ? `t-${tokenId}` : `e-${i}`}
                tokenId={tokenId ?? undefined}
                empty={tokenId === null}
                selected={tokenId !== null && tokenId === selectedToken}
                onClick={
                  tokenId !== null && onSelect
                    ? () => onSelect(tokenId)
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Item count */}
      <div className="px-0.5 text-[10px] font-mono text-muted-foreground/50">
        {tokens.length} item{tokens.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
