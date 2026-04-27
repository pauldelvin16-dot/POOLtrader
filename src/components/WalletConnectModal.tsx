import React, { useState, useEffect } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Loader2, Wallet, AlertCircle, Smartphone, ExternalLink } from 'lucide-react';
import { useWallet } from '@/hooks/useWeb3Wallet';
import { CHAIN_NAMES } from '@/lib/web3Config';
import { toast } from 'sonner';

interface WalletConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const WALLET_CONFIGS = [
  { id: 'metamask', name: 'MetaMask', icon: '🦊', color: 'bg-orange-500', hasMobile: true },
  { id: 'trust-wallet', name: 'Trust Wallet', icon: '🔵', color: 'bg-blue-500', hasMobile: true },
  { id: 'phantom', name: 'Phantom', icon: '👻', color: 'bg-purple-500', hasMobile: true },
  { id: 'exodus', name: 'Exodus', icon: '🌊', color: 'bg-teal-500', hasMobile: true },
  { id: 'safepal', name: 'SafePal', icon: '🛡️', color: 'bg-red-500', hasMobile: true },
  { id: 'coinbase', name: 'Coinbase', icon: '🔷', color: 'bg-blue-600', hasMobile: true },
  { id: 'walletconnect', name: 'WalletConnect', icon: '🔗', color: 'bg-blue-400', hasMobile: true },
  { id: 'browser-wallet', name: 'Browser Wallet', icon: '🌐', color: 'bg-gray-500', hasMobile: false },
];

export function WalletConnectModal({ isOpen, onClose }: WalletConnectModalProps) {
  const { open } = useWeb3Modal();
  const { address, chainId, isConnected } = useWeb3ModalAccount();
  const { connectWallet, isConnecting, error, isWalletInstalled, getInstalledWallets, isMobile, openWalletDeepLink, detectWalletType } = useWallet();
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [installedWallets, setInstalledWallets] = useState<string[]>([]);
  const [detectedWallet, setDetectedWallet] = useState<string | null>(null);
  const [showMobileOptions, setShowMobileOptions] = useState(false);

  // Detect installed wallets on mount
  useEffect(() => {
    if (isOpen) {
      const installed = getInstalledWallets();
      setInstalledWallets(installed);
      console.log('Installed wallets detected:', installed);
    }
  }, [isOpen, getInstalledWallets]);

  // Auto-detect wallet type when connected
  useEffect(() => {
    if (isConnected && address) {
      // Try to detect from provider
      const provider = (window as any).ethereum;
      if (provider) {
        const detected = detectWalletType(provider);
        setDetectedWallet(detected);
        console.log('Detected wallet type:', detected);
      }
    }
  }, [isConnected, address, detectWalletType]);

  const handleConnectWallet = async (walletType?: string) => {
    const walletToConnect = walletType || selectedWallet;
    if (!address || !walletToConnect) {
      toast.error('Please select a wallet and connect first');
      return;
    }

    const success = await connectWallet(walletToConnect);
    if (success) {
      toast.success('Wallet connected successfully!');
      onClose();
    }
  };

  const handleMobileWalletOpen = (walletId: string) => {
    const walletType = walletId.replace('-wallet', '').replace('trust-wallet', 'trust');
    openWalletDeepLink(walletType);
    setShowMobileOptions(false);
  };

  const isWalletAvailable = (walletId: string) => {
    // Check if wallet is installed or if it's a mobile device
    const isInstalled = installedWallets.includes(walletId);
    const mobile = isMobile();
    const hasMobileSupport = WALLET_CONFIGS.find(w => w.id === walletId)?.hasMobile;
    
    console.log(`Checking wallet ${walletId}:`, { isInstalled, mobile, hasMobileSupport, result: isInstalled || (mobile && hasMobileSupport) });
    
    return isInstalled || (mobile && hasMobileSupport);
  };

  const handleWalletClick = async (walletId: string) => {
    console.log('Wallet clicked:', walletId);
    setSelectedWallet(walletId);
    
    // If not connected via Web3Modal, open it first
    if (!isConnected || !address) {
      console.log('Not connected, opening Web3Modal...');
      await open();
      return;
    }
    
    // If already connected, proceed with wallet connection
    console.log('Already connected, proceeding with wallet connection...');
    await handleConnectWallet(walletId);
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
          {/* Show detected installed wallets */}
          {installedWallets.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                Detected Wallets
                <Badge variant="secondary" className="text-xs">{installedWallets.length}</Badge>
              </label>
              <div className="flex flex-wrap gap-2">
                {installedWallets.map(walletId => {
                  const config = WALLET_CONFIGS.find(w => w.id === walletId);
                  return (
                    <Badge key={walletId} className={`${config?.color || 'bg-gray-500'} text-white`}>
                      {config?.icon} {config?.name || walletId}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 1: Open Web3Modal or Mobile Options */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Step 1: Connect Your Wallet</label>
            
            {/* Mobile wallet deep links */}
            {isMobile() && !isConnected && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Smartphone className="h-3 w-3" />
                  Mobile device detected - Quick open installed wallet:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {WALLET_CONFIGS.filter(w => w.hasMobile && w.id !== 'walletconnect' && w.id !== 'browser-wallet').map((wallet) => (
                    <Button
                      key={wallet.id}
                      onClick={() => handleMobileWalletOpen(wallet.id)}
                      variant="outline"
                      className="text-xs justify-start"
                      size="sm"
                    >
                      <span className="mr-2">{wallet.icon}</span>
                      {wallet.name}
                      <ExternalLink className="ml-auto h-3 w-3" />
                    </Button>
                  ))}
                </div>
              </div>
            )}
            
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
                  {isMobile() ? 'Connect via WalletConnect' : 'Open Wallet Connect'}
                </>
              )}
            </Button>
            {isConnected && chainId && (
              <p className="text-xs text-gray-500">
                Connected to {CHAIN_NAMES[chainId] || `Chain ${chainId}`}
                {detectedWallet && (
                  <span className="ml-2">
                    via {WALLET_CONFIGS.find(w => w.id === detectedWallet)?.name || detectedWallet}
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Step 2: Select Wallet Type */}
          {isConnected && address && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Step 2: Verify Wallet Type</label>
              {detectedWallet && (
                <p className="text-xs text-green-600">
                  Auto-detected: {WALLET_CONFIGS.find(w => w.id === detectedWallet)?.name || detectedWallet}
                </p>
              )}
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {WALLET_CONFIGS.map((wallet) => {
                  const isAvailable = isWalletAvailable(wallet.id);
                  const isDetected = detectedWallet === wallet.id;
                  const isInstalled = installedWallets.includes(wallet.id);
                  
                  return (
                    <Button
                      key={wallet.id}
                      onClick={() => handleWalletClick(wallet.id)}
                      variant={selectedWallet === wallet.id ? 'default' : isDetected ? 'secondary' : 'outline'}
                      className={`text-xs justify-start ${!isAvailable ? 'opacity-50' : ''} ${isDetected ? 'ring-2 ring-green-500' : ''} ${isInstalled ? 'border-blue-500 border-2' : ''}`}
                      disabled={isConnecting}
                      title={!isAvailable ? 'Wallet not detected - use WalletConnect' : isDetected ? 'Auto-detected' : isInstalled ? 'Click to select' : 'WalletConnect compatible'}
                    >
                      <span className="mr-2">{wallet.icon}</span>
                      <span className="truncate">{wallet.name}</span>
                      {isDetected && <Badge className="ml-auto bg-green-500 text-white text-[10px] px-1">Auto</Badge>}
                      {isInstalled && !isDetected && <Badge className="ml-auto bg-blue-500 text-white text-[10px] px-1">Installed</Badge>}
                    </Button>
                  );
                })}
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
              onClick={() => handleConnectWallet()}
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
