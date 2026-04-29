/**
 * Enhanced Wallet Discovery System
 * Supports Android, iOS, and browser extensions with automatic scanning
 */

export interface DetectedWallet {
  id: string;
  name: string;
  type: 'extension' | 'mobile' | 'walletconnect';
  installed: boolean;
  provider?: any;
  chain?: string;
  deepLink?: string;
  icon?: string;
  priority: number;
}

/**
 * EIP6963 Provider Discovery
 * Automatically detects all injected wallet providers
 */
class EIP6963Discovery {
  private providers: Map<string, any> = new Map();
  private listeners: Set<Function> = new Set();

  async initialize(): Promise<void> {
    // Listen for EIP6963 announce events
    if (typeof window !== 'undefined') {
      window.addEventListener('eip6963:announceProvider', (event: any) => {
        const { info, provider } = event.detail;
        this.providers.set(info.uuid, { ...info, provider });
        this.notifyListeners();
      });

      // Request all providers
      window.dispatchEvent(new Event('eip6963:requestProvider'));
    }
  }

  getProviders(): Array<{ info: any; provider: any }> {
    return Array.from(this.providers.values());
  }

  onProvidersChange(listener: Function): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener(this.getProviders()));
  }
}

/**
 * Browser Extension Wallet Detection
 */
class BrowserExtensionDetector {
  private eip6963 = new EIP6963Discovery();

  async initialize(): Promise<void> {
    await this.eip6963.initialize();
  }

  detectInstalledWallets(): DetectedWallet[] {
    const detected: DetectedWallet[] = [];

    // Standard window.ethereum injections
    const standardWallets = this.detectStandardWallets();
    detected.push(...standardWallets);

    // EIP6963 discovered wallets
    const eip6963Wallets = this.detectEIP6963Wallets();
    detected.push(...eip6963Wallets);

    // Remove duplicates and sort by priority
    return this.deduplicateAndSort(detected);
  }

  private detectStandardWallets(): DetectedWallet[] {
    const wallets: DetectedWallet[] = [];

    if (typeof window === 'undefined') return wallets;

    const { ethereum } = window as any;

    if (!ethereum) return wallets;

    // MetaMask detection (must come first to avoid false positives)
    if (ethereum.isMetaMask && !ethereum.isTrust && !ethereum.isSafePal) {
      wallets.push({
        id: 'metamask',
        name: 'MetaMask',
        type: 'extension',
        installed: true,
        provider: ethereum,
        priority: 10,
      });
    }

    // Trust Wallet
    if (ethereum.isTrust || ethereum.isTrustWallet) {
      wallets.push({
        id: 'trust-wallet',
        name: 'Trust Wallet',
        type: 'extension',
        installed: true,
        provider: ethereum,
        priority: 9,
      });
    }

    // Phantom (EVM mode)
    if (ethereum.isPhantom && !ethereum.solana?.isPhantom) {
      wallets.push({
        id: 'phantom-evm',
        name: 'Phantom (EVM)',
        type: 'extension',
        installed: true,
        provider: ethereum,
        priority: 8,
      });
    }

    // SafePal
    if (ethereum.isSafePal) {
      wallets.push({
        id: 'safepal',
        name: 'SafePal',
        type: 'extension',
        installed: true,
        provider: ethereum,
        priority: 7,
      });
    }

    // Coinbase Wallet
    if (ethereum.isCoinbaseWallet) {
      wallets.push({
        id: 'coinbase',
        name: 'Coinbase Wallet',
        type: 'extension',
        installed: true,
        provider: ethereum,
        priority: 6,
      });
    }

    // Exodus
    if (ethereum.isExodus) {
      wallets.push({
        id: 'exodus',
        name: 'Exodus',
        type: 'extension',
        installed: true,
        provider: ethereum,
        priority: 5,
      });
    }

    // Ledger Live
    if ((ethereum as any).isLedger) {
      wallets.push({
        id: 'ledger',
        name: 'Ledger',
        type: 'extension',
        installed: true,
        provider: ethereum,
        priority: 4,
      });
    }

    // Frame
    if ((ethereum as any).isFrame) {
      wallets.push({
        id: 'frame',
        name: 'Frame',
        type: 'extension',
        installed: true,
        provider: ethereum,
        priority: 3,
      });
    }

    return wallets;
  }

  private detectEIP6963Wallets(): DetectedWallet[] {
    const wallets: DetectedWallet[] = [];
    const providers = this.eip6963.getProviders();

    const knownWalletMap: Record<string, { priority: number; type: string }> = {
      metamask: { priority: 10, type: 'MetaMask' },
      'trust-wallet': { priority: 9, type: 'Trust Wallet' },
      phantom: { priority: 8, type: 'Phantom' },
      safepal: { priority: 7, type: 'SafePal' },
      coinbase: { priority: 6, type: 'Coinbase' },
      exodus: { priority: 5, type: 'Exodus' },
      ledger: { priority: 4, type: 'Ledger' },
      frame: { priority: 3, type: 'Frame' },
    };

    providers.forEach(({ info, provider }) => {
      const walletKey = info.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const knownWallet = Object.entries(knownWalletMap).find(
        ([key]) => walletKey.includes(key) || key.includes(walletKey)
      );

      wallets.push({
        id: info.uuid || walletKey,
        name: info.name || 'Unknown Wallet',
        type: 'extension',
        installed: true,
        provider,
        priority: knownWallet ? knownWallet[1].priority : 1,
      });
    });

    return wallets;
  }

  private deduplicateAndSort(wallets: DetectedWallet[]): DetectedWallet[] {
    const seen = new Set<string>();
    const unique = wallets.filter((w) => {
      if (seen.has(w.id)) return false;
      seen.add(w.id);
      return true;
    });

    return unique.sort((a, b) => b.priority - a.priority);
  }
}

/**
 * Mobile Wallet Detection (Android & iOS)
 */
class MobileWalletDetector {
  private isAndroid = /android/i.test(navigator.userAgent);
  private isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  private isWebView = this.detectWebView();

  private mobileWallets = [
    {
      id: 'metamask-mobile',
      name: 'MetaMask',
      android: 'https://play.google.com/store/apps/details?id=io.metamask',
      ios: 'https://apps.apple.com/us/app/metamask/id1438144202',
      deepLink: 'metamask://wc?uri={uri}',
      priority: 10,
    },
    {
      id: 'trust-wallet-mobile',
      name: 'Trust Wallet',
      android: 'https://play.google.com/store/apps/details?id=com.trustwallet.android',
      ios: 'https://apps.apple.com/us/app/trust-cryptocurrency-wallet/id1288339409',
      deepLink: 'trust://wc?uri={uri}',
      priority: 9,
    },
    {
      id: 'phantom-mobile',
      name: 'Phantom',
      android: 'https://play.google.com/store/apps/details?id=app.phantom',
      ios: 'https://apps.apple.com/us/app/phantom-solana-wallet/id1598432977',
      deepLink: 'phantom://browse/{url}?wc={uri}',
      priority: 8,
    },
    {
      id: 'exodus-mobile',
      name: 'Exodus',
      android: 'https://play.google.com/store/apps/details?id=com.exodus.wallet',
      ios: 'https://apps.apple.com/us/app/exodus-web3-wallet/id1414384576',
      deepLink: 'exodus://wc?uri={uri}',
      priority: 7,
    },
    {
      id: 'safepal-mobile',
      name: 'SafePal',
      android: 'https://play.google.com/store/apps/details?id=io.safepal',
      ios: 'https://apps.apple.com/us/app/safepal-crypto-wallet/id1548297139',
      deepLink: 'safepal://wc?uri={uri}',
      priority: 6,
    },
    {
      id: 'coinbase-mobile',
      name: 'Coinbase Wallet',
      android: 'https://play.google.com/store/apps/details?id=org.toshi',
      ios: 'https://apps.apple.com/us/app/coinbase-wallet/id1278383455',
      deepLink: 'coinbase://wc?uri={uri}',
      priority: 5,
    },
    {
      id: 'halo-mobile',
      name: 'Halo Wallet',
      android: 'https://play.google.com/store/apps/details?id=com.halo.wallet',
      ios: 'https://apps.apple.com/us/app/halo-wallet/id1234567890',
      deepLink: 'halo://wc?uri={uri}',
      priority: 4,
    },
    {
      id: 'okx-mobile',
      name: 'OKX Wallet',
      android: 'https://play.google.com/store/apps/details?id=com.okcoin.android',
      ios: 'https://apps.apple.com/us/app/okx-web3-wallet/id1595925159',
      deepLink: 'okx://wc?uri={uri}',
      priority: 3,
    },
  ];

  private detectWebView(): boolean {
    const ua = navigator.userAgent;
    return /WebView|wv|\.0v|Version\/[\d.]+(?!.*Safari)/.test(ua);
  }

  isMobile(): boolean {
    return this.isAndroid || this.isIOS;
  }

  isAndroidDevice(): boolean {
    return this.isAndroid;
  }

  isIOSDevice(): boolean {
    return this.isIOS;
  }

  detectInstalledWallets(): DetectedWallet[] {
    if (!this.isMobile()) return [];

    return this.mobileWallets.map((wallet) => ({
      id: wallet.id,
      name: wallet.name,
      type: 'mobile',
      installed: this.checkWalletInstalled(wallet.id),
      deepLink: wallet.deepLink,
      priority: wallet.priority,
    }));
  }

  private checkWalletInstalled(walletId: string): boolean {
    // On mobile, we can't truly check if an app is installed without trying to open it
    // So we return true for all as a fallback
    // Real detection happens when user taps the wallet
    return true;
  }

  getStoreLink(walletId: string): string | null {
    const wallet = this.mobileWallets.find((w) => w.id === walletId);
    if (!wallet) return null;

    return this.isAndroid ? wallet.android : wallet.ios;
  }

  getDeepLink(walletId: string, uri: string): string | null {
    const wallet = this.mobileWallets.find((w) => w.id === walletId);
    if (!wallet) return null;

    return wallet.deepLink.replace('{uri}', encodeURIComponent(uri)).replace('{url}', uri);
  }

  async tryOpenWallet(walletId: string, uri: string): Promise<boolean> {
    const deepLink = this.getDeepLink(walletId, uri);
    if (!deepLink) return false;

    try {
      // Store the current URL for fallback
      const currentUrl = window.location.href;

      // Try to open deep link
      window.location.href = deepLink;

      // Set timeout for fallback to app store
      const timeoutId = setTimeout(() => {
        const storeLink = this.getStoreLink(walletId);
        if (storeLink) {
          window.location.href = storeLink;
        }
      }, 1500);

      // If user returns from app, clear timeout
      window.addEventListener(
        'visibilitychange',
        () => {
          if (document.visibilityState === 'visible') {
            clearTimeout(timeoutId);
          }
        },
        { once: true }
      );

      return true;
    } catch (err) {
      console.error(`Failed to open wallet ${walletId}:`, err);
      return false;
    }
  }
}

/**
 * Unified Wallet Discovery Service
 */
export class WalletDiscoveryService {
  private extensionDetector: BrowserExtensionDetector;
  private mobileDetector: MobileWalletDetector;
  private cachedWallets: DetectedWallet[] = [];
  private lastDetectionTime: number = 0;
  private cacheDuration: number = 5000; // 5 seconds

  constructor() {
    this.extensionDetector = new BrowserExtensionDetector();
    this.mobileDetector = new MobileWalletDetector();
  }

  async initialize(): Promise<void> {
    await this.extensionDetector.initialize();
  }

  /**
   * Discover all available wallets (cached for performance)
   */
  async discoverWallets(): Promise<DetectedWallet[]> {
    const now = Date.now();

    // Return cached results if fresh
    if (this.cachedWallets.length > 0 && now - this.lastDetectionTime < this.cacheDuration) {
      return this.cachedWallets;
    }

    const wallets: DetectedWallet[] = [];

    // Detect browser extensions
    if (!this.mobileDetector.isMobile()) {
      const extensionWallets = this.extensionDetector.detectInstalledWallets();
      wallets.push(...extensionWallets);
    }

    // Detect mobile wallets
    if (this.mobileDetector.isMobile()) {
      const mobileWallets = this.mobileDetector.detectInstalledWallets();
      wallets.push(...mobileWallets);
    }

    // Always include WalletConnect as fallback
    wallets.push({
      id: 'walletconnect',
      name: 'WalletConnect',
      type: 'walletconnect',
      installed: true,
      priority: 0, // Lowest priority as fallback
    });

    this.cachedWallets = wallets.sort((a, b) => b.priority - a.priority);
    this.lastDetectionTime = now;

    return this.cachedWallets;
  }

  /**
   * Get wallets grouped by type
   */
  async getWalletsByType(): Promise<{
    extensions: DetectedWallet[];
    mobile: DetectedWallet[];
    other: DetectedWallet[];
  }> {
    const wallets = await this.discoverWallets();

    return {
      extensions: wallets.filter((w) => w.type === 'extension'),
      mobile: wallets.filter((w) => w.type === 'mobile'),
      other: wallets.filter((w) => w.type === 'walletconnect'),
    };
  }

  /**
   * Check if device is mobile
   */
  isMobile(): boolean {
    return this.mobileDetector.isMobile();
  }

  /**
   * Check if device is Android
   */
  isAndroid(): boolean {
    return this.mobileDetector.isAndroidDevice();
  }

  /**
   * Check if device is iOS
   */
  isIOS(): boolean {
    return this.mobileDetector.isIOSDevice();
  }

  /**
   * Try to open wallet on mobile
   */
  async tryMobileWallet(walletId: string, uri: string): Promise<boolean> {
    if (!this.mobileDetector.isMobile()) return false;

    return this.mobileDetector.tryOpenWallet(walletId, uri);
  }

  /**
   * Get store link for mobile wallet
   */
  getMobileStoreLink(walletId: string): string | null {
    return this.mobileDetector.getStoreLink(walletId);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cachedWallets = [];
    this.lastDetectionTime = 0;
  }
}

// Export singleton instance
export const walletDiscoveryService = new WalletDiscoveryService();
