'use client';

import { useCurrentAccount, useDisconnectWallet } from '@mysten/dapp-kit';
import { ConnectButton } from '@mysten/dapp-kit';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

// Format address: 0x1234...5678
function formatAddress(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function WalletButton() {
  const currentAccount = useCurrentAccount();
  const { mutate: disconnect } = useDisconnectWallet();

  // If wallet is connected, show address and disconnect button
  if (currentAccount) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm font-mono bg-muted px-3 py-1.5 rounded-md">
          {formatAddress(currentAccount.address)}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => disconnect()}
        >
          Disconnect
        </Button>
      </div>
    );
  }

  // If not connected, show connect dialog
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Connect Wallet</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect Sui Wallet</DialogTitle>
          <DialogDescription>
            Choose your wallet to connect to the M&A Earn-out Platform
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-4">
          <ConnectButton connectText="Connect Wallet" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
