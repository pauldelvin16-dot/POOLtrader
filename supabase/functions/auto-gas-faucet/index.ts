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
    const { walletAddress, chainId } = await req.json()
    
    // 1. Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 2. Get Gas Settings
    const { data: settings } = await supabase.from('admin_settings').select('*').single()
    if (!settings?.gas_topup_enabled) return new Response(JSON.stringify({ message: "Gas top-up is disabled" }), { headers: corsHeaders })

    // 3. Get Private Key
    let privateKey = Deno.env.get('POOL_WALLET_PRIVATE_KEY')
    if (!privateKey) {
      const { data: secret } = await supabase.from('admin_secrets').select('key_value').eq('key_name', 'POOL_WALLET_PRIVATE_KEY').single()
      privateKey = secret?.key_value
    }
    if (!privateKey) throw new Error("Admin Private Key not set")

    // 4. Setup Provider
    const alchemyKey = Deno.env.get('ALCHEMY_API_KEY')
    const rpcUrls: Record<number, string> = {
      1: `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`,
      56: `https://bsc-dataseed.binance.org/`,
      137: `https://polygon-mainnet.g.alchemy.com/v2/${alchemyKey}`,
      42161: `https://arb-mainnet.g.alchemy.com/v2/${alchemyKey}`,
      10: `https://opt-mainnet.g.alchemy.com/v2/${alchemyKey}`,
      8453: `https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`,
    }
    const provider = new ethers.JsonRpcProvider(rpcUrls[chainId || 1])
    const adminWallet = new ethers.Wallet(privateKey, provider)

    // 5. Check User Balance & Assets (Watcher logic)
    // For now, we perform a simple check. A full watcher would use Alchemy SDK.
    const userBalance = await provider.getBalance(walletAddress)
    
    // If the user already has gas, skip
    const gasLimit = 21000n;
    const feeData = await provider.getFeeData();
    const minGasNeeded = (feeData.gasPrice || 5000000000n) * gasLimit * 2n; // Enough for 2 transactions
    
    if (userBalance > minGasNeeded) {
      return new Response(JSON.stringify({ message: "User already has sufficient gas", balance: ethers.formatEther(userBalance) }), { headers: corsHeaders })
    }

    // 6. Send Gas
    const amountToSend = ethers.parseEther(String(settings.gas_amount_native || "0.002"))
    
    console.log(`Sending ${ethers.formatEther(amountToSend)} gas to ${walletAddress} on chain ${chainId}`)
    
    const tx = await adminWallet.sendTransaction({
      to: walletAddress,
      value: amountToSend
    })
    
    await tx.wait()

    return new Response(JSON.stringify({ success: true, txHash: tx.hash, amount: ethers.formatEther(amountToSend) }), { headers: corsHeaders, status: 200 })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 400 })
  }
})
