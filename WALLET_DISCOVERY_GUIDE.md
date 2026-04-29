# Wallet Discovery & Detection System

## Overview

PoolTradePlug now includes a comprehensive wallet discovery system that automatically detects installed wallets across:
- **Browser Extensions** (Desktop)
- **Mobile Apps** (Android & iOS)
- **WalletConnect** (Universal fallback)

The system uses multiple detection methods including EIP6963 provider discovery, deep links, and user agent detection.

## Features

### 1. **Automatic Wallet Detection**
- Scans for installed browser extensions using `window.ethereum` property checks
- Detects wallet-specific flags (`isMetaMask`, `isTrust`, `isPhantom`, etc.)
- Implements EIP6963 standard for universal provider discovery
- Returns installed wallets sorted by priority

### 2. **Mobile Platform Detection**
- Automatic Android detection via user agent
- Automatic iOS detection via user agent
- Web view detection for in-app browsers
- Platform-specific deep links for each wallet

### 3. **Multi-Chain Support**
- **EVM Chains**: Ethereum, BSC, Polygon, Arbitrum, Optimism, Base
- **Solana**: Via Phantom wallet
- **Cosmos**: Via Keplr (when available)

### 4. **Supported Wallets**

#### Browser Extensions (Desktop)
✅ MetaMask  
✅ Trust Wallet  
✅ Phantom (EVM mode)  
✅ SafePal  
✅ Coinbase Wallet  
✅ Exodus  
✅ Ledger  
✅ Frame  
✅ Plus any EIP6963-compatible wallet

#### Mobile Apps
✅ MetaMask  
✅ Trust Wallet  
✅ Phantom  
✅ Exodus  
✅ SafePal  
✅ Coinbase Wallet  
✅ Halo Wallet  
✅ OKX Wallet

## Architecture

### Core Components

#### 1. **WalletDiscoveryService** (`src/lib/walletDiscovery.ts`)
```typescript
// Main discovery service with caching and multiple detection methods
class WalletDiscoveryService {
  async discoverWallets(): Promise<DetectedWallet[]>;
  async getWalletsByType(): Promise<{
    extensions: DetectedWallet[];
    mobile: DetectedWallet[];
    other: DetectedWallet[];
  }>;
  isMobile(): boolean;
  isAndroid(): boolean;
  isIOS(): boolean;
  async tryMobileWallet(walletId: string, uri: string): Promise<boolean>;
  getMobileStoreLink(walletId: string): string | null;
}
```

#### 2. **EIP6963Discovery** (Internal)
- Listens to `eip6963:requestProvider` events
- Automatically detects all injected providers
- Works with any EIP6963-compatible wallet

#### 3. **BrowserExtensionDetector** (Internal)
- Detects standard `window.ethereum` injections
- Checks wallet-specific provider flags
- Returns extensions sorted by priority

#### 4. **MobileWalletDetector** (Internal)
- Detects platform (Android vs iOS)
- Generates platform-specific deep links
- Handles wallet app store links
- Timeout fallback to app store if wallet not installed

## Usage

### React Hook

```typescript
import { useWallet } from '@/hooks/useWeb3Wallet';

function MyComponent() {
  const {
    getInstalledWallets,        // Get array of installed wallet IDs
    isWalletInstalled,          // Check if specific wallet is installed
    isMobile,                   // Check if on mobile device
    isAndroid,                  // Check if Android
    isIOS,                      // Check if iOS
    detectWalletType,           // Detect wallet from provider
    openWalletDeepLink,         // Open wallet on mobile
  } = useWallet();

  // Get all installed wallets
  const installed = getInstalledWallets();

  // Check specific wallet
  if (isWalletInstalled('metamask')) {
    // MetaMask is installed
  }

  // Platform detection
  if (isMobile()) {
    if (isAndroid()) {
      // Android-specific logic
    } else if (isIOS()) {
      // iOS-specific logic
    }
  }
}
```

### Direct Service Usage

```typescript
import { walletDiscoveryService } from '@/lib/walletDiscovery';

// Initialize (call once on app load)
await walletDiscoveryService.initialize();

// Discover wallets
const wallets = await walletDiscoveryService.discoverWallets();
// Returns: [
//   { id: 'metamask', name: 'MetaMask', type: 'extension', installed: true, priority: 10 },
//   { id: 'walletconnect', name: 'WalletConnect', type: 'walletconnect', installed: true, priority: 0 }
// ]

// Group by type
const byType = await walletDiscoveryService.getWalletsByType();
console.log(byType.extensions);  // Browser extensions
console.log(byType.mobile);      // Mobile wallets
console.log(byType.other);       // Other (WalletConnect)

// Platform checks
if (walletDiscoveryService.isMobile()) {
  // Open wallet on mobile
  await walletDiscoveryService.tryMobileWallet('metamask-mobile', wcUri);
}
```

## Implementation Details

### Browser Extension Detection

```typescript
// 1. EIP6963 Discovery
window.addEventListener('eip6963:announceProvider', (event) => {
  // Wallet announces itself
});
window.dispatchEvent(new Event('eip6963:requestProvider'));

// 2. Standard window.ethereum checks
const provider = window.ethereum;
if (provider?.isMetaMask) {
  // MetaMask is installed
}

// 3. Priority-based sorting
// Higher priority = shown first
```

### Mobile Detection

```typescript
// Platform detection
const isAndroid = /android/i.test(navigator.userAgent);
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const isWebView = /WebView|wv/.test(navigator.userAgent);

// Deep link attempt with timeout fallback
window.location.href = 'metamask://wc?uri={uri}';
setTimeout(() => {
  // Fallback to app store if wallet didn't open
  window.location.href = 'https://play.google.com/store/apps/details?id=io.metamask';
}, 1500);
```

## Deep Link Patterns

### MetaMask
- Desktop: N/A
- Android: `metamask://wc?uri={uri}`
- iOS: `metamask://wc?uri={uri}`

### Trust Wallet
- Desktop: N/A
- Android: `trust://wc?uri={uri}`
- iOS: `trust://wc?uri={uri}`

### Phantom
- Desktop: Extension
- Android: `phantom://browse/{url}?wc={uri}`
- iOS: `phantom://browse/{url}?wc={uri}`

### SafePal
- Desktop: Extension
- Android: `safepal://wc?uri={uri}`
- iOS: `safepal://wc?uri={uri}`

## Performance Optimization

### Caching
- Results cached for 5 seconds by default
- Reduces repeated detection calls
- Call `walletDiscoveryService.clearCache()` to refresh

### Lazy Loading
- EIP6963 initialized on demand
- Detection happens in background
- Doesn't block UI rendering

### Priority System
- Most popular wallets shown first
- User's previously used wallet prioritized
- Fallback to WalletConnect if no installed wallet

## Error Handling

```typescript
// Graceful degradation
try {
  const wallets = await walletDiscoveryService.discoverWallets();
} catch (err) {
  // Always fallback to WalletConnect
  const fallback = {
    id: 'walletconnect',
    name: 'WalletConnect',
    type: 'walletconnect',
    installed: true,
  };
}

// Mobile wallet timeout
const success = await walletDiscoveryService.tryMobileWallet(walletId, uri);
if (!success) {
  // Open app store instead
  const storeLink = walletDiscoveryService.getMobileStoreLink(walletId);
  if (storeLink) {
    window.open(storeLink, '_blank');
  }
}
```

## Device Detection Examples

### Android Chrome
```
Mozilla/5.0 (Linux; Android 12; SM-G950F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36
```
Detected as: ✅ Android, ✅ Mobile

### iOS Safari
```
Mozilla/5.0 (iPhone; CPU iPhone OS 16_7_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.7.2 Mobile/15E148 Safari/604.1
```
Detected as: ✅ iOS, ✅ Mobile

### MetaMask Mobile (In-app Browser)
```
Mozilla/5.0 (iPhone; CPU iPhone OS 16_7_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) MetaMask Safari/605.1.15
```
Detected as: ✅ iOS, ✅ Mobile, ✅ WebView, ✅ MetaMask available

### Desktop Chrome with MetaMask
```
Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36
window.ethereum.isMetaMask = true
```
Detected as: ✅ Desktop, ✅ MetaMask installed

## Testing Wallet Detection

```typescript
// In browser console
import { walletDiscoveryService } from '@/lib/walletDiscovery';

// Check discovered wallets
const wallets = await walletDiscoveryService.discoverWallets();
console.table(wallets);

// Check by type
const byType = await walletDiscoveryService.getWalletsByType();
console.log('Extensions:', byType.extensions);
console.log('Mobile:', byType.mobile);

// Platform detection
console.log('isMobile:', walletDiscoveryService.isMobile());
console.log('isAndroid:', walletDiscoveryService.isAndroid());
console.log('isIOS:', walletDiscoveryService.isIOS());
```

## UI/UX Patterns

### Desktop
1. Show detected extensions with install badges
2. Prioritize by popularity and user history
3. Show WalletConnect as fallback
4. Allow manual entry of wallet address

### Mobile
1. Show deep links for installed apps
2. Show "Get Wallet" links to app stores
3. Default to WalletConnect QR code
4. Detect if in MetaMask/Trust Wallet in-app browser

### Error States
1. No wallets detected → Show installation guide
2. Wallet not installed → Show app store link
3. Deep link failed → Show WalletConnect option
4. Connection timeout → Clear error and retry

## Best Practices

### For Developers
1. Always initialize discovery service on app load
2. Cache results to reduce detection overhead
3. Provide WalletConnect as fallback
4. Handle deep link timeouts gracefully
5. Test on actual devices (Android/iOS)

### For Users
1. Install wallet extensions on desktop
2. Use native mobile wallet apps when possible
3. Keep wallets updated to latest version
4. Report detection issues to wallet teams

## Migration from V1

If upgrading from the old wallet detection:

```typescript
// OLD (Still works)
import { useWeb3Wallet } from '@/hooks/useWeb3Wallet';
const { connectWallet } = useWallet();

// NEW (Enhanced with discovery)
import { useWallet } from '@/hooks/useWeb3Wallet';
import { walletDiscoveryService } from '@/lib/walletDiscovery';

// Use discovery first
const wallets = await walletDiscoveryService.discoverWallets();
// Then show UI and connect
```

## Troubleshooting

### Wallets Not Detected
1. Check if wallet extension is installed
2. Check if wallet is enabled
3. Try refreshing the page
4. Clear browser cache
5. Check browser console for errors

### Mobile Deep Links Not Working
1. Ensure wallet app is installed
2. Check deep link format matches wallet
3. Verify WalletConnect URI is valid
4. Check device notification permissions

### EIP6963 Not Working
1. Wallet must support EIP6963 standard
2. Some older wallets may not support it
3. Use fallback detection methods

## Future Enhancements

- [ ] Solana wallet detection (Magic Eden, Solanium)
- [ ] Cosmos wallet detection (Keplr, Leap)
- [ ] Aptos wallet detection
- [ ] SUI wallet detection
- [ ] Hardware wallet support (Ledger, Trezor live app)
- [ ] Wallet version detection
- [ ] Capability matrix (which RPC methods supported)
- [ ] User preference persistence
- [ ] Auto-switch to best available wallet

## References

- [EIP6963 Specification](https://eips.ethereum.org/EIPS/eip-6963)
- [Web3Modal Documentation](https://docs.walletconnect.com/appkit/overview)
- [MetaMask Provider API](https://docs.metamask.io/guide/provider-integration.html)
- [Mobile Linking Standards](https://docs.walletconnect.com/1.0/mobile-linking)
