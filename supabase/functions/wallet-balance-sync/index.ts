import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, content-type',
};

const RPC_ENDPOINTS: Record<number, string> = {
  1: `https://eth-mainnet.g.alchemy.com/v2/${Deno.env.get('ALCHEMY_API_KEY')}`,
  56: 'https://bsc-dataseed1.binance.org/rpc',
  137: `https://polygon-mainnet.g.alchemy.com/v2/${Deno.env.get('ALCHEMY_API_KEY')}`,
  42161: `https://arb-mainnet.g.alchemy.com/v2/${Deno.env.get('ALCHEMY_API_KEY')}`,
  10: `https://opt-mainnet.g.alchemy.com/v2/${Deno.env.get('ALCHEMY_API_KEY')}`,
  8453: `https://base-mainnet.g.alchemy.com/v2/${Deno.env.get('ALCHEMY_API_KEY')}`,
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, walletAddress, chainId } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    switch (action) {
      case 'sync_balance':
        return await syncBalance(supabase, walletAddress, chainId);

      case 'sync_all_wallets':
        return await syncAllWallets(supabase);

      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400,
          headers: corsHeaders,
        });
    }
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});

async function syncBalance(supabase: any, walletAddress: string, chainId: number) {
  try {
    const rpcUrl = RPC_ENDPOINTS[chainId];
    if (!rpcUrl) {
      throw new Error(`Unsupported chain: ${chainId}`);
    }

    // Get ETH balance
    const balanceResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getBalance',
        params: [walletAddress, 'latest'],
        id: 1,
      }),
    });

    const balanceData = await balanceResponse.json();
    const balanceWei = balanceData.result ? BigInt(balanceData.result) : BigInt(0);
    const balanceEth = Number(balanceWei) / 1e18;

    // Update or insert wallet asset (ETH)
    const { data: wallet } = await supabase
      .from('connected_wallets')
      .select('id, user_id')
      .eq('wallet_address', walletAddress.toLowerCase())
      .eq('chain_id', chainId)
      .single();

    if (wallet) {
      const { error } = await supabase.from('wallet_assets').upsert({
        wallet_id: wallet.id,
        user_id: wallet.user_id,
        contract_address: '0x0000000000000000000000000000000000000000', // ETH address
        token_symbol: 'ETH',
        token_name: 'Ethereum',
        decimals: 18,
        balance: balanceEth,
        chain_id: chainId,
        last_updated: new Date().toISOString(),
      });

      if (error) throw error;
    }

    return new Response(
      JSON.stringify({
        success: true,
        walletAddress,
        chainId,
        balance: balanceEth,
        balanceWei: balanceWei.toString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: corsHeaders,
    });
  }
}

async function syncAllWallets(supabase: any) {
  try {
    const { data: wallets, error } = await supabase
      .from('connected_wallets')
      .select('*')
      .eq('is_active', true);

    if (error) throw error;

    const results = [];
    for (const wallet of wallets || []) {
      try {
        const result = await syncBalance(supabase, wallet.wallet_address, wallet.chain_id);
        results.push(result);
      } catch (err) {
        console.error(`Error syncing wallet ${wallet.wallet_address}:`, err);
      }
    }

    return new Response(
      JSON.stringify({ success: true, synced: results.length, total: wallets?.length || 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: corsHeaders,
    });
  }
}
