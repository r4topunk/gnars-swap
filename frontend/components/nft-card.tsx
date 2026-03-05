"use client";

import { cn } from "@/lib/utils";

interface NftCardProps {
  tokenId?: number;
  selected?: boolean;
  onClick?: () => void;
  empty?: boolean;
}

export function NftCard({ tokenId, selected, onClick, empty }: NftCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "relative flex aspect-square items-center justify-center border transition-all duration-100",
        "size-full min-h-0",
        empty
          ? "border-border/30 bg-card/30"
          : "border-border bg-card hover:bg-accent",
        selected &&
          "border-primary bg-primary/10 ring-1 ring-primary shadow-[0_0_8px_-2px] shadow-primary/40",
        onClick && !empty && "cursor-pointer active:scale-95",
        !onClick && "cursor-default"
      )}
    >
      {tokenId !== undefined && (
        <span
          className={cn(
            "font-mono text-sm font-bold tabular-nums",
            selected ? "text-primary-foreground" : "text-foreground"
          )}
        >
          #{tokenId}
        </span>
      )}
    </button>
  );
}
