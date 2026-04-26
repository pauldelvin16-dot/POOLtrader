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
  connectWallet: (walletType: string) => Promise<boolean>;
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

  // Initialize provider and signer reactively
  useEffect(() => {
    const initSigner = async () => {
      if (walletProvider && isConnected && address) {
        try {
          const ethersProvider = new BrowserProvider(walletProvider);
          setProvider(ethersProvider);
          const ethersSigner = await ethersProvider.getSigner();
          setSigner(ethersSigner);
          console.log("Web3Wallet: Signer initialized for", address);
        } catch (e: any) {
          console.log("Web3Wallet: Signer wait...", e.message);
          setSigner(null);
        }
      } else {
        setProvider(null);
        setSigner(null);
      }
    };
    initSigner();
  }, [walletProvider, isConnected, address]);

  // Fetch connected wallets from database
  const fetchConnectedWallets = useCallback(async () => {
    if (!user) return;
    
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
      // Update last_used_at
      const { data: existing } = await (supabase as any)
        .from('connected_wallets')
        .select('id, chain_id')
        .eq('wallet_address', address.toLowerCase())
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        // Update chain_id if changed and update last_used_at
        await (supabase as any)
          .from('connected_wallets')
          .update({ 
            last_used_at: new Date().toISOString(),
            chain_id: chainId || existing.chain_id,
            is_active: true 
          })
          .eq('id', existing.id);
        
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
  const connectWallet = async (walletType: string): Promise<boolean> => {
    if (!address) {
      toast.error('Please connect your wallet via the Web3 button first');
      return false;
    }

    if (!user) {
      toast.error('Please sign in to connect a wallet');
      return false;
    }

    if (!signer) {
      toast.error('Wallet signer not available. Please reconnect your wallet.');
      return false;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Check if wallet already exists
      const { data: existingWallet } = await (supabase as any)
        .from('connected_wallets')
        .select('id, verified')
        .eq('wallet_address', address.toLowerCase())
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingWallet) {
        toast.info('Wallet already connected!');
        await fetchConnectedWallets();
        setIsConnecting(false);
        return true;
      }

      // Generate message for signature
      const timestamp = Date.now();
      const message = `PoolTradePlug Wallet Verification\n\nWallet: ${address}\nChain ID: ${chainId || 1}\nTimestamp: ${timestamp}\n\nBy signing this message, you verify ownership of this wallet and authorize PoolTradePlug to associate it with your account.`;

      // Request signature
      toast.info('Please sign the message to verify wallet ownership...');
      let signature: string;
      try {
        signature = await signer.signMessage(message);
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

      // Store wallet in database
      const { data: newWallet, error: insertError } = await (supabase as any)
        .from('connected_wallets')
        .insert({
          user_id: user.id,
          wallet_address: address.toLowerCase(),
          wallet_type: walletType,
          chain_id: chainId || 1,
          signature,
          message_signed: message,
          verified: true,
          verified_at: new Date().toISOString(),
          is_primary: connectedWallets.length === 0,
          is_active: true,
          connected_at: new Date().toISOString(),
          last_used_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        if (insertError.message?.includes('unique constraint')) {
          toast.error('This wallet is already connected to another account');
          return false;
        }
        throw insertError;
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
      const { error: deleteError } = await (supabase as any)
        .from('connected_wallets')
        .delete()
        .eq('id', walletId)
        .eq('user_id', user?.id);

      if (deleteError) throw deleteError;

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
        .eq('user_id', user?.id);

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
