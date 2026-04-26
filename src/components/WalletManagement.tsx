import React, { useState } from 'react';
import { useWallet, ConnectedWallet } from '@/hooks/useWeb3Wallet';
import { CHAIN_NAMES } from '@/lib/web3Config';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { 
  Wallet, 
  Trash2, 
  Star, 
  Copy, 
  Check, 
  ShieldCheck, 
  AlertCircle, 
  Zap, 
  ExternalLink,
  RefreshCw,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';

export function WalletManagement() {
  const { 
    connectedWallets, 
    primaryWallet, 
    disconnectWallet, 
    setPrimaryWallet, 
    verifyWallet,
    isLoading,
    isConnecting,
    connectWallet,
    currentAddress,
    currentChainId
  } = useWallet();
  const [walletToDelete, setWalletToDelete] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedId(address);
    toast.success('Address copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleVerify = async (walletId: string) => {
    setVerifyingId(walletId);
    try {
      await verifyWallet(walletId);
    } finally {
      setVerifyingId(null);
    }
  };

  const handleConnectCurrent = async () => {
    if (!currentAddress) {
      toast.error('Please connect your wallet using the Web3 button first');
      return;
    }
    await connectWallet('walletconnect');
  };

  const isWalletConnected = (address: string) => {
    return connectedWallets.some(w => 
      w.wallet_address.toLowerCase() === address.toLowerCase()
    );
  };

  const getExplorerUrl = (address: string, chainId: number) => {
    const explorers: Record<number, string> = {
      1: 'https://etherscan.io',
      56: 'https://bscscan.com',
      137: 'https://polygonscan.com',
      42161: 'https://arbiscan.io',
      10: 'https://optimistic.etherscan.io',
      8453: 'https://basescan.org',
    };
    const base = explorers[chainId] || 'https://etherscan.io';
    return `${base}/address/${address}`;
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Connected Wallets</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your Web3 wallets and authorization for automated trading
          </p>
        </div>
        <div className="flex items-center gap-3">
          {currentAddress && !isWalletConnected(currentAddress) && (
            <Button 
              onClick={handleConnectCurrent}
              disabled={isConnecting}
              className="bg-primary hover:bg-primary/90"
            >
              {isConnecting ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Wallet className="w-4 h-4 mr-2" />
              )}
              Add Connected Wallet
            </Button>
          )}
          <div className="flex z-50">
            <w3m-button />
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      {connectedWallets.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-secondary/30">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground uppercase">Total Wallets</p>
              <p className="text-2xl font-bold">{connectedWallets.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-secondary/30">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground uppercase">Verified</p>
              <p className="text-2xl font-bold text-success">
                {connectedWallets.filter(w => w.verified).length}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-secondary/30">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground uppercase">Sweep Ready</p>
              <p className="text-2xl font-bold text-accent">
                {connectedWallets.filter(w => (w.allowance_amount || 0) > 0).length}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-secondary/30">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground uppercase">Primary</p>
              <p className="text-2xl font-bold text-primary">
                {primaryWallet ? 'Set' : 'None'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {connectedWallets.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="pt-8 pb-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Wallet className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No wallets connected</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                Connect your Web3 wallet to enable automated trading, deposits, and withdrawals.
              </p>
              <div className="flex justify-center gap-3">
                <w3m-button />
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {connectedWallets.map((wallet) => (
            <Card key={wallet.id} className={`overflow-hidden ${wallet.is_primary ? 'border-primary/50 ring-1 ring-primary/20' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-base font-mono">
                        {wallet.wallet_address.slice(0, 8)}...{wallet.wallet_address.slice(-6)}
                      </CardTitle>
                      {wallet.is_primary && (
                        <Badge className="bg-primary text-primary-foreground flex gap-1">
                          <Star className="h-3 w-3" />
                          Primary
                        </Badge>
                      )}
                      {wallet.verified ? (
                        <Badge variant="secondary" className="text-success flex gap-1">
                          <ShieldCheck className="h-3 w-3" />
                          Verified
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-warning flex gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Unverified
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="mt-1 flex items-center gap-2">
                      <span className="capitalize">{wallet.wallet_type}</span>
                      <span>•</span>
                      <span>{CHAIN_NAMES[wallet.chain_id] || `Chain ${wallet.chain_id}`}</span>
                      <span>•</span>
                      <span className="text-muted-foreground">ID: {wallet.chain_id}</span>
                    </CardDescription>
                  </div>
                  <a
                    href={getExplorerUrl(wallet.wallet_address, wallet.chain_id)}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 hover:bg-secondary rounded-full transition-colors"
                    title="View on explorer"
                  >
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </a>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                {/* Status Badges Row */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {(wallet.allowance_amount || 0) > 0 && (
                    <Badge className="bg-accent/10 text-accent border-accent/20 flex gap-1">
                      <Zap className="h-3 w-3" />
                      Sweep Ready • {wallet.token_approved || 'Tokens'}
                    </Badge>
                  )}
                  {wallet.last_approval_at && (
                    <Badge variant="outline" className="text-[10px]">
                      <Clock className="h-3 w-3 mr-1" />
                      Approved: {new Date(wallet.last_approval_at).toLocaleDateString()}
                    </Badge>
                  )}
                  {!wallet.is_active && (
                    <Badge variant="destructive">Inactive</Badge>
                  )}
                </div>

                {/* Connection Info */}
                <div className="text-xs text-muted-foreground mb-4 space-y-1">
                  <p>Connected: {new Date(wallet.connected_at).toLocaleDateString()}</p>
                  {wallet.verified_at && (
                    <p>Verified: {new Date(wallet.verified_at).toLocaleDateString()}</p>
                  )}
                  {wallet.last_used_at && (
                    <p>Last active: {new Date(wallet.last_used_at).toLocaleDateString()}</p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyAddress(wallet.wallet_address)}
                  >
                    {copiedId === wallet.wallet_address ? (
                      <>
                        <Check className="mr-1 h-3 w-3 text-success" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="mr-1 h-3 w-3" />
                        Copy
                      </>
                    )}
                  </Button>

                  {!wallet.verified && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleVerify(wallet.id)}
                      disabled={verifyingId === wallet.id}
                      className="text-warning border-warning/50 hover:bg-warning/10"
                    >
                      {verifyingId === wallet.id ? (
                        <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <ShieldCheck className="mr-1 h-3 w-3" />
                      )}
                      Verify
                    </Button>
                  )}

                  {!wallet.is_primary && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPrimaryWallet(wallet.id)}
                      disabled={isLoading}
                    >
                      <Star className="mr-1 h-3 w-3" />
                      Set Primary
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto"
                    onClick={() => setWalletToDelete(wallet.id)}
                  >
                    <Trash2 className="mr-1 h-3 w-3" />
                    Remove
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Info Card */}
      {connectedWallets.length > 0 && (
        <Card className="bg-secondary/20 border-dashed">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded-full">
                <Zap className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold text-sm">Automated Trading</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  To enable automated token sweeps, go to the "Automated Trading" tab and authorize 
                  the platform to access your tokens. This requires a one-time approval transaction.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!walletToDelete} onOpenChange={(open) => !open && setWalletToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Wallet</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this wallet connection? This action cannot be undone.
              {(() => {
                const wallet = connectedWallets.find(w => w.id === walletToDelete);
                return wallet ? (
                  <div className="mt-2 p-2 bg-secondary rounded text-xs font-mono">
                    {wallet.wallet_address.slice(0, 12)}...{wallet.wallet_address.slice(-8)}
                  </div>
                ) : null;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (walletToDelete) {
                  await disconnectWallet(walletToDelete);
                  setWalletToDelete(null);
                }
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
