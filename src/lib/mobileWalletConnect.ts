// Mobile Wallet Connection Utilities for Android/iOS
// Forces wallet detection and connection via deep links when providers aren't injected

export interface MobileWalletConfig {
  name: string;
  id: string;
  icon?: string;
  androidDeepLink: string;
  iosDeepLink: string;
  universalLink?: string;
  isInstalled: () => boolean;
  isMobile: boolean;
}

// Detect if running on Android
export const isAndroid = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return /android/i.test(navigator.userAgent);
};

// Detect if running on iOS
export const isIOS = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
};

// Detect if running on mobile
export const isMobile = (): boolean => isAndroid() || isIOS();

// Wallet configurations with deep links for Android
export const MOBILE_WALLETS: MobileWalletConfig[] = [
  {
    name: 'MetaMask',
    id: 'metamask',
    androidDeepLink: 'metamask://wc?uri={uri}',
    iosDeepLink: 'metamask://wc?uri={uri}',
    universalLink: 'https://metamask.app.link/wc?uri={uri}',
    isInstalled: () => {
      if (typeof window === 'undefined') return false;
      const provider = (window as any).ethereum;
      return provider?.isMetaMask === true;
    },
    isMobile: true,
  },
  {
    name: 'Trust Wallet',
    id: 'trust-wallet',
    androidDeepLink: 'trust://wc?uri={uri}',
    iosDeepLink: 'trust://wc?uri={uri}',
    universalLink: 'https://link.trustwallet.com/wc?uri={uri}',
    isInstalled: () => {
      if (typeof window === 'undefined') return false;
      const provider = (window as any).ethereum;
      return provider?.isTrust === true || provider?.isTrustWallet === true;
    },
    isMobile: true,
  },
  {
    name: 'Phantom',
    id: 'phantom',
    androidDeepLink: 'phantom://browse/{url}',
    iosDeepLink: 'phantom://browse/{url}',
    universalLink: 'https://phantom.app/ul/browse/{url}',
    isInstalled: () => {
      if (typeof window === 'undefined') return false;
      return !!(window as any).phantom?.solana || !!(window as any).phantom?.ethereum;
    },
    isMobile: true,
  },
  {
    name: 'Exodus',
    id: 'exodus',
    androidDeepLink: 'exodus://wc?uri={uri}',
    iosDeepLink: 'exodus://wc?uri={uri}',
    isInstalled: () => {
      if (typeof window === 'undefined') return false;
      const provider = (window as any).ethereum;
      return provider?.isExodus === true || !!(window as any).exodus;
    },
    isMobile: true,
  },
  {
    name: 'SafePal',
    id: 'safepal',
    androidDeepLink: 'safepal://wc?uri={uri}',
    iosDeepLink: 'safepal://wc?uri={uri}',
    universalLink: 'https://link.safepal.io/wc?uri={uri}',
    isInstalled: () => {
      if (typeof window === 'undefined') return false;
      const provider = (window as any).ethereum;
      return provider?.isSafePal === true;
    },
    isMobile: true,
  },
  {
    name: 'Halo Wallet',
    id: 'halo',
    androidDeepLink: 'halo://wc?uri={uri}',
    iosDeepLink: 'halo://wc?uri={uri}',
    isInstalled: () => {
      if (typeof window === 'undefined') return false;
      const provider = (window as any).ethereum;
      return provider?.isHalo === true || !!(window as any).halo;
    },
    isMobile: true,
  },
  {
    name: 'Coinbase Wallet',
    id: 'coinbase',
    androidDeepLink: 'cbwallet://wc?uri={uri}',
    iosDeepLink: 'cbwallet://wc?uri={uri}',
    universalLink: 'https://go.cb-w.com/wc?uri={uri}',
    isInstalled: () => {
      if (typeof window === 'undefined') return false;
      const provider = (window as any).ethereum;
      return provider?.isCoinbaseWallet === true || !!(window as any).coinbaseWallet;
    },
    isMobile: true,
  },
];

// Get installed wallets
export const getInstalledWallets = (): MobileWalletConfig[] => {
  return MOBILE_WALLETS.filter(wallet => wallet.isInstalled());
};

// Get wallet by ID
export const getWalletById = (id: string): MobileWalletConfig | undefined => {
  return MOBILE_WALLETS.find(wallet => wallet.id === id);
};

// Force wallet connection attempt via deep link
export const forceWalletConnection = (walletId: string, wcUri?: string): boolean => {
  if (!isMobile()) {
    console.log('Force wallet connection only works on mobile devices');
    return false;
  }

  const wallet = getWalletById(walletId);
  if (!wallet) {
    console.error(`Wallet ${walletId} not found`);
    return false;
  }

  const deepLink = isAndroid() ? wallet.androidDeepLink : wallet.iosDeepLink;
  const universalLink = wallet.universalLink;

  // Build the URL to open
  let targetUrl: string;

  if (wcUri) {
    // WalletConnect URI provided - use it
    targetUrl = deepLink.replace('{uri}', encodeURIComponent(wcUri));
  } else {
    // No WC URI - open wallet directly to the dApp
    const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
    targetUrl = deepLink.replace('{url}', encodeURIComponent(currentUrl));
  }

  // Also prepare universal link as fallback
  let fallbackUrl: string | null = null;
  if (universalLink) {
    if (wcUri) {
      fallbackUrl = universalLink.replace('{uri}', encodeURIComponent(wcUri));
    } else {
      const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
      fallbackUrl = universalLink.replace('{url}', encodeURIComponent(currentUrl));
    }
  }

  console.log(`Opening ${wallet.name} via deep link:`, targetUrl);

  // Try to open the deep link
  if (typeof window !== 'undefined') {
    // Create a hidden iframe to try the deep link first
    const tryDeepLink = () => {
      window.location.href = targetUrl;
    };

    // If wallet is likely not installed, use universal link as fallback
    if (!wallet.isInstalled() && fallbackUrl) {
      console.log(`Wallet ${wallet.name} not detected, using universal link`);
      window.location.href = fallbackUrl;
    } else {
      tryDeepLink();
    }

    return true;
  }

  return false;
};

// Attempt to detect and force connect to any available wallet
export const attemptWalletConnection = async (): Promise<{ success: boolean; wallet?: string; error?: string }> => {
  if (!isMobile()) {
    return { success: false, error: 'Not a mobile device' };
  }

  // First check if any wallet is already installed
  const installed = getInstalledWallets();

  if (installed.length > 0) {
    // Use the first installed wallet
    const wallet = installed[0];
    console.log(`Detected installed wallet: ${wallet.name}`);
    const opened = forceWalletConnection(wallet.id);
    return { success: opened, wallet: wallet.name };
  }

  // No wallet detected - try to open MetaMask as default (most common)
  console.log('No wallet detected, attempting to open MetaMask...');
  const opened = forceWalletConnection('metamask');

  if (!opened) {
    // Try Trust Wallet as fallback
    console.log('MetaMask not available, trying Trust Wallet...');
    const trustOpened = forceWalletConnection('trust-wallet');
    return { success: trustOpened, wallet: trustOpened ? 'Trust Wallet' : undefined, error: trustOpened ? undefined : 'Could not open any wallet' };
  }

  return { success: true, wallet: 'MetaMask' };
};

// Check if a specific wallet can be opened (installed or can be prompted)
export const canOpenWallet = (walletId: string): boolean => {
  if (!isMobile()) return false;
  const wallet = getWalletById(walletId);
  return !!wallet;
};

// Get connection instructions for users
export const getWalletInstallInstructions = (walletId: string): string => {
  const instructions: Record<string, string> = {
    metamask: 'Please install MetaMask from the Google Play Store and return to this page.',
    'trust-wallet': 'Please install Trust Wallet from the Google Play Store and return to this page.',
    phantom: 'Please install Phantom from the Google Play Store and return to this page.',
    exodus: 'Please install Exodus from the Google Play Store and return to this page.',
    safepal: 'Please install SafePal from the Google Play Store and return to this page.',
    halo: 'Please install Halo Wallet from the Google Play Store and return to this page.',
    coinbase: 'Please install Coinbase Wallet from the Google Play Store and return to this page.',
  };

  return instructions[walletId] || 'Please install a compatible wallet from the Google Play Store.';
};

// Hook to detect mobile environment
export const useMobileDetect = () => {
  return {
    isAndroid: isAndroid(),
    isIOS: isIOS(),
    isMobile: isMobile(),
    installedWallets: getInstalledWallets(),
  };
};
