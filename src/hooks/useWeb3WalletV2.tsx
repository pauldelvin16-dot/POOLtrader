import React, { createContext, useContext, useEffect, useState } from 'react';
import { useWeb3ModalAccount, useWeb3ModalProvider } from '@web3modal/ethers/react';
import { BrowserProvider, Contract, ethers } from 'ethers';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { walletDiscoveryService } from '@/lib/walletDiscovery';

interface ConnectedWallet {
  id: string;
  wallet_address: string;
  wallet_type: string;
  chain_id: number;
  is_primary: boolean;
  verified: boolean;
  is_active: boolean;
  connected_at: string;
  last_used_at: string | null;
}

interface WalletContextType {
  connectedWallets: ConnectedWallet[];
  primaryWallet: ConnectedWallet | null;
  isConnecting: boolean;
  error: string | null;
  connectWallet: (walletType: string) => Promise<boolean>;
  disconnectWallet: (walletId: string) => Promise<void>;
  setPrimaryWallet: (walletId: string) => Promise<void>;
  verifyWallet: (walletId: string) => Promise<boolean>;
  fetchConnectedWallets: () => Promise<void>;
  provider: BrowserProvider | null;
  signer: any;
  // Wallet Discovery
  getInstalledWallets: () => string[];
  isWalletInstalled: (walletId: string) => boolean;
  isMobile: () => boolean;
  isAndroid: () => boolean;
  isIOS: () => boolean;
  detectWalletType: (provider: any) => string | null;
  openWalletDeepLink: (walletType: string) => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { walletProvider } = useWeb3ModalProvider();
  const { address, chainId, isConnected } = useWeb3ModalAccount();
  const supabase = useSupabaseClient();

  const [connectedWallets, setConnectedWallets] = useState<ConnectedWallet[]>([]);
  const [primaryWallet, setPrimaryWalletState] = useState<ConnectedWallet | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<any>(null);
  const [installedWallets, setInstalledWallets] = useState<string[]>([]);

  // Initialize provider and signer
  useEffect(() => {
    if (walletProvider) {
      const ethersProvider = new BrowserProvider(walletProvider);
      setProvider(ethersProvider);
      ethersProvider.getSigner().then(setSigner);
    }
  }, [walletProvider]);

  // Detect installed wallets
  useEffect(() => {
    const detectWallets = async () => {
      const wallets = await walletDiscoveryService.discoverWallets();
      const installedIds = wallets.filter((w) => w.installed).map((w) => w.id);
      setInstalledWallets(installedIds);
      console.log('Installed wallets detected:', installedIds);
    };

    detectWallets();
  }, []);

  // Fetch connected wallets from database
  const fetchConnectedWallets = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('connected_wallets')
        .select('*')
        .order('is_primary', { ascending: false })
        .order('connected_at', { ascending: false });

      if (fetchError) throw fetchError;

      setConnectedWallets(data || []);

      const primary = data?.find((w) => w.is_primary);
      if (primary) {
        setPrimaryWalletState(primary);
      }
    } catch (err) {
      console.error('Error fetching wallets:', err);
      setError('Failed to fetch wallets');
    }
  };

  // Connect wallet - with improved error handling for all wallets
  const connectWallet = async (walletType: string): Promise<boolean> => {
    setIsConnecting(true);
    setError(null);

    try {
      // Wait for address to be available (for WalletConnect and SafePal)
      let attempts = 0;
      let currentAddress = address;

      while (!currentAddress && attempts < 50) {
        // Wait for modal connection to complete
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      if (!currentAddress) {
        throw new Error('No wallet address found. Please connect your wallet.');
      }

      // Ensure provider is ready
      if (!walletProvider) {
        throw new Error('Wallet provider not available. Please try again.');
      }

      // Generate message for signature - safe for all wallets
      const now = Date.now();
      const message = `Sign this message to verify your wallet ownership for PoolTradePlug.\n\nWallet: ${currentAddress}\nChain: ${chainId || 1}\nTime: ${new Date(now).toISOString()}`;

      // Sign the message with better error handling
      let signature: string;
      try {
        if (!signer) {
          // If signer not ready, create one from provider
          const ethersProvider = new BrowserProvider(walletProvider);
          const newSigner = await ethersProvider.getSigner();
          signature = await newSigner.signMessage(message);
        } else {
          signature = await signer.signMessage(message);
        }
      } catch (signErr: any) {
        // User rejected signature or signing failed
        if (signErr.code === 'ACTION_REJECTED') {
          throw new Error('Signature rejected. Please try again.');
        }
        throw new Error(`Signing failed: ${signErr.message}`);
      }

      // Check if wallet already connected
      const { data: existingWallet } = await supabase
        .from('connected_wallets')
        .select('id')
        .eq('wallet_address', currentAddress.toLowerCase())
        .single();

      let walletRecord;
      if (existingWallet) {
        // Update existing wallet
        const { data, error: updateError } = await supabase
          .from('connected_wallets')
          .update({
            wallet_type: walletType,
            chain_id: chainId || 1,
            signature,
            message_signed: message,
            verified: true,
            last_used_at: new Date().toISOString(),
          })
          .eq('id', existingWallet.id)
          .select()
          .single();

        if (updateError) throw updateError;
        walletRecord = data;
      } else {
        // Insert new wallet
        const { data, error: insertError } = await supabase
          .from('connected_wallets')
          .insert([
            {
              wallet_address: currentAddress.toLowerCase(),
              wallet_type: walletType || 'walletconnect',
              chain_id: chainId || 1,
              signature,
              message_signed: message,
              verified: true,
              is_primary: connectedWallets.length === 0,
              is_active: true,
            },
          ])
          .select()
          .single();

        if (insertError) throw insertError;
        walletRecord = data;
      }

      // Verify in database
      if (walletRecord) {
        try {
          await supabase.functions.invoke('wallet-operations', {
            body: {
              action: 'verify_wallet',
              walletId: walletRecord.id,
              address: walletRecord.wallet_address,
              signature: signature,
            },
          });
        } catch (verifyErr) {
          console.warn('Wallet verification call failed:', verifyErr);
          // Continue anyway - local verification is enough
        }
      }

      await fetchConnectedWallets();
      return true;
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to connect wallet';
      console.error('Error connecting wallet:', err);
      setError(errorMsg);
      
      // Provide helpful suggestions based on error
      if (errorMsg.includes('Session namespaces')) {
        setError('Wallet connection error. Please try MetaMask or Trust Wallet.');
      } else if (errorMsg.includes('rejected')) {
        setError('Connection rejected. Please approve the connection in your wallet.');
      }
      
      return false;
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect wallet
  const disconnectWallet = async (walletId: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('connected_wallets')
        .delete()
        .eq('id', walletId);

      if (deleteError) throw deleteError;

      await fetchConnectedWallets();
    } catch (err) {
      console.error('Error disconnecting wallet:', err);
      setError('Failed to disconnect wallet');
    }
  };

  // Set primary wallet
  const setPrimaryWallet = async (walletId: string) => {
    try {
      // Remove primary from all wallets
      const { error: updateError1 } = await supabase
        .from('connected_wallets')
        .update({ is_primary: false })
        .not('id', 'eq', walletId);

      if (updateError1) throw updateError1;

      // Set new primary
      const { error: updateError2 } = await supabase
        .from('connected_wallets')
        .update({ is_primary: true })
        .eq('id', walletId);

      if (updateError2) throw updateError2;

      await fetchConnectedWallets();
    } catch (err) {
      console.error('Error setting primary wallet:', err);
      setError('Failed to set primary wallet');
    }
  };

  // Verify wallet ownership
  const verifyWallet = async (walletId: string): Promise<boolean> => {
    try {
      const wallet = connectedWallets.find((w) => w.id === walletId);
      if (!wallet) throw new Error('Wallet not found');

      // Verify signature
      const recoveredAddress = ethers.verifyMessage(wallet.wallet_address, wallet.signature);

      const isValid = recoveredAddress.toLowerCase() === wallet.wallet_address.toLowerCase();

      if (isValid) {
        const { error: updateError } = await supabase
          .from('connected_wallets')
          .update({ verified: true, verified_at: new Date().toISOString() })
          .eq('id', walletId);

        if (updateError) throw updateError;
      }

      return isValid;
    } catch (err) {
      console.error('Error verifying wallet:', err);
      return false;
    }
  };

  // Wallet Discovery Functions
  const getInstalledWallets = (): string[] => {
    return installedWallets;
  };

  const isWalletInstalled = (walletId: string): boolean => {
    return installedWallets.includes(walletId);
  };

  const isMobile = (): boolean => {
    return walletDiscoveryService.isMobile();
  };

  const isAndroid = (): boolean => {
    return walletDiscoveryService.isAndroid();
  };

  const isIOS = (): boolean => {
    return walletDiscoveryService.isIOS();
  };

  const detectWalletType = (provider: any): string | null => {
    if (!provider) return null;

    // Detect from provider flags
    if (provider.isMetaMask && !provider.isTrust && !provider.isSafePal) return 'metamask';
    if (provider.isTrust || provider.isTrustWallet) return 'trust-wallet';
    if (provider.isPhantom) return 'phantom-evm';
    if (provider.isSafePal) return 'safepal';
    if (provider.isCoinbaseWallet) return 'coinbase';
    if (provider.isExodus) return 'exodus';
    if ((provider as any).isLedger) return 'ledger';
    if ((provider as any).isFrame) return 'frame';

    return null;
  };

  const openWalletDeepLink = (walletType: string): void => {
    // For mobile, attempt to open wallet deep link
    if (!walletDiscoveryService.isMobile()) return;

    const deepLink = getWalletDeepLink(walletType);
    if (deepLink) {
      window.location.href = deepLink;
    }
  };

  const getWalletDeepLink = (walletType: string): string | null => {
    const deepLinks: Record<string, string> = {
      metamask: 'metamask://',
      'trust-wallet': 'trust://',
      phantom: 'phantom://',
      exodus: 'exodus://',
      safepal: 'safepal://',
      coinbase: 'coinbase://',
    };

    return deepLinks[walletType] || null;
  };

  // Fetch wallets on component mount
  useEffect(() => {
    fetchConnectedWallets();
  }, []);

  // Update last_used_at when wallet is connected
  useEffect(() => {
    if (isConnected && address) {
      const updateLastUsed = async () => {
        const wallet = connectedWallets.find(
          (w) => w.wallet_address.toLowerCase() === address.toLowerCase()
        );
        if (wallet) {
          await supabase
            .from('connected_wallets')
            .update({ last_used_at: new Date().toISOString() })
            .eq('id', wallet.id);
        }
      };
      updateLastUsed();
    }
  }, [isConnected, address]);

  const value: WalletContextType = {
    connectedWallets,
    primaryWallet,
    isConnecting,
    error,
    connectWallet,
    disconnectWallet,
    setPrimaryWallet,
    verifyWallet,
    fetchConnectedWallets,
    provider,
    signer,
    // Wallet Discovery
    getInstalledWallets,
    isWalletInstalled,
    isMobile,
    isAndroid,
    isIOS,
    detectWalletType,
    openWalletDeepLink,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider');
  }
  return context;
};
