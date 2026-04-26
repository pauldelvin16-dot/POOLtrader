import React, { useState } from 'react';
import { useWeb3Modal } from '@web3modal/ethers/react';
import { useWeb3ModalAccount } from '@web3modal/ethers/react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Wallet, AlertCircle } from 'lucide-react';
import { useWallet } from '@/hooks/useWeb3Wallet';
import { WALLET_TYPES, CHAIN_NAMES } from '@/lib/web3Config';

interface WalletConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WalletConnectModal({ isOpen, onClose }: WalletConnectModalProps) {
  const { open } = useWeb3Modal();
  const { address, chainId, isConnected } = useWeb3ModalAccount();
  const { connectWallet, isConnecting, error } = useWallet();
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);

  const handleConnectWallet = async () => {
    if (!address || !selectedWallet) return;

    await connectWallet(selectedWallet);
    if (!error) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Connect Web3 Wallet</DialogTitle>
          <DialogDescription>
            Link your crypto wallet to start trading in the pool
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step 1: Open Web3Modal */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Step 1: Select Your Wallet</label>
            <Button
              onClick={() => open()}
              variant="outline"
              className="w-full"
              disabled={isConnecting}
            >
              {isConnected && address ? (
                <>
                  <Wallet className="mr-2 h-4 w-4" />
                  {address.slice(0, 6)}...{address.slice(-4)}
                </>
              ) : (
                <>
                  <Wallet className="mr-2 h-4 w-4" />
                  Open Wallet Connect
                </>
              )}
            </Button>
            {isConnected && chainId && (
              <p className="text-xs text-gray-500">
                Connected to {CHAIN_NAMES[chainId] || `Chain ${chainId}`}
              </p>
            )}
          </div>

          {/* Step 2: Select Wallet Type */}
          {isConnected && address && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Step 2: Verify Wallet Type</label>
              <div className="grid grid-cols-2 gap-2">
                {WALLET_TYPES.map((walletType) => (
                  <Button
                    key={walletType}
                    onClick={() => setSelectedWallet(walletType)}
                    variant={selectedWallet === walletType ? 'default' : 'outline'}
                    className="capitalize text-xs"
                    disabled={isConnecting}
                  >
                    {walletType.replace('-', ' ')}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1"
              disabled={isConnecting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConnectWallet}
              className="flex-1"
              disabled={!isConnected || !selectedWallet || isConnecting}
            >
              {isConnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                'Connect Wallet'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
