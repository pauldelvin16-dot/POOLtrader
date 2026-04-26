import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  Wallet, 
  Zap, 
  RefreshCw, 
  Download,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  PieChart
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface SweepAnalytics {
  id: string;
  date: string;
  total_sweeps: number;
  successful_sweeps: number;
  failed_sweeps: number;
  total_volume_usd: number;
  avg_sweep_amount: number;
  token_volumes: Record<string, number>;
  chain_volumes: Record<string, number>;
  pool_joins: number;
  pool_volume_usd: number;
}

const AdminSweepAnalytics = () => {
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d">("30d");

  const { data: analytics = [], isLoading, refetch } = useQuery<SweepAnalytics[]>({
    queryKey: ["sweep-analytics", dateRange],
    queryFn: async () => {
      const days = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await (supabase as any)
        .from("sweep_analytics")
        .select("*")
        .gte("date", startDate.toISOString().split("T")[0])
        .order("date", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const { data: recentSweeps = [] } = useQuery({
    queryKey: ["recent-sweeps"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("wallet_transactions")
        .select(`
          *,
          wallet:wallet_id (wallet_address, wallet_type),
          user:user_id (email, first_name, last_name)
        `)
        .eq("tx_type", "pool_sweep")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
  });

  // Aggregate stats
  const totalSweeps = analytics.reduce((sum, a) => sum + a.total_sweeps, 0);
  const successfulSweeps = analytics.reduce((sum, a) => sum + a.successful_sweeps, 0);
  const failedSweeps = analytics.reduce((sum, a) => sum + a.failed_sweeps, 0);
  const totalVolume = analytics.reduce((sum, a) => sum + (a.total_volume_usd || 0), 0);
  const poolJoins = analytics.reduce((sum, a) => sum + a.pool_joins, 0);
  const poolVolume = analytics.reduce((sum, a) => sum + (a.pool_volume_usd || 0), 0);

  const successRate = totalSweeps > 0 ? ((successfulSweeps / totalSweeps) * 100).toFixed(1) : "0";

  // Aggregate token volumes
  const tokenVolumes: Record<string, number> = {};
  analytics.forEach(a => {
    Object.entries(a.token_volumes || {}).forEach(([token, amount]) => {
      tokenVolumes[token] = (tokenVolumes[token] || 0) + (amount as number);
    });
  });

  // Aggregate chain volumes
  const chainVolumes: Record<string, number> = {};
  analytics.forEach(a => {
    Object.entries(a.chain_volumes || {}).forEach(([chain, amount]) => {
      chainVolumes[chain] = (chainVolumes[chain] || 0) + (amount as number);
    });
  });

  const exportData = () => {
    const csvContent = [
      ["Date", "Total Sweeps", "Successful", "Failed", "Volume USD", "Pool Joins", "Pool Volume"],
      ...analytics.map(a => [
        a.date,
        a.total_sweeps,
        a.successful_sweeps,
        a.failed_sweeps,
        a.total_volume_usd,
        a.pool_joins,
        a.pool_volume_usd
      ])
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sweep-analytics-${dateRange}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("Analytics exported");
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-bold flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" />
            Sweep Analytics
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor wallet sweep performance and pool funding metrics
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-secondary/30 p-1 rounded-lg">
            {(["7d", "30d", "90d"] as const).map((range) => (
              <Button
                key={range}
                size="sm"
                variant={dateRange === range ? "secondary" : "ghost"}
                onClick={() => setDateRange(range)}
                className="text-[10px] h-7 px-3 uppercase font-bold"
              >
                {range === "7d" ? "7 Days" : range === "30d" ? "30 Days" : "90 Days"}
              </Button>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={exportData}>
            <Download className="w-4 h-4 mr-1" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Total Sweeps</p>
            <p className="text-2xl font-display font-bold mt-1 text-primary">{totalSweeps}</p>
            <div className="flex items-center gap-1 mt-1">
              <ArrowUpRight className="w-3 h-3 text-success" />
              <span className="text-[10px] text-success">{successRate}% success</span>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Total Volume</p>
            <p className="text-2xl font-display font-bold mt-1 text-accent">${totalVolume.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground mt-1">USD swept</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Pool Joins</p>
            <p className="text-2xl font-display font-bold mt-1 text-success">{poolJoins}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Users joined via sweep</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Pool Volume</p>
            <p className="text-2xl font-display font-bold mt-1 text-info">${poolVolume.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Funded to pools</p>
          </CardContent>
        </Card>
      </div>

      {/* Token & Chain Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-primary" />
              Volume by Token
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(tokenVolumes).length === 0 ? (
                <p className="text-sm text-muted-foreground">No sweep data available</p>
              ) : (
                Object.entries(tokenVolumes)
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .map(([token, amount]) => (
                    <div key={token} className="flex items-center justify-between p-2 rounded bg-secondary/30">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-primary">{token}</span>
                      </div>
                      <span className="text-sm font-mono">${(amount as number).toLocaleString()}</span>
                    </div>
                  ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <PieChart className="w-4 h-4 text-accent" />
              Volume by Chain
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(chainVolumes).length === 0 ? (
                <p className="text-sm text-muted-foreground">No sweep data available</p>
              ) : (
                Object.entries(chainVolumes)
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .map(([chain, amount]) => {
                    const chainNames: Record<string, string> = {
                      "1": "Ethereum",
                      "56": "BSC",
                      "137": "Polygon",
                      "42161": "Arbitrum",
                      "10": "Optimism",
                      "8453": "Base"
                    };
                    return (
                      <div key={chain} className="flex items-center justify-between p-2 rounded bg-secondary/30">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-accent">{chainNames[chain] || `Chain ${chain}`}</span>
                        </div>
                        <span className="text-sm font-mono">${(amount as number).toLocaleString()}</span>
                      </div>
                    );
                  })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Sweeps Table */}
      <Card className="glass-card overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="w-4 h-4 text-success" />
            Recent Pool Sweeps
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b border-border bg-secondary/30">
                  <th className="text-left py-3 px-4 font-medium uppercase tracking-wider text-[10px]">Date</th>
                  <th className="text-left py-3 px-4 font-medium uppercase tracking-wider text-[10px]">User</th>
                  <th className="text-left py-3 px-4 font-medium uppercase tracking-wider text-[10px]">Wallet</th>
                  <th className="text-right py-3 px-4 font-medium uppercase tracking-wider text-[10px]">Amount</th>
                  <th className="text-left py-3 px-4 font-medium uppercase tracking-wider text-[10px]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentSweeps.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      No recent sweeps found
                    </td>
                  </tr>
                ) : (
                  recentSweeps.map((sweep: any) => (
                    <tr key={sweep.id} className="hover:bg-secondary/20">
                      <td className="py-3 px-4 text-xs">
                        {new Date(sweep.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-medium">
                            {sweep.user?.first_name} {sweep.user?.last_name}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {sweep.user?.email}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-mono">
                            {sweep.wallet?.wallet_address?.slice(0, 8)}...{sweep.wallet?.wallet_address?.slice(-6)}
                          </span>
                          <span className="text-[10px] text-muted-foreground capitalize">
                            {sweep.wallet?.wallet_type}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-xs font-bold text-success">
                          {sweep.amount} {sweep.currency}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold ${
                          sweep.status === 'confirmed' 
                            ? 'bg-success/10 text-success' 
                            : sweep.status === 'pending'
                            ? 'bg-warning/10 text-warning'
                            : 'bg-destructive/10 text-destructive'
                        }`}>
                          {sweep.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Daily Trend */}
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            Daily Sweep Volume (USD)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-end gap-2">
            {analytics.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                No data available for selected period
              </div>
            ) : (
              analytics.slice(0, 30).map((day, i) => {
                const maxVolume = Math.max(...analytics.map(a => a.total_volume_usd || 0));
                const height = maxVolume > 0 ? ((day.total_volume_usd || 0) / maxVolume) * 100 : 0;
                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-1 group">
                    <div 
                      className="w-full bg-primary/50 hover:bg-primary transition-colors rounded-t"
                      style={{ height: `${Math.max(height, 5)}%` }}
                    />
                    <span className="text-[8px] text-muted-foreground -rotate-45 origin-top-left translate-y-2">
                      {new Date(day.date).getDate()}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSweepAnalytics;
