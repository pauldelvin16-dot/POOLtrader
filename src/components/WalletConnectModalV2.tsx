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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2,
  Wallet,
  AlertCircle,
  Smartphone,
  ExternalLink,
  CheckCircle2,
  Download,
} from 'lucide-react';
import { useWallet } from '@/hooks/useWeb3Wallet';
import { CHAIN_NAMES } from '@/lib/web3Config';
import { walletDiscoveryService, type DetectedWallet } from '@/lib/walletDiscovery';
import { toast } from 'sonner';

interface WalletConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const WALLET_ICONS: Record<string, string> = {
  'metamask-mobile': '🦊',
  'trust-wallet-mobile': '🔵',
  'phantom-mobile': '👻',
  'exodus-mobile': '🌊',
  'safepal-mobile': '🛡️',
  'coinbase-mobile': '🔷',
  'halo-mobile': '✨',
  'okx-mobile': '🔶',
  metamask: '🦊',
  'trust-wallet': '🔵',
  'phantom-evm': '👻',
  exodus: '🌊',
  safepal: '🛡️',
  coinbase: '🔷',
  ledger: '📱',
  frame: '🖼️',
  walletconnect: '🔗',
};

export function WalletConnectModal({ isOpen, onClose }: WalletConnectModalProps) {
  const { open } = useWeb3Modal();
  const { address, chainId, isConnected } = useWeb3ModalAccount();
  const { connectWallet, isConnecting, error } = useWallet();

  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [detectedWallets, setDetectedWallets] = useState<DetectedWallet[]>([]);
  const [extensionWallets, setExtensionWallets] = useState<DetectedWallet[]>([]);
  const [mobileWallets, setMobileWallets] = useState<DetectedWallet[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [activeMobileWallet, setActiveMobileWallet] = useState<string | null>(null);
  const [mobileConnectionAttempt, setMobileConnectionAttempt] = useState(false);

  // Initialize wallet discovery
  useEffect(() => {
    const initDiscovery = async () => {
      try {
        setIsDiscovering(true);
        await walletDiscoveryService.initialize();

        // Get detected wallets
        const wallets = await walletDiscoveryService.discoverWallets();
        setDetectedWallets(wallets);

        // Group by type
        const byType = await walletDiscoveryService.getWalletsByType();
        setExtensionWallets(byType.extensions);
        setMobileWallets(byType.mobile);

        // Set platform flags
        setIsMobile(walletDiscoveryService.isMobile());
        setIsAndroid(walletDiscoveryService.isAndroid());
        setIsIOS(walletDiscoveryService.isIOS());

        console.log('Wallet Discovery Results:', {
          total: wallets.length,
          extensions: byType.extensions.length,
          mobile: byType.mobile.length,
          isMobile: walletDiscoveryService.isMobile(),
          isAndroid: walletDiscoveryService.isAndroid(),
          isIOS: walletDiscoveryService.isIOS(),
        });
      } catch (err) {
        console.error('Wallet discovery failed:', err);
        toast.error('Failed to discover installed wallets');
      } finally {
        setIsDiscovering(false);
      }
    };

    if (isOpen) {
      initDiscovery();
    }
  }, [isOpen]);

  const handleConnectWallet = async () => {
    if (!selectedWallet) {
      toast.error('Please select a wallet');
      return;
    }

    try {
      // Open Web3Modal to trigger connection
      // This is required for SafePal and other wallets to properly negotiate sessions
      toast.loading('Opening wallet...');
      
      await new Promise(resolve => setTimeout(resolve, 300));
      await open();

      // Wait for address to be available
      await new Promise(resolve => {
        let attempts = 0;
        const checkInterval = setInterval(() => {
          if (address || attempts > 50) {
            clearInterval(checkInterval);
            resolve(true);
          }
          attempts++;
        }, 100);
      });

      // Now attempt the connection
      const success = await connectWallet(selectedWallet);
      if (success) {
        toast.success(`${selectedWallet} connected successfully!`);
        setTimeout(() => onClose(), 1000);
      } else {
        toast.error('Connection failed. Please try again.');
      }
    } catch (err: any) {
      console.error('Connection error:', err);
      toast.error(err.message || 'Failed to connect wallet');
    }
  };

  const handleMobileWalletConnect = async (walletId: string) => {
    setActiveMobileWallet(walletId);
    setMobileConnectionAttempt(true);

    try {
      // Step 1: Open Web3Modal to establish WalletConnect session
      // This ensures proper namespace negotiation
      toast.loading('Initializing WalletConnect...');
      
      await new Promise(resolve => setTimeout(resolve, 300));
      await open();

      // Step 2: Wait for address to be available from Web3Modal
      await new Promise<void>((resolve) => {
        let attempts = 0;
        const checkInterval = setInterval(() => {
          if (address || attempts > 40) {
            clearInterval(checkInterval);
            resolve();
          }
          attempts++;
        }, 100);
      });

      // Step 3: Try deep link if address is available
      if (address) {
        toast.info(`Connecting via ${walletId}...`);
        const success = await walletDiscoveryService.tryMobileWallet(walletId, 'wc-session');

        if (success) {
          // Connection successful
          const walletName = mobileWallets.find((w) => w.id === walletId)?.name || walletId;
          
          // Attempt to register the wallet
          const registerSuccess = await connectWallet(walletId);
          if (registerSuccess) {
            toast.success(`${walletName} connected!`);
            setTimeout(() => onClose(), 1000);
          } else {
            toast.warning(`${walletName} opened. Please complete the connection.`);
          }
          return;
        }
      }

      // Step 4: Fallback to app store if wallet not installed
      const storeLink = walletDiscoveryService.getMobileStoreLink(walletId);
      if (storeLink) {
        const wallet = mobileWallets.find((w) => w.id === walletId);
        toast.info(`${wallet?.name} not installed. Opening app store...`);
        window.open(storeLink, '_blank');
      } else {
        toast.error('Wallet not found. Please try WalletConnect.');
      }
    } catch (err: any) {
      console.error('Mobile wallet connection failed:', err);
      toast.error(err.message || 'Failed to connect mobile wallet');
    } finally {
      setMobileConnectionAttempt(false);
      setActiveMobileWallet(null);
    }
  };

  const getWalletIcon = (walletId: string) => WALLET_ICONS[walletId] || '💼';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Connect Web3 Wallet
          </DialogTitle>
          <DialogDescription>
            {isMobile
              ? 'Choose your mobile wallet or use WalletConnect'
              : 'Select your installed wallet or use WalletConnect'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Wallet Discovery Status */}
          {isDiscovering && (
            <Alert className="bg-blue-50 border-blue-200">
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>Scanning for installed wallets...</AlertDescription>
            </Alert>
          )}

          {/* Error Message */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Platform Info */}
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
            {isMobile && (
              <div className="flex items-center gap-2">
                <Smartphone className="h-3 w-3" />
                <span>
                  {isAndroid ? 'Android' : isIOS ? 'iOS' : 'Mobile'} device detected
                </span>
              </div>
            )}
          </div>

          {/* Main Connection Tabs */}
          <Tabs defaultValue={isMobile ? 'mobile' : 'extensions'} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              {!isMobile && <TabsTrigger value="extensions">Extensions</TabsTrigger>}
              {isMobile && <TabsTrigger value="mobile">Mobile Wallets</TabsTrigger>}
              <TabsTrigger value="walletconnect">WalletConnect</TabsTrigger>
              <TabsTrigger value="manual">Manual</TabsTrigger>
            </TabsList>

            {/* Browser Extensions Tab */}
            {!isMobile && (
              <TabsContent value="extensions" className="space-y-3">
                {extensionWallets.length > 0 ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Detected Wallets</label>
                    <div className="grid grid-cols-2 gap-2">
                      {extensionWallets.map((wallet) => (
                        <Button
                          key={wallet.id}
                          onClick={() => setSelectedWallet(wallet.id)}
                          variant={
                            selectedWallet === wallet.id ? 'default' : 'outline'
                          }
                          className="flex items-center gap-2 justify-start"
                        >
                          <span className="text-lg">{getWalletIcon(wallet.id)}</span>
                          <span className="flex-1 text-left">{wallet.name}</span>
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      No browser wallets detected. Install MetaMask, Trust Wallet, or another
                      supported wallet extension.
                    </AlertDescription>
                  </Alert>
                )}
              </TabsContent>
            )}

            {/* Mobile Wallets Tab */}
            {isMobile && (
              <TabsContent value="mobile" className="space-y-3">
                {mobileWallets.length > 0 ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Available Wallets</label>
                    <div className="grid grid-cols-1 gap-2">
                      {mobileWallets.map((wallet) => (
                        <Button
                          key={wallet.id}
                          onClick={() => handleMobileWalletConnect(wallet.id)}
                          disabled={
                            mobileConnectionAttempt &&
                            activeMobileWallet !== wallet.id
                          }
                          variant={
                            activeMobileWallet === wallet.id ? 'default' : 'outline'
                          }
                          className="flex items-center gap-3 justify-between py-6"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{getWalletIcon(wallet.id)}</span>
                            <div className="text-left">
                              <div className="font-medium">{wallet.name}</div>
                              <div className="text-xs opacity-75">
                                {isAndroid ? 'Android' : 'iOS'} App
                              </div>
                            </div>
                          </div>
                          {activeMobileWallet === wallet.id &&
                            mobileConnectionAttempt && (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            )}
                          {!mobileConnectionAttempt && (
                            <ExternalLink className="h-4 w-4" />
                          )}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      No mobile wallets detected. Use WalletConnect or manually enter
                      your wallet address.
                    </AlertDescription>
                  </Alert>
                )}
              </TabsContent>
            )}

            {/* WalletConnect Tab */}
            <TabsContent value="walletconnect" className="space-y-3">
              <Alert className="bg-blue-50 border-blue-200">
                <AlertDescription>
                  WalletConnect supports 300+ wallets including all major protocols (Solana,
                  Cosmos, etc.)
                </AlertDescription>
              </Alert>
              <Button
                onClick={() => open()}
                className="w-full flex items-center gap-2"
                size="lg"
              >
                <span className="text-xl">🔗</span>
                Open WalletConnect
              </Button>
              {isConnected && chainId && (
                <p className="text-xs text-gray-500">
                  Connected to {CHAIN_NAMES[chainId] || `Chain ${chainId}`}
                </p>
              )}
            </TabsContent>

            {/* Manual Connection Tab */}
            <TabsContent value="manual" className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Manual Wallet Connection
                </label>
                <p className="text-sm text-gray-600 mb-4">
                  Click the button to manually open your wallet or use WalletConnect to
                  scan a QR code.
                </p>
                <Button onClick={() => open()} className="w-full" variant="secondary">
                  <Wallet className="mr-2 h-4 w-4" />
                  Open Wallet Provider
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          {/* Connection Step 2: Verify and Connect */}
          {!isMobile && isConnected && address && (
            <div className="space-y-3 pt-4 border-t">
              <div className="bg-green-50 rounded-lg p-3">
                <p className="text-sm text-green-800">
                  ✓ Connected: {address.slice(0, 6)}...{address.slice(-4)}
                </p>
                {chainId && (
                  <p className="text-xs text-green-700 mt-1">
                    Chain: {CHAIN_NAMES[chainId] || `Chain ${chainId}`}
                  </p>
                )}
              </div>

              {selectedWallet && (
                <Button
                  onClick={handleConnectWallet}
                  className="w-full"
                  disabled={isConnecting}
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Connect {selectedWallet}
                    </>
                  )}
                </Button>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1"
              disabled={isConnecting || mobileConnectionAttempt}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
