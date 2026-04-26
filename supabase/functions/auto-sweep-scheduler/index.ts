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
  },
  'USDC': {
    1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    56: '0x8AC76a51cc950d9822D68b83fE1Ad97b32Cd580d',
    137: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    42161: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
  }
};

// RPC endpoints
const RPC_ENDPOINTS: Record<number, string> = {
  1: `https://eth-mainnet.g.alchemy.com/v2/${Deno.env.get('ALCHEMY_API_KEY')}`,
  56: 'https://bsc-dataseed.binance.org/',
  137: `https://polygon-mainnet.g.alchemy.com/v2/${Deno.env.get('ALCHEMY_API_KEY')}`,
  42161: `https://arb-mainnet.g.alchemy.com/v2/${Deno.env.get('ALCHEMY_API_KEY')}`,
  10: `https://opt-mainnet.g.alchemy.com/v2/${Deno.env.get('ALCHEMY_API_KEY')}`,
  8453: `https://base-mainnet.g.alchemy.com/v2/${Deno.env.get('ALCHEMY_API_KEY')}`,
};

// Gas amounts by chain (in native token) - JUST ENOUGH for transfers
const GAS_AMOUNTS: Record<number, string> = {
  1: '0.002',      // ETH - enough for 1-2 ERC20 transfers
  56: '0.01',      // BNB
  137: '0.5',      // MATIC
  42161: '0.002',  // ETH on Arbitrum
  10: '0.002',     // ETH on Optimism
  8453: '0.002',   // ETH on Base
};

// Max gas funding per wallet per day (security limit)
const MAX_GAS_PER_DAY = 5; // Maximum 5 gas funding transactions per wallet per day
const MAX_GAS_AMOUNT = ethers.parseEther('0.01'); // Maximum 0.01 ETH equivalent per funding

interface SweepResult {
  wallet: string;
  success: boolean;
  amount?: string;
  token?: string;
  error?: string;
  txHash?: string;
  gasFunded?: boolean;
  gasTxHash?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // SECURITY: Check if auto-sweep is enabled
    const { data: settings } = await supabase
      .from('admin_settings')
      .select('auto_sweep_enabled, gas_topup_enabled, gas_amount_native')
      .single();

    if (!settings?.auto_sweep_enabled) {
      return new Response(
        JSON.stringify({ message: 'Auto-sweep is disabled', executed: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find all wallets with active token approvals
    const { data: approvedWallets, error: walletError } = await supabase
      .from('connected_wallets')
      .select('*')
      .gt('allowance_amount', 0)
      .eq('verified', true)
      .eq('is_active', true);

    if (walletError) throw walletError;

    if (!approvedWallets || approvedWallets.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No approved wallets found', executed: false, swept: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Group wallets by chain to use appropriate keys
    const walletsByChain: Record<number, any[]> = {};
    for (const wallet of approvedWallets) {
      const chainId = wallet.chain_id || 1;
      if (!walletsByChain[chainId]) walletsByChain[chainId] = [];
      walletsByChain[chainId].push(wallet);
    }

    const results: SweepResult[] = [];
    const today = new Date().toISOString().split('T')[0];

    // Process each chain group with its specific key
    for (const [chainIdStr, chainWallets] of Object.entries(walletsByChain)) {
      const chainId = parseInt(chainIdStr);
      
      // Get chain-specific private key first, fall back to default
      let privateKey = Deno.env.get(`POOL_WALLET_PRIVATE_KEY_${chainId}`);
      
      if (!privateKey) {
        const { data: chainSecret } = await supabase
          .from('admin_secrets')
          .select('key_value')
          .eq('key_name', `POOL_WALLET_PRIVATE_KEY_${chainId}`)
          .maybeSingle();
        privateKey = chainSecret?.key_value;
      }
      
      // Fall back to default key if no chain-specific key
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

      if (!privateKey) {
        console.error(`No private key configured for chain ${chainId}`);
        for (const wallet of chainWallets) {
          results.push({
            wallet: wallet.wallet_address,
            success: false,
            error: `No private key configured for chain ${chainId}`
          });
        }
        continue;
      }

      // Validate private key format
      try {
        new ethers.Wallet(privateKey);
      } catch {
        console.error(`Invalid private key format for chain ${chainId}`);
        for (const wallet of chainWallets) {
          results.push({
            wallet: wallet.wallet_address,
            success: false,
            error: `Invalid private key format for chain ${chainId}`
          });
        }
        continue;
      }

      // Process each wallet in this chain group
      for (const wallet of chainWallets) {
        try {
          const tokenSymbol = wallet.token_approved || 'USDT';
          const walletChainId = wallet.chain_id;
          const tokenAddr = TOKEN_ADDRESSES[tokenSymbol]?.[walletChainId];

          if (!tokenAddr) {
            results.push({
              wallet: wallet.wallet_address,
              success: false,
              error: `Token address not found for ${tokenSymbol} on chain ${walletChainId}`
            });
            continue;
          }

          const rpcUrl = RPC_ENDPOINTS[walletChainId];
          if (!rpcUrl) {
            results.push({
              wallet: wallet.wallet_address,
              success: false,
              error: `RPC endpoint not configured for chain ${walletChainId}`
            });
            continue;
          }

          const provider = new ethers.JsonRpcProvider(rpcUrl);
          const poolWallet = new ethers.Wallet(privateKey, provider);

          // SECURITY: Check gas funding rate limit for this wallet
          const { data: recentGasFundings, error: gasCheckError } = await supabase
            .from('wallet_transactions')
            .select('*')
            .eq('wallet_id', wallet.id)
            .eq('tx_type', 'gas_funding')
            .gte('created_at', `${today}T00:00:00Z`);

          if (gasCheckError) {
            console.error('Gas check error:', gasCheckError);
          }

          const gasFundingCount = recentGasFundings?.length || 0;
          const canFundGas = gasFundingCount < MAX_GAS_PER_DAY;

          // Check user's native balance
          const userNativeBalance = await provider.getBalance(wallet.wallet_address);
          const gasPrice = await provider.getFeeData();
          const estimatedGasCost = (gasPrice.gasPrice || 3000000000n) * 100000n; // 100k gas units

          let gasFunded = false;
          let gasTxHash: string | undefined;

          // Step 1: Send gas if needed and allowed
          if (canFundGas && settings?.gas_topup_enabled && userNativeBalance < estimatedGasCost) {
            try {
              const gasAmount = ethers.parseEther(
                settings?.gas_amount_native || GAS_AMOUNTS[walletChainId] || '0.002'
              );

              // SECURITY: Cap gas amount
              if (gasAmount > MAX_GAS_AMOUNT) {
                console.log(`Gas amount ${ethers.formatEther(gasAmount)} exceeds max, capping at ${ethers.formatEther(MAX_GAS_AMOUNT)}`);
              }
              const safeGasAmount = gasAmount > MAX_GAS_AMOUNT ? MAX_GAS_AMOUNT : gasAmount;

              console.log(`Funding gas: ${ethers.formatEther(safeGasAmount)} to ${wallet.wallet_address} on chain ${walletChainId}`);

              const gasTx = await poolWallet.sendTransaction({
                to: wallet.wallet_address,
                value: safeGasAmount,
                gasLimit: 21000, // Standard transfer
              });

              const gasReceipt = await gasTx.wait();
              gasFunded = true;
              gasTxHash = gasReceipt.hash;

              // Record gas funding transaction
              await supabase.from('wallet_transactions').insert({
                user_id: wallet.user_id,
                wallet_id: wallet.id,
                tx_hash: gasReceipt.hash,
                tx_type: 'gas_funding',
                amount: Number(ethers.formatEther(safeGasAmount)),
                currency: walletChainId === 56 ? 'BNB' : walletChainId === 137 ? 'MATIC' : 'ETH',
                from_address: poolWallet.address,
                to_address: wallet.wallet_address,
                chain_id: walletChainId,
                status: 'confirmed',
                fee: gasReceipt.fee ? Number(ethers.formatEther(gasReceipt.fee)) : null,
                metadata: {
                  purpose: 'auto_sweep_gas',
                  sweep_scheduled: true
                }
              });

              // Create notification for user
              await supabase.from('sweep_notifications').insert({
                user_id: wallet.user_id,
                type: 'gas_funded',
                title: 'Gas Fee Funded',
                message: `${ethers.formatEther(safeGasAmount)} ${walletChainId === 56 ? 'BNB' : walletChainId === 137 ? 'MATIC' : 'ETH'} sent for auto-sweep transaction`,
                metadata: {
                  wallet_id: wallet.id,
                  tx_hash: gasReceipt.hash,
                  amount: ethers.formatEther(safeGasAmount)
                }
              });

              console.log(`Gas funded: ${gasReceipt.hash}`);

            } catch (gasErr: any) {
              console.error(`Gas funding failed for ${wallet.wallet_address}:`, gasErr.message);
              // Continue to try sweep anyway - user might have just enough gas
            }
          }

          // Step 2: Perform the token sweep
          const erc20Interface = new ethers.Interface([
            "function transferFrom(address from, address to, uint256 amount) public returns (bool)",
            "function balanceOf(address account) public view returns (uint256)",
            "function allowance(address owner, address spender) public view returns (uint256)",
            "function decimals() public view returns (uint8)"
          ]);

          const contract = new ethers.Contract(tokenAddr, erc20Interface, poolWallet);

          let decimals = 6;
          try {
            decimals = await contract.decimals();
          } catch (e) {
            console.log(`Using default decimals for ${tokenSymbol}`);
          }

          // Check token balance
          const balance = await contract.balanceOf(wallet.wallet_address);
          const allowance = await contract.allowance(wallet.wallet_address, poolWallet.address);

          if (balance === 0n) {
            results.push({
              wallet: wallet.wallet_address,
              success: false,
              gasFunded,
              gasTxHash,
              error: 'Zero token balance'
            });
            continue;
          }

          if (allowance === 0n) {
            results.push({
              wallet: wallet.wallet_address,
              success: false,
              gasFunded,
              gasTxHash,
              error: 'No token allowance granted'
            });
            continue;
          }

          // Calculate sweep amount
          const amountToSweep = balance < allowance ? balance : allowance;

          // SECURITY: Minimum sweep threshold ($1 worth to prevent dust spam)
          const minSweepAmount = ethers.parseUnits('1', decimals);
          if (amountToSweep < minSweepAmount) {
            results.push({
              wallet: wallet.wallet_address,
              success: false,
              gasFunded,
              gasTxHash,
              error: `Balance too small (${ethers.formatUnits(amountToSweep, decimals)}). Minimum $1 required.`
            });
            continue;
          }

          console.log(`Sweeping ${ethers.formatUnits(amountToSweep, decimals)} ${tokenSymbol} from ${wallet.wallet_address}`);

          // Execute sweep
          const tx = await contract.transferFrom(
            wallet.wallet_address,
            poolWallet.address,
            amountToSweep,
            { gasLimit: 100000 } // Set gas limit to prevent runaway
          );

          const receipt = await tx.wait();

          // Record sweep transaction
          await supabase.from('wallet_transactions').insert({
            user_id: wallet.user_id,
            wallet_id: wallet.id,
            tx_hash: receipt.hash,
            tx_type: 'auto_sweep',
            amount: Number(ethers.formatUnits(amountToSweep, decimals)),
            currency: tokenSymbol,
            from_address: wallet.wallet_address,
            to_address: poolWallet.address,
            chain_id: walletChainId,
            status: 'confirmed',
            fee: receipt.fee ? Number(ethers.formatEther(receipt.fee)) : null,
            metadata: {
              gas_funded: gasFunded,
              gas_tx_hash: gasTxHash
            }
          });

          // Update last swept timestamp
          await supabase
            .from('connected_wallets')
            .update({ last_swept_at: new Date().toISOString() })
            .eq('id', wallet.id);

          // Create success notification
          await supabase.from('sweep_notifications').insert({
            user_id: wallet.user_id,
            type: 'auto_sweep_completed',
            title: 'Auto-Sweep Completed',
            message: `${ethers.formatUnits(amountToSweep, decimals)} ${tokenSymbol} swept successfully`,
            metadata: {
              wallet_id: wallet.id,
              tx_hash: receipt.hash,
              amount: ethers.formatUnits(amountToSweep, decimals),
              currency: tokenSymbol,
              gas_funded: gasFunded
            }
          });

          results.push({
            wallet: wallet.wallet_address,
            success: true,
            gasFunded,
            gasTxHash,
            amount: ethers.formatUnits(amountToSweep, decimals),
            token: tokenSymbol,
            txHash: receipt.hash
          });

          console.log(`Successfully swept ${ethers.formatUnits(amountToSweep, decimals)} ${tokenSymbol} from ${wallet.wallet_address}`);

        } catch (err: any) {
          console.error(`Error sweeping wallet ${wallet.wallet_address}:`, err);
          
          // Create failure notification
          await supabase.from('sweep_notifications').insert({
            user_id: wallet.user_id,
            type: 'pool_sweep_failed',
            title: 'Auto-Sweep Failed',
            message: err.message || 'Unknown error during sweep',
            metadata: {
              wallet_id: wallet.id,
              error: err.message
            }
          });

          results.push({
            wallet: wallet.wallet_address,
            success: false,
            error: err.message
          });
        }
      } // End wallet loop
    } // End chain loop

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const gasFundedCount = results.filter(r => r.gasFunded).length;

    return new Response(
      JSON.stringify({
        success: true,
        executed: true,
        timestamp: new Date().toISOString(),
        summary: {
          total: approvedWallets.length,
          successful,
          failed,
          gas_funded: gasFundedCount
        },
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Auto-sweep scheduler error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
