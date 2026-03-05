"use client";

import { useAccount } from "wagmi";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ConnectButton } from "@/components/connect-button";
import { TradePanel } from "@/components/trade-panel";
import { SwapList } from "@/components/swap-list";
import { useSwaps } from "@/hooks/use-swaps";

function SwapSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {[0, 1].map((i) => (
        <div key={i} className="rounded-xl ring-1 ring-foreground/10 p-4 space-y-3">
          <div className="flex justify-between">
            <div className="h-4 w-20 animate-pulse bg-muted" />
            <div className="h-5 w-12 animate-pulse bg-muted rounded-full" />
          </div>
          <div className="flex items-center gap-3">
            <div className="size-14 animate-pulse bg-muted border border-border" />
            <div className="h-4 w-4 animate-pulse bg-muted" />
            <div className="size-14 animate-pulse bg-muted border border-border" />
          </div>
          <div className="space-y-1.5">
            <div className="h-3 w-32 animate-pulse bg-muted" />
            <div className="h-3 w-28 animate-pulse bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

function TabContent({
  isConnected,
  isLoading,
  disconnectedMsg,
  children,
}: {
  isConnected: boolean;
  isLoading: boolean;
  disconnectedMsg: string;
  children: React.ReactNode;
}) {
  if (!isConnected) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        {disconnectedMsg}
      </div>
    );
  }
  if (isLoading) return <SwapSkeleton />;
  return <>{children}</>;
}

export default function Page() {
  const { isConnected } = useAccount();
  const { myProposals, incoming, history, isLoading, markSwap, addSwap, syncFromChain, totalSwaps } = useSwaps();

  return (
    <div className="mx-auto flex min-h-dvh md:h-dvh max-w-3xl flex-col px-4 py-6">
      <header className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-bold tracking-tight">GnarsSwap</h1>
          <p className="text-xs text-muted-foreground">
            P2P NFT trading for Gnars
          </p>
        </div>
        <ConnectButton />
      </header>

      <main className="mt-6 flex-1 min-h-0 flex flex-col">
        <Tabs defaultValue="trade" className="flex-1 min-h-0 flex flex-col">
          <TabsList variant="line">
            <TabsTrigger value="trade">New Trade</TabsTrigger>
            <TabsTrigger value="inbox">
              Inbox
              {incoming.length > 0 && (
                <Badge variant="default" className="ml-1.5">
                  {incoming.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="proposals">My Proposals</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <div className="mt-4 flex-1 min-h-0 flex flex-col">
            <TabsContent value="trade" className="min-h-0 flex flex-col">
              <TradePanel
                onTradeComplete={(swap) => {
                  addSwap(swap);
                  syncFromChain();
                }}
              />
            </TabsContent>

            <TabsContent value="inbox">
              <TabContent
                isConnected={isConnected}
                isLoading={isLoading}
                disconnectedMsg="Connect your wallet to see incoming swaps"
              >
                <SwapList
                  swaps={incoming}
                  emptyMessage="No incoming swap proposals"
                  onSwapAction={markSwap}
                />
              </TabContent>
            </TabsContent>

            <TabsContent value="proposals">
              <TabContent
                isConnected={isConnected}
                isLoading={isLoading}
                disconnectedMsg="Connect your wallet to see your proposals"
              >
                <SwapList
                  swaps={myProposals}
                  emptyMessage="You haven't proposed any swaps yet"
                  onSwapAction={markSwap}
                />
              </TabContent>
            </TabsContent>

            <TabsContent value="history">
              <TabContent
                isConnected={isConnected}
                isLoading={isLoading}
                disconnectedMsg="Connect your wallet to see swap history"
              >
                <SwapList
                  swaps={history}
                  emptyMessage="No completed or cancelled swaps"
                />
              </TabContent>
            </TabsContent>
          </div>
        </Tabs>
      </main>

      <footer className="mt-4 border-t pt-3 text-center text-xs text-muted-foreground shrink-0">
        Gnars on Base
      </footer>
    </div>
  );
}
