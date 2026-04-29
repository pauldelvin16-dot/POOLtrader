/**
 * Advanced Wallet Detection and Connection Management
 * Handles both EVM and non-EVM wallets with proper provider detection
 */

export interface WalletProvider {
  name: string;
  id: string;
  isInstalled: boolean;
  hasExtension: boolean;
  hasMobile: boolean;
  icon: string;
  color: string;
  detection: () => boolean;
  getDeepLink: (uri?: string) => string;
}

export interface DetectionResult {
  walletType: string;
  provider: any;
  isMobile: boolean;
  isExtension: boolean;
  installed: WalletProvider[];
  available: WalletProvider[];
}

// Comprehensive wallet configuration
export const WALLET_PROVIDERS: Record<string, WalletProvider> = {
  metamask: {
    name: 'MetaMask',
    id: 'metamask',
    icon: '🦊',
    color: 'bg-orange-500',
    hasExtension: true,
    hasMobile: true,
    isInstalled: false,
    detection: () => {
      if (typeof window === 'undefined') return false;
      const ethereum = (window as any).ethereum;
      return !!(ethereum?.isMetaMask && !ethereum?.isTrust && !ethereum?.isSafePal);
    },
    getDeepLink: (uri?: string) => {
      if (!uri) {
        const url = typeof window !== 'undefined' ? window.location.href : '';
        return `https://metamask.app.link/dapp/${url}`;
      }
      return `metamask://wc?uri=${encodeURIComponent(uri)}`;
    },
  },
  trustwallet: {
    name: 'Trust Wallet',
    id: 'trustwallet',
    icon: '🔵',
    color: 'bg-blue-500',
    hasExtension: true,
    hasMobile: true,
    isInstalled: false,
    detection: () => {
      if (typeof window === 'undefined') return false;
      const ethereum = (window as any).ethereum;
      const isTrustExtension = ethereum?.isTrust || ethereum?.isTrustWallet;
      const isTrustAgent = typeof navigator !== 'undefined' && /trust/i.test(navigator.userAgent);
      return !!(isTrustExtension || isTrustAgent);
    },
    getDeepLink: (uri?: string) => {
      if (!uri) {
        const url = encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '');
        return `https://link.trustwallet.com/open_url?coin_id=60&url=${url}`;
      }
      return `trust://wc?uri=${encodeURIComponent(uri)}`;
    },
  },
  phantom: {
    name: 'Phantom',
    id: 'phantom',
    icon: '👻',
    color: 'bg-purple-500',
    hasExtension: true,
    hasMobile: true,
    isInstalled: false,
    detection: () => {
      if (typeof window === 'undefined') return false;
      const phantom = (window as any).phantom;
      const ethereum = (window as any).ethereum;
      const solana = (window as any).solana;
      return !!(
        phantom?.ethereum?.isPhantom ||
        phantom?.isPhantom ||
        ethereum?.isPhantom ||
        solana?.isPhantom
      );
    },
    getDeepLink: (uri?: string) => {
      if (!uri) {
        const path = typeof window !== 'undefined' ? window.location.pathname : '';
        return `https://phantom.app/ul/browse/${typeof window !== 'undefined' ? window.location.host : ''}${path}`;
      }
      return `phantom://browse/${typeof window !== 'undefined' ? window.location.host : ''}?wc=${encodeURIComponent(uri)}`;
    },
  },
  exodus: {
    name: 'Exodus',
    id: 'exodus',
    icon: '🌊',
    color: 'bg-teal-500',
    hasExtension: true,
    hasMobile: true,
    isInstalled: false,
    detection: () => {
      if (typeof window === 'undefined') return false;
      const ethereum = (window as any).ethereum;
      const exodus = (window as any).exodus;
      return !!(ethereum?.isExodus || exodus?.ethereum?.isExodus);
    },
    getDeepLink: (uri?: string) => {
      if (!uri) return 'https://exodus.com/download/';
      return `exodus://wc?uri=${encodeURIComponent(uri)}`;
    },
  },
  safepal: {
    name: 'SafePal',
    id: 'safepal',
    icon: '🛡️',
    color: 'bg-red-500',
    hasExtension: true,
    hasMobile: true,
    isInstalled: false,
    detection: () => {
      if (typeof window === 'undefined') return false;
      const ethereum = (window as any).ethereum;
      const isSafePal = ethereum?.isSafePal;
      const isSafePalAgent = typeof navigator !== 'undefined' && /safepal/i.test(navigator.userAgent);
      return !!(isSafePal || isSafePalAgent);
    },
    getDeepLink: (uri?: string) => {
      if (!uri) return 'https://www.safepal.com/download';
      return `safepal://wc?uri=${encodeURIComponent(uri)}`;
    },
  },
  coinbase: {
    name: 'Coinbase Wallet',
    id: 'coinbase',
    icon: '🔷',
    color: 'bg-blue-600',
    hasExtension: true,
    hasMobile: true,
    isInstalled: false,
    detection: () => {
      if (typeof window === 'undefined') return false;
      const ethereum = (window as any).ethereum;
      return !!ethereum?.isCoinbaseWallet;
    },
    getDeepLink: (uri?: string) => {
      if (!uri) {
        const url = encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '');
        return `https://coinbase.com/wallet/downloads?redirect_url=${url}`;
      }
      return `cbwallet://wc?uri=${encodeURIComponent(uri)}`;
    },
  },
  walletconnect: {
    name: 'WalletConnect',
    id: 'walletconnect',
    icon: '🔗',
    color: 'bg-blue-400',
    hasExtension: false,
    hasMobile: true,
    isInstalled: true, // WalletConnect is always available
    detection: () => true,
    getDeepLink: (uri?: string) => {
      if (!uri) return 'https://walletconnect.com/';
      return `wc://launch?uri=${encodeURIComponent(uri)}`;
    },
  },
};

/**
 * Detects all installed wallets on the current device
 */
export function detectInstalledWallets(): WalletProvider[] {
  const installed: WalletProvider[] = [];

  for (const [key, wallet] of Object.entries(WALLET_PROVIDERS)) {
    if (wallet.detection()) {
      installed.push({ ...wallet, isInstalled: true });
    }
  }

  return installed;
}

/**
 * Get available wallets for current platform (mobile vs desktop)
 */
export function getAvailableWallets(isMobileDevice: boolean): WalletProvider[] {
  const available: WalletProvider[] = [];

  for (const [key, wallet] of Object.entries(WALLET_PROVIDERS)) {
    const isAvailable =
      wallet.detection() ||
      (isMobileDevice && wallet.hasMobile) ||
      (!isMobileDevice && wallet.hasExtension);

    if (isAvailable) {
      available.push({ ...wallet, isInstalled: wallet.detection() });
    }
  }

  return available;
}

/**
 * Detect wallet type from provider
 */
export function detectWalletType(provider: any): string {
  if (!provider) return 'walletconnect';

  // Check specific wallet flags (priority order)
  if (provider.isPhantom) return 'phantom';
  if (provider.isMetaMask && !provider.isTrust && !provider.isSafePal) return 'metamask';
  if (provider.isTrust || provider.isTrustWallet) return 'trustwallet';
  if (provider.isCoinbaseWallet) return 'coinbase';
  if (provider.isExodus) return 'exodus';
  if (provider.isSafePal) return 'safepal';

  // Check provider name
  const providerName = provider.name?.toLowerCase() || provider.constructor?.name?.toLowerCase() || '';
  if (providerName.includes('phantom')) return 'phantom';
  if (providerName.includes('metamask')) return 'metamask';
  if (providerName.includes('trust')) return 'trustwallet';
  if (providerName.includes('exodus')) return 'exodus';
  if (providerName.includes('safepal')) return 'safepal';
  if (providerName.includes('coinbase')) return 'coinbase';

  // Check for WalletConnect signals
  if (provider.session || provider.connector || provider.signer?.session || provider.uri) {
    return 'walletconnect';
  }

  return 'browser-wallet';
}

/**
 * Comprehensive wallet detection
 */
export function performComprehensiveDetection(): DetectionResult {
  const isMobileDevice = /android|iphone|ipad|ipod|mobile/i.test(
    typeof navigator !== 'undefined' ? navigator.userAgent : ''
  );
  const isExtension = !(isMobileDevice || typeof (window as any).__ethereum === 'undefined');
  const provider = typeof window !== 'undefined' ? (window as any).ethereum : null;

  const installed = detectInstalledWallets();
  const available = getAvailableWallets(isMobileDevice);
  const walletType = detectWalletType(provider);

  return {
    walletType,
    provider,
    isMobile: isMobileDevice,
    isExtension,
    installed,
    available,
  };
}

/**
 * Check if wallet supports specific chain
 */
export function isChainSupportedByWallet(
  walletId: string,
  chainId: number
): boolean {
  // Most wallets support major EVM chains
  const majorEVMChains = [1, 56, 137, 42161, 10, 8453];
  const isSolana = chainId >= 101 && chainId <= 103;

  // Phantom has strong Solana support
  if (walletId === 'phantom' && isSolana) return true;

  // Most wallets support EVM chains
  if (majorEVMChains.includes(chainId)) return true;

  return false;
}

/**
 * Get recommended wallet for chain
 */
export function getRecommendedWalletForChain(chainId: number): string {
  const isSolana = chainId >= 101 && chainId <= 103;

  if (isSolana) return 'phantom';
  if ([1, 56, 137].includes(chainId)) return 'metamask';

  return 'metamask'; // Default recommendation
}

/**
 * Format wallet address for display
 */
export function formatWalletAddress(address: string, chars: number = 6): string {
  if (!address) return '';
  return `${address.substring(0, chars)}...${address.substring(address.length - chars)}`;
}

/**
 * Validate wallet address format
 */
export function isValidWalletAddress(address: string): boolean {
  // EVM address validation (0x followed by 40 hex chars)
  if (/^0x[a-fA-F0-9]{40}$/.test(address)) return true;

  // Solana address validation (base58, 44 chars)
  if (/^[1-9A-HJ-NP-Z]{44}$/.test(address)) return true;

  return false;
}

/**
 * Get explorer URL for wallet address
 */
export function getExplorerUrl(
  address: string,
  chainId: number,
  type: 'address' | 'tx' = 'address'
): string | null {
  const explorers: Record<number, { name: string; url: string }> = {
    1: { name: 'Etherscan', url: 'https://etherscan.io' },
    56: { name: 'BscScan', url: 'https://bscscan.com' },
    137: { name: 'PolygonScan', url: 'https://polygonscan.com' },
    42161: { name: 'Arbiscan', url: 'https://arbiscan.io' },
    10: { name: 'Optimism', url: 'https://optimistic.etherscan.io' },
    8453: { name: 'BaseScan', url: 'https://basescan.org' },
  };

  const explorer = explorers[chainId];
  if (!explorer) return null;

  const endpoint = type === 'address' ? '/address/' : '/tx/';
  return `${explorer.url}${endpoint}${address}`;
}
