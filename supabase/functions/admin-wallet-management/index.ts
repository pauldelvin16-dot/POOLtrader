import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { jwtDecode } from 'https://esm.sh/jwt-decode@4.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, content-type',
};

interface AdminRequest {
  action: 'list_user_wallets' | 'get_wallet_stats' | 'get_wallet_health' | 'list_all_wallets' | 'verify_wallet' | 'update_wallet_status';
  userId?: string;
  walletId?: string;
  status?: string;
}

/**
 * Verify admin authorization
 */
function verifyAdmin(authHeader: string): string | null {
  try {
    const token = authHeader.replace('Bearer ', '');
    const decoded: any = jwtDecode(token);
    
    if (decoded.role === 'admin' || decoded.email?.endsWith('@pooltrader.admin')) {
      return decoded.sub;
    }
    return null;
  } catch (err) {
    console.error('Token verification error:', err);
    return null;
  }
}

/**
 * List wallets for a specific user
 */
async function listUserWallets(supabase: any, userId: string) {
  try {
    const { data, error } = await supabase
      .from('connected_wallets')
      .select(`
        id,
        user_id,
        wallet_address,
        wallet_type,
        chain_id,
        is_primary,
        verified,
        is_active,
        connected_at,
        last_used_at,
        allowance_amount,
        token_approved,
        handshake_status,
        metadata
      `)
      .eq('user_id', userId)
      .order('is_primary', { ascending: false })
      .order('connected_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: {
        user_id: userId,
        wallets: data || [],
        total: data?.length || 0,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Get comprehensive wallet statistics
 */
async function getWalletStats(supabase: any, userId: string) {
  try {
    const { data, error } = await supabase.rpc('get_wallet_stats', {
      p_user_id: userId,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    const stats = data?.[0] || {};
    
    // Get sweep stats
    const { data: sweepStats, error: sweepError } = await supabase.rpc('get_sweep_stats', {
      p_user_id: userId,
    });

    if (!sweepError && sweepStats?.[0]) {
      Object.assign(stats, sweepStats[0]);
    }

    return {
      success: true,
      data: {
        user_id: userId,
        wallet_stats: stats,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Check wallet health
 */
async function checkWalletHealth(supabase: any, walletId: string) {
  try {
    const { data, error } = await supabase.rpc('check_wallet_health', {
      p_wallet_id: walletId,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    const health = data?.[0] || {};
    
    return {
      success: true,
      data: {
        wallet_id: walletId,
        health: health,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * List all wallets across users (admin only)
 */
async function listAllWallets(supabase: any, limit: number = 100, offset: number = 0) {
  try {
    const { data, error, count } = await supabase
      .from('connected_wallets')
      .select(`
        id,
        user_id,
        wallet_address,
        wallet_type,
        chain_id,
        verified,
        is_active,
        connected_at,
        allowance_amount,
        handshake_status
      `, { count: 'exact' })
      .order('connected_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: {
        wallets: data || [],
        pagination: {
          limit,
          offset,
          total: count || 0,
        },
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Verify a wallet (admin action)
 */
async function verifyWallet(supabase: any, walletId: string, verified: boolean) {
  try {
    const { error } = await supabase
      .from('connected_wallets')
      .update({
        verified,
        verified_at: verified ? new Date().toISOString() : null,
      })
      .eq('id', walletId);

    if (error) {
      return { success: false, error: error.message };
    }

    // Log activity
    const { data: wallet } = await supabase
      .from('connected_wallets')
      .select('user_id')
      .eq('id', walletId)
      .single();

    if (wallet?.user_id) {
      await supabase
        .from('wallet_activity')
        .insert({
          user_id: wallet.user_id,
          wallet_id: walletId,
          activity_type: verified ? 'verified' : 'failed_verification',
          details: { admin_action: true },
        })
        .catch(() => {});
    }

    return {
      success: true,
      message: `Wallet ${verified ? 'verified' : 'unverified'} successfully`,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Update wallet status
 */
async function updateWalletStatus(
  supabase: any,
  walletId: string,
  status: 'active' | 'inactive' | 'suspended'
) {
  try {
    const statusMap: Record<string, any> = {
      active: { is_active: true },
      inactive: { is_active: false },
      suspended: { is_active: false, handshake_status: 'failed' },
    };

    const { error } = await supabase
      .from('connected_wallets')
      .update({
        ...statusMap[status],
        updated_at: new Date().toISOString(),
      })
      .eq('id', walletId);

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      message: `Wallet status updated to ${status}`,
    };
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
    const authHeader = req.headers.get('authorization') || '';
    const adminId = verifyAdmin(authHeader);

    if (!adminId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized: Admin access required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { action, userId, walletId, status } = body;

    // Validate environment
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Log admin action
    console.log(`Admin action: ${action} by ${adminId}`, { userId, walletId });

    let result: any;

    switch (action) {
      case 'list_user_wallets':
        if (!userId) {
          result = { success: false, error: 'userId is required' };
          break;
        }
        result = await listUserWallets(supabase, userId);
        break;

      case 'get_wallet_stats':
        if (!userId) {
          result = { success: false, error: 'userId is required' };
          break;
        }
        result = await getWalletStats(supabase, userId);
        break;

      case 'get_wallet_health':
        if (!walletId) {
          result = { success: false, error: 'walletId is required' };
          break;
        }
        result = await checkWalletHealth(supabase, walletId);
        break;

      case 'list_all_wallets':
        result = await listAllWallets(supabase, body.limit || 100, body.offset || 0);
        break;

      case 'verify_wallet':
        if (!walletId) {
          result = { success: false, error: 'walletId is required' };
          break;
        }
        result = await verifyWallet(supabase, walletId, body.verified !== false);
        break;

      case 'update_wallet_status':
        if (!walletId || !status) {
          result = { success: false, error: 'walletId and status are required' };
          break;
        }
        result = await updateWalletStatus(supabase, walletId, status);
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
