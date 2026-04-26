import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PoolSweepParams {
  poolId: string;
  walletId: string;
  autoJoin?: boolean;
}

export interface SweepAllParams {
  userId: string;
}

export const usePoolSweep = () => {
  const sweepAndJoinPool = useMutation({
    mutationFn: async ({ poolId, walletId, autoJoin = true }: PoolSweepParams) => {
      const { data, error } = await (supabase as any).functions.invoke('pool-sweep-integration', {
        body: {
          action: 'sweep_and_join_pool',
          poolId,
          walletId,
          autoJoin
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data?.success) {
        const sweep = data.sweep;
        const joined = data.pool_join;
        
        if (joined) {
          toast.success(
            `Pool Joined Successfully!`,
            { 
              description: `Swept ${sweep.amount} ${sweep.currency} and joined pool.` 
            }
          );
        } else {
          toast.success(
            `Sweep Completed`,
            { 
              description: `Swept ${sweep.amount} ${sweep.currency} to pool wallet.` 
            }
          );
        }
      }
    },
    onError: (err: any) => {
      toast.error("Sweep failed: " + (err.message || err));
    }
  });

  const sweepAllForPools = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any).functions.invoke('pool-sweep-integration', {
        body: {
          action: 'sweep_all_for_pools'
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data?.success) {
        const summary = data.summary;
        toast.success(
          `Bulk Sweep Complete`,
          { 
            description: `Successful: ${summary.successful}, Failed: ${summary.failed}` 
          }
        );
      } else {
        toast.info(data?.message || "No wallets to sweep");
      }
    },
    onError: (err: any) => {
      toast.error("Bulk sweep failed: " + (err.message || err));
    }
  });

  const getSweepEligiblePools = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any).functions.invoke('pool-sweep-integration', {
        body: {
          action: 'get_sweep_eligible_pools'
        }
      });

      if (error) throw error;
      return data;
    }
  });

  return {
    sweepAndJoinPool,
    sweepAllForPools,
    getSweepEligiblePools,
  };
};
