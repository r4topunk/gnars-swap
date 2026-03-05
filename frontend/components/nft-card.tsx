"use client";

import { cn } from "@/lib/utils";

interface NftCardProps {
  tokenId?: number;
  imageUrl?: string;
  selected?: boolean;
  onClick?: () => void;
  empty?: boolean;
}

export function NftCard({ tokenId, imageUrl, selected, onClick, empty }: NftCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "relative flex aspect-square items-center justify-center border transition-all duration-100",
        "size-full min-h-0 overflow-hidden",
        empty
          ? "border-border/30 bg-card/30"
          : "border-border bg-card hover:bg-accent",
        selected &&
          "border-yellow-400 ring-1 ring-yellow-400 shadow-[0_0_8px_-2px] shadow-yellow-400/40",
        onClick && !empty && "cursor-pointer active:scale-95",
        !onClick && "cursor-default"
      )}
    >
      {tokenId !== undefined && imageUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={`Gnar #${tokenId}`}
            className="absolute inset-0 size-full object-cover"
            loading="lazy"
          />
          {selected && (
            <div className="absolute inset-0 bg-yellow-400/20 ring-inset ring-1 ring-yellow-400" />
          )}
          <span className="absolute bottom-0 left-0 right-0 bg-background/70 px-1 py-0.5 text-center font-mono text-[9px] font-bold tabular-nums leading-tight text-foreground">
            #{tokenId}
          </span>
        </>
      ) : tokenId !== undefined ? (
        <span
          className={cn(
            "font-mono text-sm font-bold tabular-nums",
            selected ? "text-yellow-400" : "text-foreground"
          )}
        >
          #{tokenId}
        </span>
      ) : null}
    </button>
  );
}
