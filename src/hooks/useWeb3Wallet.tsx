import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useWeb3ModalAccount, useWeb3ModalProvider } from '@web3modal/ethers/react';
import { BrowserProvider, ethers } from 'ethers';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface ConnectedWallet {
  id: string;
  user_id: string;
  wallet_address: string;
  wallet_type: string;
  chain_id: number;
  is_primary: boolean;
  verified: boolean;
  is_active: boolean;
  connected_at: string;
  last_used_at: string | null;
  last_approval_at: string | null;
  message_signed?: string;
  signature?: string;
  verified_at?: string | null;
  allowance_amount: number;
  token_approved?: string;
  metadata?: {
    total_value_usd?: number;
  };
}

interface WalletContextType {
  connectedWallets: ConnectedWallet[];
  primaryWallet: ConnectedWallet | null;
  isConnecting: boolean;
  error: string | null;
  isLoading: boolean;
  connectWallet: (walletType?: string) => Promise<boolean>;
  disconnectWallet: (walletId: string) => Promise<void>;
  setPrimaryWallet: (walletId: string) => Promise<void>;
  verifyWallet: (walletId: string) => Promise<boolean>;
  fetchConnectedWallets: () => Promise<void>;
  refreshWallet: () => Promise<void>;
  provider: BrowserProvider | null;
  signer: any;
  currentChainId: number | undefined;
  currentAddress: string | undefined;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const normalizeAddress = (value?: string | null) => value?.toLowerCase() || '';

const detectWalletType = (walletProvider: unknown): string => {
  const provider = walletProvider as Record<string, any> | null;
  if (!provider) return 'walletconnect';

  if (provider.isMetaMask) return 'metamask';
  if (provider.isTrust || provider.isTrustWallet) return 'trust-wallet';
  if (provider.isCoinbaseWallet) return 'coinbase';
  if (provider.isPhantom) return 'phantom';
  if (provider.isExodus) return 'exodus';
  if (provider.isSafePal) return 'safepal';
  if (provider.session || provider.connector || provider.signer?.session) return 'walletconnect';

  if (typeof navigator !== 'undefined') {
    const mobileUserAgent = /android|iphone|ipad|ipod/i.test(navigator.userAgent);
    if (mobileUserAgent) return 'walletconnect';
  }

  return 'browser-wallet';
};

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { walletProvider } = useWeb3ModalProvider();
  const { address, chainId, isConnected } = useWeb3ModalAccount();
  const { user } = useAuth();

  const [connectedWallets, setConnectedWallets] = useState<ConnectedWallet[]>([]);
  const [primaryWallet, setPrimaryWalletState] = useState<ConnectedWallet | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<any>(null);

  const ensureSigner = useCallback(async () => {
    if (!walletProvider || !isConnected || !address) return null;

    try {
      const ethersProvider = new BrowserProvider(walletProvider);
      
      // Check if we can get accounts without throwing
      const accounts = await ethersProvider.send('eth_accounts', []).catch(() => []);
      if (!accounts || accounts.length === 0) {
        console.log('No accounts available yet, waiting for wallet connection...');
        return null;
      }
      
      const ethersSigner = await ethersProvider.getSigner();
      setProvider(ethersProvider);
      setSigner(ethersSigner);
      return { ethersProvider, ethersSigner };
    } catch (err: any) {
      // Silently handle eth_requestAccounts errors - wallet not ready yet
      if (err.message?.includes('eth_requestAccounts') || 
          err.message?.includes('could not coalesce') ||
          err.message?.includes('not allowed')) {
        console.log('Wallet not ready for signer, will retry...');
        return null;
      }
      throw err;
    }
  }, [walletProvider, isConnected, address]);

  // Initialize provider and signer reactively
  useEffect(() => {
    let cancelled = false;

    const initSigner = async () => {
      if (walletProvider && isConnected && address) {
        try {
          const signerData = await ensureSigner();
          if (cancelled || !signerData) return;
          console.log("Web3Wallet: Signer initialized for", address);
        } catch (e: any) {
          if (cancelled) return;
          console.log("Web3Wallet: Signer wait...", e.message);
          setSigner(null);
          setProvider(null);
        }
      } else {
        setProvider(null);
        setSigner(null);
      }
    };

    initSigner();

    return () => {
      cancelled = true;
    };
  }, [walletProvider, isConnected, address, ensureSigner]);

  // Fetch connected wallets from database
  const fetchConnectedWallets = useCallback(async () => {
    if (!user) {
      setConnectedWallets([]);
      setPrimaryWalletState(null);
      return;
    }
    
    setIsLoading(true);
    try {
      const { data, error: fetchError } = await (supabase as any)
        .from('connected_wallets')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('is_primary', { ascending: false })
        .order('connected_at', { ascending: false });

      if (fetchError) {
        console.error('Fetch wallets error:', fetchError);
        throw fetchError;
      }

      setConnectedWallets(data || []);
      const primary = data?.find((w: ConnectedWallet) => w.is_primary);
      setPrimaryWalletState(primary || null);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching wallets:', err);
      setError('Failed to fetch wallets: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Initial fetch
  useEffect(() => {
    if (user) {
      fetchConnectedWallets();
    }
  }, [user, fetchConnectedWallets]);

  // Real-time subscription for wallet updates
  useEffect(() => {
    if (!user) return;

    const subscription = (supabase as any)
      .channel('connected_wallets_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'connected_wallets',
          filter: `user_id=eq.${user.id}`
        }, 
        (payload: any) => {
          console.log('Wallet change detected:', payload);
          fetchConnectedWallets();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user, fetchConnectedWallets]);

  // Refresh current wallet data
  const refreshWallet = async () => {
    if (!user || !address) return;
    
    try {
      const normalizedAddress = normalizeAddress(address);
      const { data: existingWallets, error: existingError } = await (supabase as any)
        .from('connected_wallets')
        .select('id, chain_id, is_active')
        .eq('wallet_address', normalizedAddress)
        .eq('user_id', user.id)
        .order('connected_at', { ascending: false });

      if (existingError) throw existingError;

      if (existingWallets?.length) {
        const exactChainWallet = existingWallets.find((wallet: ConnectedWallet) => wallet.chain_id === (chainId || 1));
        const reusableWallet = exactChainWallet || (existingWallets.length === 1 ? existingWallets[0] : null);

        if (!reusableWallet) {
          await fetchConnectedWallets();
          return;
        }

        await (supabase as any)
          .from('connected_wallets')
          .update({ 
            last_used_at: new Date().toISOString(),
            chain_id: chainId || reusableWallet.chain_id,
            is_active: true 
          })
          .eq('id', reusableWallet.id);
        
        await fetchConnectedWallets();
      }
    } catch (err) {
      console.error('Error refreshing wallet:', err);
    }
  };

  // Watch for chain/address changes
  useEffect(() => {
    if (isConnected && address && user) {
      refreshWallet();
    }
  }, [isConnected, address, chainId, user]);

  // Connect wallet with proper verification
  const connectWallet = async (walletType?: string): Promise<boolean> => {
    if (!address) {
      toast.error('Please connect your wallet via the Web3 button first');
      return false;
    }

    if (!user) {
      toast.error('Please sign in to connect a wallet');
      return false;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const normalizedAddress = normalizeAddress(address);
      const activeChainId = chainId || 1;
      const resolvedWalletType = walletType || detectWalletType(walletProvider);
      const signerInstance = signer || (await ensureSigner())?.ethersSigner;

      if (!signerInstance) {
        toast.error('Wallet signer not available. Please reconnect your wallet.');
        return false;
      }

      // Fetch all wallets for this address (including inactive ones to allow reconnection)
      const { data: existingWallets, error: existingFetchError } = await (supabase as any)
        .from('connected_wallets')
        .select('id, verified, is_active, chain_id, wallet_address')
        .eq('wallet_address', normalizedAddress)
        .eq('user_id', user.id)
        .order('connected_at', { ascending: false });

      if (existingFetchError) throw existingFetchError;

      // Find wallet matching this exact chain
      const exactChainWallet = existingWallets?.find((wallet: ConnectedWallet) => wallet.chain_id === activeChainId);
      // If no exact match, use the most recent wallet for this address (allows reconnection after disconnect)
      const reusableWallet = exactChainWallet || existingWallets?.[0];

      // If already active on this chain, just refresh
      if (exactChainWallet?.is_active) {
        toast.info('Wallet already connected!');
        await refreshWallet();
        await fetchConnectedWallets();
        return true;
      }

      console.log('Wallet connection check:', {
        address: normalizedAddress,
        chainId: activeChainId,
        existingWalletsCount: existingWallets?.length || 0,
        exactChainWallet: exactChainWallet?.id,
        reusableWallet: reusableWallet?.id,
        isReactivating: reusableWallet && !reusableWallet.is_active
      });

      // Generate message for signature
      const timestamp = Date.now();
      const message = `PoolTradePlug Wallet Verification\n\nWallet: ${address}\nChain ID: ${activeChainId}\nTimestamp: ${timestamp}\n\nBy signing this message, you verify ownership of this wallet and authorize PoolTradePlug to associate it with your account.`;

      // Request signature
      toast.info('Please sign the message to verify wallet ownership...');
      let signature: string;
      try {
        signature = await signerInstance.signMessage(message);
      } catch (signErr: any) {
        if (signErr.code === 'ACTION_REJECTED' || signErr.message?.includes('rejected')) {
          toast.error('Signature rejected. Wallet connection cancelled.');
          return false;
        }
        throw signErr;
      }

      // Verify signature on client side
      const recoveredAddress = ethers.verifyMessage(message, signature);
      if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
        throw new Error('Signature verification failed - addresses do not match');
      }

      const walletPayload = {
        user_id: user.id,
        wallet_address: normalizedAddress,
        wallet_type: resolvedWalletType,
        chain_id: activeChainId,
        signature,
        message_signed: message,
        verified: true,
        verified_at: new Date().toISOString(),
        is_primary: connectedWallets.length === 0,
        is_active: true,
        connected_at: new Date().toISOString(),
        last_used_at: new Date().toISOString(),
      };

      if (reusableWallet) {
        const { error: updateError } = await (supabase as any)
          .from('connected_wallets')
          .update({
            ...walletPayload,
            is_primary: reusableWallet.is_primary || connectedWallets.length === 0,
          })
          .eq('id', reusableWallet.id)
          .eq('user_id', user.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await (supabase as any)
          .from('connected_wallets')
          .insert(walletPayload);

        if (insertError) {
          if (insertError.message?.includes('unique constraint')) {
            toast.error('This wallet is already connected to another account');
            return false;
          }
          throw insertError;
        }
      }

      toast.success('Wallet connected and verified successfully!');
      await fetchConnectedWallets();
      return true;
    } catch (err: any) {
      console.error('Error connecting wallet:', err);
      const errorMsg = err.message || 'Failed to connect wallet';
      setError(errorMsg);
      toast.error(errorMsg);
      return false;
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect wallet
  const disconnectWallet = async (walletId: string) => {
    try {
      const walletToDisconnect = connectedWallets.find((wallet) => wallet.id === walletId);
      const { error: updateError } = await (supabase as any)
        .from('connected_wallets')
        .update({
          is_active: false,
          is_primary: false,
          last_used_at: new Date().toISOString(),
        })
        .eq('id', walletId)
        .eq('user_id', user?.id);

      if (updateError) throw updateError;

      if (walletToDisconnect?.is_primary) {
        const replacementWallet = connectedWallets.find((wallet) => wallet.id !== walletId && wallet.is_active);
        if (replacementWallet) {
          await (supabase as any)
            .from('connected_wallets')
            .update({ is_primary: true })
            .eq('id', replacementWallet.id)
            .eq('user_id', user?.id);
        }
      }

      toast.success('Wallet disconnected');
      await fetchConnectedWallets();
    } catch (err: any) {
      console.error('Error disconnecting wallet:', err);
      toast.error('Failed to disconnect wallet: ' + err.message);
      setError('Failed to disconnect wallet');
    }
  };

  // Set primary wallet
  const setPrimaryWallet = async (walletId: string) => {
    try {
      // Remove primary from all user's wallets
      await (supabase as any)
        .from('connected_wallets')
        .update({ is_primary: false })
        .eq('user_id', user?.id)
        .eq('is_active', true);

      // Set new primary
      const { error: updateError } = await (supabase as any)
        .from('connected_wallets')
        .update({ is_primary: true })
        .eq('id', walletId)
        .eq('user_id', user?.id);

      if (updateError) throw updateError;

      toast.success('Primary wallet updated');
      await fetchConnectedWallets();
    } catch (err: any) {
      console.error('Error setting primary wallet:', err);
      toast.error('Failed to set primary wallet: ' + err.message);
      setError('Failed to set primary wallet');
    }
  };

  // Verify wallet ownership
  const verifyWallet = async (walletId: string): Promise<boolean> => {
    try {
      const wallet = connectedWallets.find((w) => w.id === walletId);
      if (!wallet || !wallet.signature || !wallet.message_signed) {
        toast.error('Wallet data incomplete - cannot verify');
        return false;
      }

      // Verify signature
      const recoveredAddress = ethers.verifyMessage(wallet.message_signed, wallet.signature);
      const isValid = recoveredAddress.toLowerCase() === wallet.wallet_address.toLowerCase();

      if (isValid) {
        const { error: updateError } = await (supabase as any)
          .from('connected_wallets')
          .update({ 
            verified: true, 
            verified_at: new Date().toISOString() 
          })
          .eq('id', walletId);

        if (updateError) throw updateError;
        
        toast.success('Wallet verified successfully!');
        await fetchConnectedWallets();
      } else {
        toast.error('Signature verification failed');
      }

      return isValid;
    } catch (err: any) {
      console.error('Error verifying wallet:', err);
      toast.error('Verification failed: ' + err.message);
      return false;
    }
  };

  const value: WalletContextType = {
    connectedWallets,
    primaryWallet,
    isConnecting,
    isLoading,
    error,
    connectWallet,
    disconnectWallet,
    setPrimaryWallet,
    verifyWallet,
    fetchConnectedWallets,
    refreshWallet,
    provider,
    signer,
    currentChainId: chainId,
    currentAddress: address,
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
