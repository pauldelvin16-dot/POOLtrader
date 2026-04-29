# Wallet Discovery - Quick Reference Card

## 🚀 Getting Started (2 minutes)

```typescript
// 1. Initialize on app load
import { walletDiscoveryService } from '@/lib/walletDiscovery';
useEffect(() => walletDiscoveryService.initialize(), []);

// 2. Use the hook
import { useWallet } from '@/hooks/useWeb3WalletV2';
const { getInstalledWallets, connectWallet } = useWallet();

// 3. Connect wallet
const success = await connectWallet('metamask');
```

## 📍 API Quick Reference

### WalletDiscoveryService

```typescript
import { walletDiscoveryService } from '@/lib/walletDiscovery';

// Discover wallets
const wallets = await walletDiscoveryService.discoverWallets();

// Get by type
const byType = await walletDiscoveryService.getWalletsByType();
// { extensions: [...], mobile: [...], other: [...] }

// Platform checks
const isMobile = walletDiscoveryService.isMobile();
const isAndroid = walletDiscoveryService.isAndroid();
const isIOS = walletDiscoveryService.isIOS();

// Cache management
walletDiscoveryService.clearCache();
walletDiscoveryService.setCacheDuration(10000);

// Deep link for mobile
const success = await walletDiscoveryService.tryMobileWallet('metamask', uri);

// Get app store link
const link = walletDiscoveryService.getMobileStoreLink('metamask');
```

### useWallet Hook

```typescript
import { useWallet } from '@/hooks/useWeb3WalletV2';

const {
  // Wallet management
  connectWallet,              // (walletType: string) => Promise<boolean>
  disconnectWallet,           // (walletId: string) => Promise<void>
  setPrimaryWallet,           // (walletId: string) => Promise<void>
  verifyWallet,               // (walletId: string) => Promise<void>
  
  // Detection
  getInstalledWallets,        // () => string[]
  isWalletInstalled,          // (walletId: string) => boolean
  detectWalletType,           // (provider: any) => string
  
  // Platform detection
  isMobile,                   // () => boolean
  isAndroid,                  // () => boolean
  isIOS,                      // () => boolean
  
  // Mobile
  openWalletDeepLink,         // (walletType: string) => Promise<void>
  
  // State
  connectedWallets,           // WalletRecord[]
  primaryWallet,              // WalletRecord | null
  isConnecting,               // boolean
  error,                      // string | null
} = useWallet();
```

## 🎯 Common Patterns

### Show Detected Wallets

```typescript
const { getInstalledWallets, connectWallet } = useWallet();

const installed = getInstalledWallets();
{installed.map(wallet => (
  <button key={wallet} onClick={() => connectWallet(wallet)}>
    {wallet}
  </button>
))}
```

### Platform-Specific Logic

```typescript
const { isMobile, isAndroid, isIOS } = useWallet();

if (isMobile()) {
  if (isAndroid()) {
    // Android-specific code
  } else if (isIOS()) {
    // iOS-specific code
  }
} else {
  // Desktop-specific code
}
```

### Check Wallet Installation

```typescript
const { isWalletInstalled } = useWallet();

if (isWalletInstalled('metamask')) {
  // Show MetaMask button
} else {
  // Show install link
}
```

### Mobile Wallet Connection

```typescript
const { openWalletDeepLink } = useWallet();

const handleMobileConnect = async (walletType) => {
  // Try to open wallet app
  await openWalletDeepLink(walletType);
  
  // Fallback to WalletConnect after timeout
  setTimeout(() => {
    open(); // Web3Modal open
  }, 2000);
};
```

### Remember Last Used

```typescript
const { connectWallet } = useWallet();

const saveLastWallet = (walletType) => {
  localStorage.setItem('lastWallet', walletType);
};

const connectLastWallet = async () => {
  const last = localStorage.getItem('lastWallet');
  if (last) {
    await connectWallet(last);
  }
};
```

## 🌐 Supported Wallets

### Desktop Extensions
`metamask` | `trust-wallet` | `phantom-evm` | `safepal` | `coinbase-wallet` | `exodus` | `ledger` | `frame`

### Mobile Apps
`metamask-mobile` | `trust-wallet-mobile` | `phantom-mobile` | `exodus-mobile` | `safepal-mobile` | `coinbase-wallet-mobile` | `halo-wallet` | `okx-wallet`

### Universal
`walletconnect` | `manual-entry`

## 🔗 Deep Links

```typescript
// MetaMask
metamask://wc?uri={uri}

// Trust Wallet
trust://wc?uri={uri}

// Phantom
phantom://browse/{url}?wc={uri}

// SafePal
safepal://wc?uri={uri}
```

## 📱 Platform Detection

```typescript
// Detect Android
/android/i.test(navigator.userAgent)

// Detect iOS
/iphone|ipad|ipod/i.test(navigator.userAgent)

// Detect WebView
/WebView|wv/.test(navigator.userAgent)

// In-app browser
navigator.userAgent.includes('MetaMask')
```

## ⚙️ Configuration

### Environment Variables

```env
VITE_WEB3_PROJECT_ID=your_walletconnect_id
ALCHEMY_API_KEY=your_alchemy_key
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_key
```

### Customize Discovery

```typescript
import { walletDiscoveryService } from '@/lib/walletDiscovery';

// Set cache duration (milliseconds)
walletDiscoveryService.setCacheDuration(10000);

// Clear cache
walletDiscoveryService.clearCache();

// Get stats
const stats = walletDiscoveryService.getCacheStats();
```

## 🚨 Error Handling

```typescript
try {
  const success = await connectWallet('metamask');
  if (!success) {
    // Fallback to WalletConnect
    open();
  }
} catch (err) {
  // Handle error
  console.error('Connection failed:', err);
}
```

## 📊 Debugging

```typescript
// In browser console

// Check discovered wallets
const wallets = await walletDiscoveryService.discoverWallets();
console.table(wallets);

// Check platform
console.log({
  userAgent: navigator.userAgent,
  isMobile: walletDiscoveryService.isMobile(),
  isAndroid: walletDiscoveryService.isAndroid(),
  isIOS: walletDiscoveryService.isIOS(),
});

// Check provider
console.log(window.ethereum);

// Clear cache
walletDiscoveryService.clearCache();
```

## 🧪 Testing Commands

```bash
# Run dev server
npm run dev

# Open wallet discovery modal
# Navigate to http://localhost:5173/dashboard/web3-wallet

# Test in Android emulator
# Device emulation in Chrome DevTools

# Test on physical device
# Use ngrok for local testing: ngrok http 5173
```

## 📚 Documentation

| File | Purpose |
|------|---------|
| [WALLET_DISCOVERY_GUIDE.md](./WALLET_DISCOVERY_GUIDE.md) | Full technical docs |
| [WALLET_DISCOVERY_IMPLEMENTATION.md](./WALLET_DISCOVERY_IMPLEMENTATION.md) | Integration guide |
| [WALLET_DISCOVERY_EXAMPLES.md](./WALLET_DISCOVERY_EXAMPLES.md) | Code examples |
| [WALLET_DISCOVERY_SYSTEM.md](./WALLET_DISCOVERY_SYSTEM.md) | Complete summary |

## 🔍 Type Reference

```typescript
// Detected wallet
interface DetectedWallet {
  id: string;
  name: string;
  type: 'extension' | 'mobile' | 'walletconnect' | 'manual';
  installed: boolean;
  priority: number;
}

// Connected wallet from DB
interface WalletRecord {
  id: string;
  user_id: string;
  wallet_address: string;
  wallet_type: string;
  chain_id: number;
  is_primary: boolean;
  verified: boolean;
  connected_at: string;
  last_used_at: string;
}

// Wallet preferences
interface WalletPreferences {
  lastUsed?: string;
  favorites: string[];
  blocklist: string[];
}
```

## 🎯 Workflow

```
1. User visits app
   ↓
2. walletDiscoveryService.initialize()
   ↓
3. getInstalledWallets() → ['metamask', 'walletconnect']
   ↓
4. Show UI with installed wallets
   ↓
5. User clicks wallet
   ↓
6. connectWallet(walletType)
   ↓
7. [Desktop] Web3Modal opens → connects
   [Mobile] Deep link attempted → WalletConnect fallback
   ↓
8. User signs message
   ↓
9. Wallet stored in database
   ↓
10. User is connected! ✅
```

## 💡 Tips & Tricks

### Lazy Load Discovery
```typescript
const { getInstalledWallets } = useWallet();
const installed = getInstalledWallets(); // Lazy initialized
```

### Cache All Wallets
```typescript
// Warm up cache on app load
await walletDiscoveryService.discoverWallets();
```

### Retry on Failure
```typescript
async function connectWithRetry(wallet, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await connectWallet(wallet);
    } catch (err) {
      if (i === maxRetries - 1) throw err;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}
```

### Track Analytics
```typescript
const handleConnect = async (wallet) => {
  const platform = isMobile() ? 'mobile' : 'desktop';
  const success = await connectWallet(wallet);
  
  // Send to analytics
  analytics.track('wallet_connection', {
    wallet,
    platform,
    success,
  });
};
```

## ❌ Common Mistakes

❌ Not initializing service on app load  
✅ Call `walletDiscoveryService.initialize()` in useEffect

❌ Detecting wallets on every render  
✅ Cache in state: `useEffect(() => setWallets(getInstalledWallets()), [])`

❌ No fallback to WalletConnect  
✅ Always provide WalletConnect as option

❌ No error handling  
✅ Wrap in try/catch and provide fallback

❌ Testing only in desktop  
✅ Test on physical Android and iOS devices

## 🎓 Learning Path

1. **Start here**: [WALLET_DISCOVERY_IMPLEMENTATION.md](./WALLET_DISCOVERY_IMPLEMENTATION.md)
2. **Code examples**: [WALLET_DISCOVERY_EXAMPLES.md](./WALLET_DISCOVERY_EXAMPLES.md)
3. **Deep dive**: [WALLET_DISCOVERY_GUIDE.md](./WALLET_DISCOVERY_GUIDE.md)
4. **Full context**: [WALLET_DISCOVERY_SYSTEM.md](./WALLET_DISCOVERY_SYSTEM.md)

---

**Need Help?** Check the relevant documentation file above or search this quick reference for your use case.

**System Status**: ✅ Production Ready  
**Last Updated**: Current Session
