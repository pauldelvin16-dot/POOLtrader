import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

interface WalletDetails {
  address: string;
  chainId: number;
  balance: string;
  balanceFormatted: string;
  ensName?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, userId, walletAddress, chainId } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    switch (action) {
      case 'verify_wallet':
        return await verifyWallet(supabase, userId, walletAddress, chainId);

      case 'update_wallet_balance':
        return await updateWalletBalance(supabase, userId, walletAddress, chainId);

      case 'get_wallet_transactions':
        return await getWalletTransactions(supabase, userId, walletAddress);

      case 'record_transaction':
        return await recordTransaction(supabase, userId, walletAddress, req.json());

      default:
        return new Response(
          JSON.stringify({ error: 'Unknown action' }),
          { status: 400, headers: corsHeaders }
        );
    }
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});

async function verifyWallet(supabase: any, userId: string, walletAddress: string, chainId: number) {
  try {
    // Update wallet as verified in database
    const { data, error } = await supabase
      .from('connected_wallets')
      .update({
        verified: true,
        verified_at: new Date().toISOString(),
      })
      .eq('wallet_address', walletAddress.toLowerCase())
      .eq('chain_id', chainId)
      .select();

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

async function updateWalletBalance(supabase: any, userId: string, walletAddress: string, chainId: number) {
  try {
    // This would integrate with a blockchain RPC provider
    // For now, we're setting up the structure

    const { data, error } = await supabase
      .from('connected_wallets')
      .update({
        last_used_at: new Date().toISOString(),
      })
      .eq('wallet_address', walletAddress.toLowerCase())
      .eq('chain_id', chainId)
      .select();

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

async function getWalletTransactions(supabase: any, userId: string, walletAddress: string) {
  try {
    const { data, error } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('from_address', walletAddress.toLowerCase())
      .or(`to_address.eq.${walletAddress.toLowerCase()}`)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

async function recordTransaction(supabase: any, userId: string, walletAddress: string, body: any) {
  try {
    const { tx_hash, tx_type, amount, currency, to_address, chain_id } = body;
    const { data: walletData, error: walletError } = await supabase
      .from('connected_wallets')
      .select('id')
      .eq('wallet_address', walletAddress.toLowerCase())
      .eq('chain_id', chain_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (walletError) throw walletError;
    if (!walletData?.id) throw new Error('Connected wallet not found for this transaction.');

    const { data, error } = await supabase
      .from('wallet_transactions')
      .insert([
        {
          user_id: userId,
          wallet_id: walletData.id,
          tx_hash,
          tx_type,
          amount,
          currency,
          from_address: walletAddress.toLowerCase(),
          to_address,
          chain_id,
          status: 'pending',
        },
      ])
      .select();

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}
