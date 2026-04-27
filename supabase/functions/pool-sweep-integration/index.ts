import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { ethers } from 'https://esm.sh/ethers@6.7.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, content-type',
};

// Token addresses by chain
const TOKEN_ADDRESSES: Record<string, Record<number, string>> = {
  'USDT': {
    1: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    56: '0x55d398326f99059fF775485246999027B3197955',
    137: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    42161: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    // Solana USDT
    101: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    102: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    103: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  },
  'USDC': {
    1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    56: '0x8AC76a51cc950d9822D68b83fE1Ad97b32Cd580d',
    137: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    42161: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
    // Solana USDC
    101: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    102: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    103: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  }
};

// Solana-specific token addresses (SPL tokens)
const SOLANA_TOKENS: Record<string, Record<number, string>> = {
  'SOL': {
    101: 'So11111111111111111111111111111111111111112', // Wrapped SOL
    102: 'So11111111111111111111111111111111111111112',
    103: 'So11111111111111111111111111111111111111112',
  },
  'BONK': {
    101: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  },
  'JUP': {
    101: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  }
};

// RPC endpoints
const ALCHEMY_KEY = Deno.env.get('ALCHEMY_API_KEY') || '';
const RPC_ENDPOINTS: Record<number, string> = {
  1: ALCHEMY_KEY ? `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}` : 'https://cloudflare-eth.com',
  56: 'https://bsc-dataseed.binance.org/',
  137: ALCHEMY_KEY ? `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}` : 'https://polygon-rpc.com',
  42161: ALCHEMY_KEY ? `https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}` : 'https://arb1.arbitrum.io/rpc',
  10: ALCHEMY_KEY ? `https://opt-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}` : 'https://mainnet.optimism.io',
  8453: ALCHEMY_KEY ? `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}` : 'https://mainnet.base.org',
  // Solana RPC endpoints
  101: 'https://api.mainnet-beta.solana.com',
  102: 'https://api.testnet.solana.com',
  103: 'https://api.devnet.solana.com',
};

// Helper to check if chain is Solana
const isSolanaChain = (chainId: number): boolean => {
  return chainId === 101 || chainId === 102 || chainId === 103;
};

// Helper to get chain name
const getChainName = (chainId: number): string => {
  const names: Record<number, string> = {
    1: 'Ethereum', 56: 'BSC', 137: 'Polygon', 42161: 'Arbitrum',
    10: 'Optimism', 8453: 'Base',
    101: 'Solana', 102: 'Solana Testnet', 103: 'Solana Devnet'
  };
  return names[chainId] || `Chain ${chainId}`;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, userId, poolId, walletId, autoJoin } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    switch (action) {
      case 'sweep_and_join_pool':
        return await sweepAndJoinPool(supabase, userId, poolId, walletId, autoJoin);
      
      case 'sweep_all_for_pools':
        return await sweepAllForPools(supabase, userId);
      
      case 'get_sweep_eligible_pools':
        return await getSweepEligiblePools(supabase, userId);
      
      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

  } catch (error: any) {
    console.error('Pool sweep integration error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function normalizePrivateKey(input: string): string {
  const trimmed = input.trim();
  const no0x = trimmed.startsWith('0x') ? trimmed.slice(2) : trimmed;
  if (!/^[0-9a-fA-F]{64}$/.test(no0x)) {
    throw new Error('Invalid private key format');
  }
  return `0x${no0x}`;
}

async function getChainPrivateKey(supabase: any, chainId: number): Promise<string | null> {
  // Try chain-specific key first
  let privateKey = Deno.env.get(`POOL_WALLET_PRIVATE_KEY_${chainId}`);
  
  if (!privateKey) {
    const { data: chainSecret } = await supabase
      .from('admin_secrets')
      .select('key_value')
      .eq('key_name', `POOL_WALLET_PRIVATE_KEY_${chainId}`)
      .maybeSingle();
    privateKey = chainSecret?.key_value;
  }
  
  // Fall back to default key
  if (!privateKey) {
    privateKey = Deno.env.get('POOL_WALLET_PRIVATE_KEY');
    if (!privateKey) {
      const { data: defaultSecret } = await supabase
        .from('admin_secrets')
        .select('key_value')
        .eq('key_name', 'POOL_WALLET_PRIVATE_KEY')
        .maybeSingle();
      privateKey = defaultSecret?.key_value;
    }
  }

  if (!privateKey) return null;
  return normalizePrivateKey(privateKey);
}

async function sweepAndJoinPool(supabase: any, userId: string, poolId: string, walletId: string, autoJoin: boolean = true) {
  try {
    // Get wallet details
    const { data: wallet, error: walletError } = await supabase
      .from('connected_wallets')
      .select('*')
      .eq('id', walletId)
      .eq('user_id', userId)
      .single();

    if (walletError || !wallet) {
      throw new Error('Wallet not found or not authorized');
    }

    if (!wallet.verified || (wallet.allowance_amount || 0) <= 0) {
      throw new Error('Wallet not verified or no token approval granted');
    }

    const chainId = wallet.chain_id;
    
    // Get chain-specific private key
    const privateKey = await getChainPrivateKey(supabase, chainId);
    if (!privateKey) {
      throw new Error(`No private key configured for chain ${chainId}`);
    }

    // Get pool details
    const { data: pool, error: poolError } = await supabase
      .from('pools')
      .select('*')
      .eq('id', poolId)
      .single();

    if (poolError || !pool) {
      throw new Error('Pool not found');
    }

    if (pool.status !== 'open') {
      throw new Error('Pool is not open for joining');
    }

    // Get pool wallet address
    const { data: poolAddress } = await supabase
      .from('pool_addresses')
      .select('*')
      .eq('chain_id', chainId)
      .eq('is_active', true)
      .maybeSingle();

    if (!poolAddress) {
      throw new Error(`No pool wallet configured for chain ${chainId}`);
    }

    const tokenSymbol = wallet.token_approved || 'USDT';
    const tokenAddr = TOKEN_ADDRESSES[tokenSymbol]?.[chainId];

    if (!tokenAddr) {
      throw new Error(`Token address not found for ${tokenSymbol} on chain ${chainId}`);
    }

    const rpcUrl = RPC_ENDPOINTS[chainId];
    if (!rpcUrl) {
      throw new Error(`RPC not configured for chain ${chainId}`);
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const poolWallet = new ethers.Wallet(privateKey, provider);

    // ERC20 interface
    const erc20Interface = new ethers.Interface([
      "function transferFrom(address from, address to, uint256 amount) public returns (bool)",
      "function balanceOf(address account) public view returns (uint256)",
      "function allowance(address owner, address spender) public view returns (uint256)",
      "function decimals() public view returns (uint8)"
    ]);

    const contract = new ethers.Contract(tokenAddr, erc20Interface, poolWallet);

    // Get token decimals
    let decimals = 6;
    try {
      decimals = await contract.decimals();
    } catch (e) {
      console.log('Using default decimals');
    }

    // Check balance and allowance
    const balance = await contract.balanceOf(wallet.wallet_address);
    const allowance = await contract.allowance(wallet.wallet_address, poolWallet.address);

    if (balance === 0n) {
      throw new Error('No tokens to sweep - wallet balance is zero');
    }

    if (allowance === 0n) {
      throw new Error('No token allowance granted');
    }

    // Calculate amount to sweep
    const amountToSweep = balance < allowance ? balance : allowance;

    // Minimum sweep threshold (e.g., $10 worth)
    const minSweepAmount = ethers.parseUnits('10', decimals);
    if (amountToSweep < minSweepAmount) {
      throw new Error(`Sweep amount too small. Minimum $10 required. Current: $${ethers.formatUnits(amountToSweep, decimals)}`);
    }

    // Execute sweep
    console.log(`Sweeping ${ethers.formatUnits(amountToSweep, decimals)} ${tokenSymbol} from ${wallet.wallet_address}`);
    
    const tx = await contract.transferFrom(
      wallet.wallet_address,
      poolWallet.address,
      amountToSweep
    );

    const receipt = await tx.wait();

    const sweepAmount = Number(ethers.formatUnits(amountToSweep, decimals));

    // Record sweep transaction
    await supabase.from('wallet_transactions').insert({
      user_id: userId,
      wallet_id: walletId,
      tx_hash: receipt.hash,
      tx_type: 'pool_sweep',
      amount: sweepAmount,
      currency: tokenSymbol,
      from_address: wallet.wallet_address,
      to_address: poolWallet.address,
      chain_id: chainId,
      status: 'confirmed',
      metadata: {
        pool_id: poolId,
        pool_name: pool.name,
        auto_join: autoJoin
      }
    });

    // Update last swept timestamp
    await supabase
      .from('connected_wallets')
      .update({ last_swept_at: new Date().toISOString() })
      .eq('id', walletId);

    // Create notification
    await supabase.from('sweep_notifications').insert({
      user_id: userId,
      type: 'pool_sweep_success',
      title: 'Pool Sweep Completed',
      message: `Successfully swept ${sweepAmount} ${tokenSymbol} for pool "${pool.name}"`,
      metadata: {
        pool_id: poolId,
        pool_name: pool.name,
        amount: sweepAmount,
        currency: tokenSymbol,
        tx_hash: receipt.hash
      }
    });

    let joinResult = null;

    // Auto-join pool if enabled
    if (autoJoin) {
      // Check if user already joined
      const { data: existingJoin } = await supabase
        .from('pool_participants')
        .select('*')
        .eq('pool_id', poolId)
        .eq('user_id', userId)
        .maybeSingle();

      if (!existingJoin) {
        // Add user to pool
        const { data: joinData, error: joinError } = await supabase
          .from('pool_participants')
          .insert({
            pool_id: poolId,
            user_id: userId,
            joined_at: new Date().toISOString(),
            contribution_amount: sweepAmount,
            contribution_currency: tokenSymbol,
            status: 'active'
          })
          .select()
          .single();

        if (!joinError) {
          joinResult = joinData;
          
          // Update pool current amount
          await supabase.rpc('increment_pool_amount', {
            pool_id: poolId,
            amount: sweepAmount
          });

          // Create join notification
          await supabase.from('sweep_notifications').insert({
            user_id: userId,
            type: 'pool_join_success',
            title: 'Pool Joined',
            message: `You have successfully joined pool "${pool.name}" with ${sweepAmount} ${tokenSymbol}`,
            metadata: {
              pool_id: poolId,
              pool_name: pool.name,
              contribution: sweepAmount,
              currency: tokenSymbol
            }
          });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sweep: {
          tx_hash: receipt.hash,
          amount: sweepAmount,
          currency: tokenSymbol,
          from: wallet.wallet_address,
          to: poolWallet.address
        },
        pool_join: joinResult,
        message: `Successfully swept ${sweepAmount} ${tokenSymbol}${joinResult ? ' and joined pool' : ''}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Sweep and join error:', error);
    
    // Create failure notification
    await supabase.from('sweep_notifications').insert({
      user_id: userId,
      type: 'pool_sweep_failed',
      title: 'Pool Sweep Failed',
      message: error.message,
      metadata: {
        pool_id: poolId,
        wallet_id: walletId,
        error: error.message
      }
    });

    throw error;
  }
}

async function sweepAllForPools(supabase: any, userId: string) {
  // Get all verified wallets with approvals
  const { data: wallets, error } = await supabase
    .from('connected_wallets')
    .select('*')
    .eq('user_id', userId)
    .eq('verified', true)
    .gt('allowance_amount', 0)
    .eq('is_active', true);

  if (error) throw error;
  if (!wallets || wallets.length === 0) {
    return new Response(
      JSON.stringify({ success: false, message: 'No sweep-eligible wallets found' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get open pools
  const { data: pools } = await supabase
    .from('pools')
    .select('*')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(1);

  if (!pools || pools.length === 0) {
    return new Response(
      JSON.stringify({ success: false, message: 'No open pools available' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const results = [];
  
  // Try to sweep each wallet into the most recent pool
  for (const wallet of wallets) {
    try {
      const result = await sweepAndJoinPool(
        supabase, 
        userId, 
        pools[0].id, 
        wallet.id, 
        true
      );
      const resultData = await result.json();
      results.push({ wallet: wallet.wallet_address, ...resultData });
    } catch (err: any) {
      results.push({ 
        wallet: wallet.wallet_address, 
        success: false, 
        error: err.message 
      });
    }
  }

  const successful = results.filter((r: any) => r.success).length;

  return new Response(
    JSON.stringify({
      success: true,
      summary: {
        total: wallets.length,
        successful,
        failed: wallets.length - successful
      },
      results
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function getSweepEligiblePools(supabase: any, userId: string) {
  // Get user's sweep-eligible wallets
  const { data: wallets } = await supabase
    .from('connected_wallets')
    .select('*')
    .eq('user_id', userId)
    .eq('verified', true)
    .gt('allowance_amount', 0)
    .eq('is_active', true);

  // Get open pools
  const { data: pools } = await supabase
    .from('pools')
    .select('*')
    .eq('status', 'open');

  // Get user's current participations
  const { data: participations } = await supabase
    .from('pool_participants')
    .select('pool_id')
    .eq('user_id', userId);

  const joinedPoolIds = new Set(participations?.map((p: any) => p.pool_id) || []);

  return new Response(
    JSON.stringify({
      eligible_wallets: wallets || [],
      open_pools: pools || [],
      joined_pools: Array.from(joinedPoolIds),
      can_sweep: (wallets || []).length > 0 && (pools || []).length > 0
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
