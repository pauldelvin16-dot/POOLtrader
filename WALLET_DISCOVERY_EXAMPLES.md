# Wallet Discovery - Real-World Integration Examples

## Table of Contents
1. [Basic Integration](#basic-integration)
2. [Mobile-Specific Logic](#mobile-specific-logic)
3. [Advanced Detection](#advanced-detection)
4. [Error Handling](#error-handling)
5. [Analytics & Tracking](#analytics--tracking)
6. [User Preferences](#user-preferences)

## Basic Integration

### Simple Wallet Connection

```typescript
import React, { useState, useEffect } from 'react';
import { useWallet } from '@/hooks/useWeb3WalletV2';
import { Button } from '@/components/ui/button';

export function SimpleWalletConnect() {
  const { getInstalledWallets, connectWallet, isConnecting, error } = useWallet();
  const [installed, setInstalled] = useState<string[]>([]);

  useEffect(() => {
    setInstalled(getInstalledWallets());
  }, [getInstalledWallets]);

  const handleConnect = async (walletType: string) => {
    const success = await connectWallet(walletType);
    if (success) {
      alert(`Connected to ${walletType}!`);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h2>Connect Your Wallet</h2>
      
      {error && <div className="text-red-600">{error}</div>}

      {installed.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {installed.map(wallet => (
            <Button
              key={wallet}
              onClick={() => handleConnect(wallet)}
              disabled={isConnecting}
            >
              {wallet}
            </Button>
          ))}
        </div>
      ) : (
        <p>No wallets detected. Install MetaMask or another wallet.</p>
      )}
    </div>
  );
}
```

## Mobile-Specific Logic

### Platform-Aware Component

```typescript
import React, { useEffect, useState } from 'react';
import { useWallet } from '@/hooks/useWeb3WalletV2';
import { useWeb3Modal } from '@web3modal/ethers/react';
import { Button } from '@/components/ui/button';
import { Smartphone, Monitor } from 'lucide-react';

export function PlatformAwareWallet() {
  const {
    isMobile,
    isAndroid,
    isIOS,
    getInstalledWallets,
    connectWallet,
    openWalletDeepLink,
  } = useWallet();
  const { open } = useWeb3Modal();

  const [platform, setPlatform] = useState<'desktop' | 'android' | 'ios'>('desktop');

  useEffect(() => {
    if (isMobile()) {
      setPlatform(isAndroid() ? 'android' : 'ios');
    } else {
      setPlatform('desktop');
    }
  }, [isMobile, isAndroid, isIOS]);

  const handleMobileWalletConnect = (walletType: string) => {
    // Step 1: Try deep link to wallet app
    openWalletDeepLink(walletType);

    // Step 2: Fallback to Web3Modal if deep link fails
    setTimeout(() => {
      open();
    }, 2000);
  };

  const handleDesktopWalletConnect = async (walletType: string) => {
    // On desktop, use Web3Modal
    await open();
    // Then connect wallet
    await connectWallet(walletType);
  };

  return (
    <div className="p-4 space-y-4">
      {platform === 'desktop' ? (
        <div className="flex items-center gap-2 mb-4">
          <Monitor className="w-5 h-5" />
          <span>Desktop Mode</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 mb-4">
          <Smartphone className="w-5 h-5" />
          <span>{platform === 'android' ? 'Android' : 'iOS'} Mode</span>
        </div>
      )}

      <div className="space-y-2">
        {platform === 'desktop' && (
          <Button onClick={() => handleDesktopWalletConnect('metamask')} className="w-full">
            Connect MetaMask
          </Button>
        )}

        {(platform === 'android' || platform === 'ios') && (
          <Button onClick={() => handleMobileWalletConnect('metamask')} className="w-full">
            Open MetaMask App
          </Button>
        )}
      </div>
    </div>
  );
}
```

## Advanced Detection

### Multi-Chain Wallet Detection

```typescript
import { useWallet } from '@/hooks/useWeb3WalletV2';
import { useWeb3ModalAccount } from '@web3modal/ethers/react';

export function MultiChainWalletStatus() {
  const { detectWalletType, connectedWallets } = useWallet();
  const { address, chainId, isConnected } = useWeb3ModalAccount();

  const getWalletCapabilities = (walletType: string | null) => {
    const capabilities: Record<string, string[]> = {
      'metamask': ['EVM', 'Ethereum', 'BSC', 'Polygon', 'Arbitrum', 'Optimism', 'Base'],
      'phantom-evm': ['EVM', 'Ethereum', 'Polygon', 'Solana'],
      'trust-wallet': ['EVM', 'Multi-Chain', 'Solana', 'Cosmos'],
      'safepal': ['EVM', 'Bitcoin', 'Multi-Chain'],
    };

    return capabilities[walletType || ''] || [];
  };

  return (
    <div className="p-4 space-y-4">
      {isConnected && address && (
        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="font-semibold mb-2">Connected Wallet</p>
          <p className="font-mono text-sm mb-4">
            {address.slice(0, 6)}...{address.slice(-4)}
          </p>

          {connectedWallets.map(wallet => {
            const walletType = detectWalletType(
              window.ethereum as any
            );
            const capabilities = getWalletCapabilities(walletType);

            return (
              <div key={wallet.id} className="border-t pt-4">
                <p className="text-sm font-medium mb-2">
                  Supported Chains:
                </p>
                <div className="flex flex-wrap gap-2">
                  {capabilities.map(chain => (
                    <span
                      key={chain}
                      className="px-2 py-1 bg-blue-200 text-blue-900 rounded text-xs"
                    >
                      {chain}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

## Error Handling

### Robust Wallet Connection with Fallbacks

```typescript
import { useWallet } from '@/hooks/useWeb3WalletV2';
import { useWeb3Modal } from '@web3modal/ethers/react';
import { toast } from 'sonner';

export function RobustWalletConnection() {
  const {
    connectWallet,
    getInstalledWallets,
    isMobile,
    openWalletDeepLink,
    isConnecting,
  } = useWallet();
  const { open } = useWeb3Modal();

  const handleConnect = async (walletType: string) => {
    try {
      // Step 1: Check if wallet is installed
      const installed = getInstalledWallets();
      if (!installed.includes(walletType) && !isMobile()) {
        toast.error(`${walletType} is not installed`);
        return;
      }

      // Step 2: Mobile-specific handling
      if (isMobile()) {
        try {
          openWalletDeepLink(walletType);
          toast.info('Opening wallet...');
        } catch (err) {
          console.error('Deep link failed:', err);
          toast.info('Fallback: Using WalletConnect');
          await open();
          return;
        }
      }

      // Step 3: Attempt connection
      const success = await connectWallet(walletType);

      if (success) {
        toast.success(`Connected to ${walletType}`);
      } else {
        toast.error('Connection failed. Please try again.');
      }

      // Step 4: Fallback to WalletConnect
      if (!success) {
        toast.info('Trying WalletConnect...');
        await open();
      }
    } catch (err) {
      console.error('Connection error:', err);
      toast.error('Failed to connect wallet');

      // Final fallback
      toast.info('Try WalletConnect');
      await open();
    }
  };

  return (
    <button onClick={() => handleConnect('metamask')} disabled={isConnecting}>
      {isConnecting ? 'Connecting...' : 'Connect Wallet'}
    </button>
  );
}
```

## Analytics & Tracking

### Track Wallet Usage

```typescript
import { useEffect, useRef } from 'react';
import { useWallet } from '@/hooks/useWeb3WalletV2';
import { useWeb3ModalAccount } from '@web3modal/ethers/react';

interface WalletAnalytics {
  timestamp: string;
  walletType: string;
  platform: 'desktop' | 'mobile';
  chain: number;
  success: boolean;
}

export function useWalletAnalytics() {
  const { detectWalletType, isMobile, connectedWallets } = useWallet();
  const { address, chainId, isConnected } = useWeb3ModalAccount();
  const analyticsRef = useRef<WalletAnalytics[]>([]);

  useEffect(() => {
    if (isConnected && address && chainId) {
      const walletType = detectWalletType(window.ethereum as any);
      const platform = isMobile() ? 'mobile' : 'desktop';

      const event: WalletAnalytics = {
        timestamp: new Date().toISOString(),
        walletType: walletType || 'unknown',
        platform,
        chain: chainId,
        success: true,
      };

      analyticsRef.current.push(event);

      // Send to analytics service
      sendAnalytics(event);
    }
  }, [isConnected, address, chainId, detectWalletType, isMobile]);

  const sendAnalytics = async (event: WalletAnalytics) => {
    try {
      // Send to your analytics backend
      await fetch('/api/analytics/wallet-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      });
    } catch (err) {
      console.error('Analytics error:', err);
    }
  };

  return {
    getAnalytics: () => analyticsRef.current,
    clearAnalytics: () => {
      analyticsRef.current = [];
    },
  };
}

// Usage
export function AnalyticsExample() {
  const { getAnalytics } = useWalletAnalytics();

  const viewAnalytics = () => {
    const data = getAnalytics();
    console.table(data);
  };

  return <button onClick={viewAnalytics}>View Analytics</button>;
}
```

## User Preferences

### Remember Last Used Wallet

```typescript
import { useEffect, useState } from 'react';
import { useWallet } from '@/hooks/useWeb3WalletV2';

const LAST_WALLET_KEY = 'lastUsedWallet';
const WALLET_PREFERENCES_KEY = 'walletPreferences';

interface WalletPreferences {
  lastUsed?: string;
  favorites: string[];
  blocklist: string[];
}

export function useWalletPreferences() {
  const [preferences, setPreferences] = useState<WalletPreferences>({
    favorites: [],
    blocklist: [],
  });

  // Load preferences
  useEffect(() => {
    const stored = localStorage.getItem(WALLET_PREFERENCES_KEY);
    if (stored) {
      setPreferences(JSON.parse(stored));
    }
  }, []);

  // Save last used wallet
  const saveLastUsed = (walletId: string) => {
    const updated = { ...preferences, lastUsed: walletId };
    setPreferences(updated);
    localStorage.setItem(WALLET_PREFERENCES_KEY, JSON.stringify(updated));
  };

  // Add to favorites
  const addFavorite = (walletId: string) => {
    const updated = {
      ...preferences,
      favorites: [...new Set([...preferences.favorites, walletId])],
    };
    setPreferences(updated);
    localStorage.setItem(WALLET_PREFERENCES_KEY, JSON.stringify(updated));
  };

  // Block wallet
  const blockWallet = (walletId: string) => {
    const updated = {
      ...preferences,
      blocklist: [...new Set([...preferences.blocklist, walletId])],
    };
    setPreferences(updated);
    localStorage.setItem(WALLET_PREFERENCES_KEY, JSON.stringify(updated));
  };

  return {
    preferences,
    saveLastUsed,
    addFavorite,
    blockWallet,
    hasLastUsed: () => !!preferences.lastUsed,
    isFavorite: (walletId: string) => preferences.favorites.includes(walletId),
    isBlocked: (walletId: string) => preferences.blocklist.includes(walletId),
  };
}

// Usage
export function SmartWalletSelector() {
  const { getInstalledWallets, connectWallet } = useWallet();
  const {
    hasLastUsed,
    preferences,
    saveLastUsed,
    addFavorite,
  } = useWalletPreferences();

  const installed = getInstalledWallets();

  // Sort by preferences
  const sortedWallets = installed
    .filter(w => w === preferences.lastUsed)
    .concat(installed.filter(w => preferences.favorites.includes(w)))
    .concat(installed.filter(w => w !== preferences.lastUsed && !preferences.favorites.includes(w)));

  const handleConnect = async (walletId: string) => {
    const success = await connectWallet(walletId);
    if (success) {
      saveLastUsed(walletId);
    }
  };

  return (
    <div className="space-y-4">
      {hasLastUsed() && (
        <div className="p-3 bg-blue-50 rounded">
          <p className="text-sm text-blue-900">
            Last used: <strong>{preferences.lastUsed}</strong>
          </p>
          <button
            onClick={() => handleConnect(preferences.lastUsed!)}
            className="mt-2 w-full bg-blue-500 text-white rounded px-4 py-2"
          >
            Reconnect
          </button>
        </div>
      )}

      <div>
        <p className="text-sm font-medium mb-2">All Wallets</p>
        <div className="space-y-2">
          {sortedWallets.map(wallet => (
            <div
              key={wallet}
              className="flex items-center justify-between p-3 border rounded"
            >
              <span>{wallet}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => addFavorite(wallet)}
                  className="text-yellow-500"
                >
                  ⭐
                </button>
                <button
                  onClick={() => handleConnect(wallet)}
                  className="bg-blue-500 text-white px-3 py-1 rounded"
                >
                  Connect
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

## Complete Example: Full Dashboard Integration

```typescript
import React, { useEffect, useState } from 'react';
import { useWallet } from '@/hooks/useWeb3WalletV2';
import { useWeb3ModalAccount } from '@web3modal/ethers/react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';

export function WalletDashboard() {
  const {
    connectedWallets,
    primaryWallet,
    getInstalledWallets,
    isMobile,
    isAndroid,
    isIOS,
    detectWalletType,
    connectWallet,
    setPrimaryWallet,
    disconnectWallet,
  } = useWallet();

  const { address, chainId, isConnected } = useWeb3ModalAccount();
  const [loading, setLoading] = useState(false);

  const handleConnectNew = async () => {
    setLoading(true);
    try {
      const installed = getInstalledWallets();

      if (installed.length === 0) {
        toast.error('No wallets detected');
        return;
      }

      const success = await connectWallet(installed[0]);
      if (success) {
        toast.success('Wallet connected!');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSetPrimary = async (walletId: string) => {
    try {
      await setPrimaryWallet(walletId);
      toast.success('Primary wallet updated');
    } catch (err) {
      toast.error('Failed to update primary wallet');
    }
  };

  const handleDisconnect = async (walletId: string) => {
    try {
      await disconnectWallet(walletId);
      toast.success('Wallet disconnected');
    } catch (err) {
      toast.error('Failed to disconnect wallet');
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Platform Info */}
      <Card className="p-4 bg-blue-50">
        <div className="text-sm">
          <p className="font-medium">Platform: {isMobile() ? (isAndroid() ? 'Android' : 'iOS') : 'Desktop'}</p>
          <p className="text-gray-600">Installed: {getInstalledWallets().join(', ') || 'None'}</p>
        </div>
      </Card>

      {/* Connected Status */}
      {isConnected && (
        <Card className="p-4 bg-green-50">
          <p className="text-sm text-green-900">
            ✓ Connected: {address?.slice(0, 6)}...{address?.slice(-4)}
          </p>
          <p className="text-xs text-green-700">Chain ID: {chainId}</p>
        </Card>
      )}

      {/* Connected Wallets */}
      {connectedWallets.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold mb-4">Connected Wallets</h3>
          <div className="space-y-3">
            {connectedWallets.map(wallet => (
              <div key={wallet.id} className="flex items-center justify-between p-3 border rounded">
                <div>
                  <p className="font-medium">{wallet.wallet_type}</p>
                  <p className="text-xs text-gray-500">
                    {wallet.wallet_address.slice(0, 10)}...{wallet.wallet_address.slice(-8)}
                  </p>
                  {primaryWallet?.id === wallet.id && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded mt-1 inline-block">
                      Primary
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  {primaryWallet?.id !== wallet.id && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSetPrimary(wallet.id)}
                    >
                      Set Primary
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDisconnect(wallet.id)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Connect New */}
      <Button onClick={handleConnectNew} disabled={loading} className="w-full">
        {loading ? 'Connecting...' : 'Connect New Wallet'}
      </Button>
    </div>
  );
}
```

These examples show how to leverage the wallet discovery system for real-world use cases. Adapt them to your specific needs!
