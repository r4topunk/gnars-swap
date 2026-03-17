"use client";

import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { Button } from "@/components/ui/button";

export function ConnectButton() {
  const { address, isConnected, isConnecting, isReconnecting } = useAccount();
  const { connect, isPending: isConnectPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const loading = isConnecting || isReconnecting || isConnectPending;

  if (!mounted || loading) {
    return (
      <Button variant="outline" size="sm" disabled>
        {mounted ? "Connecting..." : "Connect Wallet"}
      </Button>
    );
  }

  if (isConnected && address) {
    return (
      <Button variant="outline" size="sm" onClick={() => disconnect()}>
        {address.slice(0, 6)}...{address.slice(-4)}
      </Button>
    );
  }

  return (
    <Button size="sm" onClick={() => connect({ connector: injected() })}>
      Connect Wallet
    </Button>
  );
}
